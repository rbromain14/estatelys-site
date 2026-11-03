/* Estatelys click events (same principle as dueo.eu track.js). No cookie, no identifier:
   sends {event, page, lang, label} to SITE.eventsEndpoint, which adds one row to the "Events" sheet.
   Events: brochure (PDF download), contact (contact page / button), visit (viewing request),
   email (mailto link), facebook, rental (rental page viewing request). */
(function () {
  var url = document.documentElement.getAttribute("data-ev-url");
  if (!url) return;
  var sent = {};
  function send(ev, label) {
    var key = ev + "|" + location.pathname + "|" + (label || "");
    if (sent[key] && Date.now() - sent[key] < 3000) return;
    sent[key] = Date.now();
    var body = JSON.stringify({ event: ev, page: location.pathname, lang: document.documentElement.lang || "", label: label || "" });
    try { if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }))) return; } catch (e) {}
    try { fetch(url, { method: "POST", mode: "no-cors", body: body, keepalive: true }); } catch (e) {}
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a,button");
    if (!a) return;
    var h = a.getAttribute("href") || "", ev = a.getAttribute("data-ev");
    if (ev) return send(ev, h.split("/").pop());
    if (/\.pdf$/.test(h)) return send("brochure", h.split("/").pop());
    if (h.indexOf("mailto:") === 0) return send("email");
    if (h.indexOf("facebook.com") > -1) return send("facebook");
    if (/contact\/(\?|$)/.test(h)) return send(/[?&]p=/.test(h) ? "visit" : "contact", decodeURIComponent((h.split("p=")[1] || "").split("&")[0]));
  }, true);
})();
