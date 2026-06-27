import { writeFile } from 'node:fs/promises';

const endpoint = process.env.MAGENTO_GRAPHQL_URL || 'https://www.sosoftbeds.co.uk/graphql';
const storeOrigin = process.env.MAGENTO_STORE_ORIGIN || 'https://www.sosoftbeds.co.uk';
const pageSize = Number(process.env.MAGENTO_PAGE_SIZE || 10);
const includeStorefrontTabs = process.env.INCLUDE_STOREFRONT_TABS !== '0';

const optionValueFields = `
  uid
  title
  option_type_id
  price
  price_type
  sku
  description
  dependency
  dependency_type
  images_data
  is_default
  disabled
`;

const inputValueFields = `
  uid
  price_type
  price
  sku
  dependency
  dependency_type
`;

const query = `
query GetExpandedProducts($pageSize: Int!, $currentPage: Int!) {
  products(search: "", pageSize: $pageSize, currentPage: $currentPage) {
    total_count
    page_info {
      current_page
      page_size
      total_pages
    }
    items {
      id
      name
      sku
      __typename
      type_id
      url_key
      canonical_url
      meta_title
      meta_description
      rating_summary
      review_count
      ... on SimpleProduct { weight }
      categories {
        uid
        id
        name
        url_key
        url_path
        url_suffix
        level
        breadcrumbs {
          category_id
          category_name
          category_url_key
          category_url_path
        }
      }
      description { html }
      short_description { html }
      price_range { minimum_price { regular_price { value currency } final_price { value currency } } }
      stock_status
      image { label url }
      media_gallery { url label position disabled }
      related_products {
        sku
        name
        url_key
        image { url label }
        price_range { minimum_price { regular_price { value currency } } }
      }
      ... on CustomizableProductInterface {
        options {
          __typename
          title
          required
          sort_order
          option_id
          uid
          qty_input
          one_time
          is_swatch
          is_hidden
          description
          disabled
          selection_limit_from
          selection_limit_to
          ... on CustomizableDropDownOption { dropdown_value: value { ${optionValueFields} } }
          ... on CustomizableRadioOption { radio_value: value { ${optionValueFields} } }
          ... on CustomizableMultipleOption { multiple_value: value { ${optionValueFields} } }
          ... on CustomizableCheckboxOption { checkbox_value: value { ${optionValueFields} } }
          ... on CustomizableFieldOption { field_value: value { max_characters ${inputValueFields} } }
          ... on CustomizableAreaOption { area_value: value { max_characters ${inputValueFields} } }
          ... on CustomizableFileOption { file_value: value { file_extension image_size_x image_size_y ${inputValueFields} } }
          ... on CustomizableDateOption { date_value: value { ${inputValueFields} } }
        }
      }
    }
  }
}
`;

const fetchedAt = new Date().toISOString();
const products = [];
let totalCount = 0;
let totalPages = 1;

