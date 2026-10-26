(function () {
  // header: solid after scroll on home
  var hdr = document.getElementById("hdr");
  function onScroll() { if (hdr) hdr.classList.toggle("solid", window.scrollY > 40); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  // mobile menu
  var burger = document.querySelector(".burger"), mnav = document.getElementById("mnav");
  if (burger && mnav) {
    mnav.hidden = true;
    burger.addEventListener("click", function () {
      var open = burger.getAttribute("aria-expanded") === "true";
      burger.setAttribute("aria-expanded", String(!open)); mnav.hidden = open;
      if (!open) hdr.classList.add("solid"); else onScroll();
    });
  }

  // remember language choice
  document.querySelectorAll(".langs a").forEach(function (a) {
    a.addEventListener("click", function () { try { localStorage.setItem("lang", a.getAttribute("hreflang")); } catch (e) {} });
  });

  // gallery lightbox
  var lb = document.getElementById("lb"), items = [].slice.call(document.querySelectorAll("[data-gallery] .gal-i")), idx = 0;
  if (lb && items.length) {
    var im = lb.querySelector("img"), fc = lb.querySelector("figcaption");
    function show(i) { idx = (i + items.length) % items.length; im.src = items[idx].dataset.full; im.alt = items[idx].dataset.cap; fc.textContent = items[idx].dataset.cap; }
    function open(i) { show(i); lb.hidden = false; document.body.style.overflow = "hidden"; lb.querySelector(".lb-x").focus(); }
    function close() { lb.hidden = true; document.body.style.overflow = ""; items[idx].focus(); }
    items.forEach(function (b, i) { b.addEventListener("click", function () { open(i); }); });
    lb.querySelector(".lb-x").addEventListener("click", close);
    lb.querySelector(".lb-p").addEventListener("click", function () { show(idx - 1); });
    lb.querySelector(".lb-n").addEventListener("click", function () { show(idx + 1); });
    lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
    document.addEventListener("keydown", function (e) {
      if (lb.hidden) return;
      if (e.key === "Escape") close(); if (e.key === "ArrowLeft") show(idx - 1); if (e.key === "ArrowRight") show(idx + 1);
    });
  }

  // contact form -> mailto
  var f = document.getElementById("cform");
  if (f) {
    var q = new URLSearchParams(location.search).get("p");
    if (q) { var sel = f.querySelector("select"); [].forEach.call(sel.options, function (o) { if (o.text === q) sel.value = o.text; }); }
    var rq = new URLSearchParams(location.search).get("r");
    if (rq) { var ta = f.querySelector("textarea"); if (ta && !ta.value) ta.value = "Resource: " + rq + "\n"; }
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = new FormData(f), prop = d.get("property");
      var subject = f.dataset.subject + (prop ? " — " + prop : "") + " — " + d.get("name");
      var body = d.get("message") + "\n\n" + d.get("name") + "\n" + d.get("email") + (d.get("phone") ? "\n" + d.get("phone") : "");
      location.href = "mailto:" + f.dataset.email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    });
  }

  // maps (Leaflet loaded with defer)
  function initMaps() {
    if (!window.L) return;
    document.querySelectorAll(".map[data-points]").forEach(function (el) {
      var pts = JSON.parse(el.dataset.points);
      var map = L.map(el, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
      var icon = L.divIcon({ className: "", html: '<span style="display:block;width:18px;height:18px;border-radius:50%;background:#c8a97e;border:3px solid #12110f;box-shadow:0 0 0 1px #c8a97e"></span>', iconSize: [18, 18], iconAnchor: [9, 9] });
      pts.forEach(function (p) { L.marker([p.lat, p.lng], { icon: icon, title: p.n }).addTo(map).bindPopup("<b>" + p.n + "</b><br>" + p.a + "<br><small>" + p.t + "</small>"); });
      if (pts.length === 1) map.setView([pts[0].lat, pts[0].lng], 16);
      else map.fitBounds(L.latLngBounds(pts.map(function (p) { return [p.lat, p.lng]; })), { padding: [50, 50] });
    });
  }
  if (document.querySelector(".map")) window.addEventListener("load", initMaps);
})();

