/**
 * Every question, logged in D1 (schema.sql), sent to #spurwing-faq-alert and
 * added to the Google Sheet (google-sheet.gs) as it's asked.
 */

const CONTACT_DETAILS = /[\w.+-]+@[\w-]+\.[\w.]+|(?:\+?\d[\s-]?){9,}/;
const REMOVED = "[removed: contained contact details]";
const MAX_ANSWER = 500;

/**
 * Log one question and tell the team. A question with an email address or a
 * phone number in it is kept out of all three, and so is its answer.
 */
export async function record(env, { question, page, answered, answer, sources, ms }) {
	const personal = CONTACT_DETAILS.test(question);
	const entry = {
		question: personal ? REMOVED : question,
		page,
		answered,
		answer: personal ? "" : answer,
		sources,
		ms,
	};
	const askedAt = new Date().toISOString();
	await Promise.all([save(env, entry, askedAt), alert(env, entry), addRow(env, entry, askedAt)]);
}

function save(env, { question, page, answered, answer, sources, ms }, askedAt) {
	return env.DB.prepare(
		"INSERT INTO questions (asked_at, page, question, answered, answer, sources, ms) VALUES (?, ?, ?, ?, ?, ?, ?)",
	)
		.bind(askedAt, page, question, answered ? 1 : 0, answer, JSON.stringify(sources.map((source) => source.url)), ms)
		.run();
}

/**
 * Add the question as a row in the Google Sheet the team reads, through the
 * sheet's own script. Its address carries the key the script checks. Returns
 * the script's status, or null without a sheet.
 */
async function addRow(env, { question, page, answered, answer, sources }, askedAt) {
	if (!env.SHEET_WEBHOOK_URL) return null;
	const response = await fetch(env.SHEET_WEBHOOK_URL, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ askedAt, page, question, answered, answer, sources: sources.map((source) => source.url).join(" ") }),
	});
	return response.status;
}

/** Post the question to Slack. Returns Slack's status, or null without a webhook. */
async function alert(env, entry) {
	if (!env.SLACK_WEBHOOK_URL) return null;
	const response = await fetch(env.SLACK_WEBHOOK_URL, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ text: alertText(entry) }),
	});
	return response.status;
}

/**
 * One question as a Slack message: where it was asked, the question, and the
 * answer with its pages or the hand-off. The visitor's words and the model's
 * are escaped, so neither can ping the channel or dress up a link.
 */
export function alertText({ question, page, answered, answer, sources }) {
	const lines = [`*New FAQ question* on ${escape(page || "an unknown page")}`, `>${escape(question)}`];
	if (!answered) {
		lines.push("Couldn't answer from the site; offered the discovery call.");
		return lines.join("\n");
	}
	const short = answer.length > MAX_ANSWER ? `${answer.slice(0, MAX_ANSWER).trimEnd()}…` : answer;
	lines.push(`Answered: ${escape(short)}`);
	if (sources.length) lines.push(`From: ${sources.map(({ title, url }) => `<${url}|${escape(title)}>`).join(", ")}`);
	return lines.join("\n");
}

// Slack reads <…> as a mention or a link, so these three are escaped.
function escape(text) {
	return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
