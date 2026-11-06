/**
 * The FAQ questions sheet. Every question asked in the website's FAQ ask box
 * becomes a row, sent by the ask.spurwing.co.uk Worker (worker/src/log.js).
 *
 * Set up once, in the Google Sheet:
 *   1. Extensions → Apps Script, replace the code with this file, save.
 *   2. Project settings → Script properties → add KEY with a long random value.
 *   3. Deploy → New deployment → Web app; execute as me, access: anyone. Copy
 *      the web app URL.
 *   4. Give the Worker that URL with the key on the end, as a secret:
 *        npx wrangler secret put SHEET_WEBHOOK_URL --config worker/wrangler.jsonc
 *      value: https://script.google.com/macros/s/…/exec?key=THE_KEY
 *   5. File → Settings → time zone (GMT+00:00) London, so times read as UK time.
 */

const HEADERS = ["Asked", "Page", "Question", "Answered", "Answer", "Pages used"];

function doPost(e) {
  const key = PropertiesService.getScriptProperties().getProperty("KEY");
  if (!key || e.parameter.key !== key) return ContentService.createTextOutput("refused");

  const row = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([
    new Date(row.askedAt),
    asText(row.page),
    asText(row.question),
    row.answered ? "Yes" : "No",
    asText(row.answer),
    asText(row.sources),
  ]);
  return ContentService.createTextOutput("ok");
}

// A visitor's question starting with = would run as a formula; a leading
// apostrophe keeps it as text.
function asText(value) {
  const text = String(value || "");
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}
