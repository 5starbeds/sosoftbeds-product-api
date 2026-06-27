# How Sosoft Beds Built An AI-Ready Product API

Sosoft Beds built a machine-readable product catalogue API so product data can be understood consistently by search engines, AI assistants, comparison tools, and ecommerce integrations.

The goal was not to create another frontend. The goal was to expose reliable product facts in a format that machines can request, validate, and reuse.

## Why We Built It

Traditional ecommerce pages are built primarily for human browsing. They contain product facts, but those facts are often mixed with layout code, scripts, marketing blocks, navigation, and duplicate content.

For search engines and AI systems, a clean API is easier to interpret than a rendered page. It gives each product a stable machine-readable source of truth.

## What The API Contains

The Sosoft Beds Product API includes:

- Product names, SKUs, slugs, prices, sale prices, stock status, and canonical URLs.
- Product descriptions, short descriptions, specification content, dimensions, FAQs, and storefront tabs.
- Full image galleries.
- Category membership and breadcrumbs.
- Custom options and option values.
- Configured price calculation for selected custom options.
- Natural-language search for product discovery.
- CMS and blog content pages.
- OpenAPI, sitemap, robots, and LLM guide endpoints.

## Why It Uses Embedded Data

The public API is cache-first. Product and content data is generated from Magento and embedded into the Cloudflare Worker bundle.

That means public API requests do not need to query Magento GraphQL in real time. This keeps responses fast, predictable, and resilient.

## Key Endpoints

```text
GET https://api.sosoftbeds.co.uk/
GET https://api.sosoftbeds.co.uk/docs
GET https://api.sosoftbeds.co.uk/openapi.json
GET https://api.sosoftbeds.co.uk/llms.txt
GET https://api.sosoftbeds.co.uk/products-sitemap.xml
GET https://api.sosoftbeds.co.uk/api/products
GET https://api.sosoftbeds.co.uk/api/products/{slug}
GET https://api.sosoftbeds.co.uk/api/products/{slug}/price?values={optionValueIds}
GET https://api.sosoftbeds.co.uk/api/categories
GET https://api.sosoftbeds.co.uk/api/search?q={query}
GET https://api.sosoftbeds.co.uk/api/content-pages
```

## Discovery Signals

The API is linked from the main website through crawler-readable signals:

- Global head links to the API homepage, OpenAPI spec, LLM guide, and product sitemap.
- Main-site `robots.txt` sitemap reference for the API sitemap.
- API-domain `robots.txt` allowing access and pointing to the product sitemap.
- A public GitHub repository with README, OpenAPI spec, and example requests.

## Result

The result is a product catalogue that is easier for machines to consume without changing the existing customer-facing Magento storefront.

This gives Sosoft Beds a stronger technical foundation for search, AI-assisted shopping, structured product discovery, and future ecommerce integrations.
