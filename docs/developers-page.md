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
curl "https://api.sosoftbeds.co.uk/api/products?page=1&limit=10"
curl "https://api.sosoftbeds.co.uk/api/products/60cm-ottoman-bed"
curl "https://api.sosoftbeds.co.uk/api/search?q=king+size+ottoman+beds+under+500"
curl "https://api.sosoftbeds.co.uk/api/products/60cm-ottoman-bed/price?values=134102"
curl "https://api.sosoftbeds.co.uk/api/categories"
curl "https://api.sosoftbeds.co.uk/api/content-pages/choose-your-adjustable-bed"
```

## Repository

GitHub: https://github.com/5starbeds/sosoftbeds-product-api

## Notes

The API is designed to serve fast, cache-only product and content responses from embedded data. Magento GraphQL is used by cache-generation scripts, not by public missing-product fallback requests.
