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
 * the list. This module owns the behaviour and the motion. The sparkle steps
 * aside when the reader starts typing; on asking, the card shows the question,
 * a twinkling sparkle and shimmering stage words ("Reading the site…"), then
 * the answer streams in and the sparkle becomes a tick. The stages follow the
 * answer service's stream: the matched pages arrive before the first word, so
 * "Checking 6 pages…" appears when they actually do.
 *
 * Questions go to the Worker at `config.endpoint`, which answers only from
 * spurwing.co.uk and sends server-sent events:
 *   sources  [{ title, url }]     the pages it found
 *   token    "text"               the next piece of the answer
 *   handoff  { message }          it couldn't answer from the site
 *   error    { message }          it couldn't answer at all
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
	minStageMs: 600,
	timeoutMs: 15000,
	// Earlier questions and answers sent along, so a follow-up has its context.
	historyTurns: 2,
	handoffPath: "/discovery-call",
	failure: "I couldn't answer that just now.",
	handoffLink: "Ask the team directly",
};

const EASE = [0.2, 0.7, 0.2, 1];

const icons = {
	twinkle:
		'<svg viewBox="0 0 120 120" width="100%" height="100%" fill="none" aria-hidden="true"><path d="M50 25C54 47.67 67.33 61 90 65C67.33 69 54 82.33 50 105C46 82.33 32.67 69 10 65C32.67 61 46 47.67 50 25Z" fill="currentColor"/><path d="M92.5 7.5C94.5 18.83 101.17 25.5 112.5 27.5C101.17 29.5 94.5 36.17 92.5 47.5C90.5 36.17 83.83 29.5 72.5 27.5C83.83 25.5 90.5 18.83 92.5 7.5Z" fill="currentColor"/><path d="M97.5 75C98.83 82 103 86.17 110 87.5C103 88.83 98.83 93 97.5 100C96.17 93 92 88.83 85 87.5C92 86.17 96.17 82 97.5 75Z" fill="currentColor"/></svg>',
	tick: '<svg viewBox="34 35 60 60" width="100%" height="100%" fill="none" aria-hidden="true"><path d="M56 86L36 66.16L42.36 60L56 73.4L85.64 44L92 50.32L56 86Z" fill="currentColor"/></svg>',
};

