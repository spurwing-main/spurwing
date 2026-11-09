/**
 * ask.spurwing.co.uk: answers "Ask your own question" in the site's FAQ lists.
 *
 * src/modules/ai-faq.js posts { question, history, page, token } to /ask. The
 * visitor is checked first (an allowed site, five questions a minute,
 * Turnstile). Then AI Search finds the matching pages of spurwing.co.uk and
 * GPT-6.1 Terra writes the answer from those pages through the AI Gateway,
 * handing off anything they don't cover, harmful questions included. The reply is a stream of server-sent
 * events:
 *
 *   sources  [{ title, url }]   the pages found, before any of the answer
 *   token    "text"             the next piece of the answer
 *   cited    [{ title, url }]   the pages the finished answer drew on
 *   handoff  { message }        the site doesn't answer it
 *   error    { message }        something failed; the page offers the team instead
 *   done     {}
 *
 * Every question is logged to D1, with the time and page it was asked on.
 */
import { links, pagesFrom, relay, startAnswer } from "./answer.js";
import { eventStream } from "./events.js";
import { record } from "./log.js";
import { syncNotes } from "./notes.js";

const MAX_QUESTION = 300;
// The page sends its last two questions and answers, so a follow-up has context.
const MAX_HISTORY = 4;
const MAX_TURN = 2000;
// IDs from the page: the question's, its conversation's and Clarity's.
const ID = /^[\w-]{1,64}$/;

export default {
	fetch(request, env, ctx) {
		const { pathname } = new URL(request.url);
		const cors = corsHeaders(request.headers.get("origin"), env);

		if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
		if (request.method !== "POST") return notFound(cors);
		if (pathname === "/ask") return ask(request, env, ctx, cors);

		// Ours alone, locked by INDEX_KEY. Without the key it doesn't exist.
		if (pathname === "/index" && unlocked(request, env)) return indexPage(request, env);
		return notFound(cors);
	},

	// Hourly: reload the team's notes from ClickUp (notes.js).
	scheduled(event, env, ctx) {
		ctx.waitUntil(syncNotes(env).then((result) => console.log({ notes: result })));
	},
};

async function ask(request, env, ctx, cors) {
	if (!cors["access-control-allow-origin"]) return new Response("Forbidden", { status: 403 });

	const input = await readInput(request);
	if (!input) return json({ error: "bad request" }, 400, cors);

	const ip = request.headers.get("cf-connecting-ip") ?? "";
	const { success } = await env.RATE_LIMIT.limit({ key: ip });
	if (!success) return json({ error: "rate limited" }, 429, cors);
	if (env.TURNSTILE_SECRET && !(await turnstileOk(input.token, ip, env))) {
		return json({ error: "turnstile" }, 403, cors);
	}

	const started = Date.now();
	const askedAt = new Date(started).toISOString();
	// When each step finished, in ms, logged with every question to show where
	// the time goes.
	const timings = {};
	const mark = (step) => (timings[step] ??= Date.now() - started);
	// Everything that ties a logged question to the visit: the page's IDs, and
	// Cloudflare's request ID (the Ray ID in its logs), country and browser.
	const visit = {
		ray: request.headers.get("cf-ray") ?? "",
		country: request.cf?.country ?? "",
		userAgent: (request.headers.get("user-agent") ?? "").slice(0, 300),
		model: env.MODEL,
	};
	const log = (outcome) => {
		const ms = Date.now() - started;
		console.log({ id: input.id, ray: visit.ray, answered: outcome.answered, ...timings, total: ms });
		ctx.waitUntil(record(env, { ...input, ...visit, ...outcome, askedAt, firstWordMs: timings.firstWord ?? null, ms }));
	};

	// Inside the stream, a failure reaches the page as an `error` event, which it
	// turns into the hand-off, rather than as a bare 500.
	return eventStream(cors, async (sendEvent) => {
		const send = (event, data) => {
			if (event === "token") mark("firstWord");
			return sendEvent(event, data);
		};

		const pages = pagesFrom((await search(input.question, env)).chunks);
		mark("searched");
		send("sources", links(pages));

		log(await relay(await startAnswer(input, pages, env), send, pages));
	});
}

function search(question, env) {
	return env.AI_SEARCH.search({
		query: question,
		ai_search_options: {
			retrieval: { max_num_results: 8, context_expansion: 1, match_threshold: 0.3, keyword_match_mode: "or" },
			// Reranking only reorders the pages, and Terra reads all eight anyway; off,
			// the pages arrive in about 0.9s instead of 1.3 to 2.7.
			reranking: { enabled: false },
			// Rewriting runs a second model before the search and added seconds; the
			// looser keyword matching above finds the "you" questions without it.
			query_rewrite: { enabled: false },
		},
	});
}

async function readInput(request) {
	const body = await request.json().catch(() => null);
	const question = typeof body?.question === "string" ? body.question.trim() : "";
	if (!question || question.length > MAX_QUESTION) return null;

	const history = (Array.isArray(body.history) ? body.history : [])
		.filter((turn) => ["user", "assistant"].includes(turn?.role) && typeof turn.content === "string")
		.slice(-MAX_HISTORY)
		.map((turn) => ({ role: turn.role, content: turn.content.slice(0, MAX_TURN) }));

	const id = (value) => (typeof value === "string" && ID.test(value) ? value : "");

	return {
		question,
		history,
		page: typeof body.page === "string" ? body.page.slice(0, 200) : "",
		token: typeof body.token === "string" ? body.token : "",
		id: id(body.id) || crypto.randomUUID(),
		conversation: id(body.conversation),
		turn: history.filter((turn) => turn.role === "user").length + 1,
		clarityUser: id(body.clarity?.user),
		claritySession: id(body.clarity?.session),
	};
}

async function turnstileOk(token, ip, env) {
	if (!token) return false;
	const form = new FormData();
	form.append("secret", env.TURNSTILE_SECRET);
	form.append("response", token);
	if (ip) form.append("remoteip", ip);
	const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
	return (await response.json())?.success === true;
}

function corsHeaders(origin, env) {
	const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map((entry) => entry.trim());
	if (!origin || !allowed.includes(origin)) return {};
	return {
		"access-control-allow-origin": origin,
		"access-control-allow-methods": "POST, OPTIONS",
		"access-control-allow-headers": "content-type",
		vary: "origin",
	};
}

function unlocked(request, env) {
	return Boolean(env.INDEX_KEY) && request.headers.get("x-index-key") === env.INDEX_KEY;
}

/**
 * Until the new site is live, AI Search can't crawl it (staging isn't on
 * Spurwing's Cloudflare account and blocks crawlers), so
 * scripts/index-staging.mjs posts each page here. Remove this route once the
 * instance crawls spurwing.co.uk.
 */
async function indexPage(request, env) {
	const { key, html, url, title } = await request.json();
	const item = await env.AI_SEARCH.items.upload(key, html, { metadata: { url, title } });
	return Response.json({ key, id: item?.id ?? null });
}

function json(data, status, headers) {
	return Response.json(data, { status, headers });
}

function notFound(headers) {
	return new Response("Not found", { status: 404, headers });
}
