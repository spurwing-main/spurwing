/** The question log in D1 (schema.sql) and Monday's digest of it in #spurwing-faq-alert. */

const CONTACT_DETAILS = /[\w.+-]+@[\w-]+\.[\w.]+|(?:\+?\d[\s-]?){9,}/;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** One row per question. A question with an email address or phone number in it is not kept. */
export async function record(env, { question, page, answered, answer, sources, ms }) {
	const personal = CONTACT_DETAILS.test(question);
	await env.DB.prepare(
		"INSERT INTO questions (asked_at, page, question, answered, answer, sources, ms) VALUES (?, ?, ?, ?, ?, ?, ?)",
	)
		.bind(
			new Date().toISOString(),
			page,
			personal ? "[removed: contained contact details]" : question,
			answered ? 1 : 0,
			personal ? "" : answer,
			JSON.stringify(sources.map((source) => source.url)),
			ms,
		)
		.run();
}

/** Post the last week's questions to Slack. Returns Slack's status, or null without a webhook. */
export async function digest(env) {
	if (!env.SLACK_WEBHOOK_URL) return null;

	const since = new Date(Date.now() - WEEK_MS).toISOString();
	const { results } = await env.DB.prepare("SELECT question, answered FROM questions WHERE asked_at >= ? ORDER BY asked_at DESC")
		.bind(since)
		.all();

	const response = await fetch(env.SLACK_WEBHOOK_URL, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ text: digestText(results) }),
	});
	return response.status;
}

export function digestText(rows) {
	if (!rows.length) return "No questions asked on the website's FAQ this week.";

	const counts = new Map();
	for (const { question } of rows) counts.set(question, (counts.get(question) ?? 0) + 1);
	const mostAsked = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10);
	const answered = rows.filter((row) => row.answered).length;
	const unanswered = [...new Set(rows.filter((row) => !row.answered).map((row) => row.question))].slice(0, 15);

	return [
		`*FAQ questions this week: ${rows.length}* (${answered} answered)`,
		"",
		"*Most asked*",
		...mostAsked.map(([question, count]) => `• ${question}${count > 1 ? ` (${count})` : ""}`),
		"",
		unanswered.length ? "*Couldn't answer — candidates for new FAQs*" : "*Answered everything*",
		...unanswered.map((question) => `• ${question}`),
	].join("\n");
}
