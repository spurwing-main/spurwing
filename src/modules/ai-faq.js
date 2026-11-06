import { animate } from "motion";

import { claimOnce, requireElement } from "../dom.js";

/**
 * Ask your own question: the AI box at the end of every FAQ list.
 *
 *   <div data-ai-faq="component">
 *     <div data-ai-faq="ask">
 *       <svg data-ai-faq="sparkle">
 *       <div class="faq-card"><div class="faq-card_trigger">
 *         <textarea data-ai-faq="input">  <button data-ai-faq="send">
 *     <button data-ai-faq="another" hidden>
 *
 * The Designer owns the look: the ask card is a curated FAQ card's classes, and
 * an answer is built from those same classes, so it reads as one more card in
 * the list. This module owns the behaviour and the motion.
 *
 * Asking turns the ask card into the answer card in place: the question stays
 * where it was typed, the card opens like an FAQ answer, and the sparkle
 * twinkles beside shimmering stage words ("Checking 6 pages…") until the answer
 * streams in. The finished card shows a tick and the pages the answer came from.
 *
 * Questions go to the Worker at `config.endpoint` (worker/ in this repo), which
 * answers only from spurwing.co.uk and sends server-sent events:
 *   sources  [{ title, url }]   the pages it found, before any of the answer
 *   token    "text"             the next piece of the answer
 *   cited    [{ title, url }]   the pages the finished answer drew on
 *   handoff  { message }        it couldn't answer from the site
 *   error    { message }        it couldn't answer at all
 * A hand-off offers the discovery call with the question carried into the
 * booking notes.
 */

export const config = {
	endpoint: "https://ask.spurwing.co.uk/ask",
	// The "spurwing-ask" Turnstile widget (invisible, spurwing.co.uk and
	// spurwing.webflow.io). Public by design; its secret lives only in the Worker.
	turnstileSiteKey: "0x4AAAAAAF2LSWTlSOLzJuaH",
	stages: ["Reading the site…", "Checking {n} pages…", "Writing an answer…"],
	// Each stage stays at least this long, so a fast answer doesn't flicker.
	minStageMs: 300,
	timeoutMs: 15000,
	// Earlier questions and answers sent along, so a follow-up has its context.
	historyTurns: 2,
	handoffPath: "/discovery-call",
	failure: "I couldn't answer that just now.",
	handoffLink: "Ask the team directly",
};

// Spurwing's ease, from the design prototype.
const EASE = [0.2, 0.7, 0.2, 1];
// The FAQ cards' own opening (faq.js), so an answer opens like one.
const OPEN = { duration: 400, easing: "cubic-bezier(0.25, 0.1, 0.25, 1)" };

const TICK =
	'<svg viewBox="34 35 60 60" width="100%" height="100%" fill="none" aria-hidden="true"><path d="M56 86L36 66.16L42.36 60L56 73.4L85.64 44L92 50.32L56 86Z" fill="currentColor"/></svg>';

