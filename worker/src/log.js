/**
 * Every question, logged in D1 (schema.sql) with its time and the IDs that tie
 * it to the visit. The team reads it by asking Claude through Cloudflare's MCP
 * server, or in the Cloudflare dashboard.
 *
 * To find a question elsewhere:
 *   Clarity      filter recordings by the custom tag ai_faq_question_id, or by
 *                the visitor and session IDs (only once the visitor accepted
 *                cookies; Clarity doesn't run before)
 *   AI Gateway   filter logs by the metadata question = id
 *   Workers logs search the Ray ID
 */

const CONTACT_DETAILS = /[\w.+-]+@[\w-]+\.[\w.]+|(?:\+?\d[\s-]?){9,}/;
const REMOVED = "[removed: contained contact details]";

const COLUMNS = [
	"asked_at",
	"question_id",
	"conversation_id",
	"turn",
	"page",
	"question",
	"answered",
	"answer",
	"sources",
	"first_word_ms",
	"ms",
	"clarity_user",
	"clarity_session",
	"ray_id",
	"country",
	"user_agent",
	"model",
];
const INSERT = `INSERT INTO questions (${COLUMNS.join(", ")}) VALUES (${COLUMNS.map(() => "?").join(", ")})`;

/** One row per question. A question with an email address or phone number in it is not kept, nor its answer. */
export async function record(env, entry) {
	const personal = CONTACT_DETAILS.test(entry.question);
	await env.DB.prepare(INSERT)
		.bind(
			entry.askedAt,
			entry.id,
			entry.conversation,
			entry.turn,
			entry.page,
			personal ? REMOVED : entry.question,
			entry.answered ? 1 : 0,
			personal ? "" : entry.answer,
			// A team note is logged by its page name, so an answer can be traced to it.
			JSON.stringify(entry.sources.map((source) => (source.note ? `note: ${source.note}` : source.url))),
			entry.firstWordMs,
			entry.ms,
			entry.clarityUser,
			entry.claritySession,
			entry.ray,
			entry.country,
			entry.userAgent,
			entry.model,
		)
		.run();
}