// resource tools: rental yield calculator and purchase/resale cost calculator
(function () {
  var nf = function (lang, d) { return new Intl.NumberFormat({ fr: "fr-FR", en: "en-GB", de: "de-DE", hu: "hu-HU" }[lang] || "en-GB", { maximumFractionDigits: d }); };
  var lang = document.documentElement.lang || "fr";
  var eur = function (v) { return nf(lang, 0).format(Math.round(v)) + " €"; };
  var pct = function (v) { return isFinite(v) ? nf(lang, 2).format(v * 100) + (lang === "en" ? "%" : " %") : "–"; };
  document.querySelectorAll("[data-sim]").forEach(function (f) {
    var num = function (n) { var x = parseFloat(f.elements[n].value); return isFinite(x) ? x : 0; };
    var out = function (k, v) { f.querySelector('[data-out="' + k + '"]').textContent = v; };
    function run() {
      var price = num("price"), invest = price * (1 + num("buyCosts") / 100) + num("works");
      var months = Math.max(0, 12 - num("vacancy"));
      var income = num("rent") * months;
      var costs = num("charges") * 12 + income * num("mgmt") / 100 + num("other");
      var netBefore = income - costs;
      var tax = Math.max(0, netBefore) * num("tax") / 100;
      out("invest", eur(invest));
      out("gross", price ? pct(num("rent") * 12 / price) : "–");
      out("net", invest ? pct(netBefore / invest) : "–");
      out("netTax", invest ? pct((netBefore - tax) / invest) : "–");
      out("cash", eur(netBefore - tax));
    }
    f.addEventListener("input", run); run();
  });
  document.querySelectorAll("[data-costs]").forEach(function (box) {
    var c = JSON.parse(box.dataset.costs), L = box.dataset.lang || lang;
    var lbl = {
      duty: { fr: "Droit de mutation", en: "Transfer duty", de: "Grunderwerbsteuer", hu: "Vagyonszerzési illeték" },
      lawyer: { fr: "Avocat (fourchette)", en: "Lawyer (range)", de: "Anwalt (Spanne)", hu: "Ügyvéd (sáv)" },
      agency: { fr: "Agence à la revente (fourchette)", en: "Agency on resale (range)", de: "Makler beim Verkauf (Spanne)", hu: "Ingatlaniroda eladáskor (sáv)" },
      gain: { fr: "Impôt sur la plus-value (personne physique)", en: "Capital gains tax (individual)", de: "Steuer auf Veräußerungsgewinn (Privatperson)", hu: "Árfolyamnyereség adója (magánszemély)" },
      buy: { fr: "Total frais d'achat", en: "Total purchase costs", de: "Kaufnebenkosten gesamt", hu: "Vételi költségek összesen" }
    };
    var q = function (n) { var x = parseFloat(box.querySelector('[name="' + n + '"]').value); return isFinite(x) ? x : 0; };
    var row = function (k, v) { return "<div><span>" + lbl[k][L] + "</span><b>" + v + "</b></div>"; };
    var range = function (p, a) { return a ? eur(p * a[0] / 100) + " – " + eur(p * a[1] / 100) : "–"; };
    function run() {
      var p = q("p"), s = q("s"), y = q("y"), html = "";
      var duty = p * c.transferDutyRate;
      html += row("duty", eur(duty));
      html += row("lawyer", range(p, c.lawyerFeePct));
      if (c.lawyerFeePct) html += row("buy", eur(duty + p * c.lawyerFeePct[0] / 100) + " – " + eur(duty + p * c.lawyerFeePct[1] / 100));
      if (s) {
        html += row("agency", range(s, c.agencyFeePct));
        if (c.pitRate && c.gainReduction) {
          var red = 0; c.gainReduction.forEach(function (g) { if (y >= g.year) red = g.pct; });
          var gain = Math.max(0, s - p - duty);
          html += row("gain", eur(gain * (1 - red / 100) * c.pitRate));
        }
      }
      box.querySelector("[data-costs-out]").innerHTML = html;
    }
    box.addEventListener("input", run); run();
  });
})();
