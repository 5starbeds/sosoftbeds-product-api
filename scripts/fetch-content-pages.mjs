import { writeFile } from 'node:fs/promises';

const storeOrigin = process.env.MAGENTO_STORE_ORIGIN || 'https://www.sosoftbeds.co.uk';
const defaultExtraUrls = [
  'https://www.sosoftbeds.co.uk/choose-your-adjustable-bed',
];

const pageUrls = process.env.CONTENT_PAGE_URLS
  ? parseUrlList(process.env.CONTENT_PAGE_URLS)
  : await discoverContentUrls();

const fetchedAt = new Date().toISOString();
const pages = [];

for (const pageUrl of pageUrls) {
  const response = await fetch(pageUrl, {
    headers: {
      'user-agent': 'SosoftBedsContentCache/1.0 (+https://products-api.sosoftbeds.workers.dev/llms.txt)',
    },
  });

  if (!response.ok) {
    console.warn(`Content page skipped: ${pageUrl} HTTP ${response.status}`);
    continue;
  }

  const html = await response.text();
  const contentHtml = cleanContentHtml(extractMainContent(html));
  const text = htmlToText(contentHtml);
  const headings = extractHeadings(contentHtml);
  const links = extractLinks(contentHtml);
  const title = decodeHtml(extractTagText(html, 'title') || headings.find(heading => heading.level === 1)?.text || slugFromUrl(pageUrl));

  pages.push({
    type: getPageType(pageUrl),
    slug: slugFromUrl(pageUrl),
    title,
    meta_title: title,
    meta_description: getMetaContent(html, 'description'),
    canonical_url: getCanonicalUrl(html) || pageUrl,
    url: pageUrl,
    h1: headings.find(heading => heading.level === 1)?.text || title,
    headings,
    links,
    html: contentHtml,
    text,
    word_count: countWords(text),
    cache_generated_at: fetchedAt,
  });

  console.log(`Fetched content page: ${pageUrl} (${countWords(text)} words, ${links.length} links)`);
}

await writeFile('src/cached-content-pages.js', `export const CACHED_CONTENT_PAGES = ${JSON.stringify(pages)};\n`);
await writeFile('content-pages-response.json', `${JSON.stringify({ pages }, null, 2)}\n`);

console.log(`Cached ${pages.length} content page${pages.length === 1 ? '' : 's'}.`);

function parseUrlList(value) {
  return value
    .split(',')
    .map(url => url.trim())
    .filter(Boolean);
}

async function discoverContentUrls() {
  const cmsPages = await fetchSitemapLocs(`${storeOrigin}/google_sitemap_pages.xml`);
  const blogPages = await discoverBlogUrls();

  return dedupeUrls([
    ...cmsPages.filter(shouldKeepContentUrl),
    ...defaultExtraUrls,
    `${storeOrigin}/blog`,
    ...blogPages,
  ]);
}

