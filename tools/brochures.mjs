// Generates one PDF brochure per property and per language from src/data.mjs.
// Run locally (needs Playwright): node tools/brochures.mjs  ->  src/assets/brochures/<slug>-<lang>.pdf
// Re-run whenever a price, rent or photo changes, then commit the PDFs.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");
import { SITE, LANGS, t, projects } from "../src/data.mjs";

const ROOT = resolve(".");
const OUT = join(ROOT, "src/assets/brochures");
mkdirSync(OUT, { recursive: true });
const LOCALE = { fr: "fr-FR", en: "en-GB", de: "de-DE", hu: "hu-HU" };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const eur = (n, l) => new Intl.NumberFormat(LOCALE[l], { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n).replace(/ | /g, " ");
const huf = (n, l) => `≈ ${new Intl.NumberFormat(LOCALE[l], { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format((n * SITE.hufRate) / 1e6)} M Ft`;
const pct = (v, l) => new Intl.NumberFormat(LOCALE[l], { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v) + (l === "en" ? "%" : " %");
const img = (n, small = false) => pathToFileURL(join(ROOT, "src/img", `${n}${small && existsSync(join(ROOT, "src/img", `${n}-s.jpg`)) ? "-s" : ""}.jpg`)).href;
const asset = (p) => pathToFileURL(join(ROOT, "src/assets", p)).href;
const lp = (l) => (l === "fr" ? "" : `${l}/`);

const L = {
  brochure: { fr: "Brochure", en: "Brochure", de: "Exposé", hu: "Brosúra" },
  keyFacts: { fr: "Caractéristiques", en: "Key facts", de: "Eckdaten", hu: "Főbb adatok" },
  photos: { fr: "Photos", en: "Photos", de: "Fotos", hu: "Fotók" },
  contact: { fr: "Contact", en: "Contact", de: "Kontakt", hu: "Kapcsolat" },
  online: { fr: "Fiche complète, carte et photos en ligne", en: "Full listing, map and photos online", de: "Vollständiges Exposé, Karte und Fotos online", hu: "Teljes adatlap, térkép és fotók online" },
  date: { fr: "Document établi le", en: "Document dated", de: "Stand", hu: "Dokumentum dátuma:" },
  eurNote: { fr: "Prix fixé en forints ; montant en euros indicatif, au taux de", en: "Price set in HUF; EUR amount indicative, at", de: "Preis in HUF festgelegt; EUR-Betrag unverbindlich, Kurs", hu: "Az ár forintban rögzített; az euróösszeg tájékoztató jellegű, árfolyam:" },
  hufNote: { fr: "Montant en forints indicatif, au taux de", en: "HUF amount indicative, at", de: "HUF-Betrag unverbindlich, Kurs", hu: "A forintösszeg tájékoztató jellegű, árfolyam:" },
  noOffer: {
    fr: "Document d'information, sans valeur contractuelle. Surfaces et caractéristiques à vérifier lors de la visite.",
    en: "For information only; not a contractual document. Surfaces and features to be checked at the viewing.",
    de: "Nur zur Information, keine vertragliche Unterlage. Flächen und Merkmale bei der Besichtigung zu prüfen.",
    hu: "Tájékoztató jellegű dokumentum, nem minősül ajánlatnak. A területeket és jellemzőket a megtekintéskor ellenőrizni kell.",
  },
};

const css = `
@font-face{font-family:Archivo;font-weight:100 900;font-stretch:62% 125%;src:url(${asset("fonts/archivo-latin-wdth-normal.woff2")}) format("woff2")}
@font-face{font-family:Archivo;font-weight:100 900;font-stretch:62% 125%;src:url(${asset("fonts/archivo-latin-ext-wdth-normal.woff2")}) format("woff2");unicode-range:U+0100-02BA,U+1E00-1EFF}
@page{size:A4;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Archivo,Arial,sans-serif;color:#111;font-size:10.5pt;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pg{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always;padding:16mm}
.pg:last-child{page-break-after:auto}
h1,h2,h3{font-stretch:118%;font-weight:700;letter-spacing:-.02em;line-height:1.05}
.cover{padding:0;background:#000;color:#f4f3ef}
.cover .ph{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(.62)}
.cover .in{position:absolute;left:16mm;right:16mm;bottom:18mm}
.cover .logo{position:absolute;top:14mm;left:16mm;width:46mm}
.eyebrow{font-size:9pt;letter-spacing:.04em;color:#c8a97e;font-weight:600;margin-bottom:4mm}
.cover h1{font-size:40pt;margin-bottom:4mm}
.cover .type{font-size:13pt;margin-bottom:8mm}
.cover .price{display:flex;align-items:baseline;gap:6mm;border-top:1px solid rgba(255,255,255,.5);padding-top:5mm}
.cover .price b{font-size:26pt;font-stretch:118%}
.cover .price span{font-size:11pt;opacity:.85}
.cover .tag{position:absolute;top:14mm;right:16mm;background:#c8a97e;color:#111;font-weight:600;font-size:9pt;padding:2mm 4mm}
h2{font-size:18pt;margin:0 0 4mm}
.lead{font-size:11.5pt;margin-bottom:6mm}
.facts{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #111;border-left:1px solid #111;margin-bottom:7mm}
.facts div{border-right:1px solid #111;border-bottom:1px solid #111;padding:3mm 4mm}
.facts span{display:block;font-size:8.5pt;color:#666}
.facts b{font-size:11pt}
.two{display:grid;grid-template-columns:1fr 1fr;gap:6mm}
.two img,.grid img{width:100%;height:100%;object-fit:cover;display:block}
.two .im{height:62mm}
.grid{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:84mm;gap:4mm}
.grid .wide{grid-column:1/3}
.cap{font-size:8pt;color:#666;margin-top:2mm}
.plan{width:100%;max-height:150mm;object-fit:contain;border:1px solid #111;margin-bottom:6mm;background:#fff}
.txt p{margin-bottom:3mm}
.foot{position:absolute;left:16mm;right:16mm;bottom:12mm;border-top:1px solid #111;padding-top:3mm;font-size:8pt;color:#555;display:flex;justify-content:space-between;gap:6mm}
.contact{border:1px solid #111;padding:5mm 6mm;margin-top:4mm}
.contact h3{font-size:13pt;margin-bottom:2mm}
.contact a{color:#111}
.note{font-size:8.5pt;color:#555;margin-top:3mm}
`;

function brochure(p, l) {
  const url = `https://${SITE.domain}/${lp(l)}projects/${p.slug}/`;
  const imgs = (p.images || []).map((x) => x[0]);
  const gallery = imgs.slice(1, 7);
  const factCells = [
    [t.price[l], p.priceFromHuf ? p.priceHuf : `${eur(p.price, l)}`],
    p.priceFromHuf ? ["EUR", `≈ ${eur(p.price, l)}`] : ["HUF", huf(p.price, l)],
    ...(p.rent ? [[t.rent[l], `${eur(p.rent, l)}`], [t.yield[l], pct(p.yield, l)]] : []),
    ...p.facts.map((f) => ["", f[l]]),
  ];
  const foot = `<div class="foot"><span>${esc(SITE.name)} · ${esc(SITE.companyFull || SITE.company)} · Cg. ${esc(SITE.regNo)}</span><span>${esc(SITE.domain)}</span></div>`;
  return `<!doctype html><html lang="${l}"><head><meta charset="utf-8"><style>${css}</style></head><body>
<section class="pg cover">
  <img class="ph" src="${img(p.cover)}">
  <img class="logo" src="${asset("logo-white.png")}">
  <span class="tag">${esc(p.type[l])}</span>
  <div class="in">
    <p class="eyebrow">${esc(p.district[l])}</p>
    <h1>${esc(p.name)}</h1>
    <p class="type">${esc(p.address)}</p>
    <div class="price"><b>${p.priceFromHuf ? p.priceHuf : eur(p.price, l)}</b><span>${p.priceFromHuf ? `≈ ${eur(p.price, l)}` : huf(p.price, l)}</span>${p.yield ? `<span>${t.yield[l]} ${pct(p.yield, l)}</span>` : ""}</div>
  </div>
</section>
<section class="pg">
  <p class="eyebrow">${L.brochure[l]} · ${esc(p.name)}</p>
  <h2>${esc(p.short[l])}</h2>
  <p class="lead">${esc(p.desc[l])}</p>
  <h3 style="font-size:12pt;margin-bottom:3mm">${L.keyFacts[l]}</h3>
  <div class="facts">${factCells.map(([k, v]) => `<div>${k ? `<span>${esc(k)}</span>` : ""}<b>${v}</b></div>`).join("")}</div>
  ${p.rent ? `<p class="note">${esc(p.rentDetail[l])}</p>` : ""}
  <div class="two">${gallery.slice(0, 2).map((n) => `<div class="im"><img src="${img(n, true)}"></div>`).join("")}</div>
  ${p.cgi ? `<p class="note">${esc(t.cgiNote[l])}</p>` : ""}
  ${foot}
</section>
<section class="pg">
  <p class="eyebrow">${L.photos[l]}</p>
  <div class="grid">${gallery.slice(2, 6).map((n, i) => `<div${i === 0 && gallery.length < 6 ? ' class="wide"' : ""}><img src="${img(n, true)}"></div>`).join("")}</div>
  ${p.cgi ? `<p class="note">${esc(t.cgiNote[l])}</p>` : ""}
  ${foot}
</section>
<section class="pg">
  ${(p.plans || []).length ? `<p class="eyebrow">${t.layout[l]}</p>${p.plans.slice(0, 1).map((n) => `<img class="plan" src="${img(n)}">`).join("")}` : ""}
  <div class="two txt">
    <div><h3 style="font-size:12pt;margin-bottom:2mm">${t.theDistrict[l]}</h3><p>${esc(p.districtText[l])}</p></div>
    <div>${p.buildingText ? `<h3 style="font-size:12pt;margin-bottom:2mm">${t.theBuilding[l]}</h3><p>${esc(p.buildingText[l])}</p>` : ""}</div>
  </div>
  <div class="contact">
    <h3>${L.contact[l]}</h3>
    <p>${SITE.email} · <a href="${url}">${url.replace("https://", "")}</a></p>
    <p class="note">${L.online[l]}.</p>
  </div>
  <p class="note">${(p.priceFromHuf ? L.eurNote : L.hufNote)[l]} ${SITE.hufRate} HUF/EUR. ${L.noOffer[l]} ${L.date[l]} ${new Intl.DateTimeFormat(LOCALE[l], { day: "numeric", month: "long", year: "numeric" }).format(new Date())}.</p>
  ${foot}
</section>
</body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage();
let n = 0;
for (const p of projects.filter((x) => (x.status || "for-sale") === "for-sale")) {
  for (const l of LANGS) {
    const html = brochure(p, l);
    const tmp = join(OUT, `.tmp-${p.slug}-${l}.html`);
    writeFileSync(tmp, html);
    await page.goto(pathToFileURL(tmp).href, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({ path: join(OUT, `${p.slug}-${l}.pdf`), format: "A4", printBackground: true, preferCSSPageSize: true });
    (await import("node:fs")).unlinkSync(tmp);
    n++;
  }
}
await browser.close();
console.log(`${n} brochures written to src/assets/brochures/`);
