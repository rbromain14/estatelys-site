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
