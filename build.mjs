// Static site generator for Estatelys Budapest. No dependencies: `node build.mjs`.
// Output: dist/  (FR at the root, EN/DE/HU under /en/, /de/, /hu/)
// PREVIEW=1 node build.mjs  -> links end in index.html (for file:// or preview hosting)
import { mkdirSync, writeFileSync, cpSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { SITE, LANGS, LANG_LABEL, LANG_NAME, t, cap, projects, cityPhotos } from "./src/data.mjs";

const OUT = process.env.OUT || "dist";
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
const priceMain = (p, l) => (p.priceFromHuf ? p.priceHuf : eur(p.price, l));
const priceAlt = (p, l) => (p.priceFromHuf ? `≈ ${eur(p.price, l)}` : huf(p.price, l));

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

function layout({ l, route, title, desc, body, image, extraHead = "", bodyClass = "" }) {
  const A = (p) => asset(l, route, p);
  const R = (r) => rel(l, route, l, r);
  const nav = [
    ["", t.navHome[l]],
    ["projects/", t.navProjects[l]],
    ["about/", t.navAbout[l]],
    ["contact/", t.navContact[l]],
  ];
  const isActive = (r) => (r === "" ? route === "" : route.startsWith(r));
  const alt = LANGS.map((x) => `<link rel="alternate" hreflang="${x}" href="${abs(x, route)}">`).join("\n") +
    `\n<link rel="alternate" hreflang="x-default" href="${abs("fr", route)}">`;
  const langLinks = LANGS.map((x) =>
    `<a href="${rel(l, route, x, route)}" hreflang="${x}" lang="${x}" title="${LANG_NAME[x]}"${x === l ? ' aria-current="true" class="on"' : ""}>${LANG_LABEL[x]}</a>`).join("");
  const ogImg = image ? `https://${SITE.domain}/img/${image}.jpg` : `https://${SITE.domain}/img/hero.jpg`;
  return `<!doctype html>
<html lang="${l}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${abs(l, route)}">
${alt}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${ogImg}">
<meta property="og:url" content="${abs(l, route)}">
<meta property="og:locale" content="${OG_LOCALE[l]}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#12110f">
<link rel="icon" href="${A("assets/favicon.svg")}" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,400&family=Jost:wght@300;400;500&display=swap">
<link rel="stylesheet" href="${A("assets/site.css")}">
${extraHead}
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">${l === "fr" ? "Aller au contenu" : l === "de" ? "Zum Inhalt" : l === "hu" ? "Ugrás a tartalomra" : "Skip to content"}</a>
<header class="hdr" id="hdr">
  <div class="wrap hdr-in">
    <a class="logo" href="${R("")}" aria-label="${SITE.name}">
      <span class="logo-w">ESTATELYS</span><span class="logo-s">BUDAPEST</span>
    </a>
    <nav class="nav" aria-label="Main">
      ${nav.map(([r, n]) => `<a href="${R(r)}"${isActive(r) ? ' aria-current="page"' : ""}>${n}</a>`).join("")}
    </nav>
    <div class="hdr-r">
      <div class="langs" aria-label="Language">${langLinks}</div>
      <a class="btn btn-s" href="${R("contact/")}">${t.contactUs[l]}</a>
      <button class="burger" aria-label="Menu" aria-expanded="false" aria-controls="mnav"><span></span><span></span></button>
    </div>
  </div>
  <nav class="mnav" id="mnav" aria-label="Mobile">
    ${nav.map(([r, n]) => `<a href="${R(r)}"${isActive(r) ? ' aria-current="page"' : ""}>${n}</a>`).join("")}
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
<footer class="ftr">
  <div class="wrap ftr-in">
    <div>
      <a class="logo" href="${R("")}"><span class="logo-w">ESTATELYS</span><span class="logo-s">BUDAPEST</span></a>
      <p class="muted small">${t.tagline[l]}</p>
    </div>
    <div class="ftr-c">
      <a href="mailto:${SITE.email}">${SITE.email}</a>
      <a href="tel:${SITE.phoneHref}">${SITE.phone}</a>
      <span class="muted">${SITE.city}</span>
    </div>
    <div class="ftr-c">
      ${nav.map(([r, n]) => `<a href="${R(r)}">${n}</a>`).join("")}
    </div>
  </div>
  <div class="wrap ftr-b small muted">
    <span>© ${new Date().getFullYear()} ${SITE.name}</span>
    <span>${t.photoCredit[l]}</span>
  </div>
</footer>
<script src="${A("assets/site.js")}" defer></script>
</body>
</html>`;
}

// ── components ───────────────────────────────────────────────
const img = (l, route, name, alt, cls = "", sizes = "100vw", eager = false) =>
  `<img class="${cls}" src="${asset(l, route, `img/${name}.jpg`)}" srcset="${asset(l, route, `img/${name}-s.jpg`)} 800w, ${asset(l, route, `img/${name}.jpg`)} 1600w" sizes="${sizes}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;

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
      <span class="price">${priceMain(p, l)}</span>
      ${p.yield ? `<span class="yield">${t.yield[l]} ${p.yield}</span>` : `<span class="muted small">${priceAlt(p, l)}</span>`}
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
function home(l) {
  const route = "";
  const A = (p) => asset(l, route, p);
  const R = (r) => rel(l, route, l, r);
  const body = `
<section class="hero">
  <img class="hero-img" src="${A("img/hero.jpg")}" srcset="${A("img/hero-s.jpg")} 800w, ${A("img/hero.jpg")} 1920w" sizes="100vw" alt="" fetchpriority="high">
  <div class="hero-fade"></div>
  <div class="wrap hero-in">
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
    <div><b>V · VI · VII</b><span>${t.stat2[l]}</span></div>
    <div><b>${projects.length}</b><span>${t.stat3[l]}</span></div>
    <div><b>FR · EN · DE · HU</b><span>${t.stat4[l]}</span></div>
  </div>
</section>
<section class="sec wrap">
  <div class="sec-h">
    <div><p class="eyebrow">${t.featuredEyebrow[l]}</p><h2>${t.featuredTitle[l]}</h2></div>
    <a class="link" href="${R("projects/")}">${t.allProjects[l]} →</a>
  </div>
  <div class="grid2">${projects.map((p) => card(p, l, route)).join("")}</div>
</section>
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
</section>`;
  const ld = {
    "@context": "https://schema.org", "@type": "RealEstateAgent", name: SITE.name,
    url: `https://${SITE.domain}/`, email: SITE.email, telephone: SITE.phone,
    address: { "@type": "PostalAddress", addressLocality: "Budapest", addressCountry: "HU" },
    areaServed: "Budapest", image: `https://${SITE.domain}/img/hero.jpg`,
  };
  return layout({ l, route, title: `${SITE.name} — ${t.tagline[l].split(" · ")[1]} & ${t.s2t[l].toLowerCase()}`, desc: t.metaDesc[l], body, bodyClass: "is-home",
    extraHead: `<script type="application/ld+json">${JSON.stringify(ld)}</script>` });
}

