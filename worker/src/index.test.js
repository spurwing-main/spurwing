// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import worker, { digestText, pagesFrom, relay, SYSTEM_PROMPT } from "./index.js";

const ORIGIN = "https://spurwing.webflow.io";

function upstream(parts) {
	const encoder = new TextEncoder();
	return new ReadableStream({
		start(controller) {
			for (const part of parts) controller.enqueue(encoder.encode(part));
			controller.close();
		},
	});
}

const chunks = (list) => `event: chunks\ndata: ${JSON.stringify(list)}\n\n`;
const delta = (text) => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
const done = "data: [DONE]\n\n";

async function collect(stream) {
	const text = await new Response(stream).text();
	return text
		.trim()
		.split("\n\n")
		.map((block) => {
			const [eventLine, dataLine] = block.split("\n");
			return [eventLine.slice(7), JSON.parse(dataLine.slice(6))];
		});
}

function env(overrides = {}) {
	return {
		ALLOWED_ORIGINS: `${ORIGIN},https://www.spurwing.co.uk`,
		MODEL: "openai/gpt-6.1-terra",
		RATE_LIMIT: { limit: vi.fn(async () => ({ success: true })) },
		AI: { run: vi.fn(async () => ({ response: "safe" })) },
		AI_SEARCH: {
			chatCompletions: vi.fn(async () =>
				upstream([chunks([{ item: { key: "approach.html", metadata: {} } }]), delta("We work "), delta("in stages."), done]),
			),
		},
		DB: { prepare: vi.fn(() => ({ bind: () => ({ run: async () => {}, all: async () => ({ results: [] }) }) })) },
		...overrides,
	};
}

const ctx = { waitUntil: vi.fn() };

function ask(body, headers = {}) {
	return new Request("https://ask.spurwing.co.uk/ask", {
		method: "POST",
		headers: { origin: ORIGIN, "content-type": "application/json", "cf-connecting-ip": "1.2.3.4", ...headers },
		body: JSON.stringify(body),
	});
}

describe("worker fetch", () => {
	it("streams the pages, then the answer, from AI Search with the answer rules", async () => {
		const bindings = env();
		const response = await worker.fetch(ask({ question: "How do you work?", history: [], page: "/faq" }), bindings, ctx);

		expect(response.headers.get("access-control-allow-origin")).toBe(ORIGIN);
		expect(await collect(response.body)).toEqual([
			["sources", [{ title: "Approach", url: "https://www.spurwing.co.uk/approach" }]],
			["token", "We work "],
			["token", "in stages."],
			["done", {}],
		]);

		const call = bindings.AI_SEARCH.chatCompletions.mock.calls[0][0];
		expect(call.messages[0]).toEqual({ role: "system", content: SYSTEM_PROMPT });
		expect(call.messages.at(-1)).toEqual({ role: "user", content: "How do you work?" });
		expect(call).toMatchObject({ model: "openai/gpt-6.1-terra", stream: true });
	});

	it("refuses other sites, bad input and a visitor over the limit", async () => {
		expect((await worker.fetch(ask({ question: "Hi" }, { origin: "https://evil.example" }), env(), ctx)).status).toBe(403);
		expect((await worker.fetch(ask({ question: "" }), env(), ctx)).status).toBe(400);
		expect((await worker.fetch(ask({ question: "x".repeat(301) }), env(), ctx)).status).toBe(400);

		const limited = env({ RATE_LIMIT: { limit: async () => ({ success: false }) } });
		expect((await worker.fetch(ask({ question: "Hi" }), limited, ctx)).status).toBe(429);
	});

	it("hands off a question Llama Guard flags, without asking AI Search", async () => {
		const bindings = env({ AI: { run: async () => ({ response: "unsafe\nS1" }) } });
		const response = await worker.fetch(ask({ question: "Something harmful" }), bindings, ctx);

		expect(await collect(response.body)).toEqual([["handoff", { message: "I couldn't find that on our site." }]]);
		expect(bindings.AI_SEARCH.chatCompletions).not.toHaveBeenCalled();
	});

	it("sends an error event, not a 500, when AI Search fails", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const bindings = env({ AI_SEARCH: { chatCompletions: async () => Promise.reject(new Error("AiSearchError: Internal Error")) } });
		const response = await worker.fetch(ask({ question: "Where are you based?" }), bindings, ctx);

		expect(response.status).toBe(200);
		expect(await collect(response.body)).toEqual([["error", { message: "failed" }]]);
	});

	it("checks Turnstile once its secret is set", async () => {
		const fetch = vi.fn(async () => Response.json({ success: false }));
		vi.stubGlobal("fetch", fetch);

		const response = await worker.fetch(ask({ question: "Hi", token: "abc" }), env({ TURNSTILE_SECRET: "secret" }), ctx);

		expect(response.status).toBe(403);
		expect(fetch.mock.calls[0][0]).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
		vi.unstubAllGlobals();
	});

	it("only uploads a page to AI Search with the right index key", async () => {
		const upload = vi.fn(async () => ({ id: "item-1" }));
		const bindings = env({ INDEX_KEY: "k", AI_SEARCH: { items: { upload } } });
		const page = (key) =>
			new Request("https://ask.spurwing.co.uk/index", {
				method: "POST",
				headers: { "x-index-key": key },
				body: JSON.stringify({ key: "faq.html", html: "<p>Hi</p>", url: "https://www.spurwing.co.uk/faq", title: "Webflow FAQs" }),
			});

		expect((await worker.fetch(page("wrong"), bindings, ctx)).status).toBe(404);
		expect((await worker.fetch(page("k"), env(), ctx)).status).toBe(404);
		expect((await worker.fetch(page("k"), bindings, ctx)).status).toBe(200);
		expect(upload).toHaveBeenCalledWith("faq.html", "<p>Hi</p>", { metadata: { url: "https://www.spurwing.co.uk/faq", title: "Webflow FAQs" } });
	});

	it("answers the browser's preflight", async () => {
		const response = await worker.fetch(new Request("https://ask.spurwing.co.uk/ask", { method: "OPTIONS", headers: { origin: ORIGIN } }), env(), ctx);

		expect(response.status).toBe(204);
		expect(response.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
	});
});

