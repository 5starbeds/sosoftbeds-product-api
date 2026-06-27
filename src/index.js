// Cached products data (update by running: npm run cache-products)
import { CACHED_PRODUCTS } from './cached-products.js';
import { CACHED_CONTENT_PAGES } from './cached-content-pages.js';

const STORE_ORIGIN = 'https://www.sosoftbeds.co.uk';
const CANONICAL_API_ORIGIN = 'https://api.sosoftbeds.co.uk';
const BRAND_NAME = 'Sosoft Beds';
const SOURCE_REPOSITORY_URL = 'https://github.com/5starbeds/sosoftbeds-product-api';
const API_VERSION = '1.0';
const GOOGLE_SITE_VERIFICATION_FILENAME = 'googleba3eea9f8143c3f9.html';
const GOOGLE_SITE_VERIFICATION_CONTENT = `google-site-verification: ${GOOGLE_SITE_VERIFICATION_FILENAME}`;
const PRODUCTS_DATA_UPDATED = getLatestCacheDate(CACHED_PRODUCTS);
const CONTENT_DATA_UPDATED = getLatestCacheDate(CACHED_CONTENT_PAGES);
const DATA_UPDATED = [PRODUCTS_DATA_UPDATED, CONTENT_DATA_UPDATED].sort().reverse()[0];

const OPTION_VALUE_KEYS = [
  'dropdown_value',
  'radio_value',
  'multiple_value',
  'checkbox_value',
  'field_value',
  'area_value',
  'file_value',
  'date_value',
];

const KEYWORD_STOP_WORDS = new Set([
  'and',
  'are',
  'for',
  'from',
  'optional',
  'or',
  'sosoft',
  'sosoftbeds',
  'the',
  'to',
  'with',
]);

const ANALYTICS_DISCOVERY_PATHS = new Set([
  '/',
  '/robots.txt',
  '/llms.txt',
  '/openapi.json',
  '/docs',
  '/sitemap.xml',
  '/products-sitemap.xml',
  '/.well-known/ai-plugin.json',
  '/api/products',
  '/api/categories',
  '/api/search',
  '/api/content-pages',
]);

const CRAWLER_USER_AGENT_PATTERNS = [
  { name: 'Google-InspectionTool', pattern: /google-inspectiontool/i },
  { name: 'Googlebot', pattern: /googlebot/i },
  { name: 'Bingbot', pattern: /bingbot/i },
  { name: 'ClaudeBot', pattern: /claudebot|claude-user|anthropic-ai/i },
  { name: 'GPTBot', pattern: /gptbot|chatgpt-user|oai-searchbot/i },
  { name: 'Amazonbot', pattern: /amazonbot/i },
  { name: 'Applebot', pattern: /applebot/i },
  { name: 'Bytespider', pattern: /bytespider/i },
  { name: 'DuckAssistBot', pattern: /duckassistbot|duckduckbot/i },
  { name: 'PerplexityBot', pattern: /perplexitybot/i },
  { name: 'CCBot', pattern: /ccbot/i },
  { name: 'FacebookExternalHit', pattern: /facebookexternalhit/i },
  { name: 'LinkedInBot', pattern: /linkedinbot/i },
  { name: 'Twitterbot', pattern: /twitterbot/i },
  { name: 'SEO crawler', pattern: /semrush|ahrefs|mj12bot|dotbot/i },
  { name: 'Other crawler', pattern: /bot|crawler|spider|slurp/i },
];

const SELECT_OPTION_VALUE_FIELDS = `
  uid
  title
  option_type_id
  price
  price_type
  sku
  sort_order
  mageworx_option_type_price
  mageworx_title
  special_price
  tier_price
  description
  dependency
  dependency_type
  cost
  images_data
  is_default
  qty_multiplier
  weight
  weight_type
  qty
  manage_stock
  disabled
`;

const INPUT_OPTION_VALUE_FIELDS = `
  uid
  price_type
  price
  sku
  mageworx_option_price
  mageworx_title
  dependency
  dependency_type
`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const startedAt = Date.now();

    try {
      const response = await handleApiRequest(request, env, url);
      logApiRequest(request, url, response, startedAt);
      return response;
    } catch (error) {
      console.error(JSON.stringify({
        event: 'api_request_error',
        path: url.pathname,
        method: request.method,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }));

      const response = jsonResponse({ error: 'Internal server error' }, 500);
      logApiRequest(request, url, response, startedAt, { unhandled_error: true });
      return response;
    }
  },
};