export function initAiFaq(root = document, { signal } = {}) {
	const components = root.querySelectorAll('[data-ai-faq="component"]');

	if (!components.length) return;

	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	for (const component of components) {
		if (claimOnce(component, "data-ai-faq-claimed")) setUp(component);
	}

	function setUp(component) {
		const ask = requireElement(component, '[data-ai-faq="ask"]');
		const input = requireElement(component, '[data-ai-faq="input"]');
		const send = requireElement(component, '[data-ai-faq="send"]');
		const another = requireElement(component, '[data-ai-faq="another"]');
		const sparkle = component.querySelector('[data-ai-faq="sparkle"]');
		const askCard = input.closest(".faq-card");
		const plus = another.querySelector("svg");
		const history = [];
		let busy = false;

		// Webflow drops an empty `hidden` attribute on publish, so say it here too.
		another.hidden = true;

		revealWithTheList();

		// Vouch for the visitor before they ask, not after.
		const near = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return;
				near.disconnect();
				prepareToken();
			},
			{ rootMargin: "600px 0px" },
		);
		near.observe(component);
		signal?.addEventListener("abort", () => near.disconnect());

		input.addEventListener("focus", () => {
			prepareToken();
			showSparkle(false);
		});
		input.addEventListener("blur", () => {
			if (!input.value.trim()) showSparkle(true);
		});
		input.addEventListener("input", fit);
		input.addEventListener("keydown", (event) => {
			if (event.key !== "Enter" || event.shiftKey) return;
			event.preventDefault();
			submit();
		});
		send.addEventListener("click", submit);

		another.addEventListener("click", () => {
			another.hidden = true;
			ask.hidden = false;
			fit();
			rise(ask);
			input.focus({ preventScroll: true });
			ask.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
		});
		if (plus && !reduceMotion) {
			another.addEventListener("pointerenter", () => animate(plus, { rotate: 90 }, { duration: 0.3, ease: EASE }));
			another.addEventListener("pointerleave", () => animate(plus, { rotate: 0 }, { duration: 0.3, ease: EASE }));
		}

		function fit() {
			input.style.height = "auto";
			input.style.height = `${input.scrollHeight}px`;
		}

		/**
		 * The ask card reveals with the site's scroll animation on the turn after
		 * the cards above it. The site's rule sets --anim-i on every data-anim
		 * element, so the turn goes on the card itself. The sparkle sits outside
		 * the card, where the reveal's mask would hide it, so it fades in on the
		 * same beat instead; without the scroll animation (reduced motion, or its
		 * safety net switched it off) the sparkle is simply there.
		 */
		function revealWithTheList() {
			if (!askCard) return;
			const list = component.parentElement;
			const turn = Math.min(list ? list.querySelectorAll(".w-dyn-item, .faqs-new_extra > *").length : 0, 6);
			if (!askCard.hasAttribute("data-anim")) askCard.setAttribute("data-anim", "card");
			askCard.style.setProperty("--anim-i", String(turn));

			const html = document.documentElement;
			if (!sparkle || reduceMotion || !html.hasAttribute("data-anim-ready")) return;
			sparkle.style.opacity = "0";
			const watch = new MutationObserver(() => {
				if (askCard.getAttribute("data-anim-state") !== "in" && !html.hasAttribute("data-anim-panic")) return;
				watch.disconnect();
				animate(sparkle, { opacity: 1, scale: [0.6, 1] }, { duration: 0.5, delay: turn * 0.06 + 0.2, ease: EASE });
			});
			watch.observe(askCard, { attributes: true, attributeFilter: ["data-anim-state"] });
			watch.observe(html, { attributes: true, attributeFilter: ["data-anim-panic"] });
			signal?.addEventListener("abort", () => watch.disconnect());
		}

		// The sparkle steps aside while the reader types.
		function showSparkle(visible) {
			if (!sparkle) return;
			const to = visible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 };
			animate(sparkle, to, { duration: reduceMotion ? 0 : 0.25, ease: EASE });
		}

		async function submit() {
			const question = input.value.trim();

			if (!question) {
				input.focus();
				return;
			}
			if (busy) return;
			busy = true;

			track("ai_faq_ask");

			// The answer card takes the ask card's place, so the question stays
			// exactly where it was typed.
			const card = answerCard(question);
			const hadFocus = ask.contains(document.activeElement);
			ask.before(card.element);
			ask.hidden = true;
			card.open();
			// Measured while hidden, the box would collapse to nothing and come back
			// unusable, so clear its size and measure again when it returns.
			input.value = "";
			input.style.height = "";

			const answer = await stream(question, card);
			card.finish();
			busy = false;

			if (answer) {
				history.push({ role: "user", content: question }, { role: "assistant", content: answer });
				history.splice(0, Math.max(0, history.length - config.historyTurns * 2));
			}

			if (signal?.aborted) return;
			prepareToken();
			another.hidden = false;
			rise(another);
			// Focus went with the hidden ask card; unless the reader has moved on,
			// it comes back on the next thing to do.
			const lost = document.activeElement === document.body || ask.contains(document.activeElement);
			// No ring for it: the reader didn't move it there.
			if (hadFocus && lost) another.focus({ preventScroll: true, focusVisible: false });
		}

		async function stream(question, card) {
			const controller = new AbortController();
			const stop = () => controller.abort();
			signal?.addEventListener("abort", stop);
			const timeout = setTimeout(stop, config.timeoutMs);
			let answer = "";

			try {
				const response = await fetch(config.endpoint, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ question, history, page: location.pathname, token: await turnstileToken() }),
					signal: controller.signal,
				});
				if (!response.ok || !response.body) throw new Error(`ask failed: ${response.status}`);

				for await (const { event, data } of readEvents(response.body)) {
					if (event === "sources") {
						card.cite(data);
						await card.stage(1, data.length);
						card.stage(2);
					} else if (event === "cited") {
						card.cite(data);
					} else if (event === "token") {
						await card.write(data);
						answer += data;
					} else if (event === "handoff") {
						card.handoff(data.message, question);
						track("ai_faq_no_answer");
						return "";
					} else if (event === "error") {
						throw new Error(data.message);
					}
				}

				track("ai_faq_answered");
				return answer;
			} catch {
				if (signal?.aborted) return "";
				card.handoff(config.failure, question);
				track("ai_faq_no_answer");
				return "";
			} finally {
				clearTimeout(timeout);
				signal?.removeEventListener("abort", stop);
			}
		}

		/**
		 * One answer card, built from the classes a curated FAQ card carries so the
		 * Designer's styles apply. It isn't an accordion item and isn't marked up
		 * as a published FAQ: the AI's answers are never presented to Google as ours.
		 */
		function answerCard(question) {
			const element = node("div", "faq-card");
			const head = node("div", "faq-card_trigger");
			const title = node("h3", "faq-card_title");
			const status = node("span", "faq-card_icon");
			const panel = node("div", "faq-card_panel");
			const content = node("div", "faq-card_content");
			const body = node("div", "rich-text w-richtext");
			const text = node("p");
			let paragraph = text;
			let twinkle = [];
			let shimmer = null;
			let pages = [];
			let shownAt = 0;
			let writing = false;
			let handedOff = false;

			element.dataset.aiFaq = "answer";
			element.setAttribute("aria-busy", "true");
			head.style.cursor = "default";
			title.textContent = question;
			body.setAttribute("aria-live", "polite");
			head.append(title, status);
			body.append(text);
			content.append(body);
			panel.append(content);
			element.append(head, panel);

			// The thinking star is the ask card's own sparkle, twinkling as in the
			// design: each star shrinks, turns and dims in turn.
			if (sparkle) {
				const star = sparkle.cloneNode(true);
				star.removeAttribute("class");
				star.removeAttribute("data-ai-faq");
				star.removeAttribute("style");
				star.removeAttribute("width");
				star.removeAttribute("height");
				// Drawn at the question's 22px, as in the design, over the 16px icon
				// slot the tick fills; the negative margin keeps it centred there.
				Object.assign(star.style, { display: "block", width: "1.375rem", height: "1.375rem", margin: "-0.1875rem" });
				status.append(star);
				if (!reduceMotion) {
					twinkle = [...star.querySelectorAll("path")].map((path, index) => {
						path.style.transformBox = "fill-box";
						path.style.transformOrigin = "center";
						return animate(
							path,
							{ scale: [1, 0.55, 1], rotate: [0, 45, 0], opacity: [1, 0.35, 1] },
							{ duration: 1.2, delay: index * 0.2, ease: "easeInOut", repeat: Infinity },
						);
					});
				}
			}

			show(0);

			// Opens like an FAQ answer, the first words rising into it.
			function open() {
				resize(() => {}, 0);
				rise(text, 0.1);
			}

			/**
			 * Every change in the card's height eases like an FAQ answer opening: a
			 * new line, the hand-off, the sources. The panel goes from the height it
			 * shows now to the one its content needs. This is the browser's own
			 * animation, which starts on the frame it's asked for; a Motion height
			 * tween showed the card fully open for a frame, then fell behind and
			 * snapped.
			 */
			function resize(change, from = panel.getBoundingClientRect().height) {
				change();
				if (reduceMotion) return;
				const to = content.offsetHeight;
				if (Math.abs(to - from) < 1) return;
				panel.animate([{ height: `${from}px` }, { height: `${to}px` }], OPEN);
			}

			// Waits out the stage on screen first, so a fast answer doesn't flicker
			// through words nobody could read.
			async function stage(index, count = pages.length) {
				await settle();
				if (writing) return;
				show(index, count);
				if (!reduceMotion) animate(text, { opacity: [0.3, 1] }, { duration: 0.3 });
			}

			// Straight away, not after a wait, so the first stage is in place before
			// the card measures itself to open.
			function show(index, count = pages.length) {
				text.textContent = config.stages[index].replace("{n}", count);
				startShimmer();
				shownAt = Date.now();
			}

			function settle() {
				return pause(shownAt + config.minStageMs - Date.now());
			}

			// A light sweeping across the stage words, as in the design.
			function startShimmer() {
				if (reduceMotion || shimmer) return;
				Object.assign(text.style, {
					backgroundImage:
						"linear-gradient(90deg, var(--_color---grey-500) 0%, var(--_color---grey-500) 38%, var(--_color---grey-950) 50%, var(--_color---grey-500) 62%, var(--_color---grey-500) 100%)",
					backgroundSize: "300% 100%",
					backgroundClip: "text",
					webkitBackgroundClip: "text",
					color: "transparent",
				});
				shimmer = animate(text, { backgroundPosition: ["100% 0", "0% 0"] }, { duration: 1.2, ease: "linear", repeat: Infinity });
			}

			function stopShimmer() {
				shimmer?.stop();
				shimmer = null;
				text.removeAttribute("style");
			}

			async function write(piece) {
				const first = !writing;
				if (first) {
					await settle();
					writing = true;
					stopShimmer();
				}
				// A blank line in the answer starts a new paragraph.
				resize(() => {
					if (first) text.textContent = "";
					piece.split(/\n{2,}/).forEach((part, index) => {
						if (index) {
							paragraph = node("p");
							body.append(paragraph);
						}
						if (!part) return;
						const words = node("span");
						words.textContent = part;
						paragraph.append(words);
						if (!reduceMotion) animate(words, { opacity: [0, 1] }, { duration: 0.25 });
					});
				});
			}

			function cite(list) {
				pages = list;
			}

			function handoff(message, asked) {
				writing = true;
				handedOff = true;
				stopShimmer();
				pages = [];
				const link = node("a", "text-style-link");
				link.href = `${config.handoffPath}?notes=${encodeURIComponent(asked)}`;
				link.textContent = config.handoffLink;
				link.addEventListener("click", () => track("ai_faq_handoff"));
				resize(() => {
					text.textContent = `${message} `;
					text.append(link, ".");
				});
				rise(text);
			}

			// The star gives way to a tick, or to nothing when it couldn't answer,
			// and the pages it drew on rise in underneath.
			function finish() {
				writing = true;
				stopShimmer();
				twinkle.forEach((controls) => controls.stop());
				element.removeAttribute("aria-busy");
				status.innerHTML = handedOff ? "" : TICK;
				if (!handedOff && !reduceMotion) animate(status, { opacity: [0, 1], scale: [0.5, 1] }, { duration: 0.35, ease: EASE });

				if (!pages.length) return;
				const from = node("p");
				from.append("From: ");
				pages.forEach((page, index) => {
					const link = node("a", "text-style-link");
					link.href = page.url;
					link.textContent = page.title;
					from.append(...(index ? [", ", link] : [link]));
				});
				resize(() => body.append(from));
				rise(from);
			}

			return { element, open, stage, write, cite, handoff, finish };
		}
	}

	// The design's fade-up: in from 8px below, on Spurwing's ease.
	function rise(element, delay = 0) {
		if (reduceMotion) return;
		animate(element, { opacity: [0, 1], y: [8, 0] }, { duration: 0.4, delay, ease: EASE });
	}
}

