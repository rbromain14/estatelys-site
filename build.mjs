// Static site generator for Estatelys Budapest. No dependencies: `node build.mjs`.
// Output: dist/  (FR at the root, EN/DE/HU under /en/, /de/, /hu/)
// PREVIEW=1 node build.mjs  -> links end in index.html (for file:// or preview hosting)
import { readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, cpSync, rmSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { SITE, LANGS, LANG_LABEL, LANG_NAME, t, cap, projects, cityPhotos, legal, signature, refsText, resources, seo, team, rentals, partners, blog, districts, pilot } from "./src/data.mjs";
const RES = existsSync("src/resources") ? Object.fromEntries(readdirSync("src/resources").filter((f) => f.endsWith(".json")).map((f) => { const r = JSON.parse(readFileSync(join("src/resources", f), "utf8")); return [r.item, r]; })) : {};
const BLOG = existsSync("src/blog") ? readdirSync("src/blog").filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join("src/blog", f), "utf8"))).sort((a, b) => b.date.localeCompare(a.date) || (b.rank || 0) - (a.rank || 0)) : [];
const RES_ITEMS = resources.groups.flatMap((g) => g.items.map((it) => ({ ...it, group: g })));
const TOOL_PAGES = new Set(["sim"]);
const resReady = (it) => Boolean(RES[it.key]) || TOOL_PAGES.has(it.key);
const REFS = existsSync("src/refs.json") ? JSON.parse(readFileSync("src/refs.json", "utf8")) : [];

const OUT = process.env.OUT || "dist";
// Design variant: optional src/assets/theme.css (loaded after site.css) and its Google Fonts URL in src/theme.json
const THEME = Object.assign({ fonts: "https://fonts.googleapis.com/css2?family=Cinzel:wght@500&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,400&family=Jost:wght@300;400;500&display=swap" },
  existsSync("src/theme.json") ? JSON.parse(readFileSync("src/theme.json", "utf8")) : {}, { css: existsSync("src/assets/theme.css") });
