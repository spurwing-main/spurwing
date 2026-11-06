import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motion = vi.hoisted(() => ({ animate: vi.fn() }));

vi.mock("motion", () => ({ animate: motion.animate }));

import { config, initAiFaq, readEvents } from "./ai-faq.js";

const markup = `
	<div data-ai-faq="component">
		<div data-ai-faq="ask">
			<svg data-ai-faq="sparkle" class="ai-faq_sparkle"><path d="M1 1"/><path d="M2 2"/><path d="M3 3"/></svg>
			<div class="faq-card"><div class="faq-card_trigger">
				<textarea data-ai-faq="input"></textarea>
				<button data-ai-faq="send" type="button"></button>
			</div></div>
		</div>
		<button data-ai-faq="another" type="button"><svg></svg></button>
	</div>
`;

const $ = (selector) => document.querySelector(selector);

function sse(events) {
	return events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join("");
}

function respondWith(body, init = { status: 200 }) {
	const fetch = vi.fn(async () => new Response(body, init));
	vi.stubGlobal("fetch", fetch);
	return fetch;
}

function ask(question) {
	$('[data-ai-faq="input"]').value = question;
	$('[data-ai-faq="send"]').click();
}

const settled = () => vi.waitFor(() => expect($('[data-ai-faq="another"]').hidden).toBe(false));

