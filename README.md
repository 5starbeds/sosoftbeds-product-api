# Sosoft Beds Product API

Machine-readable product catalogue API designed for search engines, AI assistants, and ecommerce integrations.

Live API: https://api.sosoftbeds.co.uk/

API docs: https://api.sosoftbeds.co.uk/docs

OpenAPI spec: https://api.sosoftbeds.co.uk/openapi.json

Product sitemap: https://api.sosoftbeds.co.uk/products-sitemap.xml

LLM guide: https://api.sosoftbeds.co.uk/llms.txt

## What This API Provides

- Embedded product catalogue data from Magento.
- Product detail responses by slug or SKU.
- Product categories, breadcrumbs, image galleries, custom options, tabs, dimensions, FAQs, product type, factual search keywords, availability, related product API URLs, and specification-style content.
- Natural-language product search such as `king size ottoman beds under 500`.
- Configured product pricing from selected custom option values.
- CMS and blog content page data.
- OpenAPI, sitemap, robots, and LLM discovery endpoints.

## Main Endpoints

```text
GET /
GET /docs
GET /llms.txt
GET /openapi.json
GET /products-sitemap.xml
GET /api/products
GET /api/products/{slug}
GET /api/products/{slug}/price?values={optionValueIds}
GET /api/categories
GET /api/categories/{slug}
GET /api/search?q={query}
GET /api/content-pages
GET /api/content-pages/{slug}
```

## Example Requests

```bash
curl "https://api.sosoftbeds.co.uk/api/products?page=1&limit=10"
curl "https://api.sosoftbeds.co.uk/api/products/60cm-ottoman-bed"
curl "https://api.sosoftbeds.co.uk/api/search?q=king+size+ottoman+beds+under+500"
curl "https://api.sosoftbeds.co.uk/api/products/60cm-ottoman-bed/price?values=134102"
curl "https://api.sosoftbeds.co.uk/api/categories"
curl "https://api.sosoftbeds.co.uk/api/categories/adjustable-beds"
curl "https://api.sosoftbeds.co.uk/api/content-pages/choose-your-adjustable-bed"
```

More examples are available in [examples/requests.http](examples/requests.http).

## Publish This On

- GitHub repository: https://github.com/5starbeds/sosoftbeds-product-api
- Website developer page: https://www.sosoftbeds.co.uk/developers
- Postman collection: [postman/sosoftbeds-product-api.postman_collection.json](postman/sosoftbeds-product-api.postman_collection.json)
- Technical blog post draft: [docs/how-sosoft-beds-built-an-ai-ready-product-api.md](docs/how-sosoft-beds-built-an-ai-ready-product-api.md)

## Local Development

```bash
npm install
npm run dev
```

## Refresh Embedded Data

```bash
npm run cache-products
npm run cache-content
```

Or refresh both:

```bash
npm run cache-all
```

## Automated Refresh And Deploy

The repository includes a GitHub Actions workflow at `.github/workflows/refresh-and-deploy.yml`.

Schedule:

```text
Nightly: 0 2 * * * UTC
Sunday full refresh: 0 4 * * 0 UTC
```

The workflow refreshes the embedded Magento product/content cache, runs tests, commits changed cache files back to `main`, and deploys the Worker to Cloudflare.

Required GitHub repository secrets:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

The Cloudflare token should be scoped to edit Workers on the account that owns `products-api`.

## Worker Analytics

The Worker writes structured JSON logs for API and discovery requests. Each log entry includes the normalized endpoint, exact path, response status, response time, content type, User-Agent, crawler classification, Cloudflare verified bot category when available, and aggregated country. It does not log individual IP addresses.

Use these logs in Cloudflare Workers Observability to see whether search engines and AI crawlers are discovering the API, which endpoints they request, and which individual product paths are being followed from product-page JSON alternate links.

## Deploy

```bash
npm run deploy
```

## Repository Contents

- [src/index.js](src/index.js) - Cloudflare Worker router and API formatters.
- [src/cached-products.js](src/cached-products.js) - Generated product cache.
- [src/cached-content-pages.js](src/cached-content-pages.js) - Generated CMS/blog content cache.
- [scripts/fetch-expanded-products.mjs](scripts/fetch-expanded-products.mjs) - Magento product cache generator.
- [scripts/fetch-content-pages.mjs](scripts/fetch-content-pages.mjs) - CMS/blog cache generator.
- [openapi.json](openapi.json) - Static copy of the live OpenAPI document.
- [examples/requests.http](examples/requests.http) - Example API requests.
- [postman/sosoftbeds-product-api.postman_collection.json](postman/sosoftbeds-product-api.postman_collection.json) - Postman collection for API testing.
- [docs/how-sosoft-beds-built-an-ai-ready-product-api.md](docs/how-sosoft-beds-built-an-ai-ready-product-api.md) - Technical blog post draft.

## Notes

The Worker is designed to serve fast, cache-only API responses from embedded data. Magento GraphQL is used by the cache-generation scripts, not by missing-product API fallback requests.
