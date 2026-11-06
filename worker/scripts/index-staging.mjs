// Send every staging page's main content to the Worker's /index route, which
// uploads it to AI Search. Run from the repo root:
//   INDEX_KEY=… node worker/scripts/index-staging.mjs [worker-url]
// Pages are keyed like "work__roam-charging.html" and carry their live URL and
// title as metadata, which become the answer's "From:" links.

const worker = process.argv[2] ?? "https://ask.spurwing.co.uk";
const key = process.env.INDEX_KEY;
if (!key) throw new Error("set INDEX_KEY to the Worker's INDEX_KEY secret");

const sitemap = await (await fetch("https://spurwing.webflow.io/sitemap.xml")).text();
const paths = [...sitemap.matchAll(/<loc>https?:\/\/[^/<]+(\/[^<]*)?<\/loc>/g)]
	.map((match) => match[1] || "/")
	.filter((path) => !path.startsWith("/legal"));

const strip = (html) =>
	html
		.replace(/<(script|style|svg|noscript|template|picture|video|figure)\b[\s\S]*?<\/\1>/g, "")
		.replace(/<img\b[^>]*>/g, "")
		.replace(/\s(class|style|data-[\w-]+|srcset|sizes|loading|role|aria-[\w-]+|id|item\w+|width|height|fetchpriority|decoding)="[^"]*"/g, "");

for (const path of paths) {
	const page = await (await fetch(`https://spurwing.webflow.io${path}`)).text();
	const fullTitle = page.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? path;
	const title = fullTitle.replace(/\s*[|–-]\s*Spurwing.*$/, "").replace(/&amp;/g, "&");
	const main = page.match(/<main\b[\s\S]*?<\/main>/)?.[0] ?? "";
	const itemKey = `${path === "/" ? "index" : path.replace(/^\/|\/$/g, "").replaceAll("/", "__")}.html`;

	const response = await fetch(`${worker}/index`, {
		method: "POST",
		headers: { "content-type": "application/json", "x-index-key": key },
		body: JSON.stringify({
			key: itemKey,
			html: `<html><head><title>${title}</title></head><body>${strip(main)}</body></html>`,
			url: `https://www.spurwing.co.uk${path === "/" ? "" : path}`,
			title,
		}),
	});
	console.log(response.status, itemKey);
}
