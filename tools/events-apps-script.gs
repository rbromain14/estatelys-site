// Estatelys endpoint (Google Apps Script, bound to Romain's sheet "Estatelys – Site events").
// 1. Click events from src/assets/track.js: {event, page, lang, label} -> first tab, one row. No cookie, no IP, no identifier.
// 2. Contact form from src/assets/site.js: {type:"contact", name, email, phone, property, message, page, lang, ms}
//    -> tab "Contacts" + one email to contact@estatelys.com (reply-to = the visitor). Answers "ok" when done.
// Deploy: Deploy > Manage deployments > edit (pencil) > Version: New version > Deploy (keeps the same /exec URL).
const EVENTS = ["brochure", "contact", "visit", "email", "facebook", "rental"];
const TO = "contact@estatelys.com";

function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const clean = (v, n) => String(v || "").replace(/[\r\t]/g, " ").replace(/^[=+\-@]/, "'").slice(0, n);
    if (d.type === "contact") return contact(d, clean);
    const ev = String(d.event || "");
    if (EVENTS.indexOf(ev) < 0) return out("ignored");
    const page = clean(d.page, 200).replace(/\n/g, " ");
    if (page && page.charAt(0) !== "/" && page.charAt(0) !== "'") return out("ignored");
    withLock(() => SpreadsheetApp.getActiveSpreadsheet().getSheets()[0].appendRow([now(), ev, page, clean(d.lang, 5), clean(d.label, 120).replace(/\n/g, " ")]));
    return out("ok");
  } catch (err) {
    return out("error");
  }
}

function contact(d, clean) {
  const name = clean(d.name, 120).replace(/\n/g, " ").trim();
  const email = clean(d.email, 160).trim();
  const message = clean(d.message, 5000).trim();
  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return out("invalid");
  if (Number(d.ms) < 3000) return out("ignored"); // filled in under 3 s: bot
  const phone = clean(d.phone, 40).replace(/\n/g, " ");
  const property = clean(d.property, 120).replace(/\n/g, " ");
  const lang = clean(d.lang, 5), page = clean(d.page, 200).replace(/\n/g, " ");
  withLock(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName("Contacts");
    if (!sh) { sh = ss.insertSheet("Contacts"); sh.appendRow(["Time (Budapest)", "Name", "Email", "Phone", "Property", "Message", "Language", "Page"]); }
    sh.appendRow([now(), name, email, phone, property, message, lang, page]);
  });
  MailApp.sendEmail({
    to: TO,
    replyTo: email,
    name: "Estatelys website",
    subject: "Website enquiry" + (property ? " — " + property : "") + " — " + name,
    body: message + "\n\n" + name + "\n" + email + (phone ? "\n" + phone : "") + "\n\nLanguage: " + lang + " · Page: " + page,
  });
  return out("ok");
}

function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try { fn(); } finally { lock.releaseLock(); }
}

function now() { return Utilities.formatDate(new Date(), "Europe/Budapest", "yyyy-MM-dd HH:mm:ss"); }

function doGet() { return out("Estatelys endpoint"); }

function out(s) { return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT); }
