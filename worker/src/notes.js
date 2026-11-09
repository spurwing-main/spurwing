/**
 * The team's notes for the ask box: a ClickUp Doc ("Ask box notes") shared to
 * the web. Every hour the Worker reads it through its public link (the
 * NOTES_URL secret, so the link stays out of this repo) and loads each page
 * into AI Search beside the site's pages.
 *
 * A note answers like a page but is never shown as a link. A line on the page
 * like "See: [About Spurwing](https://www.spurwing.co.uk/about)" gives answers
 * drawn from it that public link instead. "How to use this doc" is never read.
 *
 * NOTES_URL is the JSON behind the Doc's public link, which ClickUp's own
 * viewer reads. It isn't a documented API, so a change on ClickUp's side shows
 * up here as an error in the Worker's logs, and the last loaded notes stay.
 */

export const NOTE_PREFIX = "notes__";
const SITE_HOST = "www.spurwing.co.uk";
const SKIP = /^how to use/i;

export async function syncNotes(env) {
	if (!env.NOTES_URL) throw new Error("notes: NOTES_URL is not set");
	const response = await fetch(env.NOTES_URL, { headers: { accept: "application/json" } });
	if (!response.ok) throw new Error(`notes: ClickUp answered ${response.status}`);
	if (!response.headers.get("content-type")?.includes("json")) throw new Error("notes: ClickUp sent a page, not the Doc's data");
	const doc = await response.json();
	if (doc.is_doc_archived || !Array.isArray(doc.pages)) throw new Error("notes: the Doc is archived or unreadable");

	const notes = flatten(doc.pages)
		.filter((page) => !page.archived && !page.deleted && !SKIP.test(page.name ?? ""))
		.map(toNote);

	const loaded = (await env.AI_SEARCH.items.list({ search: NOTE_PREFIX, per_page: 100 })).result.filter((item) =>
		item.key?.startsWith(NOTE_PREFIX),
	);
	const byKey = new Map(loaded.map((item) => [item.key, item]));

	const uploaded = [];
	for (const note of notes) {
		if (byKey.get(note.key)?.metadata?.updated === note.metadata.updated) continue;
		await env.AI_SEARCH.items.upload(note.key, note.text, { metadata: note.metadata });
		uploaded.push(note.key);
	}

	const removed = [];
	for (const item of loaded) {
		if (notes.some((note) => note.key === item.key)) continue;
		await env.AI_SEARCH.items.delete(item.id);
		removed.push(item.key);
	}

	return { notes: notes.length, uploaded, removed };
}

function flatten(pages) {
	return pages.flatMap((page) => [page, ...flatten(page.pages ?? [])]);
}

/** One Doc page as Markdown for AI Search, with its "See:" link lifted out as metadata. */
export function toNote(page) {
	const { text, see } = fromOps(JSON.parse(page.content || '{"ops":[]}').ops ?? []);
	return {
		key: `${NOTE_PREFIX}${page.id}.md`,
		text: `# ${page.name}\n\n${text}`,
		metadata: {
			note: page.name,
			title: see?.title ?? "",
			url: see?.url ?? "",
			updated: String(page.date_updated ?? ""),
		},
	};
}

/** ClickUp's page content (Quill ops) as plain Markdown, minus the "See:" line. */
function fromOps(ops) {
	const lines = [];
	let line = [];
	let see = null;

	for (const op of ops) {
		if (typeof op.insert !== "string") continue;
		const parts = op.insert.split("\n");
		parts.forEach((part, index) => {
			if (index > 0) {
				lines.push(finish(line, index === parts.length - 1 ? op.attributes : undefined));
				line = [];
			}
			if (part) line.push({ text: part, link: op.attributes?.link });
		});
	}
	if (line.length) lines.push(finish(line));

	const kept = lines.filter((entry) => {
		const link = /^see:/i.test(entry.plain.trim()) && entry.links[0];
		if (!link) return true;
		see ??= publicLink(link);
		return false;
	});

	return { text: kept.map((entry) => entry.markdown).join("\n").replace(/\n{3,}/g, "\n\n").trim(), see };
}

// A line ends at a newline insert, which carries the line's heading or list style.
function finish(parts, style = {}) {
	const plain = parts.map((part) => part.text).join("");
	const links = parts.filter((part) => part.link).map((part) => ({ title: part.text.trim(), url: part.link }));
	const prefix = style?.header ? `${"#".repeat(style.header)} ` : style?.list ? "- " : "";
	return { plain, links, markdown: `${prefix}${plain}` };
}

// Only a page of this site can be shown to visitors as a link.
function publicLink({ title, url }) {
	try {
		const parsed = new URL(url, `https://${SITE_HOST}`);
		if (!["spurwing.co.uk", SITE_HOST].includes(parsed.hostname)) return null;
		return { title, url: `https://${SITE_HOST}${parsed.pathname === "/" ? "" : parsed.pathname}` };
	} catch {
		return null;
	}
}
