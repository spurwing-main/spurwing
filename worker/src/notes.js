/**
 * The team's answers for the ask box: a ClickUp Doc ("Ask box answers") shared to
 * the web. Every hour the Worker reads it through its public link (the
 * NOTES_URL secret, so the link stays out of this repo) and loads each page
 * into AI Search beside the site's pages.
 *
 * Each heading on a page starts its own note, so one page can hold many topics.
 * A note answers like a page but is never shown as a link. A line under a
 * heading like "See: [About Spurwing](https://www.spurwing.co.uk/about)" gives
 * answers drawn from that note that public link instead. The pages for the team
 * ("Start here" and "Known gaps") are never read, nor is a question left empty
 * or answered only "TBC".
 *
 * NOTES_URL is the JSON behind the Doc's public link, which ClickUp's own
 * viewer reads. It isn't a documented API, so a change on ClickUp's side shows
 * up here as an error in the Worker's logs, and the last loaded notes stay.
 */

export const NOTE_PREFIX = "notes__";
const SITE_HOST = "www.spurwing.co.uk";
// Pages for the team, not the box: its rules, and the questions it can't answer yet.
const SKIP = /^(start here|how to use|known gaps)/i;
// An answer still to be written.
const PLACEHOLDER = /^(tbc|tbd|todo|to do|tba|\?+|-+|…|\.\.\.)\.?$/i;

export async function syncNotes(env) {
	if (!env.NOTES_URL) throw new Error("notes: NOTES_URL is not set");
	const response = await fetch(env.NOTES_URL, { headers: { accept: "application/json" } });
	if (!response.ok) throw new Error(`notes: ClickUp answered ${response.status}`);
	if (!response.headers.get("content-type")?.includes("json")) throw new Error("notes: ClickUp sent a page, not the Doc's data");
	const doc = await response.json();
	if (doc.is_doc_archived || !Array.isArray(doc.pages)) throw new Error("notes: the Doc is archived or unreadable");

	const notes = flatten(doc.pages)
		.filter((page) => !page.archived && !page.deleted && !SKIP.test(page.name ?? ""))
		.flatMap(toNotes);

	const loaded = (await env.AI_SEARCH.items.list({ search: NOTE_PREFIX, per_page: 50 })).result.filter((item) =>
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

/**
 * One Doc page as notes for AI Search: one per heading (and one for any text
 * before the first), each with its "See:" link lifted out as metadata.
 */
export function toNotes(page) {
	return sections(lines(JSON.parse(page.content || '{"ops":[]}').ops ?? []))
		.map((section) => fromSection(section, page.name))
		.filter(({ text }) => text)
		.map(({ name, text, see }, index) => ({
			key: `${NOTE_PREFIX}${page.id}--${index}.md`,
			text: `# ${page.name}\n\n${text}`,
			metadata: {
				note: name,
				// AI Search keeps only url and title; a note without a See link is titled by its heading.
				title: see?.title ?? name,
				url: see?.url ?? "",
				updated: String(page.date_updated ?? ""),
			},
		}));
}

// A heading line starts a new section.
function sections(all) {
	const found = [[]];
	for (const entry of all) {
		if (entry.header && found.at(-1).length) found.push([]);
		found.at(-1).push(entry);
	}
	return found;
}

/** A section as plain Markdown, minus its "See:" line. */
function fromSection(entries, pageName) {
	let see = null;
	const kept = entries.filter((entry) => {
		const link = /^see:/i.test(entry.plain.trim()) && entry.links[0];
		if (!link) return true;
		see ??= publicLink(link);
		return false;
	});
	const name = entries[0]?.header ? entries[0].plain.trim() : pageName;
	const text = kept.map((entry) => entry.markdown).join("\n").replace(/\n{3,}/g, "\n\n").trim();
	// A heading on its own, or over a placeholder, says nothing.
	const body = kept.filter((entry) => !entry.header && entry.plain.trim());
	const empty = !body.length || body.every((entry) => PLACEHOLDER.test(entry.plain.trim()));
	return { name, see, text: empty ? "" : text };
}

/** ClickUp's page content (Quill ops) as lines. */
function lines(ops) {
	const all = [];
	let line = [];

	for (const op of ops) {
		if (typeof op.insert !== "string") continue;
		const parts = op.insert.split("\n");
		parts.forEach((part, index) => {
			if (index > 0) {
				all.push(finish(line, index === parts.length - 1 ? op.attributes : undefined));
				line = [];
			}
			if (part) line.push({ text: part, link: op.attributes?.link });
		});
	}
	if (line.length) all.push(finish(line));
	return all;
}

// A line ends at a newline insert, which carries the line's heading or list style.
function finish(parts, style = {}) {
	const plain = parts.map((part) => part.text).join("");
	const links = parts.filter((part) => part.link).map((part) => ({ title: part.text.trim(), url: part.link }));
	const prefix = style?.header ? `${"#".repeat(style.header)} ` : style?.list ? "- " : "";
	return { plain, links, header: Boolean(style?.header), markdown: `${prefix}${plain}` };
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