// A property counts as for sale unless its status in data.mjs is set to "sold"
const FOR_SALE = projects.filter((p) => (p.status || "for-sale") === "for-sale");
const PREVIEW = process.env.PREVIEW === "1";
const LOCALE = { fr: "fr-FR", en: "en-GB", de: "de-DE", hu: "hu-HU" };
const OG_LOCALE = { fr: "fr_FR", en: "en_GB", de: "de_DE", hu: "hu_HU" };

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const eur = (n, l) => new Intl.NumberFormat(LOCALE[l], { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n).replace(/ | /g, " ");
const huf = (n, l) => {
  const m = (n * SITE.hufRate) / 1e6;
  const s = new Intl.NumberFormat(LOCALE[l], { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(m);
  return `≈ ${s} M Ft`;
};
const pct = (v, l) => new Intl.NumberFormat(LOCALE[l], { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v) + (l === "en" ? "%" : " %");
const priceMain = (p, l) => (p.priceFromHuf ? p.priceHuf : huf(p.price, l)); // HUF is the primary price for every property (Romain, 3 Nov 2026 19:01)
const priceAlt = (p, l) => (p.priceFromHuf ? `≈ ${eur(p.price, l)}` : huf(p.price, l));
// HUF first (primary), EUR second (Romain, 3 Nov 2026 19:01); the currency the price was set in carries no "≈"
const priceEur = (p, l) => (p.priceFromHuf ? `≈ ${eur(p.price, l)}` : eur(p.price, l));
const priceFt = (p, l) => (p.priceFromHuf ? p.priceHuf : huf(p.price, l));
const priceDuo = (p, l) => `<span class="pd"><span class="pd-1">${priceFt(p, l)}</span><span class="pd-2">${priceEur(p, l)}</span></span>`;

// path helpers: a "route" is like "" | "projects/" | "projects/klauzal-23/"
const langBase = (l) => (l === "fr" ? "" : `${l}/`);
const fileFor = (l, route) => join(OUT, langBase(l), route, "index.html");
function rel(fromLang, fromRoute, toLang, toRoute) {
  const depth = (langBase(fromLang) + fromRoute).split("/").filter(Boolean).length;
  const up = "../".repeat(depth);
  const target = langBase(toLang) + toRoute;
  const href = up + target;
  if (PREVIEW) return (href || "./") + "index.html";
  return href || "./";
}
const asset = (l, route, p) => "../".repeat((langBase(l) + route).split("/").filter(Boolean).length) + p;
const abs = (l, route) => `https://${SITE.domain}/${langBase(l)}${route}`;

// ── SEO helpers ──────────────────────────────────────────────
const BUILT = new Date().toISOString().slice(0, 10); // sitemap <lastmod>
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII"];
// Budapest postcodes are 1DDx, DD = district (1055 -> V)
const districtOf = (p) => { const m = p.address.match(/\b1(\d\d)\d\b/); return m ? ROMAN[+m[1]] || "" : ""; };
const m2Of = (p) => { const m = p.facts[0].en.match(/(\d+)\s*m²/); return m ? +m[1] : null; };
const hufValue = (p) => { const m = String(p.priceHuf || "").match(/([\d.,]+)\s*M/); return m ? Math.round(parseFloat(m[1].replace(",", ".")) * 1e6) : null; };
const ORG_ID = `https://${SITE.domain}/#organization`;
const SEO_INDEXNOW_KEY = "1e40a2d42ad17b32a0814fa174ea9ca9"; // public by design (IndexNow protocol)
// Homepage photo (Unsplash). Change it here: the home hero AND the default share image (og:image) both use it.
// Homepage photo: St Stephen's Basilica, B&W (Unsplash sbyz9wX9Rrg, © Salmen Bejaoui), hosted locally since 5 Nov 2026
// (src/img/hero-basilica-900/1600/2400 .jpg + .webp). Share image = 1200×630 crop of the same photo.
const SHARE_IMG = `https://${SITE.domain}/img/share-basilica.jpg`;
const WEB_ID = `https://${SITE.domain}/#website`;
const seatParts = SITE.seat.match(/^(\d{4})\s+([^,]+),\s*(.+)$/);
const ORG = {
  "@type": "RealEstateAgent", "@id": ORG_ID, name: SITE.name, alternateName: "Estatelys", legalName: SITE.company,
  url: `https://${SITE.domain}/`, logo: `https://${SITE.domain}/assets/logo-dark.png`, image: `https://${SITE.domain}/assets/logo-dark.png`,
  email: SITE.email, taxID: SITE.taxNo, ...(SITE.vatNo ? { vatID: SITE.vatNo } : {}),
  address: { "@type": "PostalAddress", streetAddress: seatParts?.[3], postalCode: seatParts?.[1], addressLocality: seatParts?.[2] || "Budapest", addressCountry: "HU" },
  areaServed: { "@type": "City", name: "Budapest" }, knowsLanguage: LANGS,
  ...((() => { const same = [...(SITE.sameAs || []), ...SITE.social.filter((x) => x.url).map((x) => x.url)]; return same.length ? { sameAs: [...new Set(same)] } : {}; })()),
};
// WebP twin of a .jpg when it exists in src/img (generated by tools/webp.py)
const hasWebp = (name) => existsSync(`src/img/${name}.webp`);

// Cache-busting: ?v=<content hash> on CSS/JS so visitors never mix new HTML with old CSS
const VER = (p) => (existsSync(join("src", p)) ? "?v=" + createHash("md5").update(readFileSync(join("src", p))).digest("hex").slice(0, 8) : "");
function layout({ l, route, title, desc, body, image, extraHead = "", bodyClass = "", crumbs = [], ld = [], noindex = false }) {
  const A = (p) => asset(l, route, p);
  const R = (r) => rel(l, route, l, r);
  const nav = [
    ["projects/", t.navProjects[l]],
    ["rentals/", t.navRentals[l]],
    ...(REFS.length ? [["references/", t.navRefs[l]]] : []),
    ["resources/", t.navResources[l]],
    ...(BLOG.length ? [["blog/", t.navBlog[l]]] : []),
    ["pilot/", t.navPilot[l]],
    ["about/", t.navAbout[l]],
    ["contact/", t.navContact[l]],
  ];
  const isActive = (r) => (r === "" ? route === "" : route.startsWith(r));
  const alt = LANGS.map((x) => `<link rel="alternate" hreflang="${x}" href="${abs(x, route)}">`).join("\n") +
    `\n<link rel="alternate" hreflang="x-default" href="${abs("fr", route)}">`;
  const langLinks = LANGS.map((x) =>
    `<a href="${rel(l, route, x, route)}" hreflang="${x}" lang="${x}" title="${LANG_NAME[x]}"${x === l ? ' aria-current="true" class="on"' : ""}>${LANG_LABEL[x]}</a>`).join("");
  // Default share image = the homepage photo (St Stephen's Basilica, B&W, Unsplash licence), 1200×630 for link previews
  const ogImg = image ? `https://${SITE.domain}/img/${image}.jpg` : SHARE_IMG;
  // One JSON-LD graph per page: publisher + website on every page, breadcrumb on inner pages, page entities
  const trail = route ? [[t.navHome[l], ""], ...crumbs] : [];
  const graph = noindex ? null : {
    "@context": "https://schema.org",
    "@graph": [
      ORG,
      { "@type": "WebSite", "@id": WEB_ID, url: `https://${SITE.domain}/`, name: SITE.name, inLanguage: LANGS, publisher: { "@id": ORG_ID } },
      ...(trail.length ? [{ "@type": "BreadcrumbList", itemListElement: trail.map(([n, r], i) => ({ "@type": "ListItem", position: i + 1, name: n.replace(/<[^>]+>/g, ""), item: abs(l, r) })) }] : []),
      ...ld,
    ],
  };
  const seoHead = noindex ? `<meta name="robots" content="noindex">` : `<link rel="canonical" href="${abs(l, route)}">
${alt}`;
  const fontsHref = /^https?:/.test(THEME.fonts) ? THEME.fonts : A(THEME.fonts);
  const fontsHead = /^https?:/.test(THEME.fonts)
    ? `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="${fontsHref}">`
    : `${(THEME.preload || []).map((f) => `<link rel="preload" href="${A(f)}" as="font" type="font/woff2" crossorigin>`).join("\n")}\n<link rel="stylesheet" href="${fontsHref}">`;
  return `<!doctype html>
<html lang="${l}"${SITE.eventsEndpoint && !PREVIEW && !process.env.NOINDEX ? ` data-ev-url="${SITE.eventsEndpoint}"` : ""}>
<head>
<meta charset="utf-8">
<meta name="msvalidate.01" content="0BD99446D69509A07A6743A18EE2944B">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${seoHead}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(ogImg)}">
${image ? "" : `<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta property="og:image:alt" content="${esc(t.heroAlt[l])}">`}
<meta property="og:url" content="${abs(l, route)}">
<meta property="og:locale" content="${OG_LOCALE[l]}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#12110f">
<link rel="icon" href="${A("assets/favicon.svg")}" type="image/svg+xml">
${fontsHead}
<link rel="stylesheet" href="${A("assets/site.css")}${VER("assets/site.css")}">
${THEME.css ? `<link rel="stylesheet" href="${A("assets/theme.css")}${VER("assets/theme.css")}">` : ""}
${process.env.NOINDEX && !noindex ? '<meta name="robots" content="noindex">' : ""}
${graph ? `<script type="application/ld+json">${JSON.stringify(graph)}</script>` : ""}
${extraHead}
${PREVIEW || noindex || process.env.NOINDEX ? "" : `${SITE.metricoolHash ? `<script>function loadScript(a){var b=document.getElementsByTagName("head")[0],c=document.createElement("script");c.type="text/javascript",c.src="https://tracker.metricool.com/resources/be.js",c.onreadystatechange=a,c.onload=a,b.appendChild(c)}loadScript(function(){beTracker.t({hash:"${SITE.metricoolHash}"})});</script>` : ""}
${SITE.cfBeaconToken ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${SITE.cfBeaconToken}"}'></script>` : ""}`}
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">${l === "fr" ? "Aller au contenu" : l === "de" ? "Zum Inhalt" : l === "hu" ? "Ugrás a tartalomra" : "Skip to content"}</a>
<header class="hdr" id="hdr">
  <div class="wrap hdr-in">
    <a class="logo" href="${R("")}" aria-label="${SITE.name}">
      <img src="${A("assets/logo-white.png")}" alt="Estatelys Budapest" width="160" height="46">
    </a>
    <nav class="nav" aria-label="Main">
      ${nav.filter(([r]) => r !== "contact/").map(([r, n]) => `<a href="${R(r)}"${isActive(r) ? ' aria-current="page"' : ""}>${n}</a>`).join("")}
    </nav>
    <div class="hdr-r">
      <details class="ldd"><summary aria-label="Language: ${LANG_NAME[l]}">${LANG_LABEL[l]}<i aria-hidden="true">▾</i></summary><div class="ldd-m" role="menu">${LANGS.map((x) => `<a href="${rel(l, route, x, route)}" hreflang="${x}" lang="${x}"${x === l ? ' aria-current="true" class="on"' : ""}><b>${LANG_LABEL[x]}</b> ${LANG_NAME[x]}</a>`).join("")}</div></details>
      <a class="btn btn-s" href="${R("contact/")}">${t.contactUs[l]}</a>
      <button class="burger" aria-label="Menu" aria-expanded="false" aria-controls="mnav"><span></span><span></span></button>
    </div>
  </div>
  <nav class="mnav" id="mnav" aria-label="Mobile">
    ${nav.map(([r, n]) => `<a href="${R(r)}"${isActive(r) ? ' aria-current="page"' : ""}>${n}</a>`).join("")}
    <a href="${SITE.appUrl}" rel="nofollow">${t.login[l]}</a>
    <div class="langs">${langLinks}</div>
  </nav>
</header>
<main id="main">
${body}
</main>
<section class="band">
  <div class="wrap band-in">
    <div>
      <h2>${t.ctaBandTitle[l]}</h2>
      <p>${t.ctaBandText[l]}</p>
    </div>
    <a class="btn" href="${R("contact/")}">${t.contactUs[l]}</a>
  </div>
</section>
${followBlock(l)}
<footer class="ftr">
  <div class="wrap ftr-in">
    <div>
      <a class="logo" href="${R("")}"><img src="${A("assets/logo-white.png")}" alt="Estatelys Budapest" width="180" height="52"></a>
      <p class="muted small">${t.tagline[l]}</p>
    </div>
    <div class="ftr-c">
      <a href="mailto:${SITE.email}">${SITE.email}</a>
      <span class="muted">${SITE.seat}</span>
    </div>
    <div class="ftr-c">
      ${nav.map(([r, n]) => `<a href="${R(r)}">${n}</a>`).join("")}
      <a href="${R("legal/")}">${legal.nav[l]}</a>
    </div>
  </div>
  <div class="wrap ftr-b small muted">
    <span>© ${new Date().getFullYear()} ${SITE.name} · ${SITE.company} · Cg. ${SITE.regNo}</span>
    <span>${t.photoCredit[l]}</span>
  </div>
</footer>
<script src="${A("assets/site.js")}${VER("assets/site.js")}" defer></script>
${SITE.eventsEndpoint ? `<script src="${A("assets/track.js")}${VER("assets/track.js")}" defer></script>` : ""}
</body>
</html>`;
}


// Social icons: simple monochrome glyphs (24x24), filled with currentColor
const ICON = {
  linkedin: '<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4v11H3zM9.5 9.75h3.8v1.5h.06c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.77 2.65 4.77 6.1v5.45h-4v-4.83c0-1.15-.02-2.63-1.6-2.63-1.6 0-1.85 1.25-1.85 2.55v4.91h-4z"/>',
  facebook: '<path d="M13.5 21v-7.5h2.53l.38-2.94H13.5V8.69c0-.85.24-1.43 1.46-1.43h1.55V4.63A20.8 20.8 0 0 0 14.25 4.5c-2.24 0-3.77 1.37-3.77 3.88v2.18H7.95v2.94h2.53V21z"/>',
  instagram: '<path d="M12 7.3a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4zm0 7.75a3.05 3.05 0 1 1 0-6.1 3.05 3.05 0 0 1 0 6.1zM17.95 7.1a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0z"/><path d="M12 3.5c-2.3 0-2.6 0-3.5.05-.9.04-1.53.19-2.06.4a4.17 4.17 0 0 0-2.5 2.5c-.21.53-.36 1.16-.4 2.06C3.5 9.4 3.5 9.7 3.5 12s0 2.6.05 3.5c.04.9.19 1.53.4 2.06a4.17 4.17 0 0 0 2.5 2.5c.53.21 1.16.36 2.06.4.9.04 1.2.05 3.5.05s2.6 0 3.5-.05c.9-.04 1.53-.19 2.06-.4a4.17 4.17 0 0 0 2.5-2.5c.21-.53.36-1.16.4-2.06.04-.9.05-1.2.05-3.5s0-2.6-.05-3.5c-.04-.9-.19-1.53-.4-2.06a4.17 4.17 0 0 0-2.5-2.5c-.53-.21-1.16-.36-2.06-.4C14.6 3.5 14.3 3.5 12 3.5zm0 1.53c2.26 0 2.53 0 3.42.05.83.04 1.28.18 1.58.29.4.15.68.34.98.64.3.3.49.58.64.98.11.3.25.75.29 1.58.04.9.05 1.16.05 3.42s0 2.53-.05 3.42c-.04.83-.18 1.28-.29 1.58-.15.4-.34.68-.64.98-.3.3-.58.49-.98.64-.3.11-.75.25-1.58.29-.9.04-1.16.05-3.42.05s-2.53 0-3.42-.05c-.83-.04-1.28-.18-1.58-.29a2.63 2.63 0 0 1-.98-.64 2.63 2.63 0 0 1-.64-.98c-.11-.3-.25-.75-.29-1.58-.04-.9-.05-1.16-.05-3.42s0-2.53.05-3.42c.04-.83.18-1.28.29-1.58.15-.4.34-.68.64-.98.3-.3.58-.49.98-.64.3-.11.75-.25 1.58-.29.9-.04 1.16-.05 3.42-.05z"/>',
  youtube: '<path d="M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.82.42a2.5 2.5 0 0 0-1.76 1.77C2 8.76 2 12 2 12s0 3.24.42 4.81a2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77C22 15.24 22 12 22 12s0-3.24-.42-4.81zM10 15V9l5.2 3z"/>',
  tiktok: '<path d="M16.6 3h-3.1v12.2a2.65 2.65 0 1 1-2.65-2.65c.27 0 .53.04.78.12V9.5a5.8 5.8 0 1 0 5 5.75V9.1a7.3 7.3 0 0 0 4.27 1.37V7.4A4.3 4.3 0 0 1 16.6 3z"/>',
};
const svgIcon = (id) => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">${ICON[id]}</svg>`;
const SOCIAL_PREVIEW = process.env.SOCIAL_PREVIEW === "1";
function partnersBlock(l, route = "") {
  if (!partners.items.length) return "";
  return `<section class="sec wrap partners">
  <p class="eyebrow">${partners.eyebrow[l]}</p>
  <h2>${partners.title[l]}</h2>
  <p class="muted team-i">${partners.intro[l]}</p>
  <div class="ptn-g">${partners.items.map((p) => `<article class="ptn">
    <a class="ptn-l" href="${esc(p.url)}" target="_blank" rel="noopener" data-ev="partner" aria-label="${esc(p.name)}"><img src="${p.local ? asset(l, route, p.logo) : esc(p.logo)}" alt="${esc(p.name)}" width="${p.w}" height="${p.h}" loading="lazy" referrerpolicy="no-referrer"></a>
    <div class="ptn-b">
      <p class="tm-r">${p.role[l]}</p>
      <h3>${esc(p.name)}</h3>
      <p class="muted small">${p.text[l]}</p>
      <a class="ptn-a" href="${esc(p.url)}" target="_blank" rel="noopener" data-ev="partner">${partners.visit[l]} →</a>
    </div>
  </article>`).join("")}</div>
</section>`;
}

function followBlock(l) {
  const list = SITE.social.filter((s) => s.url || SOCIAL_PREVIEW);
  if (!list.length) return "";
  return `<section class="follow">
  <div class="wrap follow-in">
    <div>
      <h2>${t.followTitle[l]}</h2>
      <p class="muted">${t.followText[l]}</p>
    </div>
    <div class="soc">${list.map((s) => s.url
      ? `<a class="soc-b soc-${s.id}" href="${esc(s.url)}" target="_blank" rel="noopener me">${svgIcon(s.id)}<span>${s.label}</span></a>`
      : `<span class="soc-b soc-${s.id} is-soon">${svgIcon(s.id)}<span>${s.label}</span><em>· ${t.soon[l]}</em></span>`).join("")}</div>
  </div>
</section>`;
}

// ── components ───────────────────────────────────────────────
const img = (l, route, name, alt, cls = "", sizes = "100vw", eager = false) => {
  const tag = `<img class="${cls}" src="${asset(l, route, `img/${name}.jpg`)}" srcset="${asset(l, route, `img/${name}-s.jpg`)} 800w, ${asset(l, route, `img/${name}.jpg`)} 1600w" sizes="${sizes}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
  if (!hasWebp(name) || !hasWebp(`${name}-s`)) return tag;
  return `<picture><source type="image/webp" srcset="${asset(l, route, `img/${name}-s.webp`)} 800w, ${asset(l, route, `img/${name}.webp`)} 1600w" sizes="${sizes}">${tag}</picture>`;
};
// single-size image (references) with WebP twin when available
const img1 = (l, route, name, alt) => {
  const tag = `<img src="${asset(l, route, `img/${name}.jpg`)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
  return hasWebp(name) ? `<picture><source type="image/webp" srcset="${asset(l, route, `img/${name}.webp`)}">${tag}</picture>` : tag;
};

function noPhoto(p, l, cls = "") {
  return `<div class="nophoto ${cls}" role="img" aria-label="${esc(p.name)}"><span class="np-n">${esc(p.name)}</span><span class="np-t">${t.photosOnRequest[l]}</span></div>`;
}

function card(p, l, route) {
  const href = rel(l, route, l, `projects/${p.slug}/`);
  const media = p.cover ? img(l, route, p.cover, p.name, "", "(min-width: 900px) 45vw, 100vw") : noPhoto(p, l);
  return `<a class="card" href="${href}">
  <div class="card-m">${media}<span class="tag">${p.type[l]}</span></div>
  <div class="card-b">
    <p class="eyebrow">${p.district[l]}</p>
    <h3>${p.name}</h3>
    <p class="muted">${p.short[l]}</p>
    <div class="card-f">
      <span class="price">${priceDuo(p, l)}</span>
      ${p.yield ? `<span class="yield">${t.yield[l]} ${pct(p.yield, l)}</span>` : ""}
    </div>
  </div>
</a>`;
}

function mapBlock(points, l, id = "map", height = 460) {
  const data = points.map((p) => ({ n: p.name, a: p.address, lat: p.lat, lng: p.lng, t: p.type[l] }));
  return `<div class="map" id="${id}" style="height:${height}px" data-points='${esc(JSON.stringify(data))}'></div>`;
}
const leafletHead = `<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin="" defer></script>`;

// ── pages ────────────────────────────────────────────────────
function pilotHomeBlock(l, route = "") {
  const R = (r) => rel(l, route, l, r);
  return `
<section class="sec wrap">
  <div class="phome dk">
    <p class="eyebrow">${pilot.eyebrow[l]}</p>
    <h2>${pilot.homeTitle[l]}</h2>
    <p class="lead">${pilot.homeText[l]}</p>
    <div class="row" style="margin-top:22px">
      <a class="btn" href="${SITE.appUrl}" rel="nofollow">${pilot.tryFree[l]}</a>
      <a class="btn btn-o" href="${R("pilot/")}">${pilot.learnMore[l]}</a>
    </div>
  </div>
</section>`;
}

function home(l) {
  const route = "";
  const A = (p) => asset(l, route, p);
  const R = (r) => rel(l, route, l, r);
  const body = `
<section class="hero dk">
  <picture><source type="image/webp" srcset="${A("img/hero-basilica-900.webp")} 900w, ${A("img/hero-basilica-1600.webp")} 1600w, ${A("img/hero-basilica-2400.webp")} 2400w" sizes="100vw"><img class="hero-img" src="${A("img/hero-basilica-1600.jpg")}" srcset="${A("img/hero-basilica-900.jpg")} 900w, ${A("img/hero-basilica-1600.jpg")} 1600w, ${A("img/hero-basilica-2400.jpg")} 2400w" sizes="100vw" width="2400" height="1350" alt="${esc(t.heroAlt[l])}" fetchpriority="high"></picture>
  <a class="hero-cr" href="https://unsplash.com/photos/sbyz9wX9Rrg" target="_blank" rel="noopener">© Salmen Bejaoui / Unsplash</a>
  <div class="hero-fade"></div>
  <div class="wrap hero-in">
    <img class="hero-sig" src="${A("assets/signature-white.png")}" alt="" width="1400" height="341">
    <p class="eyebrow">${t.heroEyebrow[l]}</p>
    <h1>${t.heroTitle[l]}</h1>
    <p class="lead">${t.heroText[l]}</p>
    <div class="row">
      <a class="btn" href="${R("projects/")}">${t.ctaProjects[l]}</a>
      <a class="btn btn-o" href="${R("contact/")}">${t.contactUs[l]}</a>
    </div>
  </div>
</section>
<section class="stats">
  <div class="wrap stats-in">
    <div><b>60+</b><span>${t.stat1[l]}</span></div>
    <div><b class="sm">I · II · V · VI · VII · VIII · XIII</b><span>${t.stat2[l]}</span></div>
    <a class="stat-l" href="${R("projects/")}"><b>${FOR_SALE.length}</b><span>${t.stat3[l]} <i class="arr">→</i></span></a>
    <div><b class="sm">FR · EN · DE · HU</b><span>${t.stat4[l]}</span></div>
    <a class="stat-l" href="${R("pilot/")}"><b class="sm">Estatelys Pilot</b><span>${t.stat5[l]} <i class="arr">→</i></span></a>
  </div>
</section>
<section class="sec wrap">
  <div class="sec-h">
    <div><p class="eyebrow">${t.featuredEyebrow[l]}</p><h2>${t.featuredTitle[l]}</h2></div>
    <a class="link" href="${R("projects/")}">${t.allProjects[l]} <i class="arr">→</i></a>
  </div>
  <div class="grid2">${FOR_SALE.map((p) => card(p, l, route)).join("")}</div>
</section>
${pilotHomeBlock(l, route)}
<section class="sec wrap">
  <p class="eyebrow">${t.jobEyebrow[l]}</p>
  <h2>${t.jobTitle[l]}</h2>
  <div class="svc">
    ${[1, 2, 3].map((i) => `<div><p class="num">0${i}</p><h3>${t[`s${i}t`][l]}</h3><p class="muted">${t[`s${i}d`][l]}</p></div>`).join("")}
  </div>
</section>
<section class="sec wrap">
  <div class="split">
    <div><p class="eyebrow">${t.cityEyebrow[l]}</p><h2>${t.cityTitle[l]}</h2></div>
    <p class="muted lead2">${t.cityText[l]}</p>
  </div>
  <div class="city">
    ${cityPhotos.map((c) => `<figure><img src="${c.src}" alt="${esc(c.label[l])}" loading="lazy" decoding="async"><figcaption><span>${c.label[l]}</span><a class="small muted" href="${c.link}" rel="noopener" target="_blank">© ${c.credit} / Unsplash</a></figcaption></figure>`).join("")}
  </div>
</section>
${partnersBlock(l, route)}`;
  return layout({ l, route, title: seo.homeTitle[l], desc: t.metaDesc[l], body, bodyClass: "is-home" });
}

function projectsPage(l) {
  const route = "projects/";
  const body = `
<section class="phdr dk"><div class="wrap">
  <p class="eyebrow">${t.forSale[l]}</p>
  <h1>${t.projTitle[l]}</h1>
  <p class="lead muted">${t.projIntro[l]}</p>
</div></section>
<section class="sec wrap"><div class="grid2">${FOR_SALE.map((p) => card(p, l, route)).join("")}</div></section>
<section class="sec wrap">
  <h2 class="h3">${t.mapTitle[l]}</h2>
  ${mapBlock(FOR_SALE, l)}
</section>`;
  const list = { "@type": "ItemList", name: t.projTitle[l], numberOfItems: FOR_SALE.length,
    itemListElement: FOR_SALE.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: abs(l, `projects/${p.slug}/`), name: p.name })) };
  return layout({ l, route, title: seo.projTitle[l].replace("{n}", FOR_SALE.length), desc: t.projIntro[l], body, extraHead: leafletHead,
    crumbs: [[t.navProjects[l], route]], ld: [list] });
}

function rentalsPage(l) {
  const route = "rentals/";
  const R = (r) => rel(l, route, l, r);
  const blocks = rentals.items.map((it) => {
    const p = projects.find((x) => x.slug === it.slug);
    if (!p) return "";
    const media = p.cover ? img(l, route, p.cover, p.name, "", "(min-width: 900px) 45vw, 100vw") : "";
    const head = `<p class="eyebrow">${p.district[l]}</p><h2>${p.name}</h2><p class="muted">${(it.kind === "whole" ? rentals.whole : rentals.rooms)[l]} · ${p.facts.slice(0, 3).map((f) => f[l]).join(" · ")}</p>`;
    const links = `<div class="rent-a"><a class="btn" href="${R("contact/")}?p=${encodeURIComponent(p.name + " — " + rentals.title.en)}" data-ev="visit">${rentals.ask[l]}</a><a class="btn btn-o" href="${R(`rentals/${p.slug}/`)}">${rentals.details[l]}</a></div>`;
    let body = "";
    if (it.kind === "whole") {
      body = `<p class="rent-p">${eur(it.rent, l)} <span>${it.exCharges ? rentals.exCharges[l] + " " : ""}${rentals.monthly[l]}</span></p>`;
    } else {
      body = rentTable(it, l);
    }
    return `<article class="rent">${media ? `<div class="rent-m">${media}</div>` : ""}<div class="rent-b">${head}${body}${links}</div></article>`;
  }).join("");
  const body = `
<section class="phdr dk"><div class="wrap">
  <p class="eyebrow">${t.navRentals[l]}</p>
  <h1>${rentals.title[l]}</h1>
  <p class="lead muted">${rentals.intro[l]}</p>
</div></section>
<section class="sec wrap rents">${blocks}</section>`;
  return layout({ l, route, title: `${rentals.title[l]} | Estatelys`, desc: rentals.intro[l], body, crumbs: [[t.navRentals[l], route]] });
}

function rentTable(it, l) {
      const tot = it.rooms.reduce((a, r) => [a[0] + r.rent, a[1] + r.charges], [0, 0]);
      return `<div class="rtbl rent-t"><table><thead><tr><th>${rentals.room[l]}</th><th>${rentals.rent[l]}</th><th>${rentals.charges[l]}</th><th>${rentals.total[l]}</th></tr></thead><tbody>${it.rooms.map((r) => `<tr><th scope="row">${esc(r.name)}${r.pos ? ` <span class="muted small">(${r.pos[l]})</span>` : ""}</th><td>${eur(r.rent, l)}</td><td>${eur(r.charges, l)}</td><td><strong>${eur(r.rent + r.charges, l)}</strong></td></tr>`).join("")}<tr class="rent-sum"><th scope="row">${rentals.sum[l]}</th><td>${eur(tot[0], l)}</td><td>${eur(tot[1], l)}</td><td><strong>${eur(tot[0] + tot[1], l)}</strong></td></tr></tbody></table></div>`;
}

// rent = an item of rentals.items: renders the same property as a rental listing (no sale price) at rentals/<slug>/
function projectPage(p, l, rent = null) {
  const route = rent ? `rentals/${p.slug}/` : `projects/${p.slug}/`;
  const R = (r) => rel(l, route, l, r);
  const others = FOR_SALE.filter((x) => x.slug !== p.slug);
  const gallery = p.images.length ? `
<section class="sec wrap">
  <h2 class="h3">${t.gallery[l]}</h2>
  <div class="gal" data-gallery>
    ${p.images.map(([n, c], i, a) => { const r = (a.length + 3) % 4, wide = r && i >= a.length - (4 - r); return `<button class="gal-i${i === 0 ? " big" : ""}${wide ? " wide" : ""}" data-full="${asset(l, route, `img/${n}.jpg`)}" data-cap="${esc(cap[c][l])}" aria-label="${esc(cap[c][l])}">${img(l, route, n, cap[c][l], "", "(min-width: 900px) 33vw, 50vw")}</button>`; }).join("")}
  </div>
  ${p.cgi ? `<p class="small muted note">${t.cgiNote[l]}</p>` : ""}
</section>` : "";

  const invest = !rent && p.rent ? `
<div class="inv">
  <div><span>${t.price[l]}</span><b>${priceDuo(p, l)}</b>${p.priceM2 ? `<em>${p.priceM2} / m²</em>` : ""}</div>
  <div><span>${t.rent[l]}</span><b>${eur(p.rent, l)}</b><em>${p.rentDetail[l]} · ${eur(p.rent * 12, l)} / ${l === "fr" ? "an" : l === "de" ? "Jahr" : l === "hu" ? "év" : "year"}</em></div>
  <div><span>${t.yield[l]}</span><b>${pct(p.yield, l)}</b><em>${eur(p.rent * 12, l)} ÷ ${eur(p.price, l)}</em></div>
</div>
<p class="small muted note">${t.yieldNote[l]} ${(p.priceFromHuf ? t.eurNote : t.hufNote)[l]}</p>` : "";

  const building = p.buildingText ? `
<section class="sec wrap">
  <div class="split">
    <div><p class="eyebrow">${t.theBuilding[l]}</p><h2 class="h3">${p.address.split(",")[0]}</h2></div>
    <p class="muted lead2">${p.buildingText[l]}</p>
  </div>
  ${p.buildingImages?.length ? `<div class="bimg n${p.buildingImages.length}">${p.buildingImages.map(([n, c]) => `<figure>${img(l, route, n, cap[c][l], "", "(min-width: 900px) 33vw, 100vw")}<figcaption class="small muted">${cap[c][l]}</figcaption></figure>`).join("")}</div>` : ""}
</section>` : "";

  const district = p.districtText ? `
<section class="sec wrap">
  <div class="split">
    <div><p class="eyebrow">${t.theDistrict[l]}</p><h2 class="h3">${p.district[l]}</h2></div>
    <div><p class="muted lead2">${p.districtText[l]}</p>${(() => { const d = distOfProp(p); return d && !rent ? `<p><a class="res-a" href="${R(`districts/${d.slug}/`)}">${districts.link[l]} <i class="arr">→</i></a></p>` : ""; })()}</div>
  </div>
</section>` : "";

  const plans = p.plans.length ? `
<section class="sec wrap">
  <h2 class="h3">${t.layout[l]}</h2>
  <div class="plans">${p.plans.map((n) => `<a href="${asset(l, route, `img/${n}.jpg`)}" target="_blank" rel="noopener"><img src="${asset(l, route, `img/${n}.jpg`)}" alt="${esc(t.layout[l] + " — " + p.name)}" loading="lazy"></a>`).join("")}</div>
</section>` : "";

  const body = `
<section class="phero dk">
  ${p.cover ? img(l, route, p.cover, p.name, "phero-img", "100vw", true) : `<div class="phero-img phero-none"></div>`}
  <div class="hero-fade"></div>
  <div class="wrap phero-in">
    <p class="eyebrow">${p.district[l]} · ${rent ? (rent.kind === "whole" ? rentals.whole : rentals.rooms)[l] : p.type[l]} · ${rent ? t.navRentals[l] : t.forSale[l]}</p>
    <h1>${p.name}</h1>
    <p class="lead">${p.address}</p>
  </div>
</section>
<section class="sec wrap">
  <div class="pgrid">
    <div>
      <p class="eyebrow">${t.theApartment[l]}</p>
      <p class="lead2">${(rent?.desc || p.desc)[l]}</p>
      <h2 class="h4">${t.keyFacts[l]}</h2>
      <ul class="chips">${p.facts.map((f) => `<li>${f[l]}</li>`).join("")}</ul>
      ${invest}
      ${rent?.kind === "rooms" ? `<h2 class="h4">${rentals.rooms[l]}</h2>${rentTable(rent, l)}` : ""}
    </div>
    ${rent ? `<aside class="pbox">
      <p class="eyebrow">${rentals.rent[l]}</p>
      ${rent.kind === "whole" ? `<p class="pbig">${eur(rent.rent, l)}</p><p class="muted">${rent.exCharges ? rentals.exCharges[l] + " " : ""}${rentals.monthly[l]}</p>` : `<p class="pbig">${eur(Math.min(...rent.rooms.map((r) => r.rent)), l)}+</p><p class="muted">${rentals.perRoom[l]}</p>`}
      <a class="btn wfull" href="${R("contact/")}?p=${encodeURIComponent(p.name + " — " + rentals.title.en)}" data-ev="visit">${rentals.ask[l]}</a>
      <a class="btn btn-o wfull" href="${R("rentals/")}">${rentals.all[l]}</a>
    </aside>` : `<aside class="pbox">
      <p class="eyebrow">${t.price[l]}</p>
      <p class="pbig">${priceDuo(p, l)}</p>
      ${!p.rent && p.priceM2 ? `<p class="muted">${p.priceM2} / m²</p>` : ""}
      ${p.yield ? `<dl><div><dt>${t.rent[l]}</dt><dd>${eur(p.rent, l)}</dd></div><div><dt>${t.yield[l]}</dt><dd>${pct(p.yield, l)}</dd></div></dl>` : ""}
      ${existsSync(`src/assets/brochures/${p.slug}-${l}.pdf`) ? `<a class="btn wfull" href="${asset(l, route, `assets/brochures/${p.slug}-${l}.pdf`)}" download data-ev="brochure">${t.brochureDl[l]}</a>` : `<a class="btn wfull" href="${R("contact/")}?p=${encodeURIComponent(p.name)}">${t.askInfo[l]}</a>`}
      <a class="btn btn-o wfull" href="${R("contact/")}?p=${encodeURIComponent(p.name)}">${t.visit[l]}</a>
      <p class="small muted">${p.rent ? "" : (p.priceFromHuf ? t.eurNote : t.hufNote)[l]}</p>
    </aside>`}
  </div>
</section>
${gallery}
${building}
${district}
${plans}
${p.streetView ? `<section class="sec wrap">
  <h2 class="h3">${t.facade[l]}</h2>
  <iframe class="sv" src="${esc(p.streetView)}" title="${esc(t.facade[l] + " — " + p.name)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
</section>` : ""}
<section class="sec wrap">
  <h2 class="h3">${t.location[l]}</h2>
  ${mapBlock([p], l, "map", 380)}
</section>
${rent ? "" : `<section class="sec wrap">
  <h2 class="h3">${t.otherProjects[l]}</h2>
  <div class="grid3">${others.map((o) => card(o, l, route)).join("")}</div>
</section>`}
<div class="lb" id="lb" hidden><button class="lb-x" aria-label="Close">×</button><button class="lb-p" aria-label="Previous">‹</button><figure><img alt=""><figcaption></figcaption></figure><button class="lb-n" aria-label="Next">›</button></div>`;

  // Price in the currency the property is priced in (Paulay Ede: HUF), as shown on the page
  const huf = p.priceFromHuf ? hufValue(p) : null;
  const m2 = m2Of(p);
  const photos = [p.cover, ...p.images.map(([n]) => n)].filter((n, i, a) => n && a.indexOf(n) === i).slice(0, 6);
  const offer = {
    "@type": "Offer", "@id": abs(l, route) + "#offer", url: abs(l, route), name: p.name, description: p.short[l],
    price: huf ?? p.price, priceCurrency: huf ? "HUF" : "EUR",
    availability: "https://schema.org/InStock", seller: { "@id": ORG_ID },
    itemOffered: { "@type": "Apartment", name: `${p.name}, Budapest ${districtOf(p)}`.trim(), description: p.desc[l],
      ...(m2 ? { floorSize: { "@type": "QuantitativeValue", value: m2, unitCode: "MTK" } } : {}),
      address: { "@type": "PostalAddress", streetAddress: p.address.split(",")[0], addressLocality: "Budapest", postalCode: p.address.match(/\d{4}/)?.[0], addressCountry: "HU" },
      geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lng },
      ...(photos.length ? { image: photos.map((n) => `https://${SITE.domain}/img/${n}.jpg`) } : {}) },
  };
  const d = districtOf(p);
  if (rent) {
    const monthly = rent.kind === "whole" ? rent.rent : Math.min(...rent.rooms.map((r) => r.rent));
    const lease = { ...offer, "@id": abs(l, route) + "#offer", url: abs(l, route), description: rent.short[l], itemOffered: { ...offer.itemOffered, description: rent.desc[l] }, businessFunction: "http://purl.org/goodrelations/v1#LeaseOut",
      price: undefined, priceCurrency: undefined,
      priceSpecification: { "@type": "UnitPriceSpecification", price: monthly, priceCurrency: "EUR", unitCode: "MON", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" } } };
    return layout({ l, route, title: `${p.name}, Budapest ${d} — ${t.navRentals[l]}, ${eur(monthly, l)}${rent.kind === "whole" ? "" : "+"} ${rentals.monthly[l]} | Estatelys`, desc: rent.short[l], body, image: p.cover,
      extraHead: leafletHead, crumbs: [[t.navRentals[l], "rentals/"], [p.name, route]], ld: [JSON.parse(JSON.stringify(lease))] });
  }
  return layout({ l, route, title: `${p.name}, Budapest ${d} — ${p.type[l]}, ${priceMain(p, l)} | Estatelys`, desc: p.short[l], body, image: p.cover,
    extraHead: leafletHead, crumbs: [[t.navProjects[l], "projects/"], [p.name, route]], ld: [offer] });
}

function about(l) {
  const route = "about/";
  const body = `
<section class="phdr dk"><div class="wrap">
  <p class="eyebrow">${t.aboutEyebrow[l]}</p>
  <h1>${t.aboutTitle[l]}</h1>
  <p class="lead muted">${t.aboutIntro[l]}</p>
</div></section>
<section class="sec wrap">
  <div class="about">
    ${img(l, route, "stollar-13", cap.courtyard[l], "about-img", "(min-width: 900px) 45vw, 100vw")}
    <div>
      <h2>${t.approach[l]}</h2>
      <p class="muted">${t.approach1[l]}</p>
      <p class="muted">${t.approach2[l]}</p>
    </div>
  </div>
</section>
<section class="sec wrap">
  <p class="eyebrow">${t.jobEyebrow[l]}</p>
  <h2>${t.jobTitle[l]}</h2>
  <div class="svc">
    ${[1, 2, 3].map((i) => `<div><p class="num">0${i}</p><h3>${t[`s${i}t`][l]}</h3><p class="muted">${t[`s${i}d`][l]}</p></div>`).join("")}
  </div>
</section>
<section class="sec wrap team">
  <p class="eyebrow">${team.eyebrow[l]}</p>
  <h2>${team.title[l]}</h2>
  <p class="muted team-i">${team.intro[l]}</p>
  <div class="team-g">${team.members.map((m) => `<article class="tm">
    <div class="tm-a" aria-hidden="true">${m.name ? esc(m.name.replace(/\./g, "").split(" ").map((w) => w[0]).join("").slice(0, 2)) : "·"}</div>
    <p class="tm-r">${m.title[l]}${m.partner ? ` <span class="tm-p">${team.partner[l]}</span>` : ""}</p>
    ${m.name ? `<h3>${esc(m.name)}</h3>` : ""}
    <p class="muted small">${m.text[l]}</p>
  </article>`).join("")}</div>
</section>
${partnersBlock(l, route)}
<section class="sec wrap sig">
  <h2>${signature.title[l]}</h2>
  <img class="sig-img" src="${asset(l, route, "assets/signature.png")}" alt="Estatelys" width="1400" height="341" loading="lazy">
  <div class="vals vals-row">
    ${[1, 2, 3].map((i) => `<div><h3>${t[`v${i}t`][l]}</h3><p class="muted">${t[`v${i}d`][l]}</p></div>`).join("")}
  </div>
</section>`;
  return layout({ l, route, title: `${t.navAbout[l]} — ${SITE.name}`, desc: t.aboutIntro[l], body, crumbs: [[t.navAbout[l], route]] });
}

function contact(l) {
  const route = "contact/";
  const body = `
<section class="phdr dk"><div class="wrap">
  <p class="eyebrow">${t.navContact[l]}</p>
  <h1>${t.contactTitle[l]}</h1>
  <p class="lead muted">${t.contactIntro[l]}</p>
</div></section>
<section class="wrap sec0">
  <div class="cgrid">
    <form class="form" id="cform" data-email="${SITE.email}" data-subject="${esc(SITE.name)}">
      <label><span>${t.name[l]}</span><input name="name" required autocomplete="name"></label>
      <div class="two">
        <label><span>${t.email[l]}</span><input name="email" type="email" required autocomplete="email"></label>
        <label><span>${t.phone[l]}</span><input name="phone" type="tel" autocomplete="tel"></label>
      </div>
      <label><span>${t.property[l]}</span>
        <select name="property"><option value="">${t.general[l]}</option>${FOR_SALE.map((p) => `<option>${p.name}</option>`).join("")}</select>
      </label>
      <label><span>${t.message[l]}</span><textarea name="message" rows="6" required></textarea></label>
      <button class="btn" type="submit">${t.send[l]}</button>
      <p class="small muted">${t.formNote[l]}</p>
    </form>
    <aside class="pbox">
      <p class="eyebrow">${SITE.name}</p>
      <a class="big-l" href="mailto:${SITE.email}">${SITE.email}</a>
      <p class="muted">${SITE.company}<br>${SITE.seat}</p>
    </aside>
  </div>
</section>`;
  return layout({ l, route, title: `${t.navContact[l]} · ${t.contactTitle[l]} | ${SITE.name}`, desc: seo.contactDesc[l], body, crumbs: [[t.navContact[l], route]] });
}


function legalPage(l) {
  const route = "legal/";
  const rows = [[legal.lblName[l], `${SITE.company}<br><span class="muted small">${SITE.companyFull}</span>`], [legal.lblSeat[l], SITE.seat],
    [legal.lblReg[l], SITE.regNo], [legal.lblCourt[l], SITE.court], [legal.lblTax[l], SITE.taxNo], ...(SITE.vatNo ? [[legal.lblVat[l], SITE.vatNo]] : []), [legal.lblDir[l], SITE.director],
    [legal.lblContact[l], `<a href="mailto:${SITE.email}">${SITE.email}</a>`]];
  const body = `
<section class="phdr dk"><div class="wrap"><p class="eyebrow">${legal.nav[l]}</p><h1>${legal.title[l]}</h1></div></section>
<section class="wrap sec0 legal">
  <h2 class="h3">${legal.publisher[l]}</h2>
  <dl class="ldl">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
  <p class="muted">${legal.brand[l]}</p>
  <h2 class="h3">${legal.hosting[l]}</h2>
  <p class="muted">${legal.hostingText[l]}</p>
  <h2 class="h3">${legal.offers[l]}</h2>
  <p class="muted">${legal.offersText[l]}</p>
  <h2 class="h3">${legal.privacy[l]}</h2>
  ${legal.privacyText[l].map((p) => `<p class="muted">${p}</p>`).join("")}
</section>`;
  return layout({ l, route, title: `${legal.title[l]} — ${SITE.name}`, desc: `${legal.title[l]} — ${SITE.company}`, body, crumbs: [[legal.nav[l], route]] });
}


function resourcesPage(l) {
  const route = "resources/";
  const R = (r) => rel(l, route, l, r);
  const body = `
<section class="phdr dk"><div class="wrap">
  <p class="eyebrow">${t.navResources[l]}</p>
  <h1>${resources.title[l]}</h1>
  <p class="lead muted">${resources.intro[l]}</p>
</div></section>
<section class="sec wrap">
  <div class="res">
    ${resources.groups.map((g) => `<div class="res-g"><h2 class="h3">${g.t[l]}</h2><ul>${g.items.filter(resReady).map((it) => resReady(it)
      ? `<li class="on"><a class="res-l" href="${R(`resources/${it.slug}/`)}">${it[l]}</a><a class="res-a" href="${R(`resources/${it.slug}/`)}">${resources.ui.read[l]} <i class="arr">→</i></a></li>`
      : `<li><span>${it[l]}</span><a class="res-a" href="${R("contact/")}?r=${encodeURIComponent(it.en)}"><em>${resources.soon[l]}</em> ${resources.ask[l]} <i class="arr">→</i></a></li>`).join("")}</ul></div>`).join("")}
  </div>
</section>`;
  return layout({ l, route, title: `${resources.title[l]} | Estatelys`, desc: resources.intro[l], body, crumbs: [[t.navResources[l], route]] });
}


// ── resource pages ───────────────────────────────────────────
const DATE_FMT = (d, l) => new Intl.DateTimeFormat(LOCALE[l], { day: "numeric", month: "long", year: "numeric" }).format(new Date(d + "T12:00:00Z"));
function md(text = "", nSources = 0) {
  const inline = (x) => esc(x)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(\d+)\]/g, (m, n) => (+n >= 1 && +n <= nSources ? `<sup><a href="#src-${n}">[${n}]</a></sup>` : m));
  const out = [];
  for (const block of String(text).trim().split(/\n\s*\n/)) {
    let para = [], list = null, kind = "";
    const flushP = () => { if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`); para = []; };
    const flushL = () => { if (list) out.push(`<${kind}>${list.map((x) => `<li>${inline(x)}</li>`).join("")}</${kind}>`); list = null; };
    for (const raw of block.split("\n")) {
      const x = raw.trim(); if (!x) continue;
      const ul = /^- /.test(x), ol = /^\d+\. /.test(x);
      if (ul || ol) {
        const k = ul ? "ul" : "ol";
        flushP(); if (list && kind !== k) flushL();
        if (!list) { list = []; kind = k; }
        list.push(ul ? x.slice(2) : x.replace(/^\d+\. /, ""));
      } else { flushL(); para.push(x); }
    }
    flushP(); flushL();
  }
  return out.join("\n");
}
function simTool(l, r) {
  const S = resources.sim, c = (r && r.calc) || {};
  const buy = c.defaultBuyCostsPct ?? (c.transferDutyRate ? c.transferDutyRate * 100 : "");
  const fields = [["price", 309600, 1000], ["buyCosts", buy, 0.1], ["works", 0, 500], ["rent", 1356, 10], ["vacancy", 0, 0.5], ["charges", 0, 5], ["mgmt", 0, 0.5], ["other", 0, 50], ["tax", "", 0.5]];
  return `<form class="sim" data-sim onsubmit="return false">
  <div class="sim-f">${fields.map(([k, v, step]) => `<label><span>${S.f[k][l]}</span><input type="number" inputmode="decimal" min="0" step="${step}" name="${k}" value="${v}"></label>`).join("")}</div>
  <div class="sim-r" aria-live="polite">
    ${["invest", "gross", "net", "netTax", "cash"].map((k) => `<div><span>${S.r[k][l]}</span><b data-out="${k}">–</b></div>`).join("")}
  </div>
  <p class="small muted">${S.r.formula[l]}</p>
  <p class="small muted">${S.note[l]}</p>
</form>`;
}
function costTool(l, r) {
  const c = (r && r.calc) || {};
  if (!c.transferDutyRate) return "";
  return `<div class="sim" data-costs='${esc(JSON.stringify(c))}' data-lang="${l}">
  <div class="sim-f"><label><span>${{ fr: "Prix du bien (€)", en: "Property price (€)", de: "Kaufpreis (€)", hu: "Az ingatlan ára (€)" }[l]}</span><input type="number" min="0" step="1000" name="p" value="295000"></label>
  <label><span>${{ fr: "Prix de revente (€)", en: "Resale price (€)", de: "Verkaufspreis (€)", hu: "Eladási ár (€)" }[l]}</span><input type="number" min="0" step="1000" name="s" value=""></label>
  <label><span>${{ fr: "Années de détention", en: "Years held", de: "Haltedauer (Jahre)", hu: "Tartási idő (év)" }[l]}</span><input type="number" min="0" max="30" step="1" name="y" value="3"></label></div>
  <div class="sim-r" aria-live="polite" data-costs-out></div>
</div>`;
}
function resourcePage(it, l) {
  const r = RES[it.key] || null;
  const route = `resources/${it.slug}/`;
  const R = (x) => rel(l, route, l, x);
  const title = r ? r.title[l] : (it.key === "sim" ? resources.sim.title[l] : it[l]);
  const summary = r ? r.summary[l] : (it.key === "sim" ? resources.sim.summary[l] : "");
  const n = r ? (r.sources || []).length : 0;
  const tbl = r && r.table && r.table.rows && r.table.rows[l] ? `<div class="rtbl"><table>${r.table.caption ? `<caption>${esc(r.table.caption[l])}</caption>` : ""}<thead><tr>${r.table.head[l].map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${r.table.rows[l].map((row) => `<tr>${row.map((c, i) => i === 0 ? `<th scope="row">${md(String(c), n).replace(/^<p>|<\/p>$/g, "")}</th>` : `<td>${md(String(c), n).replace(/^<p>|<\/p>$/g, "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : "";
  const faq = r && r.faq && r.faq.length ? `<section class="rsec"><h2>${resources.ui.faq[l]}</h2><div class="rfaq">${r.faq.map((q) => `<details><summary>${esc(q.q[l])}</summary>${md(q.a[l], n)}</details>`).join("")}</div></section>` : "";
  const siblings = it.group.items.filter((x) => x.key !== it.key && resReady(x));
  const tool = it.key === "sim" ? simTool(l, RES.costs) : it.key === "costs" ? costTool(l, r) : "";
  const places = r && r.places && r.places.length ? `<div class="map rmap" data-points='${esc(JSON.stringify(r.places.map((p) => ({ n: esc(p.name), a: esc(p.status ? p.status[l] : ""), t: esc((p.district ? p.district + " · " : "") + (p.note ? p.note[l] : "")), lat: p.lat, lng: p.lng }))))}'></div>` : "";
  const body = `
<section class="phdr dk"><div class="wrap">
  <p class="eyebrow"><a href="${R("resources/")}">${t.navResources[l]}</a> · ${it.group.t[l]}</p>
  <h1 class="rh1">${esc(title)}</h1>
  ${summary ? `<p class="lead muted">${esc(summary)}</p>` : ""}
  ${r ? `<p class="small muted rdate">${resources.ui.updated[l]} ${DATE_FMT(r.updated, l)}</p>` : ""}
</div></section>
<section class="sec wrap rwrap">
  <article class="rart">
    ${r && r.legalNotice ? `<p class="rnote">${resources.ui.legal[l]}</p>` : ""}
    ${tool}
    ${r && r.keyFacts && r.keyFacts.length ? `<div class="rkey"><h2 class="h4">${resources.ui.keyFacts[l]}</h2><ul>${r.keyFacts.map((k) => `<li>${md(k[l], n).replace(/^<p>|<\/p>$/g, "")}</li>`).join("")}</ul></div>` : ""}
    ${places}
    ${r ? (r.sections || []).map((x, i) => `<section class="rsec"><h2>${esc(x.h[l])}</h2>${md(x.body[l], n)}</section>${i === 0 ? tbl : ""}`).join("") : ""}
    ${r && !(r.sections || []).length ? tbl : ""}
    ${faq}
    ${n ? `<section class="rsec rsrc"><h2 class="h4">${resources.ui.sources[l]}</h2><ol>${r.sources.map((x, i) => `<li id="src-${i + 1}"><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a> <span class="muted">— ${resources.ui.seen[l]} ${DATE_FMT(x.seen, l)}</span></li>`).join("")}</ol></section>` : ""}
  </article>
  <aside class="rside">
    <div class="rbox"><p class="h4">${resources.ui.question[l]}</p><a class="btn" href="${R("contact/")}?r=${encodeURIComponent(it.en)}">${t.contactUs[l]}</a></div>
    ${(() => { const posts = BLOG.filter((b) => (b.resources || []).includes(it.key)); return posts.length ? `<div class="rbox"><p class="small muted">${blog.onBlog[l]}</p><ul>${posts.map((b) => `<li><a href="${R(`blog/${b.slug}/`)}">${esc(b.title[l])}</a></li>`).join("")}</ul></div>` : ""; })()}
    ${siblings.length ? `<div class="rbox"><p class="small muted">${resources.ui.related[l]}</p><ul>${siblings.map((x) => `<li><a href="${R(`resources/${x.slug}/`)}">${RES[x.key] ? esc(RES[x.key].title[l]) : x.key === "sim" ? resources.sim.title[l] : x[l]}</a></li>`).join("")}</ul></div>` : ""}
    <a class="rback" href="${R("resources/")}"><i class="arr">←</i> ${resources.ui.back[l]}</a>
  </aside>
</section>`;
  // FAQPage + Article go into the page's JSON-LD graph (publisher = the site-wide organisation)
  const ldRes = [
    ...(r && r.faq && r.faq.length ? [{ "@type": "FAQPage", mainEntity: r.faq.map((q) => ({ "@type": "Question", name: q.q[l], acceptedAnswer: { "@type": "Answer", text: q.a[l].replace(/\*\*|\[\d+\]/g, "") } })) }] : []),
    ...(r ? [{ "@type": "Article", headline: title, description: summary, dateModified: r.updated, inLanguage: l, url: abs(l, route), mainEntityOfPage: abs(l, route), author: { "@id": ORG_ID }, publisher: { "@id": ORG_ID } }] : []),
  ];
  return layout({ l, route, title: `${title} | Estatelys`, desc: summary || resources.intro[l], body, extraHead: places ? leafletHead : "",
    crumbs: [[t.navResources[l], "resources/"], [title, route]], ld: ldRes });
}

// ── blog ─────────────────────────────────────────────────────
const bImg = (l, route, name, alt, sizes) => (name.startsWith("refs/") ? img1(l, route, name, alt) : img(l, route, name, alt, "", sizes));
const bTable = (tb, l) => (tb && tb.rows && tb.rows[l] ? `<div class="rtbl"><table><thead><tr>${tb.head[l].map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${tb.rows[l].map((row) => `<tr>${row.map((c, i) => (i === 0 ? `<th scope="row">${md(String(c)).replace(/^<p>|<\/p>$/g, "")}</th>` : `<td>${md(String(c)).replace(/^<p>|<\/p>$/g, "")}</td>`)).join("")}</tr>`).join("")}</tbody></table></div>` : "");
const readMin = (a, l) => Math.max(1, Math.round(a.sections.map((x) => x.body[l]).join(" ").split(/\s+/).length / 200));
function blogPage(l) {
  const route = "blog/";
  const R = (r) => rel(l, route, l, r);
  const body = `
<section class="phdr dk"><div class="wrap">
  <p class="eyebrow">${t.navBlog[l]}</p>
  <h1>${blog.title[l]}</h1>
  <p class="lead muted">${blog.intro[l]}</p>
</div></section>
<section class="sec wrap">
  <div class="blog-g">${BLOG.map((a) => `<article class="bcard">
    <a class="bcard-m" href="${R(`blog/${a.slug}/`)}" tabindex="-1" aria-hidden="true">${bImg(l, route, a.cover, a.coverAlt[l], "(min-width: 900px) 40vw, 100vw")}</a>
    <div class="bcard-b">
      <p class="small muted">${DATE_FMT(a.date, l)} · ${readMin(a, l)} ${blog.minutes[l]}</p>
      <h2 class="h3"><a href="${R(`blog/${a.slug}/`)}">${esc(a.title[l])}</a></h2>
      <p class="muted">${esc(a.summary[l])}</p>
      <a class="res-a" href="${R(`blog/${a.slug}/`)}">${blog.read[l]} <i class="arr">→</i></a>
    </div>
  </article>`).join("")}</div>
</section>`;
  const blogLd = { "@type": "Blog", "@id": abs(l, route) + "#blog", name: blog.title[l], url: abs(l, route), inLanguage: l, publisher: { "@id": ORG_ID },
    blogPost: BLOG.map((a) => ({ "@type": "BlogPosting", headline: a.title[l], url: abs(l, `blog/${a.slug}/`), datePublished: a.date })) };
  return layout({ l, route, title: seo.blogTitle[l], desc: blog.intro[l], body, crumbs: [[t.navBlog[l], route]], ld: [blogLd] });
}
function blogArticle(a, l) {
  const route = `blog/${a.slug}/`;
  const R = (r) => rel(l, route, l, r);
  const n = (a.sources || []).length;
  const props = (a.properties || []).map((s) => projects.find((p) => p.slug === s)).filter(Boolean);
  const res = (a.resources || []).map((k) => RES_ITEMS.find((x) => x.key === k)).filter((x) => x && resReady(x));
  const resTitle = (x) => (RES[x.key] ? esc(RES[x.key].title[l]) : x.key === "sim" ? resources.sim.title[l] : x[l]);
  const body = `
<section class="phdr dk"><div class="wrap">
  <p class="eyebrow"><a href="${R("blog/")}">${t.navBlog[l]}</a> · ${DATE_FMT(a.date, l)} · ${readMin(a, l)} ${blog.minutes[l]}</p>
  <h1 class="rh1">${esc(a.title[l])}</h1>
  <p class="lead muted">${esc(a.summary[l])}</p>
</div></section>
<section class="sec wrap rwrap">
  <article class="rart">
    <figure class="bfig">${bImg(l, route, a.cover, a.coverAlt[l], "(min-width: 900px) 760px, 100vw")}<figcaption class="small muted">${esc(a.coverAlt[l])}</figcaption></figure>
    ${a.sections.map((x) => `<section class="rsec"><h2>${esc(x.h[l])}</h2>${md(x.body[l], n)}${bTable(x.table, l)}</section>`).join("")}
    ${(a.gallery || []).length ? `<div class="bgal">${a.gallery.map((g) => `<figure>${bImg(l, route, g, a.coverAlt[l], "(min-width: 900px) 33vw, 100vw")}</figure>`).join("")}</div>` : ""}
    ${a.reference ? `<p><a class="res-a" href="${R("references/")}#ref-${a.reference}">${blog.allPhotos[l]} <i class="arr">→</i></a></p>` : ""}
    ${res.length ? `<section class="rsec"><h2 class="h4">${blog.related[l]}</h2><ul>${res.map((x) => `<li><a href="${R(`resources/${x.slug}/`)}">${resTitle(x)}</a></li>`).join("")}</ul></section>` : ""}
    ${n ? `<section class="rsec rsrc"><h2 class="h4">${resources.ui.sources[l]}</h2><ol>${a.sources.map((x, i) => `<li id="src-${i + 1}"><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a> <span class="muted">— ${resources.ui.seen[l]} ${DATE_FMT(x.seen, l)}</span></li>`).join("")}</ol></section>` : ""}
    ${a.updated && a.updated !== a.date ? `<p class="small muted">${blog.updated[l]} ${DATE_FMT(a.updated, l)}</p>` : ""}
  </article>
  <aside class="rside">
    ${props.length ? `<div class="bprop"><p class="small muted">${blog.property[l]}</p>${props.map((p) => card(p, l, route)).join("")}</div>` : ""}
    <div class="rbox"><p class="h4">${blog.question[l]}</p><a class="btn" href="${R("contact/")}?r=${encodeURIComponent(a.title.en)}" data-ev="contact">${t.contactUs[l]}</a></div>
    <a class="rback" href="${R("blog/")}"><i class="arr">←</i> ${blog.back[l]}</a>
  </aside>
</section>`;
  const post = { "@type": "BlogPosting", "@id": abs(l, route) + "#article", headline: a.title[l], description: a.summary[l], inLanguage: l,
    datePublished: a.date, dateModified: a.updated || a.date, url: abs(l, route), mainEntityOfPage: abs(l, route),
    image: [a.cover, ...(a.gallery || [])].filter(Boolean).map((n) => `https://${SITE.domain}/img/${n}.jpg`),
    author: { "@id": ORG_ID }, publisher: { "@id": ORG_ID }, isPartOf: { "@id": abs(l, "blog/") + "#blog" },
    ...(props.length ? { about: props.map((p) => ({ "@type": "Apartment", name: p.name, url: abs(l, `projects/${p.slug}/`) })) } : {}) };
  return layout({ l, route, title: a.seoTitle ? a.seoTitle[l] : `${a.title[l]} | Estatelys`, desc: a.summary[l], body, image: a.cover,
    crumbs: [[t.navBlog[l], "blog/"], [a.title[l], route]], ld: [post] });
}

// ── district pages ───────────────────────────────────────────
const distNum = (p) => { const m = p.address.match(/\b1(\d\d)\d\b/); return m ? +m[1] : 0; };
const distOfProp = (p) => districts.items.find((d) => d.n === distNum(p));
const refNum = (r) => { const m = String(r.district?.en || "").match(/(\d+)/); return m ? +m[1] : 0; };
function districtPage(d, l) {
  const route = `districts/${d.slug}/`;
  const R = (r) => rel(l, route, l, r);
  const props = FOR_SALE.filter((p) => distNum(p) === d.n);
  const refs = REFS.filter((r) => r.photos.length && refNum(r) === d.n);
  const posts = BLOG.filter((b) => (b.properties || []).some((s) => props.some((p) => p.slug === s)) || refs.some((r) => r.slug === b.reference));
  const guides = RES_ITEMS.filter(resReady);
  const resTitle = (x) => (RES[x.key] ? esc(RES[x.key].title[l]) : x.key === "sim" ? resources.sim.title[l] : x[l]);
  const h1 = districts.h1[l].replace("{d}", d.name[l]);
  const body = `
<section class="phdr dk"><div class="wrap">
  <p class="eyebrow">${districts.eyebrow[l]}</p>
  <h1>${esc(h1)}</h1>
  <p class="lead muted">${districts.intro[l]}</p>
</div></section>
${props.filter((p) => p.districtText).map((p) => `<section class="sec wrap"><div class="split"><div><p class="eyebrow">${districts.around[l]}</p><h2 class="h3">${esc(p.name)}</h2></div><p class="muted lead2">${p.districtText[l]}</p></div></section>`).join("")}
${props.length ? `<section class="sec wrap"><h2 class="h3">${districts.forSale[l]}</h2><div class="grid3">${props.map((p) => card(p, l, route)).join("")}</div></section>` : ""}
${refs.length ? `<section class="sec wrap"><h2 class="h3">${districts.refs[l]}</h2><div class="grid3">${refs.map((r) => `<a class="dref" href="${R("references/")}#ref-${r.slug}">${img1(l, route, `refs/${r.slug}-1`, `${r.name}, Budapest`)}<span><strong>${esc(r.name)}</strong>${r.year ? ` · ${r.year}` : ""}${r.area ? ` · ${r.area} m²` : ""}</span></a>`).join("")}</div></section>` : ""}
${posts.length ? `<section class="sec wrap"><h2 class="h3">${blog.onBlog[l]}</h2><ul class="dlist">${posts.map((b) => `<li><a href="${R(`blog/${b.slug}/`)}">${esc(b.title[l])}</a></li>`).join("")}</ul></section>` : ""}
<section class="sec wrap"><h2 class="h3">${districts.guides[l]}</h2><ul class="dlist dcols">${guides.map((x) => `<li><a href="${R(`resources/${x.slug}/`)}">${resTitle(x)}</a></li>`).join("")}</ul></section>
<section class="sec wrap"><p class="eyebrow">${districts.others[l]}</p><p>${districts.items.filter((x) => x.slug !== d.slug).map((x) => `<a class="res-a" href="${R(`districts/${x.slug}/`)}">${x.name[l]} <i class="arr">→</i></a>`).join(" &nbsp; ")}</p></section>`;
  const place = { "@type": "CollectionPage", name: h1, url: abs(l, route), inLanguage: l,
    about: { "@type": "Place", name: `${d.name[l]}, Budapest`, containedInPlace: { "@type": "City", name: "Budapest" } },
    ...(props.length ? { mainEntity: { "@type": "ItemList", itemListElement: props.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: abs(l, `projects/${p.slug}/`), name: p.name })) } } : {}) };
  return layout({ l, route, title: `${h1} | Estatelys`, desc: seo.districtDesc[l].replace("{d}", d.name[l]), body, crumbs: [[d.name[l], route]], ld: [place] });
}

function referencesPage(l) {
  const route = "references/";
  const src = (r, i) => asset(l, route, `img/refs/${r.slug}-${i + 1}.jpg`);
  const body = `
<section class="phdr dk"><div class="wrap">
  <p class="eyebrow">${t.navRefs[l]}</p>
  <h1>${refsText.title[l]}</h1>
  <p class="lead muted">${refsText.intro[l]}</p>
</div></section>
<section class="sec wrap">
  <div class="grid2 refs" data-gallery>
    ${REFS.filter((r) => r.photos.length).map((r) => `<figure class="ref" id="ref-${r.slug}">
      <button class="gal-i ref-m" data-full="${src(r, 0)}" data-cap="${esc(r.name)}" aria-label="${esc(r.name)}">${img1(l, route, `refs/${r.slug}-1`, `${r.name}, Budapest`)}</button>
      <div class="ref-t">${r.photos.slice(1).map((_, k, arr) => `<button class="gal-i${k > 2 ? " gal-x" : ""}" data-full="${src(r, k + 1)}" data-cap="${esc(r.name)}" aria-label="${esc(r.name)}">${img1(l, route, `refs/${r.slug}-${k + 2}`, `${r.name}, Budapest`)}${k === 2 && arr.length > 3 ? `<span class="gal-more">+${arr.length - 3}</span>` : ""}</button>`).join("")}</div>
      <figcaption><h3>${esc(r.name)}</h3><p class="muted small">${r.district ? r.district[l] + " · " : ""}Budapest</p>${r.year || r.area || r.works ? `<p class="ref-f">${[r.year ? String(r.year) : "", r.area ? `${new Intl.NumberFormat(LOCALE[l], { maximumFractionDigits: 0 }).format(r.area)} m²` : "", r.works ? esc(r.works[l]) : ""].filter(Boolean).join(" · ")}</p>` : ""}${(() => { const cs = BLOG.find((b) => b.reference === r.slug); return cs ? `<p class="ref-cs"><a class="btn btn-s" href="${rel(l, route, l, `blog/${cs.slug}/`)}">${blog.caseStudy[l]} →</a></p>` : ""; })()}</figcaption>
    </figure>`).join("")}
  </div>
  ${REFS.some((r) => !r.photos.length) ? `<div class="refs-more">
    <h2>${refsText.moreTitle[l]}</h2>
    <p class="muted">${refsText.moreNote[l]}</p>
    <ul class="refs-list">${REFS.filter((r) => !r.photos.length).map((r) => `<li><strong>${esc(r.name)}</strong><span class="muted small">${r.district ? r.district[l] + " · " : ""}Budapest</span></li>`).join("")}</ul>
  </div>` : ""}
</section>
<div class="lb" id="lb" hidden><button class="lb-x" aria-label="Close">×</button><button class="lb-p" aria-label="Previous">‹</button><figure><img alt=""><figcaption></figcaption></figure><button class="lb-n" aria-label="Next">›</button></div>`;
  return layout({ l, route, title: `${refsText.title[l]} | Estatelys`, desc: refsText.intro[l], body, image: `refs/${REFS[0]?.slug}-1`, crumbs: [[t.navRefs[l], route]] });
}

function pilotPage(l) {
  const route = "pilot/";
  const R = (r) => rel(l, route, l, r);
  const b = (arr) => arr.map((x) => `<li>${x}</li>`).join("");
  const body = `
<section class="phdr dk"><div class="wrap">
  <p class="eyebrow">${pilot.eyebrow[l]}</p>
  <h1>${pilot.h1[l]}</h1>
  <p class="lead">${pilot.lead[l]}</p>
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:26px">
    <a class="btn" href="${R("contact/")}">${t.requestAccess[l]}</a>
    <a class="btn btn-o" href="${SITE.appUrl}" rel="nofollow">${t.login[l]}</a>
  </div>
</div></section>
<section class="stats"><div class="wrap stats-in">
  ${pilot.stats.map((s) => `<div><b class="sm">${s.v[l]}</b><span>${s.k[l]}</span></div>`).join("")}
</div></section>
<section class="sec wrap">
  <div class="grid2">
    <div class="card"><div class="card-b">
      <h3>${pilot.renoTitle[l]}</h3>
      <ul class="dlist">${b(pilot.renoBullets[l])}</ul>
    </div></div>
    <div class="card"><div class="card-b">
      <h3>${pilot.locTitle[l]}</h3>
      <ul class="dlist">${b(pilot.locBullets[l])}</ul>
    </div></div>
  </div>
</section>
<section class="sec wrap">
  <div class="split">
    <h2>${pilot.proofTitle[l]}</h2>
    <p class="lead" style="margin-top:0">${pilot.proofText[l]}</p>
  </div>
</section>
<section class="sec wrap">
  <h2 class="h3">${pilot.featTitle[l]}</h2>
  <ul class="chips" style="margin-top:28px">${b(pilot.features[l])}</ul>
</section>
<section class="sec wrap">
  <div class="pbox" style="padding:clamp(28px,4vw,48px);display:flex;flex-direction:column;gap:16px;align-items:flex-start">
    <h2 class="h3" style="margin:0">${pilot.ctaTitle[l]}</h2>
    <p style="margin:0;max-width:52ch">${pilot.ctaText[l]}</p>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <a class="btn" href="${R("contact/")}">${t.requestAccess[l]}</a>
      <a class="btn btn-o" href="${SITE.appUrl}" rel="nofollow">${t.login[l]}</a>
    </div>
  </div>
  <p class="rnote" style="margin-top:24px">${pilot.dataNote[l]}</p>
</section>`;
  return layout({ l, route, title: `${pilot.h1[l]} | Estatelys`, desc: pilot.lead[l], body, crumbs: [[t.navPilot[l], route]] });
}

function notFound() {
  const l = "fr", route = "";
  const body = `<section class="phdr dk"><div class="wrap"><p class="eyebrow">404</p><h1>${t.notFound.fr} · ${t.notFound.en}</h1>
  <div class="row"><a class="btn" href="/">${t.backHome.fr}</a><a class="btn btn-o" href="/en/">${t.backHome.en}</a></div></div></section>`;
  return layout({ l, route, title: `404 — ${SITE.name}`, desc: t.metaDesc.fr, body, noindex: true }).replace(/href="(?!https?:|mailto:|tel:|\/|#)([^"]*)"/g, 'href="/$1"').replace(/src="(?!https?:|\/)([^"]*)"/g, 'src="/$1"');
}

// ── write ────────────────────────────────────────────────────
function write(file, html) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, html); }

if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });
cpSync("src/img", join(OUT, "img"), { recursive: true });
cpSync("src/assets", join(OUT, "assets"), { recursive: true });

const urls = [];
const routes = new Set();
for (const l of LANGS) {
  const pages = [["", home(l)], ["projects/", projectsPage(l)], ["rentals/", rentalsPage(l)], ["about/", about(l)], ["contact/", contact(l)], ["legal/", legalPage(l)], ["resources/", resourcesPage(l)], ["pilot/", pilotPage(l)], ...(REFS.length ? [["references/", referencesPage(l)]] : []),
    ...projects.map((p) => [`projects/${p.slug}/`, projectPage(p, l)]),
    ...rentals.items.map((it) => [it, projects.find((x) => x.slug === it.slug)]).filter(([, p]) => p).map(([it, p]) => [`rentals/${p.slug}/`, projectPage(p, l, it)]),
    ...RES_ITEMS.filter(resReady).map((it) => [`resources/${it.slug}/`, resourcePage(it, l)]),
    ...districts.items.map((d) => [`districts/${d.slug}/`, districtPage(d, l)]),
    ...(BLOG.length ? [["blog/", blogPage(l)], ...BLOG.map((a) => [`blog/${a.slug}/`, blogArticle(a, l)])] : [])];
  for (const [route, html] of pages) { write(fileFor(l, route), html); urls.push(abs(l, route)); routes.add(route); }
}
write(join(OUT, "404.html"), notFound());
writeFileSync(join(OUT, "CNAME"), SITE.domain + "\n");
writeFileSync(join(OUT, ".nojekyll"), "");
writeFileSync(join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: https://${SITE.domain}/sitemap.xml\n`);
// IndexNow key file (Bing, Yandex…): lets .github/workflows/indexnow.yml announce changed URLs after each deploy. SEO chat, 6 Nov 2026.
writeFileSync(join(OUT, `${SEO_INDEXNOW_KEY}.txt`), SEO_INDEXNOW_KEY);
// llms.txt (llmstxt.org): plain-text map of the site for AI assistants, generated from the same data as the pages (English).
const llms = [
  `# ${SITE.name}`, "",
  `> ${SITE.name} (legal entity: ${SITE.company}, Budapest) buys, renovates and sells or lets apartments in historic buildings in central Budapest. Website in French, English, German and Hungarian.`, "",
  "## Properties for sale",
  ...FOR_SALE.map((p) => `- [${p.name}, Budapest ${districtOf(p)}](${abs("en", `projects/${p.slug}/`)}): ${p.type.en}, ${p.facts[0].en}, ${p.priceFromHuf ? p.priceHuf.replace("M Ft", "million HUF") : `EUR ${p.price.toLocaleString("en-US")}`}`),
  "", "## Rentals",
  ...rentals.items.map((it) => projects.find((x) => x.slug === it.slug)).filter(Boolean).map((p) => `- [${p.name}](${abs("en", `rentals/${p.slug}/`)})`),
  "", "## Guides",
  ...RES_ITEMS.filter(resReady).map((it) => `- [${RES[it.key]?.title?.en || it.en || it.slug}](${abs("en", `resources/${it.slug}/`)})`),
  "", "## Blog",
  ...BLOG.map((a) => `- [${a.title.en}](${abs("en", `blog/${a.slug}/`)}) (${a.date})`),
  "", "## Districts",
  ...districts.items.map((d) => `- [${d.name.en}](${abs("en", `districts/${d.slug}/`)})`),
  "", "## Company",
  `- [About](${abs("en", "about/")})`, `- [References: past renovations](${abs("en", "references/")})`, `- [Contact](${abs("en", "contact/")})`, `- [Legal notice](${abs("en", "legal/")})`, "",
];
writeFileSync(join(OUT, "llms.txt"), llms.join("\n"));
const altLinks = (route) => [...LANGS.map((x) => `    <xhtml:link rel="alternate" hreflang="${x}" href="${abs(x, route)}"/>`), `    <xhtml:link rel="alternate" hreflang="x-default" href="${abs("fr", route)}"/>`].join("\n");
const smEntries = [...routes].flatMap((route) => LANGS.map((l) => `  <url>\n    <loc>${abs(l, route)}</loc>\n    <lastmod>${BUILT}</lastmod>\n${altLinks(route)}\n  </url>`));
writeFileSync(join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${smEntries.join("\n")}\n</urlset>\n`);
console.log(`Built ${urls.length} pages into ${OUT}/ (domain ${SITE.domain}${PREVIEW ? ", preview links" : ""})`);