/** Parse a server-sent event stream into { event, data } pairs, data JSON-decoded. */
export async function* readEvents(body) {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	for (;;) {
		const { done, value } = await reader.read();
		buffer += decoder.decode(value, { stream: !done });

		let end;
		while ((end = buffer.indexOf("\n\n")) !== -1) {
			const block = buffer.slice(0, end);
			buffer = buffer.slice(end + 2);

			let event = "message";
			const data = [];
			for (const line of block.split("\n")) {
				if (line.startsWith("event:")) event = line.slice(6).trim();
				else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
			}
			if (data.length) yield { event, data: JSON.parse(data.join("\n")) };
		}

		if (done) return;
	}
}

function node(tag, className) {
	const element = document.createElement(tag);
	if (className) element.className = className;
	return element;
}

function pause(ms) {
	return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

// Clarity loads only after cookie consent, so before then there is nothing to tell.
function track(name) {
	window.clarity?.("event", name);
}

// Turnstile takes about two seconds to vouch for a visitor. It starts as the
// box comes near the screen and again after each question, so a token is
// waiting by the time anyone presses Enter. Tokens are single-use and last five
// minutes; an older one is fetched again.
const TOKEN_LIFE_MS = 4 * 60 * 1000;
let turnstile;
let ready = null;

export function prepareToken() {
	if (!config.turnstileSiteKey) return;
	if (ready && Date.now() - ready.at < TOKEN_LIFE_MS) return;
	const token = fetchToken();
	token.catch(() => {});
	ready = { token, at: Date.now() };
}

function turnstileToken() {
	if (!config.turnstileSiteKey) return Promise.resolve("");
	prepareToken();
	const { token } = ready;
	ready = null;
	return token;
}

function fetchToken() {
	turnstile ??= new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
		script.onload = () => resolve(window.turnstile);
		script.onerror = reject;
		document.head.append(script);
	});

	return turnstile.then(
		(api) =>
			new Promise((resolve, reject) => {
				const holder = document.createElement("div");
				document.body.append(holder);
				api.render(holder, {
					sitekey: config.turnstileSiteKey,
					callback: (token) => {
						holder.remove();
						resolve(token);
					},
					"error-callback": () => {
						holder.remove();
						reject(new Error("turnstile failed"));
					},
				});
			}),
	);
}
