// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { citedPages, links, pagesFrom, relay, SYSTEM_PROMPT } from "./answer.js";
import worker from "./index.js";

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

function model(parts) {
	return vi.fn(async () => upstream(parts));
}

function env(overrides = {}) {
	return {
		ALLOWED_ORIGINS: `${ORIGIN},https://www.spurwing.co.uk`,
		MODEL: "openai/gpt-6.1-terra",
		REASONING_EFFORT: "none",
		GATEWAY: "spurwing",
		RATE_LIMIT: { limit: vi.fn(async () => ({ success: true })) },
		AI: { run: model([delta("We work "), delta("in clear stages, from discovery to launch."), done]) },
		AI_SEARCH: {
			search: vi.fn(async () => ({
				chunks: [
					{ item: { key: "approach.html", metadata: {} }, text: "We work in clear stages: discovery, design, build and launch." },
					{ item: { key: "contact.html", metadata: {} }, text: "Email hello@spurwing.co.uk to start." },
				],
			})),
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
	it("streams the pages from AI Search, then Terra's answer written from them without reasoning", async () => {
		const bindings = env();
		const response = await worker.fetch(ask({ question: "How do you work?", history: [], page: "/faq" }), bindings, ctx);

		expect(response.headers.get("access-control-allow-origin")).toBe(ORIGIN);
		expect(await collect(response.body)).toEqual([
			[
				"sources",
				[
					{ title: "Approach", url: "https://www.spurwing.co.uk/approach" },
					{ title: "Contact", url: "https://www.spurwing.co.uk/contact" },
				],
			],
			["token", "We work "],
			["token", "in clear stages, from discovery to launch."],
			["cited", [{ title: "Approach", url: "https://www.spurwing.co.uk/approach" }]],
			["done", {}],
		]);

		const [name, input, options] = bindings.AI.run.mock.calls[0];
		expect(input.messages[0].content).toContain(SYSTEM_PROMPT);
		expect(input.messages[0].content).toContain("## Approach (https://www.spurwing.co.uk/approach)");
		expect(input.messages.at(-1)).toEqual({ role: "user", content: "How do you work?" });
		expect(input).toMatchObject({ stream: true, reasoning_effort: "none" });
		expect(options).toMatchObject({ gateway: { id: "spurwing" } });
		expect(name).toBe("openai/gpt-6.1-terra");
		expect(bindings.AI_SEARCH.search).toHaveBeenCalledWith(expect.objectContaining({ query: "How do you work?" }));
	});

	it("refuses other sites, bad input and a visitor over the limit", async () => {
		expect((await worker.fetch(ask({ question: "Hi" }, { origin: "https://evil.example" }), env(), ctx)).status).toBe(403);
		expect((await worker.fetch(ask({ question: "" }), env(), ctx)).status).toBe(400);
		expect((await worker.fetch(ask({ question: "x".repeat(301) }), env(), ctx)).status).toBe(400);

		const limited = env({ RATE_LIMIT: { limit: async () => ({ success: false }) } });
		expect((await worker.fetch(ask({ question: "Hi" }), limited, ctx)).status).toBe(429);
	});

	it("sends an error event, not a 500, when AI Search fails", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const bindings = env({ AI_SEARCH: { search: async () => Promise.reject(new Error("AiSearchError: Internal Error")) } });
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

	it("logs each question with its time, page and every ID that ties it to the visit, leaving out contact details", async () => {
		const run = vi.fn(async () => {});
		const bind = vi.fn(() => ({ run }));
		const waits = [];
		const bindings = env({ DB: { prepare: vi.fn(() => ({ bind })) } });
		const body = {
			question: "Call me on 07700 900123 about a quote?",
			page: "/faq",
			id: "q-1",
			conversation: "c-1",
			history: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Hello" }],
			clarity: { user: "1abc2de", session: "<script>" },
		};

		await collect((await worker.fetch(ask(body, { "cf-ray": "8f00aa-LHR", "user-agent": "Safari" }), bindings, { waitUntil: (p) => waits.push(p) })).body);
		await Promise.all(waits);

		const [askedAt, id, conversation, turn, page, question, answered, , , firstWordMs, ms, clarityUser, claritySession, ray, , userAgent, model] =
			bind.mock.calls[0];
		expect(new Date(askedAt).toISOString()).toBe(askedAt);
		expect([id, conversation, turn, page, answered]).toEqual(["q-1", "c-1", 2, "/faq", 1]);
		expect(question).toBe("[removed: contained contact details]");
		expect(firstWordMs).toBeGreaterThanOrEqual(0);
		expect(ms).toBeGreaterThanOrEqual(firstWordMs);
		// An ID that isn't one is dropped, not stored.
		expect([clarityUser, claritySession]).toEqual(["1abc2de", ""]);
		expect([ray, userAgent, model]).toEqual(["8f00aa-LHR", "Safari", "openai/gpt-6.1-terra"]);

		const [, , options] = bindings.AI.run.mock.calls[0];
		expect(options.gateway.metadata).toEqual({ page: "/faq", question: "q-1" });
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
		const result = await relay(upstream([delta(" NO_"), delta("ANS"), delta("WER"), done]), (event, data) => sent.push([event, data]));

		expect(sent).toEqual([["handoff", { message: "I couldn't find that on our site." }]]);
		expect(result.answered).toBe(false);
	});

	it("lets an answer through that only starts like NO_ANSWER", async () => {
		const sent = [];
		await relay(upstream([delta("No"), delta(", we don't need a retainer."), done]), (event, data) => sent.push([event, data]));

		expect(sent.filter(([event]) => event === "token").map(([, data]) => data).join("")).toBe("No, we don't need a retainer.");
	});

	it("hands off as soon as NO_ANSWER is complete, whatever follows it", async () => {
		const sent = [];
		const result = await relay(upstream([delta("NO_ANSWER. Sorry, never shown."), done]), (event, data) => sent.push([event, data]));

		expect(sent).toEqual([["handoff", { message: "I couldn't find that on our site." }]]);
		expect(result).toEqual({ answered: false, answer: "", sources: [] });
	});

	it("hands off when nothing is said", async () => {
		const sent = [];
		await relay(upstream([done]), (event, data) => sent.push([event, data]));

		expect(sent).toEqual([["handoff", { message: "I couldn't find that on our site." }]]);
	});
});

describe("pagesFrom", () => {
	it("gives each page once, with live URLs and short titles, keeping all its text", () => {
		const pages = pagesFrom([
			{ item: { key: "work__roam-charging.html", metadata: { title: "Roam Charging | Case study" } }, text: "A" },
			{ item: { key: "work__roam-charging.html", metadata: {} }, text: "B" },
			{ item: { key: "index.html", metadata: {} }, text: "C" },
			{ item: { key: "https://www.spurwing.co.uk/faq", metadata: {} }, text: "D" },
		]);

		expect(pages).toEqual([
			{ title: "Roam Charging", url: "https://www.spurwing.co.uk/work/roam-charging", text: "A\nB" },
			{ title: "Home", url: "https://www.spurwing.co.uk", text: "C" },
			{ title: "Faq", url: "https://www.spurwing.co.uk/faq", text: "D" },
		]);
	});
});

describe("citedPages", () => {
	it("cites the pages the answer drew on, not the ones search ranked first", () => {
		const pages = [
			{ title: "Discovery call", url: "/discovery-call", text: "Book a thirty minute call about your website plans." },
			{ title: "Aethos Hotels", url: "/work/aethos-hotels", text: "Aethos Hotels: eight WordPress sites brought into one Webflow site with booking integrations." },
		];

		expect(citedPages(pages, "Yes, we worked with Aethos Hotels to bring eight WordPress sites into one, with booking integrations.")).toEqual([
			{ title: "Aethos Hotels", url: "/work/aethos-hotels" },
		]);
	});
});

describe("links", () => {
	it("lists each page once, and never the LLM info page", async () => {
		const { links } = await import("./answer.js");
		expect(
			links([
				{ title: "About Spurwing", url: "https://www.spurwing.co.uk/about" },
				{ title: "About Spurwing", url: "https://www.spurwing.co.uk/about" },
				{ title: "LLM info", url: "https://www.spurwing.co.uk/llm-info", unlinked: true },
			]),
		).toEqual([{ title: "About Spurwing", url: "https://www.spurwing.co.uk/about" }]);
	});
});

describe("the LLM info page", () => {
	it("answers from it but never links visitors to it", () => {
		const pages = pagesFrom([
			{ item: { key: "llm-info.html", metadata: { url: "https://www.spurwing.co.uk/llm-info", title: "LLM info | Spurwing" } }, text: "Spurwing Agency Limited, company number 12977511." },
			{ item: { key: "about.html", metadata: {} }, text: "About" },
		]);
		expect(pages[0]).toMatchObject({ url: "https://www.spurwing.co.uk/llm-info", unlinked: true });
		const cited = citedPages(pages, "Spurwing Agency Limited, company number 12977511.");
		expect(cited).toEqual([{ title: "LLM info", url: "https://www.spurwing.co.uk/llm-info", unlinked: true }]);
		expect(links(cited)).toEqual([]);
	});
});