async function handleApiRequest(request, env, url) {
    const pathname = url.pathname;
    const acceptHeader = request.headers.get('accept') || '';
    const origin = CANONICAL_API_ORIGIN;

    if (pathname === `/${GOOGLE_SITE_VERIFICATION_FILENAME}`) {
      return textResponse(GOOGLE_SITE_VERIFICATION_CONTENT, 'text/html; charset=utf-8');
    }

    if (pathname === '/robots.txt') {
      return textResponse(formatRobotsTxt(origin), 'text/plain; charset=utf-8');
    }

    if (pathname === '/llms.txt') {
      return textResponse(formatLlmsTxt(origin), 'text/markdown; charset=utf-8');
    }

    if (pathname === '/openapi.json') {
      return jsonResponse(formatOpenApiSpec(origin));
    }

    if (pathname === '/sitemap.xml' || pathname === '/products-sitemap.xml') {
      return textResponse(formatApiSitemap(origin), 'application/xml; charset=utf-8');
    }

    if (pathname === '/.well-known/ai-plugin.json') {
      return jsonResponse(formatAiPluginManifest(origin));
    }

    if (pathname === '/docs') {
      return textResponse(formatDocsHtml(origin), 'text/html; charset=utf-8');
    }

    const priceMatch = pathname.match(/^\/api\/products\/([^/]+)\/price$/);
    if (priceMatch) {
      const slug = decodeURIComponent(priceMatch[1]);
      return handleProductPrice(slug, request);
    }

    if (pathname.startsWith('/api/products/')) {
      const slug = decodeURIComponent(pathname.slice('/api/products/'.length));
      if (!slug) {
        return new Response(JSON.stringify({ error: 'Product slug or SKU required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return handleGetProductBySlug(slug, env, acceptHeader);
    }

    if (pathname.startsWith('/api/categories/')) {
      const slug = decodeURIComponent(pathname.slice('/api/categories/'.length));
      if (!slug) {
        return jsonResponse({ error: 'Category slug required' }, 400);
      }
      return handleGetCategoryBySlug(slug, origin, url.searchParams);
    }

    if (pathname === '/api/categories') {
      return jsonResponse(getCategoryIndex(origin));
    }

    if (pathname === '/api/search') {
      return jsonResponse(handleSearch(url.searchParams, origin));
    }

    if (pathname.startsWith('/api/content-pages/')) {
      const slug = decodeURIComponent(pathname.slice('/api/content-pages/'.length));
      return handleGetContentPage(slug, acceptHeader);
    }

    if (pathname === '/api/content-pages') {
      return jsonResponse({
        message: 'Content Pages API - CMS pages and blog posts',
        usage: '/api/content-pages/blog/post/history-of-beds',
        content_pages: getContentPageSummaries(origin),
      });
    }

    if (pathname === '/api/products') {
      return jsonResponse(getProductsIndex(origin, url.searchParams));
    }

    if (pathname === '/') {
      return jsonResponse({
        status: 200,
        name: 'Sosoft Beds Product API',
        message: 'Sosoft Beds Product API',
        description: 'Machine-readable ecommerce product catalogue.',
        website: STORE_ORIGIN,
        publisher: {
          name: BRAND_NAME,
          website: STORE_ORIGIN,
        },
        canonical: CANONICAL_API_ORIGIN,
        api_version: API_VERSION,
        schema: {
          type: 'OpenAPI',
          version: '3.1',
        },
        default_language: 'en-GB',
        data_updated: DATA_UPDATED,
        data: {
          source: 'Magento',
          last_updated: DATA_UPDATED,
          products_last_updated: PRODUCTS_DATA_UPDATED,
          content_last_updated: CONTENT_DATA_UPDATED,
          cache_type: 'embedded',
        },
        sync: {
          method: 'scheduled',
          frequency: 'nightly plus weekly Sunday 04:00',
          timezone: 'UTC',
          schedule: [
            {
              type: 'nightly',
              cron: '0 2 * * *',
            },
            {
              type: 'weekly_full_refresh',
              cron: '0 4 * * 0',
            },
          ],
        },
        capabilities: [
          'product discovery',
          'natural language search',
          'product comparison',
          'pricing lookup',
          'category browsing',
          'content retrieval',
        ],
        entities: [
          'Product',
          'Category',
          'ContentPage',
          'Price',
          'Variant',
        ],
        formats: [
          'application/json',
          'OpenAPI 3.1',
          'Markdown',
          'XML sitemap',
        ],
        examples: {
          product_search: `${origin}/api/search?q=king+size+ottoman+bed`,
          product_lookup: `${origin}/api/products/Giovani-Bed`,
        },
        rate_limit: {
          policy: 'reasonable automated usage',
        },
        catalogue_stats: getCatalogueStats(origin),
        source: SOURCE_REPOSITORY_URL,
        api_base: `${origin}/api/`,
        resources: {
          llm_guide: `${origin}/llms.txt`,
          openapi: `${origin}/openapi.json`,
          docs: `${origin}/docs`,
          sitemap: `${origin}/products-sitemap.xml`,
          robots: `${origin}/robots.txt`,
          products: `${origin}/api/products`,
          categories: `${origin}/api/categories`,
          content: `${origin}/api/content-pages`,
          search: `${origin}/api/search?q=`,
        },
        endpoints: [
          `${origin}/api/products`,
          `${origin}/api/products/{slug}`,
          `${origin}/api/categories`,
          `${origin}/api/search?q=ottoman`,
          `${origin}/api/content-pages`,
          `${origin}/api/content-pages/{slug}`,
          `${origin}/docs`,
        ],
        authentication: {
          required: false,
          type: 'public',
        },
      });
    }

    return jsonResponse({ error: 'Not found' }, 404);
}

function getLatestCacheDate(items) {
  const timestamps = items
    .map(item => item?.cache_generated_at)
    .filter(Boolean)
    .sort()
    .reverse();
  return timestamps[0]?.slice(0, 10) || '2026-06-27';
}

function logApiRequest(request, url, response, startedAt, extra = {}) {
  const userAgent = request.headers.get('user-agent') || '';
  const path = url.pathname;
  const crawlerName = identifyCrawler(userAgent);
  const likelyCrawler = Boolean(crawlerName || request.cf?.verifiedBotCategory);

  if (!shouldLogApiAnalytics(path, likelyCrawler)) return;

  console.log(JSON.stringify({
    event: 'api_request',
    endpoint: normalizeAnalyticsEndpoint(path),
    path,
    search: url.search || undefined,
    method: request.method,
    status: response.status,
    duration_ms: Date.now() - startedAt,
    content_type: response.headers.get('content-type')?.split(';')[0] || undefined,
    user_agent: userAgent.slice(0, 300),
    crawler: crawlerName || undefined,
    likely_crawler: likelyCrawler,
    verified_bot_category: request.cf?.verifiedBotCategory || undefined,
    country: request.cf?.country || undefined,
    cache_control: response.headers.get('cache-control') || undefined,
    timestamp: new Date().toISOString(),
    ...extra,
  }));
}

function shouldLogApiAnalytics(path, likelyCrawler) {
  return likelyCrawler || ANALYTICS_DISCOVERY_PATHS.has(path) || path.startsWith('/api/');
}

function identifyCrawler(userAgent) {
  return CRAWLER_USER_AGENT_PATTERNS.find(({ pattern }) => pattern.test(userAgent))?.name;
}

function normalizeAnalyticsEndpoint(path) {
  if (/^\/api\/products\/[^/]+\/price$/.test(path)) return '/api/products/{slug}/price';
  if (/^\/api\/products\/[^/]+$/.test(path)) return '/api/products/{slug}';
  if (/^\/api\/categories\/[^/]+$/.test(path)) return '/api/categories/{slug}';
  if (/^\/api\/content-pages\/.+/.test(path)) return '/api/content-pages/{slug}';
  return path;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

function textResponse(text, contentType, status = 200) {
  return new Response(text, {
    status,
    headers: {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

async function handleGetProductBySlug(slug, env, acceptHeader) {
  try {
    const product = await fetchProductBySlug(slug, env);

    if (!product) {
      return new Response(JSON.stringify({ error: 'Product not found', slug }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (acceptHeader.includes('text/markdown')) {
      const markdown = formatProductMarkdown(product);
      return new Response(markdown, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'x-markdown-tokens': Math.ceil(markdown.length / 4),
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Default: return JSON
    return new Response(JSON.stringify(product, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function handleProductPrice(slug, request) {
  const product = await fetchProductBySlug(slug);

  if (!product) {
    return jsonResponse({ error: 'Product not found', slug }, 404);
  }

  const selectedValues = await readSelectedOptionValues(request);
  const calculation = calculateConfiguredProductPrice(product, selectedValues);

  return jsonResponse(calculation);
}

async function readSelectedOptionValues(request) {
  const url = new URL(request.url);
  const values = [];
  const queryValues = url.searchParams.get('values') || url.searchParams.get('value_ids') || url.searchParams.get('option_value_ids');

  if (queryValues) {
    values.push(...queryValues.split(',').map(value => ({ value_id: value.trim() })).filter(value => value.value_id));
  }

  if (request.method !== 'GET' && request.headers.get('content-type')?.includes('application/json')) {
    try {
      const body = await request.json();
      if (Array.isArray(body.selected_options)) values.push(...body.selected_options);
      if (Array.isArray(body.selected_value_ids)) values.push(...body.selected_value_ids.map(value => ({ value_id: value })));
      if (Array.isArray(body.values)) values.push(...body.values.map(value => typeof value === 'object' ? value : { value_id: value }));
    } catch (error) {
      values.push({ warning: 'Invalid JSON body ignored' });
    }
  }

  return values;
}

function calculateConfiguredProductPrice(product, selectedValues) {
  const basePrice = Number(product.sale_price ?? product.price ?? 0);
  const selections = normalizeSelectedOptionInputs(selectedValues);
  const selectedAdjustments = [];
  const warnings = selectedValues.filter(value => value.warning).map(value => value.warning);
  const matchedSelectionKeys = new Set();

  (product.custom_options || []).forEach(option => {
    getOptionValues(option).forEach(value => {
      const matchedKeys = getMatchingSelectionKeys(option, value, selections);
      if (matchedKeys.length === 0) return;

      matchedKeys.forEach(key => matchedSelectionKeys.add(key));
      const rawPrice = Number(value.price || 0);
      const priceType = String(value.price_type || '').toUpperCase();
      const priceAdjustment = priceType === 'PERCENT' ? basePrice * rawPrice / 100 : rawPrice;

      selectedAdjustments.push(compactApiObject({
        option_id: option.option_id,
        option_uid: option.uid,
        option_title: option.title,
        value_id: value.option_type_id,
        value_uid: value.uid,
        value_title: value.title,
        price_type: value.price_type,
        price: rawPrice,
        price_adjustment: roundMoney(priceAdjustment),
      }));
    });
  });

  selections.forEach(selection => {
    if (!matchedSelectionKeys.has(selection.key)) {
      warnings.push(`No matching custom option value found for ${selection.label}`);
    }
  });

  const missing_required_options = (product.custom_options || [])
    .filter(option => option.required)
    .filter(option => !selectedAdjustments.some(adjustment => adjustment.option_id === option.option_id || adjustment.option_uid === option.uid))
    .map(option => compactApiObject({ option_id: option.option_id, option_uid: option.uid, title: option.title }));

  const optionsTotal = selectedAdjustments.reduce((total, adjustment) => total + Number(adjustment.price_adjustment || 0), 0);

  return compactApiObject({
    message: 'Configured product price',
    sku: product.sku,
    slug: product.url_key || product.sku,
    name: product.name,
    currency: product.currency || 'GBP',
    base_price: roundMoney(basePrice),
    selected_options_total: roundMoney(optionsTotal),
    final_price: roundMoney(basePrice + optionsTotal),
    selected_options: selectedAdjustments,
    missing_required_options,
    warnings,
  });
}

function normalizeSelectedOptionInputs(selectedValues) {
  return selectedValues
    .filter(value => value && !value.warning)
    .map((value, index) => {
      const optionId = value.option_id ?? value.optionId;
      const valueId = value.value_id ?? value.valueId ?? value.option_type_id ?? value.optionTypeId;
      const optionUid = value.option_uid ?? value.optionUid;
      const valueUid = value.value_uid ?? value.valueUid ?? value.uid;
      const title = value.title ?? value.value_title ?? value.valueTitle;

      return compactApiObject({
        key: `selection-${index}`,
        option_id: optionId !== undefined ? String(optionId) : undefined,
        value_id: valueId !== undefined ? String(valueId) : undefined,
        option_uid: optionUid !== undefined ? String(optionUid) : undefined,
        value_uid: valueUid !== undefined ? String(valueUid) : undefined,
        title: title !== undefined ? String(title).toLowerCase() : undefined,
        label: valueId ?? valueUid ?? title ?? JSON.stringify(value),
      });
    });
}

function getMatchingSelectionKeys(option, value, selections) {
  return selections
    .filter(selection => {
      const optionMatches = !selection.option_id && !selection.option_uid
        || String(option.option_id) === selection.option_id
        || String(option.uid) === selection.option_uid;
      const valueMatches = String(value.option_type_id) === selection.value_id
        || String(value.uid) === selection.value_uid
        || String(value.title || '').toLowerCase() === selection.title;
      return optionMatches && valueMatches;
    })
    .map(selection => selection.key);
}

function roundMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function getProductsIndex(origin, searchParams) {
  const products = getProductSummaries(origin);
  const pagination = getPagination(searchParams, products.length);

  return {
    message: 'Products index',
    total: products.length,
    page: pagination.page,
    page_size: pagination.pageSize,
    total_pages: pagination.totalPages,
    next_page: pagination.page < pagination.totalPages ? `${origin}/api/products?page=${pagination.page + 1}&pageSize=${pagination.pageSize}` : undefined,
    previous_page: pagination.page > 1 ? `${origin}/api/products?page=${pagination.page - 1}&pageSize=${pagination.pageSize}` : undefined,
    products: products.slice(pagination.start, pagination.end),
  };
}

function getPagination(searchParams, total) {
  const page = clampNumber(Number(searchParams.get('page') || 1), 1, Math.max(1, Math.ceil(total / 1)));
  const pageSize = clampNumber(Number(searchParams.get('pageSize') || searchParams.get('limit') || 50), 1, 100);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const normalizedPage = Math.min(page, totalPages);

  return {
    page: normalizedPage,
    pageSize,
    totalPages,
    start: (normalizedPage - 1) * pageSize,
    end: normalizedPage * pageSize,
  };
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function handleGetContentPage(slug, acceptHeader) {
  const page = getContentPageBySlug(slug);

  if (!page) {
    return jsonResponse({ error: 'Content page not found', slug }, 404);
  }

  if (acceptHeader.includes('text/markdown')) {
    const markdown = formatContentPageMarkdown(page);
    return textResponse(markdown, 'text/markdown; charset=utf-8');
  }

  return jsonResponse(page);
}

function getContentPageBySlug(slug) {
  const normalized = slug.replace(/^\/+|\/+$/g, '');
  return CACHED_CONTENT_PAGES.find(page => page.slug === normalized || page.slug.replace(/\/$/, '') === normalized);
}

function getContentPageSummaries(origin) {
  return CACHED_CONTENT_PAGES.map(page => ({
    type: page.type,
    slug: page.slug,
    title: page.title,
    h1: page.h1,
    canonical_url: page.canonical_url,
    api_url: `${origin}/api/content-pages/${encodeURI(page.slug)}`,
    markdown_url: `${origin}/api/content-pages/${encodeURI(page.slug)}`,
    word_count: page.word_count,
    heading_count: page.headings?.length || 0,
    link_count: page.links?.length || 0,
    last_updated: page.cache_generated_at,
  }));
}

function formatContentPageMarkdown(page) {
  let md = `# ${page.h1 || page.title}\n\n`;
  md += `**Type:** ${page.type}  \n`;
  md += `**URL:** ${page.canonical_url || page.url}  \n`;
  md += `**Words:** ${page.word_count}\n\n`;

  if (page.meta_description) {
    md += `## Meta Description\n\n${page.meta_description}\n\n`;
  }

  if (page.headings?.length) {
    md += `## Headings\n\n`;
    page.headings.forEach(heading => {
      md += `${'  '.repeat(Math.max(0, heading.level - 1))}- H${heading.level}: ${heading.text}\n`;
    });
    md += '\n';
  }

  md += `## Content\n\n${page.text || 'No text available'}\n\n`;

  if (page.links?.length) {
    md += `## Links\n\n`;
    page.links.forEach(link => {
      md += `- [${link.text}](${link.url})\n`;
    });
    md += '\n';
  }

  md += `---\n\n**Generated:** ${new Date().toISOString()}  \n**Store:** www.sosoftbeds.co.uk\n`;

  return md;
}

async function fetchProductBySlug(slug) {
  const normalized = normalizeLookupValue(slug);

  if (CACHED_PRODUCTS.length > 0) {
    const product = CACHED_PRODUCTS.find(product => {
      return normalizeLookupValue(product.sku) === normalized
        || normalizeLookupValue(product.url_key) === normalized
        || normalizeLookupValue(product.canonical_url?.replace(STORE_ORIGIN, '').replace(/^\/+|\/+$/g, '')) === normalized;
    });

    if (product) {
      return formatProductData(product);
    }
  }

  return null;
}

function normalizeLookupValue(value) {
  return decodeURIComponent(String(value || ''))
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
}

async function fetchProductBySkuGraphQL(sku, env) {
  const magentoDomain = env.MAGENTO_DOMAIN || 'www.sosoftbeds.co.uk';
  const graphqlUrl = `https://${magentoDomain}/graphql`;

  const query = {
    query: `query GetProduct($sku: String!) {
      products(filter: {sku: {eq: $sku}}) {
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
          special_price
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
          dependency_rules
          hidden_dependents
          absolute_price
          absolute_cost
          absolute_weight
          sku_policy
          shareable_link
          hide_additional_product_price
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
              div_class
              one_time
              is_swatch
              is_hidden
              mageworx_option_gallery
              mageworx_option_image_mode
              description
              sku_policy
              is_all_customer_groups
              is_all_store_views
              customer_group
              store_view
              disabled
              disabled_by_values
              selection_limit_from
              selection_limit_to
              ... on CustomizableDropDownOption { dropdown_value: value { ${SELECT_OPTION_VALUE_FIELDS} } }
              ... on CustomizableRadioOption { radio_value: value { ${SELECT_OPTION_VALUE_FIELDS} } }
              ... on CustomizableMultipleOption { multiple_value: value { ${SELECT_OPTION_VALUE_FIELDS} } }
              ... on CustomizableCheckboxOption { checkbox_value: value { ${SELECT_OPTION_VALUE_FIELDS} } }
              ... on CustomizableFieldOption { field_value: value { max_characters ${INPUT_OPTION_VALUE_FIELDS} } }
              ... on CustomizableAreaOption { area_value: value { max_characters ${INPUT_OPTION_VALUE_FIELDS} } }
              ... on CustomizableFileOption { file_value: value { file_extension image_size_x image_size_y ${INPUT_OPTION_VALUE_FIELDS} } }
              ... on CustomizableDateOption { date_value: value { ${INPUT_OPTION_VALUE_FIELDS} } }
            }
          }
        }
      }
    }`,
    variables: { sku },
  };

  try {
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      console.error('GraphQL HTTP Error:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.errors) {
      console.error('GraphQL Errors:', data.errors);
      return null;
    }

    const product = data.data?.products?.items?.[0];
    return product ? formatProductData(product) : null;
  } catch (error) {
    console.error('GraphQL Fetch Error:', error.message);
    return null;
  }
}

function formatProductData(product) {
  const cleanDescription = (html) => {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
  };

  const categories = normalizeCategories(product.categories);
  const galleryImages = normalizeGalleryImages(product);
  const tabs = normalizeStorefrontTabs(product.storefront_tabs);
  const canonicalUrl = getCanonicalUrl(product);
  const price = product.price_range?.minimum_price?.regular_price?.value || 0;
  const salePrice = product.price_range?.minimum_price?.final_price?.value ?? product.special_price;
  const currency = product.price_range?.minimum_price?.regular_price?.currency || product.price_range?.minimum_price?.final_price?.currency || 'GBP';
  const productType = inferProductType(product, categories);
  const keywords = buildProductKeywords(product, categories, productType);

  const data = {
    id: product.id,
    sku: product.sku,
    name: product.name,
    brand: BRAND_NAME,
    type_id: product.type_id,
    product_type: productType,
    url_key: product.url_key,
    canonical_url: canonicalUrl,
    meta_title: product.meta_title || product.name,
    meta_description: product.meta_description || '',
    categories,
    breadcrumbs: buildBreadcrumbs(categories),
    description: cleanDescription(product.description?.html),
    short_description: cleanDescription(product.short_description?.html),
    price,
    sale_price: salePrice !== undefined && salePrice !== price ? salePrice : undefined,
    currency,
    in_stock: product.stock_status === 'IN_STOCK',
    availability: product.stock_status === 'IN_STOCK' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    stock_status: product.stock_status,
    weight: product.weight,
    rating_summary: product.rating_summary ?? 0,
    review_count: product.review_count ?? 0,
    image_url: product.image?.url,
    image_gallery: galleryImages,
    images: galleryImages.map(image => image.url),
    related_products: normalizeRelatedProducts(product.related_products),
    keywords,
    tabs,
    tab_names: tabs.map(tab => tab.title),
    product_url: canonicalUrl,
    last_updated: product.cache_generated_at || PRODUCTS_DATA_UPDATED,
  };

  // Add custom options if available from GraphQL response
  if (product.options && product.options.length > 0) {
    data.custom_options = product.options;
  }

  data.variants = data.custom_options || [];
  data.sizes = extractOptionGroup(data.custom_options, /size/i);
  data.fabric_options = extractOptionGroup(data.custom_options, /fabric/i);
  data.colours = extractOptionGroup(data.custom_options, /(colour|color|fabric)/i);
  data.dimensions = extractDimensionHints(data);
  data.more_information = getTabText(data.tabs, /^more information$/i);
  data.dimensions_tab = getTabText(data.tabs, /^dimensions$/i);
  data.assembly_instructions = getTabText(data.tabs, /^assembly instructions$/i);
  data.specification = getTabText(data.tabs, /^specification$/i);
  data.reviews_tab = getTabText(data.tabs, /^reviews$/i);
  data.faq_tab = getTabText(data.tabs, /^faq$/i);
  data.delivery_time = extractDeliveryHint(data);
  data.faqs = buildFaqs(data);
  data.semantic = buildSemanticFields(data);
  data.json_ld = buildProductJsonLd(data, product.storefront_product_json_ld);

  return compactApiObject(data);
}

function compactApiObject(value) {
  if (Array.isArray(value)) {
    return value
      .map(item => compactApiObject(item))
      .filter(item => item !== undefined && !(Array.isArray(item) && item.length === 0) && !(isPlainObject(item) && Object.keys(item).length === 0));
  }

  if (!isPlainObject(value)) {
    if (value === null || value === undefined || value === '') return undefined;
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, compactApiObject(item)])
      .filter(([, item]) => item !== undefined && !(Array.isArray(item) && item.length === 0) && !(isPlainObject(item) && Object.keys(item).length === 0)),
  );
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getCanonicalUrl(product) {
  const path = product.canonical_url || product.url_key;
  if (!path) return STORE_ORIGIN;
  if (/^https?:\/\//i.test(path)) return path;
  return `${STORE_ORIGIN}/${path.replace(/^\/+/, '')}`;
}

function getProductSummaries(origin) {
  return CACHED_PRODUCTS.map((product, sourceOrder) => buildProductSummary(product, origin, sourceOrder))
    .sort(compareProductSummaries)
    .map(({ source_order, ...summary }) => summary);
}

function buildProductSummary(product, origin, sourceOrder) {
  const categories = normalizeCategories(product.categories);
  const slug = getProductSlug(product);
  const price = product.price_range?.minimum_price?.regular_price?.value || 0;
  const salePrice = product.price_range?.minimum_price?.final_price?.value ?? product.special_price;
  const currency = product.price_range?.minimum_price?.regular_price?.currency || product.price_range?.minimum_price?.final_price?.currency || 'GBP';
  const gallery = Array.isArray(product.media_gallery) ? product.media_gallery.filter(image => image?.url && !image.disabled) : [];
  const tabNames = Array.isArray(product.storefront_tabs)
    ? product.storefront_tabs.filter(tab => tab?.title && (tab.text || tab.html)).map(tab => tab.title.trim())
    : [];

  return compactApiObject({
    sku: product.sku,
    slug,
    name: product.name,
    brand: BRAND_NAME,
    price,
    sale_price: salePrice !== undefined && salePrice !== price ? salePrice : undefined,
    currency,
    availability: product.stock_status,
    canonical_url: getCanonicalUrl(product),
    api_url: `${origin}/api/products/${encodeURIComponent(slug)}`,
    markdown_url: `${origin}/api/products/${encodeURIComponent(slug)}`,
    categories: categories.map(category => category.name),
    image_count: gallery.length || (product.image?.url ? 1 : 0),
    option_group_count: product.options?.length || 0,
    tab_count: tabNames.length,
    tab_names: tabNames,
    related_product_count: product.related_products?.length || 0,
    last_updated: product.cache_generated_at,
    sort_group: getProductSortGroup({ ...product, categories }),
    source_order: sourceOrder,
  });
}

function getProductSlug(product) {
  return product.url_key || product.sku;
}

function getCategoryIndex(origin) {
  const categories = getCategoryRecords(origin)
    .map(category => compactApiObject({
      id: category.id,
      uid: category.uid,
      name: category.name,
      slug: category.slug,
      url: category.url,
      canonical_url: category.canonical_url,
      api_url: category.api_url,
      level: category.level,
      parent_category: category.parent_category,
      product_count: category.product_count,
      last_updated: category.last_updated,
    }))
    .sort(compareCategorySummaries);

  return {
    message: 'Categories index',
    total: categories.length,
    categories,
  };
}

function handleGetCategoryBySlug(slug, origin, searchParams) {
  const categories = getCategoryRecords(origin);
  const category = findCategoryRecord(categories, slug);

  if (!category) {
    return jsonResponse({ error: 'Category not found', slug }, 404);
  }

  const pagination = getPagination(searchParams, category.products.length);
  const products = category.products.slice(pagination.start, pagination.end);
  const baseUrl = `${origin}/api/categories/${encodeURIComponent(category.slug)}`;

  return jsonResponse(compactApiObject({
    message: 'Category detail',
    id: category.id,
    uid: category.uid,
    name: category.name,
    slug: category.slug,
    url: category.url,
    canonical_url: category.canonical_url,
    api_url: category.api_url,
    level: category.level,
    breadcrumbs: category.breadcrumbs,
    parent_category: category.parent_category,
    child_categories: category.child_categories,
    product_count: category.product_count,
    page: pagination.page,
    page_size: pagination.pageSize,
    total_pages: pagination.totalPages,
    next_page: pagination.page < pagination.totalPages ? `${baseUrl}?page=${pagination.page + 1}&pageSize=${pagination.pageSize}` : undefined,
    previous_page: pagination.page > 1 ? `${baseUrl}?page=${pagination.page - 1}&pageSize=${pagination.pageSize}` : undefined,
    products,
    last_updated: category.last_updated,
    seo: category.seo,
    featured_image: category.featured_image,
  }));
}

function getCategoryRecords(origin) {
  const productSummaries = new Map(getProductSummaries(origin).map(product => [product.sku, product]));
  const categoryMap = new Map();

  CACHED_PRODUCTS.forEach(product => {
    const categories = normalizeCategories(product.categories);
    const slug = getProductSlug(product);
    const productSummary = productSummaries.get(product.sku) || compactApiObject({
      sku: product.sku,
      slug,
      name: product.name,
      api_url: `${origin}/api/products/${encodeURIComponent(slug)}`,
    });

    categories.forEach(category => {
      const key = category.url_path || category.url_key || String(category.id);
      const existing = categoryMap.get(key) || {
        id: category.id,
        uid: category.uid,
        name: category.name,
        slug: category.url_path || category.url_key,
        url: category.url,
        canonical_url: category.url,
        api_url: `${origin}/api/categories/${encodeURIComponent(category.url_path || category.url_key || String(category.id))}`,
        level: category.level,
        breadcrumbs: normalizeCategoryBreadcrumbs(category, origin),
        product_count: 0,
        products: [],
        last_updated_values: [],
        featured_image: undefined,
      };

      existing.product_count += 1;
      existing.products.push(productSummary);
      if (product.cache_generated_at) existing.last_updated_values.push(product.cache_generated_at);
      existing.featured_image ||= getCategoryFeaturedImage(product);
      categoryMap.set(key, existing);
    });
  });

  const categories = [...categoryMap.values()];
  const categoryBySlug = new Map(categories.map(category => [category.slug, category]));

  categories.forEach(category => {
    const parentSlug = getParentCategorySlug(category.slug);
    const parent = parentSlug ? categoryBySlug.get(parentSlug) : undefined;

    category.parent_category = parent ? compactApiObject({
      id: parent.id,
      name: parent.name,
      slug: parent.slug,
      url: parent.url,
      api_url: parent.api_url,
    }) : getBreadcrumbParent(category.breadcrumbs);

    category.child_categories = categories
      .filter(candidate => getParentCategorySlug(candidate.slug) === category.slug)
      .map(child => compactApiObject({
        id: child.id,
        name: child.name,
        slug: child.slug,
        url: child.url,
        api_url: child.api_url,
        product_count: child.product_count,
      }))
      .sort(compareCategorySummaries);

    category.products = category.products.sort(compareCategoryProducts);
    category.last_updated = category.last_updated_values.sort().reverse()[0]?.slice(0, 10) || DATA_UPDATED;
    category.seo = compactApiObject({
      title: `${category.name} | ${BRAND_NAME}`,
      meta_description: `Browse ${category.product_count} ${category.name} product${category.product_count === 1 ? '' : 's'} from ${BRAND_NAME}.`,
    });
    delete category.last_updated_values;
  });

  return categories;
}

function compareCategoryProducts(left, right) {
  return (left.sort_group?.rank || 50) - (right.sort_group?.rank || 50)
    || left.name.localeCompare(right.name);
}

function findCategoryRecord(categories, slug) {
  const normalized = normalizeLookupValue(slug);
  return categories.find(category => normalizeLookupValue(category.slug) === normalized)
    || categories.find(category => normalizeLookupValue(category.name) === normalized)
    || categories.find(category => normalizeLookupValue(String(category.id)) === normalized)
    || categories
      .filter(category => normalizeLookupValue(category.slug).endsWith(`/${normalized}`))
      .sort((left, right) => right.product_count - left.product_count)[0];
}

function normalizeCategoryBreadcrumbs(category, origin) {
  if (!Array.isArray(category.breadcrumbs)) return [];

  return category.breadcrumbs.map(crumb => compactApiObject({
    id: crumb.category_id,
    name: crumb.category_name,
    slug: crumb.category_url_path || crumb.category_url_key,
    url: crumb.category_url_path ? `${STORE_ORIGIN}/${crumb.category_url_path}` : undefined,
    api_url: crumb.category_url_path || crumb.category_url_key ? `${origin}/api/categories/${encodeURIComponent(crumb.category_url_path || crumb.category_url_key)}` : undefined,
  }));
}

function getBreadcrumbParent(breadcrumbs) {
  const parent = Array.isArray(breadcrumbs) ? breadcrumbs[breadcrumbs.length - 1] : undefined;
  return parent ? compactApiObject(parent) : undefined;
}

function getParentCategorySlug(slug) {
  const parts = String(slug || '').split('/').filter(Boolean);
  if (parts.length <= 1) return undefined;
  return parts.slice(0, -1).join('/');
}

function getCategoryFeaturedImage(product) {
  const image = Array.isArray(product.media_gallery)
    ? product.media_gallery.find(item => item?.url && !item.disabled)
    : product.image;

  if (!image?.url) return undefined;

  return compactApiObject({
    url: image.url,
    label: image.label || product.name,
    source_product: product.name,
    source_product_slug: getProductSlug(product),
  });
}

function getCatalogueStats(origin) {
  return {
    products: CACHED_PRODUCTS.length,
    categories: getCategoryIndex(origin).total,
    content_pages: CACHED_CONTENT_PAGES.length,
    last_sync: DATA_UPDATED,
  };
}

function compareCategorySummaries(left, right) {
  return getCategorySortRank(left) - getCategorySortRank(right)
    || (left.level || 0) - (right.level || 0)
    || left.name.localeCompare(right.name);
}

function getCategorySortRank(category) {
  return /order\s+swatches/i.test(`${category.name} ${category.slug}`) ? 90 : 10;
}

function handleSearch(searchParams, origin) {
  const query = String(searchParams.get('q') || '').trim();
  const limit = clampNumber(Number(searchParams.get('limit') || 20), 1, 50);
  const intent = parseSearchIntent(query);

  if (!query) {
    return {
      message: 'Search products, CMS pages, and blog posts',
      usage: '/api/search?q=king+size+ottoman+beds+under+500',
      query: '',
      intent,
      total: 0,
      products: [],
      content_pages: [],
    };
  }

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const productsBySku = new Map(CACHED_PRODUCTS.map(product => [product.sku, product]));
  const productResults = getProductSummaries(origin)
    .map(product => ({ item: product, score: scoreProductSearch(terms, product, productsBySku.get(product.sku), intent) }))
    .filter(result => result.score > 0)
    .sort((left, right) => right.score - left.score || left.item.sort_group.rank - right.item.sort_group.rank)
    .slice(0, limit)
    .map(result => ({ ...result.item, score: result.score }));

  const contentLimit = intent.max_price || intent.min_price ? 0 : limit;
  const contentResults = contentLimit === 0 ? [] : getContentPageSummaries(origin)
    .map(page => {
      const source = CACHED_CONTENT_PAGES.find(contentPage => contentPage.slug === page.slug);
      return { item: page, score: scoreSearchText(terms, `${page.title} ${page.slug} ${page.h1} ${page.type} ${source?.text || ''}`) };
    })
    .filter(result => result.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, contentLimit)
    .map(result => ({ ...result.item, score: result.score }));

  return {
    message: 'Search results',
    query,
    intent,
    total: productResults.length + contentResults.length,
    products: productResults,
    content_pages: contentResults,
  };
}

function parseSearchIntent(query) {
  const text = String(query || '').toLowerCase();
  const maxPrice = matchNumber(text, /(?:under|below|less than|up to|max(?:imum)?|<=)\s*£?\s*(\d+(?:\.\d+)?)/)
    ?? matchNumber(text, /£\s*(\d+(?:\.\d+)?)\s*(?:or less|and under|and below)/);
  const minPrice = matchNumber(text, /(?:over|above|more than|min(?:imum)?|>=)\s*£?\s*(\d+(?:\.\d+)?)/)
    ?? matchNumber(text, /£\s*(\d+(?:\.\d+)?)\s*(?:or more|and above)/);
  const sizeTerms = [
    ['super king', /\b(super\s*king|6ft)\b/],
    ['king size', /\b(king\s*size|kingsize|5ft)\b/],
    ['double', /\b(double|4ft6|4ft\s*6)\b/],
    ['small double', /\b(small\s*double|4ft)\b/],
    ['single', /\b(single|3ft)\b/],
    ['small single', /\b(small\s*single|2ft6|2ft\s*6)\b/],
  ].filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
  const productTerms = ['ottoman', 'adjustable', 'divan', 'sleigh', 'wingback', 'headboard', 'mattress', 'swatch', 'swatches']
    .filter(term => text.includes(term));

  return compactApiObject({
    max_price: maxPrice,
    min_price: minPrice,
    size_terms: [...new Set(sizeTerms)],
    product_terms: [...new Set(productTerms)],
  });
}

function matchNumber(text, pattern) {
  const match = text.match(pattern);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function scoreProductSearch(terms, summary, sourceProduct, intent) {
  const price = Number(summary.sale_price ?? summary.price);
  if (Number.isFinite(intent.max_price) && Number.isFinite(price) && price > intent.max_price) return 0;
  if (Number.isFinite(intent.min_price) && Number.isFinite(price) && price < intent.min_price) return 0;

  const searchableText = buildProductSearchText(summary, sourceProduct);
  let score = scoreSearchText(terms, searchableText);

  if (Number.isFinite(intent.max_price) || Number.isFinite(intent.min_price)) score += 4;
  (intent.size_terms || []).forEach(sizeTerm => {
    if (searchableText.includes(sizeTerm) || searchableText.includes(sizeTerm.replace(/\s+/g, ''))) score += 5;
  });
  (intent.product_terms || []).forEach(productTerm => {
    if (searchableText.includes(productTerm)) score += 4;
  });

  if (/\bbed(?:s)?\b/.test(searchableText) && terms.some(term => /^beds?$/.test(term))) score += 3;
  if (summary.sort_group?.name === 'bed_products') score += 1;

  return score;
}

function buildProductSearchText(summary, product) {
  const optionText = Array.isArray(product?.options)
    ? product.options.flatMap(option => [
      option.title,
      option.description,
      ...getOptionValues(option).flatMap(value => [value.title, value.description, value.sku]),
    ])
    : [];
  const categoryText = Array.isArray(product?.categories)
    ? product.categories.flatMap(category => [category.name, category.url_key, category.url_path])
    : [];

  return [
    summary.name,
    summary.sku,
    summary.slug,
    summary.brand,
    ...(summary.categories || []),
    product?.meta_title,
    product?.meta_description,
    product?.description?.html,
    product?.short_description?.html,
    ...categoryText,
    ...optionText,
  ].filter(Boolean).join(' ').toLowerCase();
}

function scoreSearchText(terms, text) {
  const haystack = String(text || '').toLowerCase();
  return terms.reduce((score, term) => {
    if (!haystack.includes(term)) return score;
    const exactMatches = haystack.match(new RegExp(`\\b${escapeRegExp(term)}\\b`, 'g'))?.length || 0;
    return score + 1 + exactMatches;
  }, 0);
}

function compareProductSummaries(left, right) {
  return left.sort_group.rank - right.sort_group.rank || left.source_order - right.source_order;
}

function getProductSortGroup(product) {
  const categoryNames = (product.categories || []).map(category => category.name || category).join(' ');
  const text = `${product.sku} ${product.name} ${product.url_key} ${categoryNames}`.toLowerCase();

  if (/\border\s+swatches\b/i.test(categoryNames) || /^\./.test(product.sku || '') || /\bswatch(?:es)?\b/.test(text)) {
    return { rank: 90, name: 'order_swatches' };
  }

  if (/\b(removal|service|delivery|shipping|warranty)\b/.test(text)) {
    return { rank: 70, name: 'services' };
  }

  if (/\b(bed|beds|ottoman|divan|headboard|adjustable|wingback|sleigh)\b/.test(text)) {
    return { rank: 10, name: 'bed_products' };
  }

  if (/\b(mattress|mattresses)\b/.test(text)) {
    return { rank: 20, name: 'mattresses' };
  }

  return { rank: 50, name: 'other_products' };
}

function formatRobotsTxt(origin) {
  return `User-agent: *
Allow: /

Sitemap: ${origin}/products-sitemap.xml
`;
}

function formatLlmsTxt(origin) {
  const products = getProductSummaries(origin);
  const contentPages = getContentPageSummaries(origin);
  const categories = getCategoryIndex(origin).categories;
  const productLines = products
    .map(product => `- ${product.name} | sku: ${product.sku} | slug: ${product.slug} | api: ${product.api_url}`)
    .join('\n');
  const categoryLines = categories
    .map(category => `- ${category.name} | slug: ${category.slug} | products: ${category.product_count}`)
    .join('\n');
  const contentLines = contentPages
    .map(page => `- ${page.title} | type: ${page.type} | slug: ${page.slug} | api: ${page.api_url}`)
    .join('\n');

  return `# Sosoft Beds Product And Content API

Machine-readable product catalogue, category index, CMS page index and blog content API for Sosoft Beds.

Website: ${STORE_ORIGIN}
API Base: ${origin}/api/
Authentication: none. The API is public and does not require authentication.

## Discovery

- OpenAPI specification: ${origin}/openapi.json
- Human-readable API docs: ${origin}/docs
- Product and content sitemap: ${origin}/products-sitemap.xml
- Source repository: ${SOURCE_REPOSITORY_URL}
- Products index: ${origin}/api/products
- Categories index: ${origin}/api/categories
- Category detail: ${origin}/api/categories/adjustable-beds
- Search: ${origin}/api/search?q=ottoman
- Content pages and blog posts: ${origin}/api/content-pages

## Endpoints

- GET /api/products
  Returns paginated products. Query params: page, pageSize or limit.
- GET /api/products/{slug}
  Returns complete product information by URL slug or SKU, including descriptions, tabs, dimensions, colours, sizes, images, pricing, availability, categories, breadcrumbs, custom options, FAQs, and JSON-LD.
- GET or POST /api/products/{slug}/price
  Calculates configured product price from selected custom option value IDs. GET supports ?values=134102,134103. POST supports JSON selected_options.
- GET /api/categories
  Returns lightweight category index with product counts and category API URLs.
- GET /api/categories/{slug}
  Returns full category information by slug, including canonical URL, API URL, breadcrumbs, parent category, child categories, product count, paginated product summaries, SEO hints, featured image, and last updated date.
- GET /api/search?q=
  Searches products, CMS pages and blog posts. Supports natural-language product intent such as size and price. Query params: q, limit.
- GET /api/content-pages
  Returns CMS page and blog post index.
- GET /api/content-pages/{slug}
  Returns complete CMS page or blog post information.
- GET /llms.txt
  Returns this machine-readable introduction.
- GET /openapi.json
  Returns the OpenAPI 3.1 specification.
- GET /docs
  Returns a human-readable HTML guide to the API.
- GET /products-sitemap.xml
  Returns sitemap URLs for products, content pages and discovery files.

## Product Payload Includes

- Name, brand, SKU, description, short description
- Categories and breadcrumbs
- Price, sale price, currency, stock status, schema.org availability
- Full image gallery
- Custom option groups and nested choices
- Sizes, fabrics, colours, dimensions hints, delivery options
- Product type, factual search keywords, related product API URLs
- Storefront tabs including Description, More Information, Reviews, Dimensions, Assembly Instructions, Specification, FAQ where available
- FAQs, semantic product facts, best_for, pros, cons, comparison points
- Product JSON-LD and canonical URL
- Last updated timestamp

## Content Page Payload Includes

- CMS pages and blog posts discovered from Magento page sitemap and blog RSS/listing pagination
- Canonical URL, title, meta description, H1, headings, cleaned HTML, clean text, links, word count, last updated timestamp

## Products

${productLines}

## Categories

${categoryLines}

## Content Pages And Blog Posts

${contentLines}
`;
}

function formatApiSitemap(origin) {
  const products = getProductSummaries(origin);
  const contentPages = getContentPageSummaries(origin);
  const categories = getCategoryIndex(origin).categories;
  const urls = [
    `${origin}/api/products`,
    `${origin}/api/categories`,
    `${origin}/api/content-pages`,
    `${origin}/llms.txt`,
    `${origin}/openapi.json`,
    `${origin}/docs`,
    ...categories.map(category => category.api_url),
    ...products.map(product => product.api_url),
    ...contentPages.map(page => page.api_url),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n')}
</urlset>
`;
}

function formatDocsHtml(origin) {
  const examples = [
    ['Products index', `${origin}/api/products?page=1&pageSize=10`],
    ['Product detail', `${origin}/api/products/60cm-ottoman-bed`],
    ['Product detail by SKU example', `${origin}/api/products/Giovani-Bed`],
    ['Configured price', `${origin}/api/products/60cm-ottoman-bed/price?values=134102`],
    ['Categories', `${origin}/api/categories`],
    ['Category detail', `${origin}/api/categories/adjustable-beds`],
    ['Search', `${origin}/api/search?q=ottoman&limit=5`],
    ['Natural-language search', `${origin}/api/search?q=king+size+ottoman+beds+under+500`],
    ['Content pages', `${origin}/api/content-pages`],
    ['OpenAPI', `${origin}/openapi.json`],
    ['LLM guide', `${origin}/llms.txt`],
    ['Sitemap', `${origin}/products-sitemap.xml`],
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sosoft Beds Product And Content API Docs</title>
  <meta name="description" content="Human-readable documentation for the Sosoft Beds product and content API.">
  <link rel="alternate" type="text/markdown" href="${origin}/llms.txt" title="Sosoft Beds llms.txt">
  <link rel="service-desc" type="application/vnd.oai.openapi+json" href="${origin}/openapi.json" title="Sosoft Beds OpenAPI">
  <link rel="sitemap" type="application/xml" href="${origin}/products-sitemap.xml" title="Sosoft Beds Product API Sitemap">
  <style>
    :root { color-scheme: light; font-family: Arial, Helvetica, sans-serif; color: #172033; background: #f7f8fa; }
    body { margin: 0; }
    main { max-width: 980px; margin: 0 auto; padding: 32px 18px 48px; }
    h1 { font-size: 32px; line-height: 1.2; margin: 0 0 12px; }
    h2 { font-size: 20px; margin: 32px 0 12px; }
    p { line-height: 1.6; max-width: 760px; }
    a { color: #0b5cad; }
    code { background: #eef1f5; border: 1px solid #d9dee7; border-radius: 4px; padding: 2px 5px; }
    pre { background: #172033; color: #f7f8fa; border-radius: 6px; overflow: auto; padding: 14px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9dee7; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e6e9ef; vertical-align: top; }
    th { background: #eef1f5; }
    .panel { background: #fff; border: 1px solid #d9dee7; border-radius: 6px; padding: 18px; }
  </style>
</head>
<body>
  <main>
    <h1>Sosoft Beds Product And Content API</h1>
    <p>Public machine-readable product catalogue, category index, content page index, blog context, search, OpenAPI schema and LLM discovery files for Sosoft Beds.</p>

    <section class="panel">
      <h2>Base URL</h2>
      <pre>${origin}</pre>
      <p>Authentication is not required. Responses are cacheable and support cross-origin requests.</p>
      <p>Source: <a href="${SOURCE_REPOSITORY_URL}">${SOURCE_REPOSITORY_URL}</a></p>
    </section>

    <h2>Discovery</h2>
    <table>
      <thead><tr><th>Resource</th><th>URL</th></tr></thead>
      <tbody>
        ${examples.map(([label, url]) => `<tr><td>${escapeHtml(label)}</td><td><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></td></tr>`).join('\n        ')}
      </tbody>
    </table>

    <h2>Core Endpoints</h2>
    <pre>GET /api/products
GET /api/products?page=2
GET /api/products/{slug}
GET /api/products/{slug}/price?values=134102,134103
POST /api/products/{slug}/price
GET /api/categories
GET /api/categories/{slug}
GET /api/search?q=ottoman
GET /api/search?q=king+size+ottoman+beds+under+500
GET /api/content-pages
GET /api/content-pages/{slug}</pre>

    <h2>Product Payload Includes</h2>
    <p>SKU, URL slug, name, brand, descriptions, pricing, stock status, categories, breadcrumbs, full image gallery, custom options, nested option values, product tabs, dimensions, FAQs, related products, semantic fields and Product JSON-LD.</p>

    <h2>Natural-Language Search</h2>
    <p>The search endpoint understands common shopping intent, including size phrases and price constraints such as <code>king size ottoman beds under 500</code>.</p>

    <h2>Configured Option Pricing</h2>
    <p>Use <code>/api/products/{slug}/price</code> to calculate the final price for selected custom option values. The endpoint returns base price, option adjustments, missing required options and final price.</p>
    <pre>GET /api/products/60cm-ottoman-bed/price?values=134102

POST /api/products/60cm-ottoman-bed/price
{
  "selected_options": [
    { "option_id": 9158, "value_id": 134102 }
  ]
}</pre>

    <h2>Content Payload Includes</h2>
    <p>CMS pages and blog posts with canonical URL, title, meta description, H1, headings, cleaned HTML, clean text, links, word count and generated timestamp.</p>
  </main>
</body>
</html>`;
}

function formatOpenApiSpec(origin) {
  const jsonResponse = (schemaRef, description, example) => ({
    description,
    content: {
      'application/json': {
        schema: { $ref: schemaRef },
        example,
      },
    },
  });
  const errorResponse = (description, example) => jsonResponse('#/components/schemas/ErrorResponse', description, example);
  const productSummaryExample = {
    sku: '60cm-ottoman-bed',
    slug: '60cm-ottoman-bed',
    name: '60cm Ottoman Bed',
    brand: 'Sosoft Beds',
    price: 299,
    currency: 'GBP',
    availability: 'IN_STOCK',
    canonical_url: 'https://www.sosoftbeds.co.uk/60cm-ottoman-bed',
    api_url: `${origin}/api/products/60cm-ottoman-bed`,
    markdown_url: `${origin}/api/products/60cm-ottoman-bed`,
    categories: ['Adjustable Beds'],
    image_count: 8,
    option_group_count: 29,
    tab_count: 7,
    tab_names: ['Description', 'More Information', 'Dimensions', 'Assembly Instructions', 'Specification', 'FAQ'],
    related_product_count: 12,
    sort_group: { rank: 10, name: 'bed_products' },
  };
  const contentPageSummaryExample = {
    type: 'cms_page',
    slug: 'choose-your-adjustable-bed',
    title: 'Choose Your Adjustable Bed',
    h1: 'Choose Your Adjustable Bed',
    canonical_url: 'https://www.sosoftbeds.co.uk/choose-your-adjustable-bed',
    api_url: `${origin}/api/content-pages/choose-your-adjustable-bed`,
    markdown_url: `${origin}/api/content-pages/choose-your-adjustable-bed`,
    word_count: 1200,
    heading_count: 8,
    link_count: 12,
  };

  return {
    openapi: '3.1.0',
    info: {
      title: 'Sosoft Beds Product And Content API',
      version: '1.0.0',
      description: 'Enriched product and content data for SSR, AI agents, JSON-LD, product comparison, blog context, CMS pages, and feeds.',
    },
    externalDocs: {
      description: 'Source repository',
      url: SOURCE_REPOSITORY_URL,
    },
    servers: [{ url: origin }],
    paths: {
      '/api/products': {
        get: {
          summary: 'List paginated products',
          parameters: [
            { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1 } },
            { name: 'pageSize', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100 } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100 } },
          ],
          responses: {
            200: jsonResponse('#/components/schemas/ProductIndex', 'Paginated product index with slug API URLs', {
              message: 'Products index',
              total: 234,
              page: 1,
              page_size: 5,
              total_pages: 47,
              next_page: `${origin}/api/products?page=2&pageSize=5`,
              products: [productSummaryExample],
            }),
          },
        },
      },
      '/api/products/{slug}': {
        get: {
          summary: 'Get enriched product data by slug or SKU',
          parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: jsonResponse('#/components/schemas/ProductDetail', 'Product data with options, categories, images, JSON-LD, and semantic fields', {
              id: 123,
              sku: '60cm-ottoman-bed',
              name: '60cm Ottoman Bed',
              brand: 'Sosoft Beds',
              type_id: 'simple',
              product_type: 'Ottoman Bed',
              url_key: '60cm-ottoman-bed',
              canonical_url: 'https://www.sosoftbeds.co.uk/60cm-ottoman-bed',
              meta_title: '60cm Ottoman Bed',
              meta_description: 'Compact ottoman bed with configurable fabric, headboard and mattress options.',
              description: 'Clean product description text from Magento and storefront tabs.',
              short_description: 'Compact ottoman bed.',
              price: 299,
              sale_price: 249,
              currency: 'GBP',
              in_stock: true,
              availability: 'https://schema.org/InStock',
              stock_status: 'IN_STOCK',
              image_url: 'https://www.sosoftbeds.co.uk/media/catalog/product/example.jpg',
              images: ['https://www.sosoftbeds.co.uk/media/catalog/product/example.jpg'],
              image_gallery: [{ url: 'https://www.sosoftbeds.co.uk/media/catalog/product/example.jpg', label: '60cm Ottoman Bed', position: 1 }],
              categories: [{ id: 10, name: 'Adjustable Beds', url_key: 'adjustable-beds', url_path: 'adjustable-beds', level: 2, url: 'https://www.sosoftbeds.co.uk/adjustable-beds' }],
              breadcrumbs: [{ category_id: 10, category_name: 'Adjustable Beds', category_url_key: 'adjustable-beds', category_url_path: 'adjustable-beds' }],
              custom_options: [{ title: 'Headboard', required: false, option_id: 1001, uid: 'custom-option-1001', dropdown_value: [{ title: 'Floor Standing Headboard', option_type_id: 2001, price: 99, depends_on: [], images: ['https://www.sosoftbeds.co.uk/media/options/headboard.jpg'] }] }],
              related_products: [{ sku: 'Majestic-Plain', name: 'Majestic Art Deco Ottoman Bed', url_key: 'majestic-ottoman-bed-art-deco-headboard-with-optional-mattress', api_url: `${origin}/api/products/majestic-ottoman-bed-art-deco-headboard-with-optional-mattress`, url: 'https://www.sosoftbeds.co.uk/majestic-ottoman-bed-art-deco-headboard-with-optional-mattress', price: 425, currency: 'GBP' }],
              keywords: ['Ottoman Bed', '60cm Ottoman Bed', '60cm ottoman bed', 'Adjustable Beds', 'ottoman bed', 'storage bed', 'fabric bed'],
              tabs: [{ title: 'Dimensions', name: 'dimensions', text: 'Width: 60cm. Length: 190cm.', html: '<p>Width: 60cm. Length: 190cm.</p>' }],
              tab_names: ['Description', 'More Information', 'Dimensions', 'Assembly Instructions', 'Specification', 'FAQ'],
              dimensions: ['Width: 60cm', 'Length: 190cm'],
              faqs: [{ question: 'Can I choose a mattress?', answer: 'Yes, compatible mattress options are available in the product options.' }],
              semantic: { summary: 'Compact ottoman bed.', product_type: 'Ottoman Bed', keywords: ['Ottoman Bed', '60cm Ottoman Bed', 'ottoman bed', 'storage bed'] },
              json_ld: { '@context': 'https://schema.org', '@type': 'Product', name: '60cm Ottoman Bed', sku: '60cm-ottoman-bed' },
            }),
            404: errorResponse('Product not found', { error: 'Product not found', slug: 'missing-product' }),
          },
        },
      },
      '/api/products/{slug}/price': {
        get: {
          summary: 'Calculate configured product price from selected custom option values',
          parameters: [
            { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'values', in: 'query', required: false, schema: { type: 'string' }, description: 'Comma-separated custom option value IDs, for example 134102,134103' },
          ],
          responses: {
            200: jsonResponse('#/components/schemas/ProductPriceResponse', 'Configured product price with selected option adjustments', {
              message: 'Configured product price',
              sku: '60cm-ottoman-bed',
              slug: '60cm-ottoman-bed',
              name: '60cm Ottoman Bed',
              currency: 'GBP',
              base_price: 1249,
              selected_options_total: 200,
              final_price: 1449,
              selected_options: [{ option_id: 9158, option_title: 'Select Storage Box Size', value_id: 134102, value_title: '2ft6 - LxW - 75cmx50cm', price: 200, price_adjustment: 200 }],
              missing_required_options: [{ option_id: 1234, title: 'Choose Your Bed Size' }],
            }),
            404: errorResponse('Product not found', { error: 'Product not found', slug: 'missing-product' }),
          },
        },
        post: {
          summary: 'Calculate configured product price from a JSON option selection',
          parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ProductPriceRequest' },
                example: { selected_options: [{ option_id: 9158, value_id: 134102 }] },
              },
            },
          },
          responses: {
            200: jsonResponse('#/components/schemas/ProductPriceResponse', 'Configured product price with selected option adjustments', {
              message: 'Configured product price',
              sku: '60cm-ottoman-bed',
              currency: 'GBP',
              base_price: 1249,
              selected_options_total: 200,
              final_price: 1449,
            }),
            404: errorResponse('Product not found', { error: 'Product not found', slug: 'missing-product' }),
          },
        },
      },
      '/api/categories': {
        get: {
          summary: 'List product categories',
          responses: {
            200: jsonResponse('#/components/schemas/CategoryIndex', 'Lightweight category index with product counts and category API URLs', {
              message: 'Categories index',
              total: 99,
              categories: [{
                id: 10,
                name: 'Adjustable Beds',
                slug: 'adjustable-beds',
                url: 'https://www.sosoftbeds.co.uk/adjustable-beds',
                canonical_url: 'https://www.sosoftbeds.co.uk/adjustable-beds',
                api_url: `${origin}/api/categories/adjustable-beds`,
                level: 2,
                product_count: 42,
              }],
            }),
          },
        },
      },
      '/api/categories/{slug}': {
        get: {
          summary: 'Get enriched category data by slug',
          parameters: [
            { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1 } },
            { name: 'pageSize', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100 } },
          ],
          responses: {
            200: jsonResponse('#/components/schemas/CategoryDetail', 'Category detail with metadata, relationships, and paginated products', {
              message: 'Category detail',
              id: 66,
              name: 'Adjustable Beds',
              slug: 'adjustable-beds',
              url: 'https://www.sosoftbeds.co.uk/adjustable-beds',
              canonical_url: 'https://www.sosoftbeds.co.uk/adjustable-beds',
              api_url: `${origin}/api/categories/adjustable-beds`,
              product_count: 5,
              page: 1,
              page_size: 50,
              total_pages: 1,
              products: [productSummaryExample],
              last_updated: '2026-06-27',
              seo: { title: 'Adjustable Beds | Sosoft Beds', meta_description: 'Browse 5 Adjustable Beds products from Sosoft Beds.' },
              featured_image: { url: 'https://www.sosoftbeds.co.uk/media/catalog/product/example.jpg', label: 'Adjustable Beds', source_product: '60cm Ottoman Bed' },
            }),
            404: errorResponse('Category not found', { error: 'Category not found', slug: 'missing-category' }),
          },
        },
      },
      '/api/search': {
        get: {
          summary: 'Search products, CMS pages, and blog posts',
          parameters: [
            { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 50 } },
          ],
          responses: {
            200: jsonResponse('#/components/schemas/SearchResponse', 'Search results grouped into products and content pages', {
              message: 'Search results',
              query: 'king size ottoman beds under 500',
              intent: { max_price: 500, size_terms: ['king size'], product_terms: ['ottoman'] },
              total: 1,
              products: [{ ...productSummaryExample, score: 4 }],
              content_pages: [],
            }),
          },
        },
      },
      '/api/content-pages': {
        get: {
          summary: 'List CMS pages and blog posts',
          responses: {
            200: jsonResponse('#/components/schemas/ContentPageIndex', 'Content page index with CMS page and blog post API URLs', {
              message: 'Content pages and blog posts index',
              total: 34,
              content_pages: [contentPageSummaryExample],
            }),
          },
        },
      },
      '/api/content-pages/{slug}': {
        get: {
          summary: 'Get enriched content page data by slug',
          parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: jsonResponse('#/components/schemas/ContentPageDetail', 'Content page data with cleaned HTML, text, headings, links, metadata, and source URL', {
              type: 'cms_page',
              slug: 'choose-your-adjustable-bed',
              title: 'Choose Your Adjustable Bed',
              h1: 'Choose Your Adjustable Bed',
              canonical_url: 'https://www.sosoftbeds.co.uk/choose-your-adjustable-bed',
              meta_description: 'Guide to choosing an adjustable bed.',
              html: '<h1>Choose Your Adjustable Bed</h1><p>Cleaned page content.</p>',
              text: 'Cleaned page content for AI and search.',
              word_count: 1200,
              headings: [{ level: 1, text: 'Choose Your Adjustable Bed' }],
              links: [{ text: 'Adjustable Beds', url: 'https://www.sosoftbeds.co.uk/adjustable-beds' }],
            }),
            404: errorResponse('Content page not found', { error: 'Content page not found', slug: 'missing-page' }),
          },
        },
      },
      '/llms.txt': {
        get: {
          summary: 'LLM-readable API guide',
          responses: {
            200: {
              description: 'Markdown guide for AI agents',
              content: {
                'text/markdown': {
                  schema: { type: 'string' },
                  example: '# Sosoft Beds Product And Content API\n\nMachine-readable product catalogue, category index, CMS page index and blog content API for Sosoft Beds.\n\nGET /api/products\nGET /api/products/{slug}\nGET /api/categories\nGET /api/search?q=',
                },
              },
            },
          },
        },
      },
      '/docs': {
        get: {
          summary: 'Human-readable API docs',
          responses: {
            200: {
              description: 'HTML documentation page for humans and crawlers',
              content: {
                'text/html': {
                  schema: { type: 'string' },
                  example: '<!doctype html><html lang="en"><head><title>Sosoft Beds Product And Content API Docs</title></head><body><h1>Sosoft Beds Product And Content API</h1></body></html>',
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            slug: { type: 'string' },
          },
          required: ['error'],
        },
        ProductIndex: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            total: { type: 'integer' },
            page: { type: 'integer' },
            page_size: { type: 'integer' },
            total_pages: { type: 'integer' },
            next_page: { type: 'string', format: 'uri' },
            previous_page: { type: 'string', format: 'uri' },
            products: { type: 'array', items: { $ref: '#/components/schemas/ProductSummary' } },
          },
          required: ['message', 'total', 'page', 'page_size', 'total_pages', 'products'],
        },
        ProductSummary: {
          type: 'object',
          properties: {
            sku: { type: 'string' },
            slug: { type: 'string' },
            name: { type: 'string' },
            brand: { type: 'string' },
            price: { type: 'number' },
            sale_price: { type: 'number' },
            currency: { type: 'string' },
            availability: { type: 'string' },
            canonical_url: { type: 'string', format: 'uri' },
            api_url: { type: 'string', format: 'uri' },
            markdown_url: { type: 'string', format: 'uri' },
            categories: { type: 'array', items: { type: 'string' } },
            image_count: { type: 'integer' },
            option_group_count: { type: 'integer' },
            tab_count: { type: 'integer' },
            tab_names: { type: 'array', items: { type: 'string' } },
            related_product_count: { type: 'integer' },
            last_updated: { type: 'string' },
            sort_group: { $ref: '#/components/schemas/SortGroup' },
          },
          required: ['sku', 'slug', 'name', 'api_url'],
        },
        ProductDetail: {
          type: 'object',
          additionalProperties: true,
          properties: {
            id: { type: 'integer' },
            sku: { type: 'string' },
            name: { type: 'string' },
            brand: { type: 'string' },
            type_id: { type: 'string' },
            product_type: { type: 'string' },
            url_key: { type: 'string' },
            canonical_url: { type: 'string', format: 'uri' },
            meta_title: { type: 'string' },
            meta_description: { type: 'string' },
            description: { type: 'string' },
            short_description: { type: 'string' },
            price: { type: 'number' },
            sale_price: { type: 'number' },
            currency: { type: 'string' },
            in_stock: { type: 'boolean' },
            availability: { type: 'string' },
            stock_status: { type: 'string' },
            weight: { type: 'number' },
            rating_summary: { type: 'number' },
            review_count: { type: 'integer' },
            image_url: { type: 'string', format: 'uri' },
            image_gallery: { type: 'array', items: { $ref: '#/components/schemas/Image' } },
            images: { type: 'array', items: { type: 'string', format: 'uri' } },
            categories: { type: 'array', items: { $ref: '#/components/schemas/Category' } },
            breadcrumbs: { type: 'array', items: { $ref: '#/components/schemas/Breadcrumb' } },
            custom_options: { type: 'array', items: { $ref: '#/components/schemas/CustomOption' } },
            variants: { type: 'array', items: { $ref: '#/components/schemas/CustomOption' } },
            sizes: { type: 'array', items: { $ref: '#/components/schemas/CustomOption' } },
            fabric_options: { type: 'array', items: { $ref: '#/components/schemas/CustomOption' } },
            colours: { type: 'array', items: { $ref: '#/components/schemas/CustomOption' } },
            dimensions: { type: 'array', items: { type: 'string' } },
            tabs: { type: 'array', items: { $ref: '#/components/schemas/ProductTab' } },
            tab_names: { type: 'array', items: { type: 'string' } },
            related_products: { type: 'array', items: { $ref: '#/components/schemas/RelatedProduct' } },
            keywords: { type: 'array', items: { type: 'string' } },
            faqs: { type: 'array', items: { $ref: '#/components/schemas/Faq' } },
            semantic: { $ref: '#/components/schemas/SemanticProductData' },
            json_ld: { type: 'object', additionalProperties: true },
            last_updated: { type: 'string' },
          },
          required: ['sku', 'name', 'brand', 'url_key', 'canonical_url', 'price', 'currency'],
        },
        ProductPriceRequest: {
          type: 'object',
          properties: {
            selected_options: { type: 'array', items: { $ref: '#/components/schemas/ProductPriceSelection' } },
            selected_value_ids: { type: 'array', items: { oneOf: [{ type: 'integer' }, { type: 'string' }] } },
            values: { type: 'array', items: { oneOf: [{ type: 'integer' }, { type: 'string' }, { $ref: '#/components/schemas/ProductPriceSelection' }] } },
          },
        },
        ProductPriceSelection: {
          type: 'object',
          properties: {
            option_id: { oneOf: [{ type: 'integer' }, { type: 'string' }] },
            option_uid: { type: 'string' },
            value_id: { oneOf: [{ type: 'integer' }, { type: 'string' }] },
            value_uid: { type: 'string' },
            title: { type: 'string' },
          },
        },
        ProductPriceResponse: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            sku: { type: 'string' },
            slug: { type: 'string' },
            name: { type: 'string' },
            currency: { type: 'string' },
            base_price: { type: 'number' },
            selected_options_total: { type: 'number' },
            final_price: { type: 'number' },
            selected_options: { type: 'array', items: { $ref: '#/components/schemas/ProductPriceAdjustment' } },
            missing_required_options: { type: 'array', items: { type: 'object', additionalProperties: true } },
            warnings: { type: 'array', items: { type: 'string' } },
          },
          required: ['message', 'sku', 'currency', 'base_price', 'selected_options_total', 'final_price'],
        },
        ProductPriceAdjustment: {
          type: 'object',
          properties: {
            option_id: { type: 'integer' },
            option_uid: { type: 'string' },
            option_title: { type: 'string' },
            value_id: { type: 'integer' },
            value_uid: { type: 'string' },
            value_title: { type: 'string' },
            price_type: { type: 'string' },
            price: { type: 'number' },
            price_adjustment: { type: 'number' },
          },
        },
        CategoryIndex: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            total: { type: 'integer' },
            categories: { type: 'array', items: { $ref: '#/components/schemas/CategorySummary' } },
          },
          required: ['message', 'total', 'categories'],
        },
        CategorySummary: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            uid: { type: 'string' },
            name: { type: 'string' },
            slug: { type: 'string' },
            url: { type: 'string', format: 'uri' },
            canonical_url: { type: 'string', format: 'uri' },
            api_url: { type: 'string', format: 'uri' },
            level: { type: 'integer' },
            parent_category: { $ref: '#/components/schemas/CategoryReference' },
            product_count: { type: 'integer' },
            last_updated: { type: 'string' },
          },
          required: ['name', 'slug', 'api_url', 'product_count'],
        },
        CategoryDetail: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            id: { type: 'integer' },
            uid: { type: 'string' },
            name: { type: 'string' },
            slug: { type: 'string' },
            url: { type: 'string', format: 'uri' },
            canonical_url: { type: 'string', format: 'uri' },
            api_url: { type: 'string', format: 'uri' },
            level: { type: 'integer' },
            breadcrumbs: { type: 'array', items: { $ref: '#/components/schemas/CategoryReference' } },
            parent_category: { $ref: '#/components/schemas/CategoryReference' },
            child_categories: { type: 'array', items: { $ref: '#/components/schemas/CategoryReference' } },
            product_count: { type: 'integer' },
            page: { type: 'integer' },
            page_size: { type: 'integer' },
            total_pages: { type: 'integer' },
            next_page: { type: 'string', format: 'uri' },
            previous_page: { type: 'string', format: 'uri' },
            products: { type: 'array', items: { $ref: '#/components/schemas/ProductSummary' } },
            last_updated: { type: 'string' },
            seo: { $ref: '#/components/schemas/SeoMetadata' },
            featured_image: { $ref: '#/components/schemas/FeaturedImage' },
          },
          required: ['message', 'name', 'slug', 'api_url', 'product_count', 'page', 'page_size', 'total_pages', 'products'],
        },
        CategoryReference: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            slug: { type: 'string' },
            url: { type: 'string', format: 'uri' },
            api_url: { type: 'string', format: 'uri' },
            product_count: { type: 'integer' },
          },
        },
        SeoMetadata: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            meta_description: { type: 'string' },
          },
        },
        FeaturedImage: {
          type: 'object',
          properties: {
            url: { type: 'string', format: 'uri' },
            label: { type: 'string' },
            source_product: { type: 'string' },
            source_product_slug: { type: 'string' },
          },
        },
        SearchResponse: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            usage: { type: 'string' },
            query: { type: 'string' },
            intent: { $ref: '#/components/schemas/SearchIntent' },
            total: { type: 'integer' },
            products: { type: 'array', items: { allOf: [{ $ref: '#/components/schemas/ProductSummary' }, { type: 'object', properties: { score: { type: 'number' } } }] } },
            content_pages: { type: 'array', items: { allOf: [{ $ref: '#/components/schemas/ContentPageSummary' }, { type: 'object', properties: { score: { type: 'number' } } }] } },
          },
          required: ['message', 'query', 'total', 'products', 'content_pages'],
        },
        SearchIntent: {
          type: 'object',
          properties: {
            max_price: { type: 'number' },
            min_price: { type: 'number' },
            size_terms: { type: 'array', items: { type: 'string' } },
            product_terms: { type: 'array', items: { type: 'string' } },
          },
        },
        ContentPageIndex: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            total: { type: 'integer' },
            content_pages: { type: 'array', items: { $ref: '#/components/schemas/ContentPageSummary' } },
          },
          required: ['message', 'total', 'content_pages'],
        },
        ContentPageSummary: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['cms_page', 'blog_index', 'blog_post'] },
            slug: { type: 'string' },
            title: { type: 'string' },
            h1: { type: 'string' },
            canonical_url: { type: 'string', format: 'uri' },
            api_url: { type: 'string', format: 'uri' },
            markdown_url: { type: 'string', format: 'uri' },
            word_count: { type: 'integer' },
            heading_count: { type: 'integer' },
            link_count: { type: 'integer' },
            last_updated: { type: 'string' },
          },
          required: ['type', 'slug', 'title', 'api_url'],
        },
        ContentPageDetail: {
          type: 'object',
          additionalProperties: true,
          properties: {
            type: { type: 'string', enum: ['cms_page', 'blog_index', 'blog_post'] },
            slug: { type: 'string' },
            title: { type: 'string' },
            h1: { type: 'string' },
            url: { type: 'string', format: 'uri' },
            canonical_url: { type: 'string', format: 'uri' },
            meta_title: { type: 'string' },
            meta_description: { type: 'string' },
            html: { type: 'string' },
            text: { type: 'string' },
            word_count: { type: 'integer' },
            headings: { type: 'array', items: { $ref: '#/components/schemas/Heading' } },
            links: { type: 'array', items: { $ref: '#/components/schemas/Link' } },
            cache_generated_at: { type: 'string' },
          },
          required: ['type', 'slug', 'title', 'text'],
        },
        SortGroup: {
          type: 'object',
          properties: {
            rank: { type: 'integer' },
            name: { type: 'string', enum: ['bed_products', 'mattresses', 'other_products', 'services', 'order_swatches'] },
          },
          required: ['rank', 'name'],
        },
        Image: {
          type: 'object',
          properties: {
            url: { type: 'string', format: 'uri' },
            label: { type: 'string' },
            position: { type: 'integer' },
            disabled: { type: 'boolean' },
          },
          required: ['url'],
        },
        Category: {
          type: 'object',
          properties: {
            uid: { type: 'string' },
            id: { type: 'integer' },
            name: { type: 'string' },
            url_key: { type: 'string' },
            url_path: { type: 'string' },
            url_suffix: { type: 'string' },
            url: { type: 'string', format: 'uri' },
            level: { type: 'integer' },
            breadcrumbs: { type: 'array', items: { $ref: '#/components/schemas/Breadcrumb' } },
          },
          required: ['name'],
        },
        Breadcrumb: {
          type: 'object',
          properties: {
            category_id: { type: 'integer' },
            category_name: { type: 'string' },
            category_url_key: { type: 'string' },
            category_url_path: { type: 'string' },
          },
        },
        CustomOption: {
          type: 'object',
          additionalProperties: true,
          properties: {
            __typename: { type: 'string' },
            title: { type: 'string' },
            required: { type: 'boolean' },
            option_id: { type: 'integer' },
            uid: { type: 'string' },
            is_swatch: { type: 'boolean' },
            dropdown_value: { type: 'array', items: { $ref: '#/components/schemas/CustomOptionValue' } },
            radio_value: { type: 'array', items: { $ref: '#/components/schemas/CustomOptionValue' } },
            multiple_value: { type: 'array', items: { $ref: '#/components/schemas/CustomOptionValue' } },
            checkbox_value: { type: 'array', items: { $ref: '#/components/schemas/CustomOptionValue' } },
            field_value: { $ref: '#/components/schemas/CustomOptionValue' },
            area_value: { $ref: '#/components/schemas/CustomOptionValue' },
            file_value: { $ref: '#/components/schemas/CustomOptionValue' },
            date_value: { $ref: '#/components/schemas/CustomOptionValue' },
          },
          required: ['title'],
        },
        CustomOptionValue: {
          type: 'object',
          additionalProperties: true,
          properties: {
            uid: { type: 'string' },
            title: { type: 'string' },
            option_type_id: { type: 'integer' },
            price: { type: 'number' },
            price_type: { type: 'string' },
            depends_on: { type: 'array', items: { type: 'string' } },
            images: { type: 'array', items: { type: 'string', format: 'uri' } },
            max_characters: { type: 'integer' },
            file_extension: { type: 'string' },
          },
        },
        ProductTab: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            name: { type: 'string' },
            html: { type: 'string' },
            text: { type: 'string' },
          },
          required: ['title'],
        },
        RelatedProduct: {
          type: 'object',
          properties: {
            sku: { type: 'string' },
            name: { type: 'string' },
            url_key: { type: 'string' },
            url: { type: 'string', format: 'uri' },
            api_url: { type: 'string', format: 'uri' },
            image_url: { type: 'string', format: 'uri' },
            price: { type: 'number' },
            currency: { type: 'string' },
          },
        },
        Faq: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            answer: { type: 'string' },
          },
          required: ['question', 'answer'],
        },
        SemanticProductData: {
          type: 'object',
          additionalProperties: true,
          properties: {
            summary: { type: 'string' },
            primary_category: { type: 'string' },
            product_type: { type: 'string' },
            keywords: { type: 'array', items: { type: 'string' } },
            key_features: { type: 'array', items: { type: 'string' } },
            use_cases: { type: 'array', items: { type: 'string' } },
          },
        },
        Heading: {
          type: 'object',
          properties: {
            level: { type: 'integer', minimum: 1, maximum: 6 },
            text: { type: 'string' },
          },
          required: ['level', 'text'],
        },
        Link: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            url: { type: 'string', format: 'uri' },
          },
          required: ['url'],
        },
      },
    },
  };
}

