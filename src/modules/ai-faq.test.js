import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motion = vi.hoisted(() => ({ animate: vi.fn() }));

vi.mock("motion", () => ({ animate: motion.animate }));

import { config, initAiFaq, loadAnswers, readEvents } from "./ai-faq.js";

const markup = `
	<div data-ai-faq="component">
		<div data-ai-faq="ask">
			<div class="faq-card"><div class="faq-card_trigger">
				<textarea data-ai-faq="input"></textarea>
				<svg data-ai-faq="sparkle" class="ai-faq_sparkle"><path d="M1 1"/><path d="M2 2"/><path d="M3 3"/></svg>
				<button data-ai-faq="send" type="button"></button>
			</div></div>
		</div>
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

const settled = () =>
	vi.waitFor(() => {
		expect($('[data-ai-faq="answer"]')).not.toBeNull();
		expect($('[data-ai-faq="answer"][aria-busy]')).toBeNull();
	});

describe("initAiFaq", () => {
	beforeEach(() => {
		config.minStageMs = 0;
		config.turnstileSiteKey = "";
		motion.animate.mockReset().mockReturnValue({ stop: vi.fn(), finished: Promise.resolve() });
		vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
		// jsdom has no layout, so no scrollIntoView or IntersectionObserver.
		Element.prototype.scrollIntoView = vi.fn();
		Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn() }));
		vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
		// jsdom's test page has no storage of its own.
		const stored = new Map();
		vi.stubGlobal("localStorage", {
			getItem: (key) => stored.get(key) ?? null,
			setItem: (key, value) => stored.set(key, String(value)),
		});
		document.body.innerHTML = markup;
	});

	afterEach(() => {
		document.body.innerHTML = "";
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it("streams the answer into a FAQ card straight under the box, which stays", async () => {
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
		expect([...card.querySelectorAll(".rich-text a")].map((link) => link.getAttribute("href"))).toEqual(["/about", "/approach"]);
		expect(card.hasAttribute("aria-busy")).toBe(false);
		expect($('[data-ai-faq="ask"]').hidden).toBe(false);
		expect($('[data-ai-faq="ask"]').nextElementSibling).toBe(card);
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

	it("reveals the ask card with the FAQ cards", () => {
		initAiFaq();

		expect($(".faq-card").getAttribute("data-anim")).toBe("card");
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
		expect([...card.querySelectorAll(".rich-text p:not(.ai-faq_note)")].map((p) => p.textContent)).toEqual([
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
		ask("And how much?");
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

		expect(JSON.parse(fetch.mock.calls[1][1].body).history).toEqual([
			{ role: "user", content: "How long does a project take?" },
			{ role: "assistant", content: "8 to 12 weeks." },
		]);
	});

	it("clears the text box for the next question", async () => {
		respondWith(sse([["token", "Yes."]]));
		initAiFaq();
		const input = $('[data-ai-faq="input"]');

		ask("Do you offer training?");
		await settled();

		expect(input.style.height).toBe("");
		expect(input.value).toBe("");
	});

	it("opens the answer under the box, an FAQ card with the sparkle twinkling as its icon", async () => {
		let finish;
		vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => (finish = resolve))));
		initAiFaq();

		ask("Do you build e-commerce?");
		await vi.waitFor(() => expect($('[data-ai-faq="answer"]')).not.toBeNull());

		const card = $('[data-ai-faq="answer"]');
		expect(card.previousElementSibling).toBe($('[data-ai-faq="ask"]'));
		expect([...card.children].map((child) => child.tagName + "." + child.className)).toEqual(["H3.faq-card_title", "DIV.faq-card_panel"]);
		expect(card.querySelector("h3.faq-card_title > .faq-card_trigger > span")).not.toBeNull();
		const star = card.querySelector(".faq-card_icon svg");
		expect(star.hasAttribute("data-ai-faq")).toBe(false);
		expect(star.hasAttribute("class")).toBe(false);
		const twinkles = motion.animate.mock.calls.filter(([, keyframes]) => keyframes.rotate?.[1] === 45);
		expect(twinkles.map(([path]) => path)).toEqual([...star.querySelectorAll("path")]);
		expect(card.querySelector(".rich-text p").textContent).toBe("Reading the site…");

		finish(new Response(sse([["token", "Yes."]])));
		await settled();
		expect(card.querySelector(".faq-card_icon svg")).toBe(star);
	});

	it("keeps focus in the box, ready for the next question", async () => {
		respondWith(sse([["token", "Yes."]]));
		initAiFaq();
		const input = $('[data-ai-faq="input"]');

		input.focus();
		ask("Keyboard?");
		await settled();

		expect($('[data-ai-faq="answer"] h3').textContent).toBe("Keyboard?");
		expect(document.activeElement).toBe(input);
	});

	it("tells a screen reader it is writing, then reads the finished answer once", async () => {
		respondWith(
			sse([
				["sources", [{ title: "About", url: "/about" }]],
				["token", "Six "],
				["token", "people."],
			]),
		);
		initAiFaq();
		const status = $('[data-ai-faq="component"] [role="status"]');
		expect(status.className).toBe("u-visually-hidden");
		expect(status.textContent).toBe("");

		ask("How many?");
		expect(status.textContent).toBe("Writing an answer…");
		await settled();

		expect(status.textContent).toBe("Six people.");
		expect($('[data-ai-faq="answer"] [aria-live]')).toBeNull();
	});

	it("reveals first when it leads the list, and after the questions when it ends it", () => {
		const question = '<div data-accordion="item"></div>';
		document.body.innerHTML = `<div class="list">${markup}${question}${question}</div>`;
		initAiFaq();
		expect($(".faq-card").style.getPropertyValue("--anim-i")).toBe("0");

		document.body.innerHTML = `<div class="list">${question}${question}${markup}</div>`;
		initAiFaq();
		expect($(".faq-card").style.getPropertyValue("--anim-i")).toBe("2");
	});

	it("lets a new answer take its room gradually so the page below glides", async () => {
		respondWith(sse([["token", "Yes."]]));
		initAiFaq();
		$('[data-ai-faq="component"]').style.rowGap = "20px";

		ask("Smooth?");
		const card = $('[data-ai-faq="answer"]');
		await settled();

		const index = Element.prototype.animate.mock.contexts.indexOf(card);
		expect(Element.prototype.animate.mock.calls[index][0]).toEqual([{ marginTop: "-20px" }, { marginTop: "0px" }]);
	});

	it("sends each question's ID, its conversation and Clarity's IDs, and tags Clarity with the question's ID", async () => {
		const clarity = vi.fn();
		vi.stubGlobal("clarity", clarity);
		document.cookie = "_clck=1abc2de%5E2%5Egax%5E1%5E2423";
		document.cookie = "_clsk=9xyz%5E1793975172285%5E31%5E1%5Et.clarity.ms%2Fcollect";
		const fetch = respondWith(sse([["token", "Yes."]]));
		initAiFaq();

		ask("First?");
		await settled();
		fetch.mockImplementation(async () => new Response(sse([["token", "Again."]])));
		ask("Second?");
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

		const [first, second] = fetch.mock.calls.map(([, init]) => JSON.parse(init.body));
		expect(first.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(second.id).not.toBe(first.id);
		expect(second.conversation).toBe(first.conversation);
		expect(first.clarity).toEqual({ user: "1abc2de", session: "9xyz" });
		expect(clarity).toHaveBeenCalledWith("set", "ai_faq_question_id", first.id);
		document.cookie = "_clck=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
		document.cookie = "_clsk=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
	});

	it("puts each new answer straight under the box, above the earlier ones", async () => {
		const fetch = respondWith(sse([["token", "Yes."]]));
		initAiFaq();

		ask("First?");
		await settled();
		fetch.mockImplementation(async () => new Response(sse([["token", "Again."]])));
		ask("Second?");
		await vi.waitFor(() => expect(document.querySelectorAll('[data-ai-faq="answer"]:not([aria-busy])')).toHaveLength(2));

		const titles = [...document.querySelectorAll('[data-ai-faq="answer"] h3')].map((heading) => heading.textContent);
		expect(titles).toEqual(["Second?", "First?"]);
	});

	it("closes the earlier answers when a new question is asked", async () => {
		const fetch = respondWith(sse([["token", "Yes."]]));
		initAiFaq();

		ask("First?");
		await settled();
		fetch.mockImplementation(async () => new Response(sse([["token", "Again."]])));
		ask("Second?");
		await vi.waitFor(() => expect(document.querySelectorAll('[data-ai-faq="answer"]:not([aria-busy])')).toHaveLength(2));

		const expanded = [...document.querySelectorAll('[data-ai-faq="answer"] .faq-card_trigger')].map((trigger) => trigger.getAttribute("aria-expanded"));
		expect(expanded).toEqual(["true", "false"]);
	});

	it("says the answer was written by AI, with a report link and Remove", async () => {
		respondWith(sse([["token", "Yes."]]));
		initAiFaq();

		ask("Do you do SEO?");
		await settled();

		const card = $('[data-ai-faq="answer"]');
		expect(card.querySelector(".ai-faq_note").textContent).toBe("This answer was generated by AI. Report an issue.");
		expect(card.querySelector(".ai-faq_report").getAttribute("href")).toBe("/discovery-call?notes=Do%20you%20do%20SEO%3F");
		expect(card.querySelector(".ai-faq_remove").getAttribute("aria-label")).toBe("Remove: Do you do SEO?");
		expect(card.querySelector(".ai-faq_cancel")).toBeNull();
	});

	it("leaves the AI line off a hand-off", async () => {
		respondWith(sse([["handoff", { message: "I couldn't find that on our site." }]]));
		initAiFaq();

		ask("Do you build apps?");
		await settled();

		expect($(".ai-faq_note")).toBeNull();
		expect($(".ai-faq_remove")).not.toBeNull();
		expect(loadAnswers()).toEqual([]);
	});

	it("opens and closes a finished answer like an FAQ", async () => {
		respondWith(sse([["token", "Yes."]]));
		initAiFaq();

		ask("Open?");
		await settled();
		const trigger = $('[data-ai-faq="answer"] .faq-card_trigger');
		const content = $('[data-ai-faq="answer"] .faq-card_content');
		expect(trigger.tagName).toBe("BUTTON");
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		expect(trigger.getAttribute("aria-controls")).toBe(content.id);

		trigger.click();
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		expect(content.inert).toBe(true);

		trigger.click();
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		expect(content.inert).toBe(false);
	});

	it("cancels a question: the request stops and its card goes", async () => {
		let aborted;
		vi.stubGlobal(
			"fetch",
			vi.fn((url, init) => {
				aborted = init.signal;
				return new Promise((resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))));
			}),
		);
		initAiFaq();

		ask("Never mind?");
		await vi.waitFor(() => expect(aborted).toBeDefined());
		const card = $('[data-ai-faq="answer"]');
		$(".ai-faq_cancel").click();

		expect(aborted.aborted).toBe(true);
		await vi.waitFor(() => expect(Element.prototype.animate.mock.calls.at(-1)[0][1]).toMatchObject({ opacity: 0 }));
		Element.prototype.animate.mock.results.at(-1).value.onfinish();
		expect(card.isConnected).toBe(false);
		expect(loadAnswers()).toEqual([]);
	});

	it("keeps answers in the browser and shows them, closed, on the next page", async () => {
		respondWith(sse([["sources", [{ title: "About", url: "/about" }]], ["token", "Six people."]]));
		initAiFaq();

		ask("How many?");
		await settled();
		expect(loadAnswers()).toMatchObject([{ question: "How many?", answer: "Six people.", pages: [{ title: "About", url: "/about" }] }]);

		document.body.innerHTML = markup;
		initAiFaq();

		const card = $('[data-ai-faq="answer"]');
		expect(card.previousElementSibling).toBe($('[data-ai-faq="ask"]'));
		expect(card.querySelector("h3").textContent).toBe("How many?");
		expect(card.querySelector(".rich-text p").textContent).toBe("Six people.");
		expect(card.querySelector("[data-ai-faq-sources]").textContent).toBe("From: About");
		expect(card.querySelector(".faq-card_trigger").getAttribute("aria-expanded")).toBe("false");
	});

	it("keeps only the newest answers", async () => {
		config.keep = 2;
		const fetch = respondWith(sse([["token", "Yes."]]));
		initAiFaq();

		for (const question of ["One?", "Two?", "Three?"]) {
			fetch.mockImplementation(async () => new Response(sse([["token", "Yes."]])));
			ask(question);
			await vi.waitFor(() => expect(loadAnswers()[0]?.question).toBe(question));
		}

		expect(loadAnswers().map((item) => item.question)).toEqual(["Three?", "Two?"]);
		config.keep = 10;
	});

	it("removes an answer from the page and the browser, and Undo brings it back", async () => {
		respondWith(sse([["token", "Yes."]]));
		Element.prototype.getAnimations = vi.fn(() => []);
		initAiFaq();

		ask("Gone?");
		await settled();
		const card = $('[data-ai-faq="answer"]');
		card.querySelector(".ai-faq_remove").click();
		Element.prototype.animate.mock.results.at(-1).value.onfinish();

		expect(card.isConnected).toBe(false);
		expect(loadAnswers()).toEqual([]);
		expect(document.activeElement).toBe($('[data-ai-faq="input"]'));
		const note = $(".ai-faq_toast");
		expect(note.hidden).toBe(false);
		expect(note.textContent).toBe("Question removedUndo");

		$(".ai-faq_undo").click();

		expect($('[data-ai-faq="ask"]').nextElementSibling).toBe(card);
		expect(loadAnswers().map((item) => item.question)).toEqual(["Gone?"]);
		expect(note.hidden).toBe(true);
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
