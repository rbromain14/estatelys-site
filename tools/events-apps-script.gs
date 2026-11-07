// Estatelys click events endpoint (Google Apps Script, bound to the sheet "Estatelys – Site events").
// Receives {event, page, lang, label} from src/assets/track.js and adds one row. No cookie, no IP, no identifier stored.
// Deploy: Extensions > Apps Script > paste > Deploy > New deployment > Web app, Execute as: Me, Who has access: Anyone.
const EVENTS = ["brochure", "contact", "visit", "email", "facebook", "rental"];

function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const ev = String(d.event || "");
    if (EVENTS.indexOf(ev) < 0) return out("ignored");
    const clean = (v, n) => String(v || "").replace(/[\r\n\t]/g, " ").replace(/^[=+\-@]/, "'").slice(0, n);
    const page = clean(d.page, 200);
    if (page && page.charAt(0) !== "/" && page.charAt(0) !== "'") return out("ignored");
    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      SpreadsheetApp.getActiveSpreadsheet().getSheets()[0].appendRow([
        Utilities.formatDate(new Date(), "Europe/Budapest", "yyyy-MM-dd HH:mm:ss"),
        ev, page, clean(d.lang, 5), clean(d.label, 120),
      ]);
    } finally {
      lock.releaseLock();
    }
    return out("ok");
  } catch (err) {
    return out("error");
  }
}

function doGet() {
  return out("Estatelys events endpoint");
}

function out(s) {
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT);
}
