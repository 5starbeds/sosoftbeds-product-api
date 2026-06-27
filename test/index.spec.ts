import { env, createExecutionContext, waitOnExecutionContext, SELF } from "cloudflare:test";
import { describe, it, expect, vi } from "vitest";
import worker from "../src";

async function fetchWorker(path: string) {
	const request = new Request<unknown, IncomingRequestCfProperties>(`http://example.com${path}`);
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

describe("Sosoft Beds Product API", () => {
	it("returns API discovery details from the homepage", async () => {
		const response = await fetchWorker("/");
		const body = await response.json() as {
			status: number;
			name: string;
			message: string;
			description: string;
			publisher: {
				name: string;
				website: string;
			};
			canonical: string;
			api_version: string;
			schema: {
				type: string;
				version: string;
			};
			default_language: string;
			data_updated: string;
			data: {
				source: string;
				last_updated: string;
				products_last_updated: string;
				content_last_updated: string;
				cache_type: string;
			};
			sync: {
				method: string;
				frequency: string;
				timezone: string;
				schedule: Array<{
					type: string;
					cron: string;
				}>;
			};
			capabilities: string[];
			entities: string[];
			formats: string[];
			examples: {
				product_search: string;
				product_lookup: string;
			};
			rate_limit: {
				policy: string;
			};
			catalogue_stats: {
				products: number;
				categories: number;
				content_pages: number;
				last_sync: string;
			};
			authentication: {
				required: boolean;
				type: string;
			};
			source: string;
			resources: {
				llm_guide: string;
				openapi: string;
				docs: string;
				sitemap: string;
				robots: string;
				products: string;
				categories: string;
				content: string;
				search: string;
			};
		};

		expect(response.status).toBe(200);
		expect(body.status).toBe(200);
		expect(body.name).toBe("Sosoft Beds Product API");
		expect(body.message).toBe("Sosoft Beds Product API");
		expect(body.description).toBe("Machine-readable ecommerce product catalogue.");
		expect(body.publisher.name).toBe("Sosoft Beds");
		expect(body.publisher.website).toBe("https://www.sosoftbeds.co.uk");
		expect(body.canonical).toBe("https://api.sosoftbeds.co.uk");
		expect(body).not.toHaveProperty("canonical_api");
		expect(body.api_version).toBe("1.0");
		expect(body.schema.type).toBe("OpenAPI");
		expect(body.schema.version).toBe("3.1");
		expect(body.default_language).toBe("en-GB");
		expect(body.data_updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(body.data.source).toBe("Magento");
		expect(body.data.last_updated).toBe(body.data_updated);
		expect(body.data.products_last_updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(body.data.content_last_updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(body.data.cache_type).toBe("embedded");
		expect(body.sync.method).toBe("scheduled");
		expect(body.sync.frequency).toBe("nightly plus weekly Sunday 04:00");
		expect(body.sync.timezone).toBe("UTC");
		expect(body.sync.schedule).toEqual([
			{ type: "nightly", cron: "0 2 * * *" },
			{ type: "weekly_full_refresh", cron: "0 4 * * 0" },
		]);
		expect(body.capabilities).toContain("natural language search");
		expect(body.capabilities).toContain("pricing lookup");
		expect(body.entities).toEqual(["Product", "Category", "ContentPage", "Price", "Variant"]);
		expect(body.formats).toContain("application/json");
		expect(body.formats).toContain("OpenAPI 3.1");
		expect(body.formats).toContain("Markdown");
		expect(body.examples.product_search).toBe("https://api.sosoftbeds.co.uk/api/search?q=king+size+ottoman+bed");
		expect(body.examples.product_lookup).toBe("https://api.sosoftbeds.co.uk/api/products/Giovani-Bed");
		expect(body.rate_limit.policy).toBe("reasonable automated usage");
		expect(body.authentication.required).toBe(false);
		expect(body.authentication.type).toBe("public");
		expect(body.catalogue_stats.products).toBeGreaterThan(200);
		expect(body.catalogue_stats.categories).toBeGreaterThan(40);
		expect(body.catalogue_stats.content_pages).toBeGreaterThan(20);
		expect(body.catalogue_stats.last_sync).toBe(body.data_updated);
		expect(body.source).toBe("https://github.com/5starbeds/sosoftbeds-product-api");
		expect(body.resources.llm_guide).toBe("https://api.sosoftbeds.co.uk/llms.txt");
		expect(body.resources.openapi).toBe("https://api.sosoftbeds.co.uk/openapi.json");
		expect(body.resources.docs).toBe("https://api.sosoftbeds.co.uk/docs");
		expect(body.resources.sitemap).toBe("https://api.sosoftbeds.co.uk/products-sitemap.xml");
		expect(body.resources.robots).toBe("https://api.sosoftbeds.co.uk/robots.txt");
		expect(body.resources.products).toBe("https://api.sosoftbeds.co.uk/api/products");
		expect(body.resources.categories).toBe("https://api.sosoftbeds.co.uk/api/categories");
		expect(body.resources.content).toBe("https://api.sosoftbeds.co.uk/api/content-pages");
		expect(body.resources.search).toBe("https://api.sosoftbeds.co.uk/api/search?q=");
		expect(body.resources).not.toHaveProperty("catalogue");
		expect(body.resources).not.toHaveProperty("discovery");
		expect(body).not.toHaveProperty("discovery");
	});

	it("serves the Google Search Console verification file", async () => {
		const response = await fetchWorker("/googleba3eea9f8143c3f9.html");
		const body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");
		expect(body).toBe("google-site-verification: googleba3eea9f8143c3f9.html");
	});

	it("serves a valid AI plugin manifest", async () => {
		const response = await fetchWorker("/.well-known/ai-plugin.json");
		const body = await response.json() as {
			schema_version: string;
			name_for_model: string;
			auth: { type: string };
			api: { type: string; url: string };
		};

		expect(response.status).toBe(200);
		expect(body.schema_version).toBe("v1");
		expect(body.name_for_model).toBe("sosoft_beds_products");
		expect(body.auth.type).toBe("none");
		expect(body.api.type).toBe("openapi");
		expect(body.api.url).toBe("https://api.sosoftbeds.co.uk/openapi.json");
	});

	it("returns paginated product summaries", async () => {
		const response = await fetchWorker("/api/products?page=1&pageSize=2");
		const body = await response.json() as {
			products: unknown[];
			page: number;
			page_size: number;
			total: number;
		};

		expect(response.status).toBe(200);
		expect(body.page).toBe(1);
		expect(body.page_size).toBe(2);
		expect(body.total).toBeGreaterThan(200);
		expect(body.products).toHaveLength(2);
	});

	it("returns a lightweight category index", async () => {
		const response = await fetchWorker("/api/categories");
		const body = await response.json() as {
			total: number;
			categories: Array<{
				name: string;
				slug: string;
				api_url: string;
				product_count: number;
				products?: unknown[];
			}>;
		};

		expect(response.status).toBe(200);
		expect(body.total).toBeGreaterThan(40);
		expect(body.categories[0].name).toBeTruthy();
		expect(body.categories[0].slug).toBeTruthy();
		expect(body.categories[0].api_url).toMatch(/^https:\/\/api\.sosoftbeds\.co\.uk\/api\/categories\//);
		expect(body.categories[0].product_count).toBeGreaterThan(0);
		expect(body.categories[0]).not.toHaveProperty("products");
	});

	it("returns rich category detail with paginated products", async () => {
		const response = await fetchWorker("/api/categories/adjustable-beds?page=1&pageSize=2");
		const body = await response.json() as {
			message: string;
			name: string;
			slug: string;
			canonical_url: string;
			api_url: string;
			product_count: number;
			page: number;
			page_size: number;
			total_pages: number;
			products: Array<{ name: string; api_url: string }>;
			last_updated: string;
			seo: { title: string; meta_description: string };
			featured_image?: { url: string };
		};

		expect(response.status).toBe(200);
		expect(body.message).toBe("Category detail");
		expect(body.name).toBe("Adjustable Beds");
		expect(body.slug).toBe("adjustable-beds");
		expect(body.canonical_url).toBe("https://www.sosoftbeds.co.uk/adjustable-beds");
		expect(body.api_url).toBe("https://api.sosoftbeds.co.uk/api/categories/adjustable-beds");
		expect(body.product_count).toBeGreaterThan(0);
		expect(body.page).toBe(1);
		expect(body.page_size).toBe(2);
		expect(body.total_pages).toBeGreaterThanOrEqual(1);
		expect(body.products).toHaveLength(2);
		expect(body.products[0].api_url).toMatch(/^https:\/\/api\.sosoftbeds\.co\.uk\/api\/products\//);
		expect(body.last_updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(body.seo.title).toBe("Adjustable Beds | Sosoft Beds");
		expect(body.seo.meta_description).toContain("Adjustable Beds");
	});

	it("returns a product detail response", async () => {
		const response = await fetchWorker("/api/products/60cm-ottoman-bed");
		const body = await response.json() as {
			url_key: string;
			product_type: string;
			keywords: string[];
			currency: string;
			availability: string;
			stock_status: string;
			last_updated: string;
			custom_options: unknown[];
			image_gallery: unknown[];
			related_products: Array<{ api_url: string }>;
			semantic: {
				product_type: string;
				keywords: string[];
				summary?: string;
			};
		};

		expect(response.status).toBe(200);
		const lowerKeywords = body.keywords.map(keyword => keyword.toLowerCase());
		const lowerSemanticKeywords = body.semantic.keywords.map(keyword => keyword.toLowerCase());
		expect(body.url_key).toBe("60cm-ottoman-bed");
		expect(body.product_type).toBe("Ottoman Bed");
		expect(lowerKeywords).toContain("ottoman bed");
		expect(body.currency).toBe("GBP");
		expect(body.availability).toBe("https://schema.org/InStock");
		expect(body.stock_status).toBe("IN_STOCK");
		expect(body.last_updated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(body.related_products[0].api_url).toMatch(/^https:\/\/api\.sosoftbeds\.co\.uk\/api\/products\//);
		expect(body.semantic.product_type).toBe(body.product_type);
		expect(lowerSemanticKeywords).toContain("ottoman bed");
		expect(body.custom_options.length).toBeGreaterThan(0);
		expect(body.image_gallery.length).toBeGreaterThan(0);
	});

	it("logs structured endpoint analytics without individual IP addresses", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

		try {
			const request = new Request<unknown, IncomingRequestCfProperties>("http://example.com/api/products/60cm-ottoman-bed", {
				headers: {
					"user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)",
				},
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);

			const analyticsLine = logSpy.mock.calls
				.map(([line]) => String(line))
				.find((line) => line.includes('"event":"api_request"'));
			const analytics = JSON.parse(analyticsLine || "{}");

			expect(response.status).toBe(200);
			expect(analytics.endpoint).toBe("/api/products/{slug}");
			expect(analytics.path).toBe("/api/products/60cm-ottoman-bed");
			expect(analytics.status).toBe(200);
			expect(analytics.duration_ms).toBeGreaterThanOrEqual(0);
			expect(analytics.user_agent).toContain("Googlebot");
			expect(analytics.crawler).toBe("Googlebot");
			expect(analytics).not.toHaveProperty("ip");
			expect(analytics).not.toHaveProperty("client_ip");
		} finally {
			logSpy.mockRestore();
		}
	});

	it("uses storefront Product JSON-LD when available", async () => {
		const response = await fetchWorker("/api/products/grandeur-ottoman-bed-warwick-fabrics");
		const body = await response.json() as {
			json_ld: {
				"@type": string;
				sku: string;
				offers: {
					price: string;
					shippingDetails?: unknown;
					hasMerchantReturnPolicy?: unknown;
				};
				aggregateRating?: { reviewCount: string };
				additionalProperty?: unknown[];
			};
		};

		expect(response.status).toBe(200);
		expect(body.json_ld["@type"]).toBe("Product");
		expect(body.json_ld.sku).toBe("Grandeur697");
		expect(body.json_ld.offers.price).toBe("475.00");
		expect(body.json_ld.aggregateRating?.reviewCount).toBe("292");
		expect(body.json_ld.offers.shippingDetails).toBeTruthy();
		expect(body.json_ld.offers.hasMerchantReturnPolicy).toBeTruthy();
		expect(body.json_ld.additionalProperty?.length).toBeGreaterThan(0);
	});

	it("serves the OpenAPI spec in integration mode", async () => {
		const response = await SELF.fetch("http://example.com/openapi.json");
		const body = await response.json() as {
			openapi: string;
			info: { title: string };
		};

		expect(response.status).toBe(200);
		expect(body.openapi).toBe("3.1.0");
		expect(body.info.title).toBe("Sosoft Beds Product And Content API");
	});
});