function formatAiPluginManifest(origin) {
  return {
    schema_version: 'v1',
    name_for_human: 'Sosoft Beds Product And Content API',
    name_for_model: 'sosoft_beds_products',
    description_for_human: 'Search and retrieve enriched Sosoft Beds product, CMS page, and blog data.',
    description_for_model: 'Use this API to retrieve Sosoft Beds product details, categories, breadcrumbs, images, custom options, prices, availability, product types, search keywords, related products, FAQs, semantic product facts, JSON-LD, CMS pages, guides, and blog posts.',
    auth: { type: 'none' },
    api: { type: 'openapi', url: `${origin}/openapi.json` },
    contact_email: 'info@sosoftbeds.co.uk',
    legal_info_url: 'https://www.sosoftbeds.co.uk/privacy-policy',
  };
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeCategories(categories) {
  if (!Array.isArray(categories)) return [];

  return categories
    .filter(category => category?.id && category?.name)
    .map(category => compactApiObject({
      id: category.id,
      uid: category.uid,
      name: category.name,
      url_key: category.url_key,
      url_path: category.url_path,
      url: category.url_path ? `${STORE_ORIGIN}/${category.url_path}${category.url_suffix || ''}` : undefined,
      level: category.level,
      breadcrumbs: category.breadcrumbs || [],
    }))
    .sort((left, right) => (left.level || 0) - (right.level || 0) || left.name.localeCompare(right.name));
}

function normalizeStorefrontTabs(tabs) {
  if (!Array.isArray(tabs)) return [];

  return tabs
    .filter(tab => tab?.title && (tab.text || tab.html))
    .map(tab => ({
      id: tab.id || null,
      title: tab.title.trim(),
      html: tab.html || '',
      text: tab.text || '',
    }));
}

function getTabText(tabs, titlePattern) {
  return tabs.find(tab => titlePattern.test(tab.title))?.text || '';
}

function buildBreadcrumbs(categories) {
  const deepest = [...categories].sort((left, right) => (right.level || 0) - (left.level || 0))[0];
  if (!deepest) return [];

  const crumbs = (deepest.breadcrumbs || []).map(crumb => compactApiObject({
    id: crumb.category_id,
    name: crumb.category_name,
    url_key: crumb.category_url_key,
    url_path: crumb.category_url_path,
    url: crumb.category_url_path ? `${STORE_ORIGIN}/${crumb.category_url_path}` : undefined,
  }));

  crumbs.push({
    id: deepest.id,
    name: deepest.name,
    url_key: deepest.url_key,
    url_path: deepest.url_path,
    url: deepest.url,
  });

  return crumbs;
}

function normalizeRelatedProducts(products) {
  if (!Array.isArray(products)) return [];

  return products.map(product => compactApiObject({
    sku: product.sku,
    name: product.name,
    url_key: product.url_key,
    url: product.url_key ? `${STORE_ORIGIN}/${product.url_key}` : undefined,
    api_url: product.url_key ? `${CANONICAL_API_ORIGIN}/api/products/${encodeURIComponent(product.url_key)}` : undefined,
    image_url: product.image_url || product.image?.url,
    price: product.price ?? product.price_range?.minimum_price?.regular_price?.value,
    currency: product.currency || product.price_range?.minimum_price?.regular_price?.currency || 'GBP',
  }));
}

function normalizeGalleryImages(product) {
  const gallery = Array.isArray(product.media_gallery) ? product.media_gallery : [];
  const images = gallery
    .filter(image => image?.url)
    .map(image => compactApiObject({
      url: image.url,
      label: image.label || product.name,
      position: image.position,
      disabled: image.disabled ? true : undefined,
    }))
    .sort((left, right) => (left.position ?? 9999) - (right.position ?? 9999));

  if (images.length === 0 && product.image?.url) {
    images.push({
      url: product.image.url,
      label: product.image.label || product.name,
      position: 1,
    });
  }

  return images;
}

function getOptionValues(option) {
  return OPTION_VALUE_KEYS.flatMap(key => option[key] || []);
}

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) return '';
  return ` +£${amount.toFixed(2)}`;
}