async function fetchSitemapLocs(sitemapUrl) {
  const response = await fetch(sitemapUrl);
  if (!response.ok) {
    console.warn(`Sitemap skipped ${sitemapUrl}: HTTP ${response.status}`);
    return [];
  }

  const xml = await response.text();
  return [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map(match => normalizeUrl(match[1])).filter(Boolean);
}

async function discoverBlogUrls() {
  const urls = new Set();

  try {
    const rss = await (await fetch(`${storeOrigin}/blog/rss`)).text();
    [...rss.matchAll(/<item>[\s\S]*?<link>\s*([^<]+)\s*<\/link>[\s\S]*?<\/item>/gi)]
      .map(match => normalizeUrl(match[1]))
      .filter(Boolean)
      .forEach(url => urls.add(url));
  } catch (error) {
    console.warn(`Blog RSS discovery failed: ${error.message}`);
  }

  for (const url of await crawlBlogListings()) {
    urls.add(url);
  }

  return [...urls];
}

async function crawlBlogListings() {
  const postUrls = new Set();
  const queue = [`${storeOrigin}/blog`];
  const seen = new Set();

  while (queue.length > 0 && seen.size < 25) {
    const listingUrl = queue.shift();
    if (seen.has(listingUrl)) continue;
    seen.add(listingUrl);

    const response = await fetch(listingUrl);
    if (!response.ok) continue;

    const html = await response.text();
    const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)]
      .map(match => normalizeUrl(match[1]))
      .filter(Boolean)
      .map(url => url.replace(/#.*$/, ''));

    for (const href of hrefs) {
      if (/\/blog\/post\//i.test(new URL(href).pathname)) {
        postUrls.add(href);
      }

      if (isBlogListingUrl(href) && !seen.has(href) && !queue.includes(href)) {
        queue.push(href);
      }
    }
  }

  return [...postUrls];
}

function isBlogListingUrl(pageUrl) {
  const url = new URL(pageUrl, storeOrigin);
  return url.origin === storeOrigin && url.pathname.replace(/\/+$/, '') === '/blog' && (!url.search || /^\?page=\d+$/i.test(url.search));
}

function shouldKeepContentUrl(pageUrl) {
  const url = new URL(pageUrl, storeOrigin);
  if (url.origin !== storeOrigin) return false;

  return !/(\/no-route\/?$|\/enable-cookies\/?$|\/410-page-gone\/?$|\/swatch-page\/?$)/i.test(url.pathname);
}

function dedupeUrls(urls) {
  const seen = new Set();
  return urls
    .map(url => normalizeUrl(url))
    .filter(Boolean)
    .filter(url => {
      const key = url.replace(/\/$/, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getPageType(pageUrl) {
  const path = new URL(pageUrl, storeOrigin).pathname;
  if (/\/blog\/post\//i.test(path)) return 'blog_post';
  if (/\/blog\/?$/i.test(path)) return 'blog_index';
  return 'cms_page';
}

function slugFromUrl(pageUrl) {
  const url = new URL(pageUrl, storeOrigin);
  const slug = url.pathname.replace(/^\/+|\/+$/g, '') || 'home';
  return url.search ? `${slug}${url.search.replace(/^\?/, '-')}`.replace(/[^a-z0-9/_-]+/gi, '-') : slug;
}

function extractMainContent(html) {
  const pageBuilder = extractBalancedTagByClass(html, 'ssb-adjustable-landing-content');
  if (pageBuilder) return pageBuilder;

  const main = extractBalancedTagById(html, 'maincontent');
  if (main) return main;

  const body = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  return body?.[1] || html;
}

function extractBalancedTagByClass(html, className) {
  const regex = new RegExp(`<([a-z0-9]+)\\b[^>]*class=["'][^"']*${escapeRegExp(className)}[^"']*["'][^>]*>`, 'i');
  const match = regex.exec(html);
  return match ? extractBalancedTag(html, match.index, match[1]) : '';
}

function extractBalancedTagById(html, id) {
  const regex = new RegExp(`<([a-z0-9]+)\\b[^>]*id=["']${escapeRegExp(id)}["'][^>]*>`, 'i');
  const match = regex.exec(html);
  return match ? extractBalancedTag(html, match.index, match[1]) : '';
}

function extractBalancedTag(html, openIndex, tagName) {
  const tokenRegex = new RegExp(`<${tagName}\\b[^>]*>|<\\/${tagName}>`, 'gi');
  tokenRegex.lastIndex = openIndex;
  let depth = 0;
  let match;

  while ((match = tokenRegex.exec(html))) {
    if (match[0].startsWith('</')) {
      depth -= 1;
      if (depth === 0) return html.slice(openIndex, tokenRegex.lastIndex);
    } else {
      depth += 1;
    }
  }

  return html.slice(openIndex);
}

function cleanContentHtml(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, '')
    .replace(/\s+data-[a-zA-Z0-9:_-]+(?:="[^"]*")?/g, '')
    .replace(/\s+class="[^"]*"/g, '')
    .replace(/\s+style="[^"]*"/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractHeadings(html) {
  const headings = [];
  const regex = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match;

  while ((match = regex.exec(html))) {
    const text = htmlToText(match[2]);
    if (text) headings.push({ level: Number(match[1]), text });
  }

  return headings.slice(0, 80);
}

function extractLinks(html) {
  const links = [];
  const regex = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = regex.exec(html))) {
    const href = normalizeUrl(match[1]);
    const text = htmlToText(match[2]);
    if (href && text) links.push({ text, url: href });
  }

  return dedupeLinks(links).slice(0, 120);
}

function normalizeUrl(href) {
  if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return '';
  }

  return new URL(href, storeOrigin).toString();
}

function dedupeLinks(links) {
  const seen = new Set();
  return links.filter(link => {
    const key = `${link.text}|${link.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getMetaContent(html, name) {
  const regex = new RegExp(`<meta\\b[^>]*(?:name|property)=["']${escapeRegExp(name)}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i');
  return decodeHtml(regex.exec(html)?.[1] || '');
}

function getCanonicalUrl(html) {
  const match = /<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i.exec(html);
  return match ? normalizeUrl(match[1]) : '';
}

function extractTagText(html, tagName) {
  const match = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i').exec(html);
  return match ? htmlToText(match[1]) : '';
}

function htmlToText(html) {
  return decodeHtml(String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|table|ul|ol|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim());
}

function countWords(text) {
  return (text.match(/\b[\w'-]+\b/g) || []).length;
}

function decodeHtml(value) {
  return String(value || '')
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}