function projectsPage(l) {
  const route = "projects/";
  const body = `
<section class="phdr wrap">
  <p class="eyebrow">${t.forSale[l]}</p>
  <h1>${t.projTitle[l]}</h1>
  <p class="lead muted">${t.projIntro[l]}</p>
</section>
<section class="wrap"><div class="grid2">${projects.map((p) => card(p, l, route)).join("")}</div></section>
<section class="sec wrap">
  <h2 class="h3">${t.mapTitle[l]}</h2>
  ${mapBlock(projects, l)}
</section>`;
  return layout({ l, route, title: `${t.projTitle[l]} — ${SITE.name}`, desc: t.projIntro[l], body, extraHead: leafletHead });
}

function projectPage(p, l) {
  const route = `projects/${p.slug}/`;
  const R = (r) => rel(l, route, l, r);
  const others = projects.filter((x) => x.slug !== p.slug);
  const gallery = p.images.length ? `
<section class="sec wrap">
  <h2 class="h3">${t.gallery[l]}</h2>
  <div class="gal" data-gallery>
    ${p.images.map(([n, c], i, a) => { const r = (a.length + 3) % 4, wide = r && i >= a.length - (4 - r); return `<button class="gal-i${i === 0 ? " big" : ""}${wide ? " wide" : ""}" data-full="${asset(l, route, `img/${n}.jpg`)}" data-cap="${esc(cap[c][l])}" aria-label="${esc(cap[c][l])}">${img(l, route, n, cap[c][l], "", "(min-width: 900px) 33vw, 50vw")}</button>`; }).join("")}
  </div>
  ${p.cgi ? `<p class="small muted note">${t.cgiNote[l]}</p>` : ""}
</section>` : "";

  const invest = p.rent ? `
<div class="inv">
  <div><span>${t.price[l]}</span><b>${priceMain(p, l)}</b><em>${priceAlt(p, l)}${p.priceM2 ? ` · ${p.priceM2} / m²` : ""}</em></div>
  <div><span>${t.rent[l]}</span><b>${eur(p.rent, l)}</b><em>${p.rentDetail[l]} · ${eur(p.rent * 12, l)} / ${l === "fr" ? "an" : l === "de" ? "Jahr" : l === "hu" ? "év" : "year"}</em></div>
  <div><span>${t.yield[l]}</span><b>${p.yield}</b><em>${eur(p.rent * 12, l)} ÷ ${eur(p.price, l)}</em></div>
</div>
<p class="small muted note">${t.yieldNote[l]} ${t.hufNote[l]}</p>` : "";

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
    <p class="muted lead2">${p.districtText[l]}</p>
  </div>
</section>` : "";

  const plans = p.plans.length ? `
<section class="sec wrap">
  <h2 class="h3">${t.layout[l]}</h2>
  <div class="plans">${p.plans.map((n) => `<a href="${asset(l, route, `img/${n}.jpg`)}" target="_blank" rel="noopener"><img src="${asset(l, route, `img/${n}.jpg`)}" alt="${esc(t.layout[l] + " — " + p.name)}" loading="lazy"></a>`).join("")}</div>
</section>` : "";

  const body = `
<section class="phero">
  ${p.cover ? img(l, route, p.cover, p.name, "phero-img", "100vw", true) : `<div class="phero-img phero-none"></div>`}
  <div class="hero-fade"></div>
  <div class="wrap phero-in">
    <p class="eyebrow">${p.district[l]} · ${p.type[l]} · ${t.forSale[l]}</p>
    <h1>${p.name}</h1>
    <p class="lead">${p.address}</p>
  </div>
</section>
<section class="sec wrap">
  <div class="pgrid">
    <div>
      <p class="eyebrow">${t.theApartment[l]}</p>
      <p class="lead2">${p.desc[l]}</p>
      <h2 class="h4">${t.keyFacts[l]}</h2>
      <ul class="chips">${p.facts.map((f) => `<li>${f[l]}</li>`).join("")}</ul>
      ${invest}
    </div>
    <aside class="pbox">
      <p class="eyebrow">${t.price[l]}</p>
      <p class="pbig">${priceMain(p, l)}</p>
      <p class="muted">${priceAlt(p, l)}${!p.rent && p.priceM2 ? ` · ${p.priceM2} / m²` : ""}</p>
      ${p.yield ? `<dl><div><dt>${t.rent[l]}</dt><dd>${eur(p.rent, l)}</dd></div><div><dt>${t.yield[l]}</dt><dd>${p.yield}</dd></div></dl>` : ""}
      <a class="btn wfull" href="${R("contact/")}?p=${encodeURIComponent(p.name)}">${t.askInfo[l]}</a>
      <a class="btn btn-o wfull" href="https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(p.name + " — " + t.visit[l])}" target="_blank" rel="noopener">WhatsApp · ${t.visit[l]}</a>
      <p class="small muted">${p.rent ? "" : t.hufNote[l]}</p>
    </aside>
  </div>
</section>
${gallery}
${building}
${district}
${plans}
<section class="sec wrap">
  <h2 class="h3">${t.location[l]}</h2>
  ${mapBlock([p], l, "map", 380)}
</section>
<section class="sec wrap">
  <h2 class="h3">${t.otherProjects[l]}</h2>
  <div class="grid3">${others.map((o) => card(o, l, route)).join("")}</div>
</section>
<div class="lb" id="lb" hidden><button class="lb-x" aria-label="Close">×</button><button class="lb-p" aria-label="Previous">‹</button><figure><img alt=""><figcaption></figcaption></figure><button class="lb-n" aria-label="Next">›</button></div>`;

  const ld = {
    "@context": "https://schema.org", "@type": "Offer",
    name: p.name, description: p.desc[l], price: p.price, priceCurrency: "EUR",
    availability: "https://schema.org/InStock", url: abs(l, route),
    itemOffered: { "@type": "Apartment", name: p.name,
      address: { "@type": "PostalAddress", streetAddress: p.address.split(",")[0], addressLocality: "Budapest", postalCode: p.address.match(/\d{4}/)?.[0], addressCountry: "HU" },
      geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lng } },
    ...(p.cover ? { image: `https://${SITE.domain}/img/${p.cover}.jpg` } : {}),
  };
  return layout({ l, route, title: `${p.name} — ${p.type[l]} · ${priceMain(p, l)} — ${SITE.name}`, desc: p.short[l], body, image: p.cover,
    extraHead: leafletHead + `\n<script type="application/ld+json">${JSON.stringify(ld)}</script>` });
}