function getOptionTypeLabel(typeName) {
  return (typeName || '')
    .replace(/^Customizable/, '')
    .replace(/Option$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2') || 'Option';
}

function cleanOptionText(value) {
  if (!value) return '';

  if (typeof value !== 'string') return String(value);

  const trimmed = value.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const first = Array.isArray(parsed) ? parsed[0] : parsed;
      return first?.description || first?.title || first?.price || trimmed;
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

function formatOptionValue(value) {
  const label = cleanOptionText(value.title) || cleanOptionText(value.sku) || cleanOptionText(value.mageworx_title) || 'Unnamed value';
  const price = formatMoney(value.price);
  const bits = [];

  if (value.option_type_id) bits.push(`id: ${value.option_type_id}`);
  if (value.sku && value.sku !== label) bits.push(`sku: ${value.sku}`);
  if (value.is_default === '1') bits.push('default');
  if (value.disabled === '1') bits.push('disabled');

  return `${label}${price}${bits.length ? ` (${bits.join(', ')})` : ''}`;
}

function extractOptionGroup(options = [], titlePattern) {
  return options
    .filter(option => titlePattern.test(option.title || ''))
    .map(option => compactApiObject({
      title: option.title,
      required: Boolean(option.required),
      values: getOptionValues(option).map(value => compactApiObject({
        id: value.option_type_id,
        title: cleanOptionText(value.title) || cleanOptionText(value.sku),
        price: Number(value.price) || undefined,
        sku: value.sku,
      })),
    }));
}

function extractDimensionHints(product) {
  const text = `${product.description}\n${product.short_description}`;
  const matches = text.match(/\b\d+(?:\.\d+)?\s?(?:cm|mm|inch|inches|ft)\b/gi) || [];
  return [...new Set(matches)].slice(0, 20);
}

function extractDeliveryHint(product) {
  const services = (product.custom_options || []).find(option => /services|delivery/i.test(option.title || ''));
  return services ? getOptionValues(services).map(value => cleanOptionText(value.title)).filter(Boolean) : [];
}

function inferProductType(product, categories = []) {
  const categoryNames = categories.map(category => category.name || category).join(' ');
  const primaryText = `${product.sku || ''} ${product.name || ''} ${product.url_key || ''}`.toLowerCase();
  const text = `${primaryText} ${categoryNames}`.toLowerCase();

  if (/\border\s+swatches\b/.test(categoryNames.toLowerCase()) || /\bswatch(?:es)?\b/.test(text)) return 'Fabric Swatch';

  const primaryProductType = matchProductTypeText(primaryText);
  if (primaryProductType) return primaryProductType;

  if (/\b(removal|service|delivery|shipping|warranty|assembly)\b/.test(text)) return 'Service';

  const categoryProductType = matchProductTypeText(text);
  if (categoryProductType) return categoryProductType;

  return titleCase(product.type_id || 'Product');
}

function matchProductTypeText(text) {
  if (/\bmattress(?:es)?\b/.test(text)) return 'Mattress';
  if (/\bheadboard(?:s)?\b/.test(text)) return 'Headboard';
  if (/\badjustable\b/.test(text)) return 'Adjustable Bed';
  if (/\belectric\b/.test(text) && /\bbed(?:s)?\b/.test(text)) return 'Electric Bed';
  if (/\bottoman\b/.test(text)) return 'Ottoman Bed';
  if (/\bdivan\b/.test(text)) return 'Divan Bed';
  if (/\bsleigh\b/.test(text)) return 'Sleigh Bed';
  if (/\bwingback\b/.test(text)) return 'Wingback Bed';
  if (/\bbed(?:s)?\b/.test(text)) return 'Bed';

  return undefined;
}

function buildProductKeywords(product, categories, productType) {
  const keywords = [];
  const seen = new Set();
  const addKeyword = (value) => {
    const keyword = cleanKeyword(value);
    if (!keyword || seen.has(keyword.toLowerCase())) return;
    seen.add(keyword.toLowerCase());
    keywords.push(keyword);
  };

  addKeyword(productType);
  addKeyword(product.name);
  addKeyword(product.sku);
  addKeyword(String(product.url_key || '').replace(/[-_]+/g, ' '));
  categories.forEach(category => addKeyword(category.name));
  addMatchedKeywordPhrases(product, categories, addKeyword);

  if (Array.isArray(product.options)) {
    product.options.forEach(option => {
      addKeyword(option.title);
      getOptionValues(option).slice(0, 8).forEach(value => addKeyword(cleanOptionText(value.title) || value.sku));
    });
  }

  const additionalProperties = product.storefront_product_json_ld?.additionalProperty;
  if (Array.isArray(additionalProperties)) {
    additionalProperties.forEach(property => {
      addKeyword(property.name);
      addKeyword(property.value);
    });
  }

  return keywords.slice(0, 60);
}

function addMatchedKeywordPhrases(product, categories, addKeyword) {
  const categoryNames = categories.map(category => category.name || category).join(' ');
  const text = `${product.name || ''} ${product.meta_title || ''} ${product.meta_description || ''} ${product.url_key || ''} ${categoryNames}`.toLowerCase();
  const phrases = [
    ['ottoman bed', /\bottoman\b/],
    ['storage bed', /\bstorage\b/],
    ['adjustable bed', /\badjustable\b/],
    ['electric bed', /\belectric\b/],
    ['wingback bed', /\bwingback\b/],
    ['chesterfield bed', /\bchesterfield\b/],
    ['sleigh bed', /\bsleigh\b/],
    ['divan bed', /\bdivan\b/],
    ['floor standing headboard', /\bfloor[-\s]?standing\b/],
    ['headboard', /\bheadboard\b/],
    ['mattress', /\bmattress\b/],
    ['fabric bed', /\bfabric\b/],
    ['king size bed', /\b(king\s*size|5ft)\b/],
    ['super king bed', /\b(super\s*king|6ft)\b/],
    ['double bed', /\b(double|4ft6|4ft\s*6)\b/],
    ['single bed', /\b(single|3ft)\b/],
  ];

  phrases.forEach(([phrase, pattern]) => {
    if (pattern.test(text)) addKeyword(phrase);
  });
}

function cleanKeyword(value) {
  const keyword = cleanOptionText(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!keyword || keyword.length < 2 || keyword.length > 90) return '';
  if (KEYWORD_STOP_WORDS.has(keyword.toLowerCase())) return '';

  return keyword;
}

function titleCase(value) {
  return String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, character => character.toUpperCase());
}

function buildFaqs(product) {
  const tabFaqs = extractFaqsFromTab(product.faq_tab);
  if (tabFaqs.length > 0) return tabFaqs;

  const faqs = [
    {
      question: `Is ${product.name} in stock?`,
      answer: product.in_stock ? `${product.name} is currently marked as in stock.` : `${product.name} is currently marked as out of stock.`,
    },
    {
      question: `What custom options are available for ${product.name}?`,
      answer: `${product.name} has ${(product.custom_options || []).length} custom option groups including ${product.sizes.length ? 'sizes' : 'product choices'}${product.fabric_options.length ? ', fabrics' : ''}${product.colours.length ? ', colours' : ''}.`,
    },
    {
      question: `How many product images are available for ${product.name}?`,
      answer: `${product.name} includes ${product.images.length} gallery image${product.images.length === 1 ? '' : 's'}.`,
    },
  ];

  return faqs;
}

function extractFaqsFromTab(text) {
  if (!text) return [];

  const pairs = [];
  const regex = /(?:Q\d*:\s*)?([^?\n]{8,}\?)\s*(?:A\d*:\s*)?([\s\S]*?)(?=(?:\n\s*Q\d*:)|$)/gi;
  let match;

  while ((match = regex.exec(text))) {
    const question = match[1].replace(/\s+/g, ' ').trim();
    const answer = match[2].replace(/\s+/g, ' ').trim();
    if (question && answer) {
      pairs.push({ question, answer });
    }
  }

  return pairs.slice(0, 20);
}

function buildSemanticFields(product) {
  const haystack = `${product.name} ${product.description} ${product.categories.map(category => category.name).join(' ')}`.toLowerCase();
  const bestFor = [];
  if (/ottoman|storage/.test(haystack)) bestFor.push('bedroom storage');
  if (/electric|adjustable/.test(haystack)) bestFor.push('adjustable comfort');
  if (product.sizes.some(group => group.values.some(value => /small|single/i.test(value.title || '')))) bestFor.push('small bedrooms');
  if (product.fabric_options.length) bestFor.push('custom fabric matching');

  return compactApiObject({
    summary: product.short_description,
    product_type: product.product_type,
    keywords: product.keywords,
    best_for: bestFor,
    pros: [
      product.images.length > 1 ? `${product.images.length} product gallery images` : 'product image available',
      product.custom_options?.length ? `${product.custom_options.length} configurable option groups` : 'standard product configuration',
      product.categories.length ? `listed in ${product.categories.length} Magento categories` : 'category data available',
      product.tabs.length ? `${product.tabs.length} storefront content tabs captured` : 'storefront tab data not captured',
    ],
    cons: product.custom_options?.some(option => getOptionValues(option).some(value => Number(value.price) > 0))
      ? ['final price can change based on selected options']
      : [],
    comparison_points: [
      `price: ${product.currency} ${Number(product.sale_price || product.price).toFixed(2)}`,
      `stock: ${product.stock_status}`,
      `options: ${(product.custom_options || []).length}`,
      `images: ${product.images.length}`,
      `categories: ${product.categories.length}`,
      `tabs: ${product.tabs.length}`,
    ],
  });
}

function buildProductJsonLd(product, storefrontProductJsonLd) {
  if (storefrontProductJsonLd?.['@type'] === 'Product') {
    return withProductPageJsonLdDefaults(storefrontProductJsonLd, product);
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    brand: {
      '@type': 'Brand',
      name: product.brand,
    },
    sku: product.sku,
    description: product.meta_description || product.short_description || product.description,
    image: product.images,
    url: product.canonical_url,
    offers: {
      '@type': 'Offer',
      priceCurrency: product.currency,
      price: Number(product.sale_price || product.price).toFixed(2),
      availability: product.availability,
      url: product.canonical_url,
    },
  };

  if (product.review_count > 0 && product.rating_summary > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: (product.rating_summary / 20).toFixed(1),
      reviewCount: product.review_count,
    };
  }

  return jsonLd;
}

