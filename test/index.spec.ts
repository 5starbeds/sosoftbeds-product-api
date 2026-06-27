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
			message: string;
			source: string;
			discovery: Record<string, string>;
		};

		expect(response.status).toBe(200);
		expect(body.message).toBe("Sosoft Beds Product and Content API");
		expect(body.source).toBe("https://github.com/5starbeds/sosoftbeds-product-api");
		expect(body.discovery.openapi).toBe("http://example.com/openapi.json");
		expect(body.discovery.docs).toBe("http://example.com/docs");
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
