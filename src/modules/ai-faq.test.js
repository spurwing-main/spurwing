import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motion = vi.hoisted(() => ({ animate: vi.fn() }));

vi.mock("motion", () => ({ animate: motion.animate }));

import { config, initAiFaq, loadAnswers, readEvents, sameQuestion } from "./ai-faq.js";
import { initFaq } from "./faq.js";

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

// The Worker's stream, ending as it always does with `done`.
function sse(events) {
	return [...events, ["done", {}]].map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join("");
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
		// No minute to wait out, unless a test sets one.
		config.minuteMs = 0;
		config.turnstileSiteKey = "";
		motion.animate.mockReset().mockReturnValue({ stop: vi.fn(), finished: Promise.resolve() });
		vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
		// jsdom has no layout, so no scrollIntoView or IntersectionObserver.
		Element.prototype.scrollIntoView = vi.fn();
		// A slide finishes at once, so a card sliding shut is closed straight away.
		Element.prototype.animate = vi.fn(() => ({ cancel: vi.fn(), addEventListener: (type, done) => done() }));
		Element.prototype.getAnimations = vi.fn(() => []);
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
		expect(card.querySelector(".faq-card_title > span").textContent).toBe("How many people work at Spurwing?");
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

	// A bot check whose passes go as `outcomes` says, one per widget: a token,
	// "error", or "never" (no answer at all).
	function botCheck(key, outcomes) {
		config.turnstileSiteKey = key;
		const render = vi.fn((holder, options) => {
			const outcome = outcomes[render.mock.calls.length - 1] ?? "token-late";
			if (outcome === "error") options["error-callback"]();
			else if (outcome !== "never") options.callback(outcome);
			return `widget-${render.mock.calls.length}`;
		});
		const remove = vi.fn();
		vi.stubGlobal("turnstile", { render, remove });
		const append = HTMLHeadElement.prototype.append;
		vi.spyOn(HTMLHeadElement.prototype, "append").mockImplementation(function (script) {
			if (script.src?.includes("turnstile")) return queueMicrotask(() => script.onload());
			return append.call(this, script);
		});
		return { render, remove };
	}

	it("tries a fresh bot pass when the first one fails, and the question still goes", async () => {
		const { render, remove } = botCheck("key-error", ["error", "token-2"]);
		const fetch = respondWith(sse([["token", "Yes."]]));
		initAiFaq();

		ask("Hi?");
		await settled();

		expect(render.mock.calls[0][1].retry).toBe("never");
		expect(JSON.parse(fetch.mock.calls[0][1].body).token).toBe("token-2");
		expect(remove).toHaveBeenCalledWith("widget-1");
		expect($('[data-ai-faq="answer"] .rich-text p').textContent).toBe("Yes.");
	});

	it("gives up on a bot pass that never comes, tries once more, then says it couldn't answer", async () => {
		config.botCheckMs = 30;
		const { render } = botCheck("key-never", ["never", "never"]);
		const fetch = respondWith(sse([["token", "Yes."]]));
		initAiFaq();

		ask("Hi?");
		await settled();

		expect(render).toHaveBeenCalledTimes(3); // two tries, then the next spare
		expect(fetch).not.toHaveBeenCalled();
		expect($('[data-ai-faq="answer"] p').textContent).toContain(config.failure);
		config.botCheckMs = 7000;
	});

	it("gets a fresh bot pass and sends again when the service refuses the pass", async () => {
		botCheck("key-refused", ["token-1", "token-2"]);
		const fetch = vi.fn(async () =>
			fetch.mock.calls.length === 1 ? new Response("", { status: 403 }) : new Response(sse([["token", "Yes."]])),
		);
		vi.stubGlobal("fetch", fetch);
		initAiFaq();

		ask("Hi?");
		await settled();

		expect(fetch.mock.calls.map(([, init]) => JSON.parse(init.body).token)).toEqual(["token-1", "token-2"]);
	});

	it("gives up when the answer goes quiet, however long it has run", async () => {
		config.silenceMs = 30;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url, init) => {
				const body = new ReadableStream({
					start(controller) {
						controller.enqueue(new TextEncoder().encode(sse([["token", "Six "]])));
						init.signal.addEventListener("abort", () => controller.error(new Error("aborted")));
					},
				});
				return new Response(body);
			}),
		);
		initAiFaq();

		ask("How many?");
		await settled();

		expect($('[data-ai-faq="answer"] p').textContent).toContain(config.failure);
		config.silenceMs = 15000;
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

	it("shows **bold** as bold, even when a marker is split between two pieces", async () => {
		respondWith(
			sse([
				["token", "Most projects take *"],
				["token", "*8–12 weeks**, depending on scope.\n\nSmaller ones are **faster"],
				["token", "**."],
				["done", {}],
			]),
		);
		initAiFaq();

		ask("How long does a project take?");
		await settled();

		const card = $('[data-ai-faq="answer"]');
		expect([...card.querySelectorAll(".rich-text strong")].map((b) => b.textContent)).toEqual(["8–12 weeks", "faster"]);
		expect(card.querySelector(".rich-text").textContent).not.toContain("*");
	});

	it("is an FAQ card in the group, never marked up as a published FAQ", async () => {
		respondWith(sse([["token", "Yes."]]));
		initAiFaq();

		ask("Can you connect our tools?");
		await settled();

		const card = $('[data-ai-faq="answer"]');
		expect(card.matches('details[data-accordion="item"][name="faq"]')).toBe(true);
		expect(card.querySelector(':scope > summary[data-accordion="trigger"] + [data-accordion="content"]')).not.toBeNull();
		expect(card.querySelector("[itemprop], [itemscope]")).toBeNull();
		expect(card.hasAttribute("itemprop")).toBe(false);
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
		respondWith("", { status: 500 });
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
		expect([...card.children].map((child) => child.tagName + "." + child.className)).toEqual(["SUMMARY.faq-card_trigger", "DIV.faq-card_panel"]);
		expect(card.querySelector("summary > h3.faq-card_title > span")).not.toBeNull();
		expect(card.open).toBe(true);
		expect(card.hasAttribute("aria-busy")).toBe(true);
		const star = card.querySelector(".faq-card_icon svg");
		expect(star.hasAttribute("data-ai-faq")).toBe(false);
		expect(star.hasAttribute("class")).toBe(false);
		const twinkles = motion.animate.mock.calls.filter(([, keyframes]) => keyframes.rotate?.[1] === 45);
		expect(twinkles.map(([path]) => path)).toEqual([...star.querySelectorAll("path")]);
		expect(card.querySelector(".rich-text p").textContent).toBe("Checking…");

		await vi.waitFor(() => expect(finish).toBeDefined());
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

		expect($('[data-ai-faq="answer"] .faq-card_title > span').textContent).toBe("Keyboard?");
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
		expect(status.textContent).toBe("Typing…");
		await settled();

		expect(status.textContent).toBe("Six people.");
		expect($('[data-ai-faq="answer"] [aria-live]')).toBeNull();
	});

	it("lets a new answer take its room gradually so the page below glides", async () => {
		respondWith(sse([["token", "Yes."]]));
		initAiFaq();
		$('[data-ai-faq="component"]').style.rowGap = "20px";

		ask("Smooth?");
		const card = $('[data-ai-faq="answer"]');
		await settled();

		// The slot opens, and the card comes in with the FAQ cards' own reveal.
		const calls = Element.prototype.animate.mock.calls.filter((call, i) => Element.prototype.animate.mock.contexts[i] === card);
		expect(calls.map(([keyframes]) => keyframes)).toEqual([[{ marginTop: "-20px" }, { marginTop: "0px" }]]);
		expect(card.getAttribute("data-anim")).toBe("card");
		expect(card.getAttribute("data-anim-state")).toBe("in");
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

		const titles = [...document.querySelectorAll('[data-ai-faq="answer"] .faq-card_title > span')].map((title) => title.textContent);
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

		const open = [...document.querySelectorAll('[data-ai-faq="answer"]')].map((card) => card.open);
		expect(open).toEqual([true, false]);
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

	it("opens and closes like an FAQ once written, and not while it is", async () => {
		let finish;
		vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => (finish = resolve))));
		const run = new AbortController();
		initAiFaq();
		initFaq(document, { signal: run.signal });

		ask("Open?");
		await vi.waitFor(() => expect(finish).toBeDefined());
		const card = $('[data-ai-faq="answer"]');
		const trigger = card.querySelector("summary");
		trigger.click();
		expect(card.open).toBe(true);

		finish(new Response(sse([["token", "Yes."]])));
		await settled();
		trigger.click();
		expect(card.open).toBe(false);

		trigger.click();
		expect(card.open).toBe(true);
		run.abort();
	});

	it("answers a question asked while another is being answered, alongside it", async () => {
		let finishFirst;
		const fetch = vi.fn(async () => {
			if (fetch.mock.calls.length === 1) {
				await new Promise((resolve) => (finishFirst = resolve));
				return new Response(sse([["token", "Six people."]]));
			}
			return new Response(sse([["token", "From £15,000."]]));
		});
		vi.stubGlobal("fetch", fetch);
		initAiFaq();

		ask("How many?");
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
		ask("How much?");
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
		await vi.waitFor(() => expect($('[data-ai-faq="answer"] p').textContent).toBe("From £15,000."));
		finishFirst();
		await settled();

		const answers = [...document.querySelectorAll('[data-ai-faq="answer"] .rich-text p')].map((p) => p.textContent);
		expect(answers).toEqual(["From £15,000.", "Six people."]);
		expect($('[data-ai-faq="component"] [role="status"]').textContent).toBe("From £15,000.Six people.");
	});

	it("holds a sixth question in a minute until the minute is up, then sends it", async () => {
		config.minuteMs = 300;
		await new Promise((resolve) => setTimeout(resolve, 300));
		const fetch = respondWith(sse([["token", "Yes."]]));
		fetch.mockImplementation(async () => new Response(sse([["token", "Yes."]])));
		initAiFaq();

		for (const n of [1, 2, 3, 4, 5]) ask(`Question ${n}?`);
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(5));
		ask("Question 6?");
		const waiting = $('[data-ai-faq="answer"]');
		await vi.waitFor(() => expect(waiting.textContent).toContain(config.waiting));
		expect(fetch).toHaveBeenCalledTimes(5);

		await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(6));
		await vi.waitFor(() => expect(waiting.querySelector(".rich-text p").textContent).toBe("Yes."));
	});

	it("waits and tries again when the service says too many", async () => {
		config.minuteMs = 50;
		const fetch = vi.fn(async () =>
			fetch.mock.calls.length === 1 ? new Response("", { status: 429 }) : new Response(sse([["token", "Yes."]])),
		);
		vi.stubGlobal("fetch", fetch);
		initAiFaq();

		ask("Busy office?");
		await settled();

		expect(fetch).toHaveBeenCalledTimes(2);
		expect($('[data-ai-faq="answer"] .rich-text p').textContent).toBe("Yes.");
	});

	it("cancels a waiting question without sending it", async () => {
		config.minuteMs = 300;
		await new Promise((resolve) => setTimeout(resolve, 300));
		const fetch = respondWith(sse([["token", "Yes."]]));
		fetch.mockImplementation(async () => new Response(sse([["token", "Yes."]])));
		initAiFaq();

		for (const n of [1, 2, 3, 4, 5, 6]) ask(`Question ${n}?`);
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(5));
		$('[data-ai-faq="answer"] .ai-faq_cancel').click();
		await new Promise((resolve) => setTimeout(resolve, 400));

		expect(fetch).toHaveBeenCalledTimes(5);
	});

	it("doesn't ask a question this page already answered: the earlier answer opens where it is", async () => {
		const fetch = respondWith(sse([["token", "From £15,000."]]));
		initAiFaq();

		ask("How much does a project cost?");
		await settled();
		fetch.mockImplementation(async () => new Response(sse([["token", "Six people."]])));
		ask("How many people?");
		await vi.waitFor(() => expect(document.querySelectorAll('[data-ai-faq="answer"]:not([aria-busy])')).toHaveLength(2));
		ask("how much does a project cost");

		expect(fetch).toHaveBeenCalledTimes(2);
		const states = [...document.querySelectorAll('[data-ai-faq="answer"]')].map(
			(card) => `${card.querySelector(".faq-card_title > span").textContent} ${card.open}`,
		);
		expect(states).toEqual(["How many people? false", "How much does a project cost? true"]);
		expect($('[data-ai-faq="input"]').value).toBe("");
		expect(loadAnswers()[0].question).toBe("How much does a project cost?");
	});

	it("opens a written FAQ that asks the same question instead of asking the AI", async () => {
		const fetch = respondWith(sse([["token", "Yes."]]));
		document.body.innerHTML = `<div class="list">${markup}
			<details data-accordion="item">
				<summary data-accordion="trigger">How much does a Webflow website cost?</summary>
				<div data-accordion="content">From £15,000.</div>
			</details></div>`;
		const written = $('[data-accordion="item"]');
		initAiFaq();

		// A word that matters added: a different question, so the AI answers it.
		ask("How much does a webflow website audit cost?");
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
		ask("how much does a webflow website cost");

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(written.open).toBe(true);
		expect($('[data-ai-faq="component"] [role="status"]').lastElementChild.textContent).toBe("From £15,000.");
	});

	it("counts the same words that matter as the same question, ignoring case, punctuation and filler", () => {
		expect(sameQuestion("How much does a project cost?", "how much does a project cost")).toBe(true);
		expect(sameQuestion("How long does a website project take?", "how long does a project take?")).toBe(true);
		expect(sameQuestion("How much does a Webflow project cost?", "How much does a Webflow website cost?")).toBe(true);
		expect(sameQuestion("How long does a website project take?", "How long does a website migration take?")).toBe(false);
		expect(sameQuestion("How much does a Webflow website audit cost?", "How much does a Webflow website cost?")).toBe(false);
		expect(sameQuestion("How much does a project cost?", "How long does a project take?")).toBe(false);
		expect(sameQuestion("?", "?")).toBe(false);
	});

	it("marks the sparkle 'AI', on the box and on each answer, and puts it before the AI line", async () => {
		respondWith(sse([["token", "Yes."]]));
		initAiFaq();
		expect($('[data-ai-faq="ask"] .ai-faq_mark > [data-ai-faq="sparkle"] + .ai-faq_label').textContent).toBe("AI");

		ask("AI?");
		await settled();

		const card = $('[data-ai-faq="answer"]');
		expect(card.querySelector(".faq-card_icon .ai-faq_mark .ai-faq_label").textContent).toBe("AI");
		expect(card.querySelector(".ai-faq_note > svg.ai-faq_note-icon")).not.toBeNull();
		expect(card.querySelector(".ai-faq_note").textContent).toBe("This answer was generated by AI. Report an issue.");
	});

	it("lets a question that failed be asked again", async () => {
		const fetch = vi.fn(async () =>
			fetch.mock.calls.length === 1 ? new Response("", { status: 500 }) : new Response(sse([["token", "From £15,000."]])),
		);
		vi.stubGlobal("fetch", fetch);
		initAiFaq();

		ask("How much does a project cost?");
		await settled();
		ask("How much does a project cost?");
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
	});

	it("doesn't send a question twice while its answer is still being written", async () => {
		vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
		initAiFaq();

		ask("How much does a project cost?");
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
		ask("how much does a project cost");
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(document.querySelectorAll('[data-ai-faq="answer"]')).toHaveLength(1);
	});

	it("doesn't open a new answer's panel from nothing, so its slot is measured as it shows", async () => {
		respondWith(sse([["token", "Yes."]]));
		initAiFaq();

		ask("Smooth?");
		const panel = $('[data-ai-faq="answer"] .faq-card_panel');
		await settled();

		const fromNothing = Element.prototype.animate.mock.calls.filter(
			(call, i) => Element.prototype.animate.mock.contexts[i] === panel && call[0][0].height === "0px",
		);
		expect(fromNothing).toEqual([]);
	});

	it("clears what was written when an answer fails part-way, and says so", async () => {
		respondWith(sse([["token", "First paragraph.\n\nSecond"], ["error", { message: "failed" }]]));
		initAiFaq();

		ask("Long?");
		await settled();

		const paragraphs = [...document.querySelectorAll('[data-ai-faq="answer"] .rich-text p')].map((p) => p.textContent);
		expect(paragraphs).toEqual([`${config.failure} ${config.handoffLink}.`]);
	});

	it("treats an answer that stops without its end as failed, not finished", async () => {
		respondWith('event: token\ndata: "Most projects"\n\n');
		initAiFaq();

		ask("Cut off?");
		await settled();

		expect($('[data-ai-faq="answer"] p').textContent).toContain(config.failure);
		expect(loadAnswers()).toEqual([]);
	});

	it("keeps a paragraph break that arrives split across two pieces", async () => {
		respondWith(sse([["token", "One.\n"], ["token", "\nTwo."]]));
		initAiFaq();

		ask("Split?");
		await settled();

		const paragraphs = [...document.querySelectorAll('[data-ai-faq="answer"] .rich-text p')].map((p) => p.textContent);
		expect(paragraphs).toEqual(["One.", "Two."]);
	});

	it("stops the sparkle and shimmer on Cancel, and puts focus back in the box", async () => {
		const stop = vi.fn();
		motion.animate.mockReturnValue({ stop, finished: Promise.resolve() });
		vi.stubGlobal("fetch", vi.fn((url, init) => new Promise((resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))))));
		initAiFaq();

		ask("Never mind?");
		await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
		const before = stop.mock.calls.length;
		$(".ai-faq_cancel").focus();
		$(".ai-faq_cancel").click();
		await vi.waitFor(() => expect(stop.mock.calls.length).toBeGreaterThan(before));

		expect(document.activeElement).toBe($('[data-ai-faq="input"]'));
	});

	it("ignores a second press of Remove while the card leaves", async () => {
		respondWith(sse([["token", "Yes."]]));
		initAiFaq();

		ask("Twice?");
		await settled();
		const remove = $(".ai-faq_remove");
		remove.click();
		const leaving = Element.prototype.animate.mock.calls.length;
		remove.click();

		expect(Element.prototype.animate.mock.calls.length).toBe(leaving);
		expect($('[data-ai-faq="answer"]').inert).toBe(true);
	});

	it("leaves a removed answer out of later questions' context", async () => {
		const fetch = respondWith(sse([["token", "Six people."]]));
		fetch.mockImplementation(async () => new Response(sse([["token", "Yes."]])));
		initAiFaq();

		ask("How many?");
		await settled();
		$(".ai-faq_remove").click();
		ask("And where?");
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

		expect(JSON.parse(fetch.mock.calls[1][1].body).history).toEqual([]);
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
		await vi.waitFor(() => expect(Element.prototype.animate.mock.calls.at(-1)[0][0]).toEqual({ opacity: 1, transform: "none" }));
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
		expect(card.querySelector(".faq-card_title > span").textContent).toBe("How many?");
		expect(card.querySelector(".rich-text p").textContent).toBe("Six people.");
		expect(card.querySelector("[data-ai-faq-sources]").textContent).toBe("From: About");
		expect(card.open).toBe(false);
		expect(card.getAttribute("name")).toBe("faq");
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

	it("forgets an answer a day after it was asked", () => {
		const day = 24 * 60 * 60 * 1000;
		const item = (question, at) => ({ id: question, question, answer: "Yes.", pages: [], at });
		localStorage.setItem(config.storageKey, JSON.stringify([item("Today?", Date.now() - day + 60000), item("Yesterday?", Date.now() - day - 60000), { id: "x", question: "Untimed?", answer: "Yes." }]));
		initAiFaq();

		expect([...document.querySelectorAll('[data-ai-faq="answer"] .faq-card_title > span')].map((title) => title.textContent)).toEqual(["Today?"]);
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
		// Focus goes to Undo, so a keyboard reaches it.
		expect(document.activeElement).toBe($(".ai-faq_undo"));
		const note = $(".ai-faq_toast");
		expect(note.hidden).toBe(false);
		expect(note.textContent).toBe("Question removedUndo");

		$(".ai-faq_undo").click();

		expect(document.activeElement).toBe($('[data-ai-faq="input"]'));
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