function withProductPageJsonLdDefaults(productJsonLd, product) {
  const jsonLd = {
    ...productJsonLd,
    '@context': productJsonLd['@context'] || 'https://schema.org/',
    '@type': 'Product',
    url: productJsonLd.url || product.canonical_url,
  };

  const offer = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
  if (offer) {
    jsonLd.offers = {
      ...offer,
      '@type': offer['@type'] || 'Offer',
      url: offer.url || product.canonical_url,
    };
  }

  return jsonLd;
}

function formatProductMarkdown(product) {
  const inStockBadge = product.in_stock ? 'In Stock' : 'Out of Stock';

  let md = `# ${product.name}

**SKU:** \`${product.sku}\`
**Product ID:** \`${product.id}\`
**Price:** £${parseFloat(product.price).toFixed(2)}
**Status:** ${inStockBadge}
**Type:** ${product.type_id}

## Description

${product.description || product.short_description || 'No description available'}

## Product Details

| Field | Value |
|-------|-------|
| **URL** | ${product.url_key} |
| **SKU** | \`${product.sku}\` |
| **Type** | ${product.type_id} |
| **Stock** | ${product.stock_status} |
| **Price** | £${parseFloat(product.price).toFixed(2)} |

`;

  if (product.categories && product.categories.length > 0) {
    md += `## Categories\n\n`;
    product.categories.forEach(category => {
      const breadcrumbNames = category.breadcrumbs?.map(crumb => crumb.category_name).filter(Boolean) || [];
      const path = [...breadcrumbNames, category.name].join(' > ');
      md += `- ${path} (${category.url_path})\n`;
    });
    md += '\n';
  }

  if (product.tabs && product.tabs.length > 0) {
    md += `## Storefront Tabs\n\n`;
    product.tabs.forEach(tab => {
      md += `### ${tab.title}\n\n${tab.text || 'No text available'}\n\n`;
    });
  }

  // Add custom options section if available
  if (product.custom_options && product.custom_options.length > 0) {
    md += `## Custom Options\n\n`;
    product.custom_options.forEach((option, idx) => {
      const required = option.required ? '(Required)' : '(Optional)';
      const typeLabel = getOptionTypeLabel(option.__typename);
      const values = getOptionValues(option);
      md += `${idx + 1}. **${option.title}** ${required} - ${typeLabel}`;
      if (option.option_id) {
        md += `, option ID ${option.option_id}`;
      }
      md += `  \n`;
      if (option.description) {
        md += `   *${cleanOptionText(option.description)}*  \n`;
      }
      if (values.length > 0) {
        values.forEach(value => {
          md += `   - ${formatOptionValue(value)}\n`;
        });
      }
      md += '\n';
    });
  }

  if (product.image_gallery && product.image_gallery.length > 0) {
    md += `## Product Images

`;
    product.image_gallery.forEach((image, idx) => {
      const label = image.label || `${product.name} image ${idx + 1}`;
      const disabled = image.disabled ? ' (disabled)' : '';
      md += `${idx + 1}. ![${label}](${image.url})${disabled}\n`;
    });

    md += `

`;
  }

  md += `---

**Generated:** ${new Date().toISOString()}
**Store:** www.sosoftbeds.co.uk
**API:** Cloudflare Workers + Magento GraphQL
`;

  return md;
}
