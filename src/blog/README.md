# Blog articles — content files

One JSON file per article: `src/blog/<slug>.json`. build.mjs renders the list at `/blog/` and each article at
`/blog/<slug>/` in FR (root), EN, DE and HU, newest first. Topics and briefs come from the SEO conversation;
every article is shown to Romain before it goes on main (project rule 6).

```json
{
  "slug": "url-slug-in-english",
  "date": "2026-11-05",            // publication date
  "updated": "2026-11-05",         // optional, date the facts were last checked
  "cover": "rakoczi-03",           // image name in src/img (own photos only)
  "coverAlt": { "fr": "", "en": "", "de": "", "hu": "" },
  "title":   { "fr": "", "en": "", "de": "", "hu": "" },
  "summary": { "fr": "", "en": "", "de": "", "hu": "" },   // 1–2 sentences, list card + meta description
  "sections": [ { "h": { "fr": "", ... }, "body": { "fr": "", ... } } ],
  "properties": ["rakoczi-40"],    // property slugs shown as cards
  "resources": ["sim", "tax"],     // resource keys linked at the end
  "sources": [ { "title": "", "url": "https://…", "seen": "2026-11-05" } ]
}
```
Body format: same as the resource pages (paragraphs, `- ` lists, `1. ` lists, `**bold**`, `[n]` = n-th source).
Prices and rents: only those of the state of play.
