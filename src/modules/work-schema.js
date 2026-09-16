// The case study template emits a CreativeWork block from its head code, which
// can bind a CMS field but cannot do either of the things William asked for.
// The result facts are one Rich Text field that rt-flow reshapes in the
// browser, so there is nothing structured for the head to read; and the quote
// is sometimes one of us describing the project rather than a client, which
// must never be published as a review. Both are settled on the page by the time
// this runs, so it completes the block already there instead of adding a second.

const workSchemaConfig = {
	schemaSelector: 'script[type="application/ld+json"]',
	statItemSelector: ".work-detail_stats-item",
	statValueSelector: ".work-detail_stats-item-num",
	quoteSelector: ".quote_container",
	quoteTextSelector: "p",
	authorSelector: ".quote_author-text .quote_author-title",
	// A quote credited to Spurwing is our own account of the work. It stays on
	// the page and out of the markup.
	ourName: "Spurwing",
};

export function initWorkSchema(root = document) {
	const block = findCreativeWork(root);

	if (!block) return;

	const { script, data } = block;
	const facts = readFacts(root);
	const review = readReview(root);

	if (!facts.length && !review) return;

	if (facts.length) data.additionalProperty = facts;
	if (review) data.review = review;

	script.textContent = JSON.stringify(data);
}

function findCreativeWork(root) {
	const scripts = [...root.querySelectorAll(workSchemaConfig.schemaSelector)];

	for (const script of scripts) {
		let data;

		try {
			data = JSON.parse(script.textContent);
		} catch {
			continue;
		}

		if (data?.["@type"] === "CreativeWork") return { script, data };
	}

	return null;
}

// Each stat reads as a value and the thing it measures: 23% / Business growth.
function readFacts(root) {
	return [...root.querySelectorAll(workSchemaConfig.statItemSelector)]
		.map((item) => {
			const value = clean(item.querySelector(workSchemaConfig.statValueSelector)?.textContent);
			const name = clean([...item.children].at(-1)?.textContent);

			if (!value || !name || name === value) return null;

			return { "@type": "PropertyValue", name, value };
		})
		.filter(Boolean);
}

function readReview(root) {
	const quote = root.querySelector(workSchemaConfig.quoteSelector);

	if (!quote) return null;

	const reviewBody = clean(quote.querySelector(workSchemaConfig.quoteTextSelector)?.textContent)
		.replace(/^[“"']+|[”"']+$/g, "")
		.trim();
	const [nameEl, roleEl] = quote.querySelectorAll(workSchemaConfig.authorSelector);
	const name = clean(nameEl?.textContent);
	const role = clean(roleEl?.textContent);

	if (!reviewBody || !name) return null;

	// "Marketing Manager - Distinct Group"
	const [jobTitle, organisation] = role.split(/\s+[-–—]\s+/);

	if (!organisation || organisation === workSchemaConfig.ourName) return null;

	return {
		"@type": "Review",
		reviewBody,
		author: {
			"@type": "Person",
			name,
			jobTitle,
			worksFor: { "@type": "Organization", name: organisation },
		},
	};
}

// Rich Text carries zero-width joiners through from the editor, which read as
// nothing on the page but land in the markup as stray characters.
function clean(text) {
	return (text || "")
		.replace(/[​-‍﻿]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}