describe("initAiFaq", () => {
	beforeEach(() => {
		config.minStageMs = 0;
		config.turnstileSiteKey = "";
		motion.animate.mockReset().mockReturnValue({ stop: vi.fn(), finished: Promise.resolve() });
		vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
		// jsdom has no layout, so no scrollIntoView or IntersectionObserver.
		Element.prototype.scrollIntoView = vi.fn();
		Element.prototype.animate = vi.fn();
		vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
		document.body.innerHTML = markup;
	});

	afterEach(() => {
		document.body.innerHTML = "";
		vi.unstubAllGlobals();
	});

	it("streams the answer into a FAQ card under the question, then offers another question", async () => {
		const fetch = respondWith(
			sse([
				["sources", [{ title: "About", url: "/about" }, { title: "Approach", url: "/approach" }]],
				["token", "Spurwing has "],
				["token", "six people."],
				["done", {}],
			]),
		);
		initAiFaq();

		ask("How many people work at Spurwing?");
		await settled();

		const card = $('[data-ai-faq="answer"]');
		expect(card.className).toBe("faq-card");
		expect(card.querySelector(".faq-card_title").textContent).toBe("How many people work at Spurwing?");
		expect(card.querySelector(".rich-text p").textContent).toBe("Spurwing has six people.");
		expect([...card.querySelectorAll("a")].map((link) => link.getAttribute("href"))).toEqual(["/about", "/approach"]);
		expect(card.hasAttribute("aria-busy")).toBe(false);
		expect($('[data-ai-faq="ask"]').hidden).toBe(true);
		expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ question: "How many people work at Spurwing?", history: [] });
	});

	it("fetches the Turnstile token on focus and uses it when the question is sent", async () => {
		config.turnstileSiteKey = "site-key";
		let issued = 0;
		const render = vi.fn((holder, options) => options.callback(`token-${++issued}`));
		vi.stubGlobal("turnstile", { render });
		const append = HTMLHeadElement.prototype.append;
		vi.spyOn(HTMLHeadElement.prototype, "append").mockImplementation(function (script) {
			if (script.src?.includes("turnstile")) return queueMicrotask(() => script.onload());
			return append.call(this, script);
		});
		const fetch = respondWith(sse([["token", "Yes."]]));
		initAiFaq();

		$('[data-ai-faq="input"]').dispatchEvent(new Event("focus"));
		await vi.waitFor(() => expect(render).toHaveBeenCalledOnce());
		ask("Hi?");
		await settled();

		expect(JSON.parse(fetch.mock.calls[0][1].body).token).toBe("token-1");
		// …and the next question's token is already on its way.
		expect(render).toHaveBeenCalledTimes(2);
	});

	it("reveals the ask card with the FAQ cards and fades the sparkle in with it", async () => {
		document.documentElement.setAttribute("data-anim-ready", "");
		initAiFaq();
		const card = $(".faq-card");
		const sparkle = $('[data-ai-faq="sparkle"]');

		expect(card.getAttribute("data-anim")).toBe("card");
		expect(sparkle.style.opacity).toBe("0");

		card.setAttribute("data-anim-state", "in");
		await vi.waitFor(() =>
			expect(motion.animate).toHaveBeenCalledWith(sparkle, { opacity: 1, scale: [0.6, 1] }, expect.objectContaining({ duration: 0.5 })),
		);
		document.documentElement.removeAttribute("data-anim-ready");
	});

	it("hides Ask another question until there is an answer", () => {
		initAiFaq();

		expect($('[data-ai-faq="another"]').hidden).toBe(true);
	});

	it("cites the pages the finished answer drew on, and keeps paragraphs", async () => {
		respondWith(
			sse([
				["sources", [{ title: "Discovery call", url: "/discovery-call" }, { title: "Aethos Hotels", url: "/work/aethos-hotels" }]],
				["token", "Yes, Aethos Hotels.\n\nWe brought eight sites into one."],
				["cited", [{ title: "Aethos Hotels", url: "/work/aethos-hotels" }]],
				["done", {}],
			]),
		);
		initAiFaq();

		ask("Have you worked with any hotels?");
		await settled();

		const card = $('[data-ai-faq="answer"]');
		expect([...card.querySelectorAll(".rich-text p")].map((p) => p.textContent)).toEqual([
			"Yes, Aethos Hotels.",
			"We brought eight sites into one.",
			"From: Aethos Hotels",
		]);
	});

	it("is never marked up as a published FAQ or an accordion item", async () => {
		respondWith(sse([["token", "Yes."]]));
		initAiFaq();

		ask("Can you connect our tools?");
		await settled();

		const card = $('[data-ai-faq="answer"]');
		expect(card.querySelector("[itemprop], [itemscope], [data-accordion]")).toBeNull();
		expect(card.hasAttribute("data-accordion")).toBe(false);
	});

	it("hands off to the discovery call with the question in the booking notes", async () => {
		respondWith(sse([["handoff", { message: "I couldn't find that on our site." }]]));
		initAiFaq();

		ask("Do you build apps?");
		await settled();

		const link = $('[data-ai-faq="answer"] a');
		expect($('[data-ai-faq="answer"] p').textContent).toContain("I couldn't find that on our site.");
		expect(link.getAttribute("href")).toBe("/discovery-call?notes=Do%20you%20build%20apps%3F");
	});

	it("hands off when the service fails", async () => {
		respondWith("", { status: 429 });
		initAiFaq();

		ask("How much is a website?");
		await settled();

		expect($('[data-ai-faq="answer"] p').textContent).toContain(config.failure);
	});

	it("sends the previous question and answer with a follow-up", async () => {
		const fetch = respondWith(sse([["token", "8 to 12 weeks."]]));
		initAiFaq();

		ask("How long does a project take?");
		await settled();
		$('[data-ai-faq="another"]').click();
		ask("And how much?");
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

		expect(JSON.parse(fetch.mock.calls[1][1].body).history).toEqual([
			{ role: "user", content: "How long does a project take?" },
			{ role: "assistant", content: "8 to 12 weeks." },
		]);
	});

	it("brings the text box back usable: never sized while hidden", async () => {
		respondWith(sse([["token", "Yes."]]));
		initAiFaq();
		const input = $('[data-ai-faq="input"]');

		ask("Do you offer training?");
		await settled();

		expect(input.style.height).toBe("");
		expect(input.value).toBe("");
	});

	it("opens the answer in the ask card's place, an FAQ card with the sparkle twinkling as its icon", async () => {
		let finish;
		vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => (finish = resolve))));
		initAiFaq();

		ask("Do you build e-commerce?");
		await vi.waitFor(() => expect($('[data-ai-faq="answer"]')).not.toBeNull());

		const card = $('[data-ai-faq="answer"]');
		expect(card.nextElementSibling).toBe($('[data-ai-faq="ask"]'));
		expect([...card.children].map((child) => child.className)).toEqual(["faq-card_trigger", "faq-card_panel"]);
		const star = card.querySelector(".faq-card_icon svg");
		expect(star.hasAttribute("data-ai-faq")).toBe(false);
		expect(star.hasAttribute("class")).toBe(false);
		const twinkles = motion.animate.mock.calls.filter(([, keyframes]) => keyframes.rotate?.[1] === 45);
		expect(twinkles.map(([path]) => path)).toEqual([...star.querySelectorAll("path")]);
		expect(card.querySelector(".rich-text p").textContent).toBe("Reading the site…");

		finish(new Response(sse([["token", "Yes."]])));
		await settled();
		expect(card.querySelector(".faq-card_icon svg path").getAttribute("d")).toMatch(/^M56 86/);
	});

	it("moves focus to Ask another when the text box took it away", async () => {
		respondWith(sse([["token", "Yes."]]));
		initAiFaq();

		$('[data-ai-faq="input"]').focus();
		ask("Keyboard?");
		await settled();

		expect(document.activeElement).toBe($('[data-ai-faq="another"]'));
	});

	it("lets Ask another, then the new ask card, take their room gradually so the page below glides", async () => {
		respondWith(sse([["token", "Yes."]]));
		initAiFaq();
		$('[data-ai-faq="component"]').style.rowGap = "20px";
		const another = $('[data-ai-faq="another"]');
		const askCard = $('[data-ai-faq="ask"]');
		another.getBoundingClientRect = () => ({ height: 22 });
		askCard.getBoundingClientRect = () => ({ height: 79 });

		ask("Smooth?");
		await settled();
		expect(Element.prototype.animate.mock.contexts.at(-1)).toBe(another);
		expect(Element.prototype.animate.mock.calls.at(-1)[0]).toEqual([{ marginTop: "-42px" }, { marginTop: "0px" }]);

		another.click();
		expect(Element.prototype.animate.mock.contexts.at(-1)).toBe(askCard);
		expect(Element.prototype.animate.mock.calls.at(-1)[0]).toEqual([{ marginTop: "-57px" }, { marginTop: "0px" }]);
	});

	it("brings the ask card back for another question", async () => {
		respondWith(sse([["token", "Yes."]]));
		initAiFaq();

		ask("Do you do SEO?");
		await settled();
		$('[data-ai-faq="another"]').click();

		expect($('[data-ai-faq="ask"]').hidden).toBe(false);
		expect($('[data-ai-faq="another"]').hidden).toBe(true);
		expect(document.activeElement).toBe($('[data-ai-faq="input"]'));
	});

	it("asks on Enter but not on Shift+Enter, and ignores an empty question", async () => {
		const fetch = respondWith(sse([["token", "Yes."]]));
		initAiFaq();
		const input = $('[data-ai-faq="input"]');

		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		input.value = "Hello";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true }));
		await Promise.resolve();
		expect(fetch).not.toHaveBeenCalled();

		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
	});

	it("sets each FAQ list up once, however often it runs", async () => {
		const fetch = respondWith(sse([["token", "Yes."]]));
		initAiFaq();
		initAiFaq();

		ask("Once?");
		await settled();

		expect(fetch).toHaveBeenCalledOnce();
	});

	it("stops the request when the page goes", async () => {
		let aborted;
		vi.stubGlobal(
			"fetch",
			vi.fn((url, init) => {
				aborted = init.signal;
				return new Promise(() => {});
			}),
		);
		const controller = new AbortController();
		initAiFaq(document, { signal: controller.signal });

		ask("Still there?");
		await vi.waitFor(() => expect(aborted).toBeDefined());
		controller.abort();

		expect(aborted.aborted).toBe(true);
	});

	it("leaves the motion out for reduced motion", async () => {
		vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
		respondWith(sse([["token", "Yes."]]));
		initAiFaq();

		ask("Calm?");
		await settled();

		const animated = motion.animate.mock.calls.filter(([, , options]) => options?.duration > 0);
		expect(animated).toEqual([]);
	});
});

describe("readEvents", () => {
	it("parses events split across reads", async () => {
		const parts = ['event: token\ndata: "Hel', 'lo"\n\nevent: sources\ndata: []\n\n'];
		const body = new ReadableStream({
			start(controller) {
				parts.forEach((part) => controller.enqueue(new TextEncoder().encode(part)));
				controller.close();
			},
		});

		const events = [];
		for await (const event of readEvents(body)) events.push(event);

		expect(events).toEqual([
			{ event: "token", data: "Hello" },
			{ event: "sources", data: [] },
		]);
	});
});