function about(l) {
  const route = "about/";
  const body = `
<section class="phdr wrap">
  <p class="eyebrow">${t.aboutEyebrow[l]}</p>
  <h1>${t.aboutTitle[l]}</h1>
  <p class="lead muted">${t.aboutIntro[l]}</p>
</section>
<section class="sec wrap">
  <div class="about">
    ${img(l, route, "stollar-13", cap.courtyard[l], "about-img", "(min-width: 900px) 45vw, 100vw")}
    <div>
      <h2>${t.approach[l]}</h2>
      <p class="muted">${t.approach1[l]}</p>
      <p class="muted">${t.approach2[l]}</p>
      <div class="vals">
        ${[1, 2, 3].map((i) => `<div><h3>${t[`v${i}t`][l]}</h3><p class="muted">${t[`v${i}d`][l]}</p></div>`).join("")}
      </div>
    </div>
  </div>
</section>
<section class="sec wrap">
  <p class="eyebrow">${t.jobEyebrow[l]}</p>
  <h2>${t.jobTitle[l]}</h2>
  <div class="svc">
    ${[1, 2, 3].map((i) => `<div><p class="num">0${i}</p><h3>${t[`s${i}t`][l]}</h3><p class="muted">${t[`s${i}d`][l]}</p></div>`).join("")}
  </div>
</section>`;
  return layout({ l, route, title: `${t.navAbout[l]} — ${SITE.name}`, desc: t.aboutIntro[l], body });
}

