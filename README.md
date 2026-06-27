# Sosoft Beds Product API

Machine-readable product catalogue API designed for search engines, AI assistants, and ecommerce integrations.

Live API: https://products-api.sosoftbeds.workers.dev/

API docs: https://products-api.sosoftbeds.workers.dev/docs

OpenAPI spec: https://products-api.sosoftbeds.workers.dev/openapi.json

Product sitemap: https://products-api.sosoftbeds.workers.dev/products-sitemap.xml

LLM guide: https://products-api.sosoftbeds.workers.dev/llms.txt

## What This API Provides

- Embedded product catalogue data from Magento.
- Product detail responses by slug or SKU.
- Product categories, breadcrumbs, image galleries, custom options, tabs, dimensions, FAQs, and specification-style content.
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
GET /api/search?q={query}
GET /api/content-pages
GET /api/content-pages/{slug}
```

## Example Requests

```bash
curl "https://products-api.sosoftbeds.workers.dev/api/products?page=1&limit=10"
curl "https://products-api.sosoftbeds.workers.dev/api/products/60cm-ottoman-bed"
curl "https://products-api.sosoftbeds.workers.dev/api/search?q=king+size+ottoman+beds+under+500"
curl "https://products-api.sosoftbeds.workers.dev/api/products/60cm-ottoman-bed/price?values=134102"
curl "https://products-api.sosoftbeds.workers.dev/api/categories"
curl "https://products-api.sosoftbeds.workers.dev/api/content-pages/choose-your-adjustable-bed"
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