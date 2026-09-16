import { beforeEach, describe, expect, it } from "vitest";

import { initWorkSchema } from "./work-schema.js";

function page({ role = "Marketing Manager - Distinct Group", stats = true, quote = true } = {}) {
	document.body.innerHTML = `
		<script type="application/ld+json">
			{"@context":"https://schema.org","@type":"CreativeWork","name":"Distinct Group"}
		</script>
		${
			stats
				? `<div class="work-detail_stats">
						<div class="work-detail_stats-item">
							<div class="work-detail_stats-item-num">23%</div>
							<div class="u-opacity-50">Business growth</div>
						</div>
						<div class="work-detail_stats-item">
							<div class="work-detail_stats-item-num">74%</div>
							<div class="u-opacity-50">YoY traffic increase</div>
						</div>
					</div>`
				: ""
		}
		${
			quote
				? `<div class="quote_container">
						<p><span>“</span><span>A pleasure to work with.</span><span>”</span></p>
						<div class="quote_author">
							<div class="quote_author-text">
								<div class="quote_author-title">Josh McCall</div>
								<div class="quote_author-title u-text-color-grey">${role}</div>
							</div>
						</div>
					</div>`
				: ""
		}
	`;
}

function written() {
	return JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
}

describe("work schema", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("adds each result fact to the page's own CreativeWork block", () => {
		page();
		initWorkSchema();

		expect(written().additionalProperty).toEqual([
			{ "@type": "PropertyValue", name: "Business growth", value: "23%" },
			{ "@type": "PropertyValue", name: "YoY traffic increase", value: "74%" },
		]);
	});

	it("marks up a client quote as a review, without its quote marks", () => {
		page();
		initWorkSchema();

		const { review } = written();

		expect(review.reviewBody).toBe("A pleasure to work with.");
		expect(review.author.name).toBe("Josh McCall");
		expect(review.author.jobTitle).toBe("Marketing Manager");
		expect(review.author.worksFor.name).toBe("Distinct Group");
	});

	// Three of the ten case studies quote one of us describing the project.
	// Publishing that as a review would present our own words as a client's.
	it("leaves a quote credited to Spurwing out of the markup", () => {
		page({ role: "Senior Developer - Spurwing" });
		initWorkSchema();

		expect(written().review).toBeUndefined();
	});

	it("leaves the block alone on a page with neither facts nor a quote", () => {
		page({ stats: false, quote: false });
		initWorkSchema();

		expect(written()).toEqual({
			"@context": "https://schema.org",
			"@type": "CreativeWork",
			name: "Distinct Group",
		});
	});
});