for (let currentPage = 1; currentPage <= totalPages; currentPage += 1) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables: { pageSize, currentPage } }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL HTTP ${response.status} on page ${currentPage}: ${await response.text()}`);
  }

  const body = await response.json();

  if (body.errors?.length) {
    throw new Error(`GraphQL errors on page ${currentPage}: ${JSON.stringify(body.errors, null, 2)}`);
  }

  const page = body.data?.products;
  if (!page) {
    throw new Error(`No products payload returned for page ${currentPage}`);
  }

  totalCount = page.total_count || totalCount;
  totalPages = page.page_info?.total_pages || totalPages;

  const pageProducts = await Promise.all((page.items || []).map(async product => {
    const productUrl = getProductUrl(product);
    const storefrontTabs = includeStorefrontTabs ? await fetchStorefrontTabs(productUrl) : [];

    return pruneProduct(product, productUrl, storefrontTabs);
  }));

  products.push(...pageProducts);
  console.log(`Fetched page ${currentPage}/${totalPages}: ${pageProducts.length} products (${products.length}/${totalCount})`);
}

const valueKeys = [
  'dropdown_value',
  'radio_value',
  'multiple_value',
  'checkbox_value',
  'field_value',
  'area_value',
  'file_value',
  'date_value',
];

const optionCount = products.reduce((total, product) => total + (product.options?.length || 0), 0);
const valueCount = products.reduce((total, product) => {
  return total + (product.options || []).reduce((optionTotal, option) => {
    return optionTotal + valueKeys.reduce((valueTotal, key) => valueTotal + (option[key]?.length || 0), 0);
  }, 0);
}, 0);

const cachePayload = {
  data: {
    products: {
      total_count: totalCount,
      page_info: {
        page_size: pageSize,
        total_pages: totalPages,
      },
      items: products,
    },
  },
};

await writeFile('expanded-products-response.json', `${JSON.stringify(cachePayload, null, 2)}\n`);
await writeFile('src/cached-products.js', `export const CACHED_PRODUCTS = ${JSON.stringify(products)};\n`);

const tabCount = products.reduce((total, product) => total + (product.storefront_tabs?.length || 0), 0);

console.log(`Cached ${products.length}/${totalCount} products, ${optionCount} options, ${valueCount} option values, ${tabCount} storefront tabs.`);

function pruneProduct(product, productUrl, storefrontTabs) {
  return compactObject({
    id: product.id,
    name: cleanText(product.name),
    sku: cleanText(product.sku),
    type_id: product.type_id,
    url_key: cleanText(product.url_key),
    canonical_url: cleanText(product.canonical_url),
    meta_title: cleanText(product.meta_title),
    meta_description: cleanText(product.meta_description),
    rating_summary: keepNonZero(product.rating_summary),
    review_count: keepNonZero(product.review_count),
    weight: keepNonZero(product.weight),
    categories: pruneCategories(product.categories),
    description: pruneHtmlBlock(product.description),
    short_description: pruneHtmlBlock(product.short_description),
    price_range: product.price_range,
    stock_status: product.stock_status,
    image: pruneImage(product.image, product.name),
    media_gallery: pruneGallery(product.media_gallery, product.name),
    related_products: pruneRelatedProducts(product.related_products),
    options: pruneOptions(product.options),
    product_page_url: productUrl,
    storefront_tabs: storefrontTabs,
    cache_generated_at: fetchedAt,
  });
}

function pruneCategories(categories) {
  if (!Array.isArray(categories)) return undefined;

  return categories.map(category => compactObject({
    uid: category.uid,
    id: category.id,
    name: cleanText(category.name),
    url_key: cleanText(category.url_key),
    url_path: cleanText(category.url_path),
    url_suffix: category.url_suffix && category.url_suffix !== '/' ? category.url_suffix : undefined,
    level: category.level,
    breadcrumbs: Array.isArray(category.breadcrumbs) ? category.breadcrumbs.map(crumb => compactObject({
      category_id: crumb.category_id,
      category_name: cleanText(crumb.category_name),
      category_url_key: cleanText(crumb.category_url_key),
      category_url_path: cleanText(crumb.category_url_path),
    })) : undefined,
  }));
}

function pruneHtmlBlock(block) {
  if (!block?.html) return undefined;
  return { html: cleanRichHtml(block.html) };
}

function pruneImage(image, productName) {
  if (!image?.url) return undefined;
  return compactObject({
    url: image.url,
    label: cleanImageLabel(image.label, productName),
  });
}

function pruneGallery(gallery, productName) {
  if (!Array.isArray(gallery)) return undefined;

  return gallery
    .filter(image => image?.url)
    .map(image => compactObject({
      url: image.url,
      label: cleanImageLabel(image.label, productName),
      position: keepNonZero(image.position),
      disabled: keepFlag(image.disabled),
    }));
}

function pruneRelatedProducts(products) {
  if (!Array.isArray(products)) return undefined;

  return products.map(product => compactObject({
    sku: cleanText(product.sku),
    name: cleanText(product.name),
    url_key: cleanText(product.url_key),
    image_url: product.image?.url,
    price: product.price_range?.minimum_price?.regular_price?.value,
    currency: product.price_range?.minimum_price?.regular_price?.currency,
  }));
}

function cleanImageLabel(label, productName) {
  const cleanLabel = cleanText(label);
  if (!cleanLabel || cleanLabel === cleanText(productName)) return undefined;
  return cleanLabel;
}

function pruneOptions(options) {
  if (!Array.isArray(options)) return undefined;

  return options.map(option => compactObject({
    __typename: option.__typename,
    title: cleanText(option.title),
    required: Boolean(option.required),
    option_id: option.option_id,
    uid: option.uid,
    qty_input: keepFlag(option.qty_input),
    one_time: keepFlag(option.one_time),
    is_swatch: keepFlag(option.is_swatch),
    is_hidden: keepFlag(option.is_hidden),
    disabled: keepFlag(option.disabled),
    selection_limit_from: keepNonZero(option.selection_limit_from),
    selection_limit_to: keepNonZero(option.selection_limit_to),
    description: cleanOptionDescription(option.description),
    dropdown_value: pruneOptionValues(option.dropdown_value),
    radio_value: pruneOptionValues(option.radio_value),
    multiple_value: pruneOptionValues(option.multiple_value),
    checkbox_value: pruneOptionValues(option.checkbox_value),
    field_value: pruneOptionValues(option.field_value),
    area_value: pruneOptionValues(option.area_value),
    file_value: pruneOptionValues(option.file_value),
    date_value: pruneOptionValues(option.date_value),
  }));
}

function pruneOptionValues(values) {
  if (!Array.isArray(values)) return undefined;

  return values.map(value => {
    const title = cleanText(value.title);
    const sku = cleanText(value.sku);
    const price = Number(value.price) || 0;

    return compactObject({
      uid: value.uid,
      title,
      option_type_id: value.option_type_id,
      sku: sku && sku !== title ? sku : undefined,
      price: price !== 0 ? price : undefined,
      price_type: price !== 0 && value.price_type && value.price_type !== 'FIXED' ? value.price_type : undefined,
      max_characters: keepNonZero(value.max_characters),
      file_extension: cleanText(value.file_extension),
      image_size_x: keepNonZero(value.image_size_x),
      image_size_y: keepNonZero(value.image_size_y),
      description: cleanOptionDescription(value.description),
      depends_on: normalizeDependencies(value.dependency),
      dependency_type: value.dependency_type && value.dependency_type !== '0' ? value.dependency_type : undefined,
      images: normalizeOptionImages(value.images_data),
      is_default: keepFlag(value.is_default),
      disabled: keepFlag(value.disabled),
    });
  });
}

function normalizeDependencies(value) {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed) || parsed.length === 0) return undefined;

  return parsed
    .map(pair => Array.isArray(pair) ? { option_id: Number(pair[0]) || pair[0], value_id: Number(pair[1]) || pair[1] } : null)
    .filter(Boolean);
}

function normalizeOptionImages(value) {
  const images = parseJson(value);
  if (!Array.isArray(images) || images.length === 0) return undefined;

  return images
    .filter(image => image?.value)
    .map(image => compactObject({
      path: image.value,
      url: image.value.startsWith('http') ? image.value : `${storeOrigin}/media/catalog/product${image.value}`,
      title: cleanText(image.title_text),
      sort_order: keepNonZero(image.sort_order),
      base: keepFlag(image.base_image),
      tooltip: keepFlag(image.tooltip_image),
      disabled: keepFlag(image.disabled),
    }));
}

function cleanOptionDescription(value) {
  if (!value) return undefined;

  const parsed = parseJson(value);
  if (Array.isArray(parsed)) {
    const description = parsed.find(item => item?.description)?.description;
    return cleanText(htmlToText(description || ''));
  }

  return cleanText(htmlToText(String(value)));
}

function cleanText(value) {
  if (value === null || value === undefined) return undefined;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text || undefined;
}

function keepFlag(value) {
  return value === true || value === 1 || value === '1' ? true : undefined;
}

function keepNonZero(value) {
  const number = Number(value);
  return Number.isFinite(number) && number !== 0 ? number : undefined;
}

function parseJson(value) {
  if (!value || typeof value !== 'string') return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function compactObject(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => {
      if (value === undefined || value === null || value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    }),
  );
}

function getProductUrl(product) {
  const path = product.canonical_url || product.url_key;
  if (!path) return storeOrigin;
  if (/^https?:\/\//i.test(path)) return path;
  return `${storeOrigin}/${path.replace(/^\/+/, '')}`;
}

async function fetchStorefrontTabs(productUrl) {
  try {
    const response = await fetch(productUrl, {
      headers: {
        'user-agent': 'SosoftBedsProductCache/1.0 (+https://products-api.sosoftbeds.workers.dev/llms.txt)',
      },
    });

    if (!response.ok) {
      console.warn(`Tabs fetch skipped for ${productUrl}: HTTP ${response.status}`);
      return [];
    }

    const html = await response.text();
    return extractStorefrontTabs(html);
  } catch (error) {
    console.warn(`Tabs fetch failed for ${productUrl}: ${error.message}`);
    return [];
  }
}

function extractStorefrontTabs(html) {
  const tabs = [];
  const tokenRegex = /<details\b[^>]*>|<\/details>/gi;
  const stack = [];
  let match;

  while ((match = tokenRegex.exec(html))) {
    const token = match[0];

    if (token.startsWith('</')) {
      const item = stack.pop();
      if (item?.name) {
        const innerHtml = html.slice(item.openEnd, match.index);
        const contentHtml = cleanTabHtml(extractTabContent(innerHtml));
        const text = htmlToText(contentHtml);
        const title = item.name.trim();

        if (text) {
          tabs.push(compactObject({
            id: item.id,
            title,
            html: /^reviews$/i.test(title) ? '' : contentHtml,
            text,
          }));
        }
      }
      continue;
    }

    const name = decodeHtml(getAttribute(token, 'data-name') || '').trim();
    stack.push({
      id: getAttribute(token, 'id') || null,
      name,
      openEnd: tokenRegex.lastIndex,
    });
  }

  return tabs;
}

function extractTabContent(innerHtml) {
  const withoutSummary = innerHtml.replace(/<summary\b[\s\S]*?<\/summary>/i, '');
  const pbMarker = /<div\b[^>]*class="[^"]*\bpb-3\b[^"]*"[^>]*>/i.exec(withoutSummary);
  return pbMarker ? withoutSummary.slice(pbMarker.index + pbMarker[0].length) : withoutSummary;
}

function cleanTabHtml(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, '')
    .replace(/\s+x-[a-zA-Z0-9:_-]+(?:="[^"]*")?/g, '')
    .replace(/\s+@[a-zA-Z0-9:_-]+(?:="[^"]*")?/g, '')
    .replace(/\s+:[a-zA-Z0-9:_-]+(?:="[^"]*")?/g, '')
    .replace(/\s+class="[^"]*"/g, '')
    .replace(/\s+style="[^"]*"/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanRichHtml(html) {
  return cleanTabHtml(html)
    .replace(/<hyva-cache\b[^>]*>/gi, '')
    .replace(/<\/hyva-cache>/gi, '')
    .trim();
}

function getAttribute(tag, attribute) {
  const match = new RegExp(`${attribute}="([^"]*)"`, 'i').exec(tag);
  return match ? match[1] : '';
}

function htmlToText(html) {
  return decodeHtml(html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|table|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim());
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x20;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}