function contact(l) {
  const route = "contact/";
  const body = `
<section class="phdr wrap">
  <p class="eyebrow">${t.navContact[l]}</p>
  <h1>${t.contactTitle[l]}</h1>
  <p class="lead muted">${t.contactIntro[l]}</p>
</section>
<section class="wrap sec0">
  <div class="cgrid">
    <form class="form" id="cform" data-email="${SITE.email}" data-subject="${esc(SITE.name)}">
      <label><span>${t.name[l]}</span><input name="name" required autocomplete="name"></label>
      <div class="two">
        <label><span>${t.email[l]}</span><input name="email" type="email" required autocomplete="email"></label>
        <label><span>${t.phone[l]}</span><input name="phone" type="tel" autocomplete="tel"></label>
      </div>
      <label><span>${t.property[l]}</span>
        <select name="property"><option value="">${t.general[l]}</option>${projects.map((p) => `<option>${p.name}</option>`).join("")}</select>
      </label>
      <label><span>${t.message[l]}</span><textarea name="message" rows="6" required></textarea></label>
      <button class="btn" type="submit">${t.send[l]}</button>
      <p class="small muted">${t.formNote[l]}</p>
    </form>
    <aside class="pbox">
      <p class="eyebrow">${SITE.name}</p>
      <a class="big-l" href="mailto:${SITE.email}">${SITE.email}</a>
      <a class="big-l" href="tel:${SITE.phoneHref}">${SITE.phone}</a>
      <a class="btn btn-o wfull" href="https://wa.me/${SITE.whatsapp}" target="_blank" rel="noopener">WhatsApp</a>
      <p class="muted">${SITE.city}</p>
    </aside>
  </div>
</section>`;
  return layout({ l, route, title: `${t.navContact[l]} — ${SITE.name}`, desc: t.contactIntro[l], body });
}

function notFound() {
  const l = "fr", route = "";
  const body = `<section class="phdr wrap"><p class="eyebrow">404</p><h1>${t.notFound.fr} · ${t.notFound.en}</h1>
  <div class="row"><a class="btn" href="/">${t.backHome.fr}</a><a class="btn btn-o" href="/en/">${t.backHome.en}</a></div></section>`;
  return layout({ l, route, title: `404 — ${SITE.name}`, desc: t.metaDesc.fr, body }).replace(/href="(?!https?:|mailto:|tel:|\/|#)([^"]*)"/g, 'href="/$1"').replace(/src="(?!https?:|\/)([^"]*)"/g, 'src="/$1"');
}

// ── write ────────────────────────────────────────────────────
function write(file, html) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, html); }

if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });
cpSync("src/img", join(OUT, "img"), { recursive: true });
cpSync("src/assets", join(OUT, "assets"), { recursive: true });

const urls = [];
for (const l of LANGS) {
  const pages = [["", home(l)], ["projects/", projectsPage(l)], ["about/", about(l)], ["contact/", contact(l)],
    ...projects.map((p) => [`projects/${p.slug}/`, projectPage(p, l)])];
  for (const [route, html] of pages) { write(fileFor(l, route), html); urls.push(abs(l, route)); }
}
write(join(OUT, "404.html"), notFound());
writeFileSync(join(OUT, "CNAME"), SITE.domain + "\n");
writeFileSync(join(OUT, ".nojekyll"), "");
writeFileSync(join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: https://${SITE.domain}/sitemap.xml\n`);
writeFileSync(join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`);
console.log(`Built ${urls.length} pages into ${OUT}/ (domain ${SITE.domain}${PREVIEW ? ", preview links" : ""})`);
