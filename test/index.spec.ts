import { env, createExecutionContext, waitOnExecutionContext, SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";
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
		expect(body.data_updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(body.data.source).toBe("Magento");
		expect(body.data.last_updated).toBe(body.data_updated);
		expect(body.data.products_last_updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(body.data.content_last_updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(body.data.cache_type).toBe("embedded");
		expect(body.sync.method).toBe("scheduled");
		expect(body.sync.frequency).toBe("daily");
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

	it("returns a product detail response", async () => {
		const response = await fetchWorker("/api/products/60cm-ottoman-bed");
		const body = await response.json() as {
			url_key: string;
			custom_options: unknown[];
			image_gallery: unknown[];
		};

		expect(response.status).toBe(200);
		expect(body.url_key).toBe("60cm-ottoman-bed");
		expect(body.custom_options.length).toBeGreaterThan(0);
		expect(body.image_gallery.length).toBeGreaterThan(0);
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