describe("relay", () => {
	it("turns NO_ANSWER into a hand-off, even when it arrives in pieces", async () => {
		const sent = [];
		const result = await relay(upstream([chunks([]), delta("NO_"), delta("ANS"), delta("WER"), done]), (event, data) => sent.push([event, data]));

		expect(sent).toEqual([
			["sources", []],
			["handoff", { message: "I couldn't find that on our site." }],
		]);
		expect(result.answered).toBe(false);
	});

	it("lets an answer through that only starts like NO_ANSWER", async () => {
		const sent = [];
		await relay(upstream([delta("No"), delta(", we don't need a retainer."), done]), (event, data) => sent.push([event, data]));

		expect(sent.filter(([event]) => event === "token").map(([, data]) => data).join("")).toBe("No, we don't need a retainer.");
	});

	it("hands off when nothing is said", async () => {
		const sent = [];
		await relay(upstream([done]), (event, data) => sent.push([event, data]));

		expect(sent).toEqual([["handoff", { message: "I couldn't find that on our site." }]]);
	});
});

describe("pagesFrom", () => {
	it("gives each page once, with live URLs and titles, best three first", () => {
		const pages = pagesFrom([
			{ item: { key: "work__roam-charging.html", metadata: { title: "Roam Charging" } } },
			{ item: { key: "work__roam-charging.html", metadata: {} } },
			{ item: { key: "index.html", metadata: {} } },
			{ item: { key: "https://www.spurwing.co.uk/faq", metadata: {} } },
			{ item: { key: "about.html", metadata: {} } },
		]);

		expect(pages).toEqual([
			{ title: "Roam Charging", url: "https://www.spurwing.co.uk/work/roam-charging" },
			{ title: "Home", url: "https://www.spurwing.co.uk" },
			{ title: "Faq", url: "https://www.spurwing.co.uk/faq" },
		]);
	});
});

describe("digestText", () => {
	it("lists the most asked and the unanswered questions", () => {
		const text = digestText([
			{ question: "How much?", answered: 1 },
			{ question: "How much?", answered: 1 },
			{ question: "Do you build apps?", answered: 0 },
		]);

		expect(text).toContain("FAQ questions this week: 3* (2 answered)");
		expect(text).toContain("• How much? (2)");
		expect(text).toContain("• Do you build apps?");
	});
});
