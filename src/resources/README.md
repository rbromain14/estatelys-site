# Resource pages — content files

One JSON file per resource: `src/resources/<slug>.json`. build.mjs renders each file to
`/resources/<slug>/` in FR (root), EN, DE and HU.

## Schema
```json
{
  "slug": "buying-property-budapest-step-by-step",
  "item": "buy",                    // key of the resource in data.mjs (see list below)
  "updated": "2026-10-26",          // date the facts were checked
  "title":   { "fr": "", "en": "", "de": "", "hu": "" },
  "summary": { "fr": "", "en": "", "de": "", "hu": "" },   // 1–2 sentences, shown under the title and as meta description (max ~155 characters)
  "keyFacts": [ { "fr": "", "en": "", "de": "", "hu": "" } ],  // 3–6 short facts with a figure, each backed by a source below
  "sections": [
    {
      "h":    { "fr": "", "en": "", "de": "", "hu": "" },
      "body": { "fr": "", "en": "", "de": "", "hu": "" }
    }
  ],
  "table": null,                    // optional: { "caption": {lang:""}, "head": {lang:["",""]}, "rows": {lang:[["",""]]} }
  "faq": [],                        // optional: [ { "q": {lang:""}, "a": {lang:""} } ]
  "sources": [ { "title": "", "url": "https://…", "seen": "2026-10-26" } ],
  "legalNotice": true               // true for tax, legal, financing topics: shows "general information, not advice"
}
```

### Body text format
- Paragraphs separated by a blank line (`\n\n`).
- Bullet list: lines starting with `- `.
- Numbered list: lines starting with `1. `, `2. ` …
- Bold: `**text**`. Source reference: `[n]` = n-th entry in `sources` (1-based).
- No HTML, no links in the body (links go in `sources`).