export function initAiFaq(root = document, { signal } = {}) {
	const components = root.querySelectorAll('[data-ai-faq="component"]');

	if (!components.length) return;

	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	for (const component of components) {
		if (!claimOnce(component, "data-ai-faq-claimed")) continue;

		setUp(component);
	}

	function setUp(component) {
		const ask = requireElement(component, '[data-ai-faq="ask"]');
		const input = requireElement(component, '[data-ai-faq="input"]');
		const send = requireElement(component, '[data-ai-faq="send"]');
		const another = requireElement(component, '[data-ai-faq="another"]');
		const sparkle = component.querySelector('[data-ai-faq="sparkle"]');
		const history = [];
		const plus = another.querySelector("svg");
		let busy = false;

		// Webflow drops an empty `hidden` attribute on publish, so say it here too.
		another.hidden = true;

		const fit = () => {
			input.style.height = "auto";
			input.style.height = `${input.scrollHeight}px`;
		};

		const showSparkle = (visible) => {
			if (!sparkle) return;
			const to = visible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 };
			animate(sparkle, to, { duration: reduceMotion ? 0 : 0.25 });
		};

		input.addEventListener("input", fit);
		input.addEventListener("focus", () => showSparkle(false));
		input.addEventListener("blur", () => {
			if (!input.value.trim()) showSparkle(true);
		});
		input.addEventListener("keydown", (event) => {
			if (event.key !== "Enter" || event.shiftKey) return;
			event.preventDefault();
			submit();
		});
		send.addEventListener("click", submit);
		another.addEventListener("click", () => {
			another.hidden = true;
			ask.hidden = false;
			rise(ask);
			input.focus({ preventScroll: true });
			ask.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
		});
		if (plus && !reduceMotion) {
			another.addEventListener("pointerenter", () => animate(plus, { rotate: 90 }, { duration: 0.3, ease: EASE }));
			another.addEventListener("pointerleave", () => animate(plus, { rotate: 0 }, { duration: 0.3, ease: EASE }));
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

			const card = answerCard(question);
			ask.before(card.element);
			ask.hidden = true;
			rise(card.element);
			input.value = "";
			fit();

			const answer = await stream(question, card);

			card.finish();
			busy = false;

			if (answer) {
				history.push({ role: "user", content: question }, { role: "assistant", content: answer });
				history.splice(0, Math.max(0, history.length - config.historyTurns * 2));
			}

			if (signal?.aborted) return;
			another.hidden = false;
			rise(another);
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
					body: JSON.stringify({
						question,
						history,
						page: location.pathname,
						token: await turnstileToken(),
					}),
					signal: controller.signal,
				});

				if (!response.ok || !response.body) throw new Error(`ask failed: ${response.status}`);

				for await (const { event, data } of readEvents(response.body)) {
					if (event === "sources") {
						card.sources(data);
						await card.stage(1, data.length);
						card.stage(2);
					} else if (event === "cited") {
						card.sources(data);
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
			} catch (error) {
				if (signal?.aborted) return "";
				card.handoff(config.failure, question);
				track("ai_faq_no_answer");
				return "";
			} finally {
				clearTimeout(timeout);
				signal?.removeEventListener("abort", stop);
			}
		}
	}

	// The artifact's fade-up: in from 8px below, on Spurwing's ease.
	function rise(element) {
		if (reduceMotion) return;
		animate(element, { opacity: [0, 1], y: [8, 0] }, { duration: 0.4, ease: EASE });
	}

	/**
	 * One answer card, built from the classes a curated FAQ card carries so the
	 * Designer's styles apply. It isn't an accordion item and isn't marked up as
	 * a published FAQ: the AI's answers are never presented to Google as ours.
	 */
	function answerCard(question) {
		const element = node("div", "faq-card");
		const head = node("div", "faq-card_trigger");
		const title = node("h3", "faq-card_title");
		const status = node("span", "faq-card_icon");
		const content = node("div", "faq-card_content");
		const body = node("div", "rich-text w-richtext");
		const text = node("p");
		let paragraph = text;
		const twinkle = [];
		let shimmer = null;
		let pages = [];
		let shownAt = 0;
		let settled = false;
		let handedOff = false;

		element.dataset.aiFaq = "answer";
		element.setAttribute("aria-busy", "true");
		head.style.cursor = "default";
		title.textContent = question;
		status.innerHTML = icons.twinkle;
		body.setAttribute("aria-live", "polite");
		head.append(title, status);
		body.append(text);
		content.append(body);
		element.append(head, content);

		if (!reduceMotion) {
			status.querySelectorAll("path").forEach((path, index) => {
				path.style.transformBox = "fill-box";
				path.style.transformOrigin = "center";
				twinkle.push(
					animate(path, { scale: [1, 0.55, 1], opacity: [1, 0.35, 1] }, { duration: 1.2, delay: index * 0.2, repeat: Infinity }),
				);
			});
		}

		stage(0);

		// Waits out the stage on screen first, so a fast answer doesn't flicker
		// through words nobody could read.
		async function stage(index, count = pages.length) {
			await settle();
			if (settled) return;
			text.textContent = config.stages[index].replace("{n}", count);
			startShimmer();
			shownAt = Date.now();
		}

		function settle() {
			return pause(Math.max(0, shownAt + config.minStageMs - Date.now()));
		}

		function startShimmer() {
			if (reduceMotion || shimmer) return;
			Object.assign(text.style, {
				backgroundImage:
					"linear-gradient(90deg, var(--_color---grey-700) 40%, var(--_color---grey-950) 50%, var(--_color---grey-700) 60%)",
				backgroundSize: "250% 100%",
				backgroundClip: "text",
				webkitBackgroundClip: "text",
				color: "transparent",
			});
			shimmer = animate(text, { backgroundPosition: ["100% 0", "-50% 0"] }, { duration: 1.6, ease: "linear", repeat: Infinity });
		}

		function stopShimmer() {
			shimmer?.stop();
			shimmer = null;
			text.removeAttribute("style");
		}

		async function write(piece) {
			if (!settled) {
				await settle();
				settled = true;
				stopShimmer();
				text.textContent = "";
			}
			// A blank line in the answer starts a new paragraph.
			piece.split(/\n{2,}/).forEach((part, index) => {
				if (index) {
					paragraph = node("p");
					body.append(paragraph);
				}
				if (!part) return;
				const word = node("span");
				word.textContent = part;
				paragraph.append(word);
				if (!reduceMotion) animate(word, { opacity: [0, 1] }, { duration: 0.15 });
			});
		}

		function sources(list) {
			pages = list;
		}

		function handoff(message, asked) {
			settled = true;
			handedOff = true;
			stopShimmer();
			const link = node("a", "text-style-link");
			link.href = `${config.handoffPath}?notes=${encodeURIComponent(asked)}`;
			link.textContent = config.handoffLink;
			link.addEventListener("click", () => track("ai_faq_handoff"));
			text.textContent = `${message} `;
			text.append(link, ".");
			pages = [];
		}

		function finish() {
			settled = true;
			stopShimmer();
			twinkle.splice(0).forEach((controls) => controls.stop());
			status.innerHTML = handedOff ? "" : icons.tick;
			element.removeAttribute("aria-busy");

			if (!pages.length) return;

			const from = node("p");
			from.append("From: ");
			pages.forEach((page, index) => {
				const link = node("a", "text-style-link");
				link.href = page.url;
				link.textContent = page.title;
				from.append(...(index ? [", ", link] : [link]));
			});
			body.append(from);
		}

		return { element, stage, write, sources, handoff, finish };
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

let turnstile;

function turnstileToken() {
	if (!config.turnstileSiteKey) return Promise.resolve("");

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
