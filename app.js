/* הטיולים שלנו: אפליקציה אישית לתכנון וליווי טיול. גרסה 1. */
(() => {
"use strict";
const T = window.TRIP, C = window.CONFIG;
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const P = Object.fromEntries(T.places.map(p => [p.id, p]));
const HOTEL = P[T.hotelId];

// ---------- אחסון מקומי ----------
const KEY = "tc:" + T.id + ":";
const store = {
  get(k, d) { try { const v = localStorage.getItem(KEY + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch {} }
};
// ---------- תוכנית משותפת (מסונכרנת דרך GitHub) ----------
const REPO = "shlomiyishai-sudo/trip-companion", PLAN_PATH = "data/plan.js";
let shared = window.PLAN || { rev: 0, days: T.days, notes: {}, status: {}, booked: {} };
const localPlan = store.get("plan", null);
if (localPlan && localPlan.dirty && (localPlan.rev || 0) >= (shared.rev || 0)) shared = localPlan;
let planDirty = !!(localPlan && localPlan.dirty && shared === localPlan);
let ghToken = store.get("ghToken", "");
T.days = shared.days.map(d => ({ ...d, items: d.items.slice() }));
let statusOv = Object.assign({}, shared.status || {}, planDirty ? store.get("status", {}) : {});   // id -> status
let bookDone = Object.assign({}, shared.booked || {}, planDirty ? store.get("booked", {}) : {});
Object.keys(shared.booked || {}).forEach(k => { if (shared.booked[k]) bookDone[k] = true; });   // bookingId -> true
(T.bookings || []).forEach(b => { if (b.done && bookDone[b.id] === undefined) bookDone[b.id] = true; });
const statusOf = p => statusOv[p.id] || p.status || "nice";
const STATUS = { must: "חובה", booked: "הוזמן", nice: "נחמד", maybe: "אולי", visited: "ביקרנו", skip: "ויתרנו" };
const layerOf = p => p.layer === "hotel" ? "hotel" : (statusOf(p) === "maybe" ? "maybe" : (p.layer === "maybe" ? "food" : p.layer));
const colorOf = p => p.layer === "hotel" ? "#111" : (T.layers[p.layer === "maybe" ? "maybe" : p.layer] || T.layers.maybe).color;
// ---------- שינויים שלי: הסרות והצעות ----------
let removed = store.get("removed", {});   // "date|text" -> {date,time,text}
const itemKey = (d, it) => d.date + "|" + it.text;
// ניקוי הסרות שכבר טופלו בעדכון (הפריט כבר לא קיים בתוכנית)
(() => { const live = new Set(); T.days.forEach(d => d.items.forEach(it => live.add(itemKey(d, it)))); let ch = false;
  Object.keys(removed).forEach(k => { if (!live.has(k)) { delete removed[k]; ch = true; } }); if (ch) store.set("removed", removed); })();
let notes = Object.assign({}, shared.notes || {}, planDirty ? store.get("notes", {}) : {});        // key -> text ("" = נמחק)
if (!planDirty) { store.set("notes", notes); store.set("status", statusOv); store.set("booked", bookDone); }
let hiddenInbox = store.get("hiddenInbox", {});
const noteBox = t => { const x = String(t); if (x.length <= 150) return `<div class="mynote">📝 ${esc(x)}</div>`; const cut = x.slice(0, 110).replace(/\s+\S*$/, "");
  return `<details class="mynote"><summary>📝 ${esc(cut)}… <span class="more">עוד</span></summary>${esc(x)}</details>`; };
const noteHtml = k => notes[k] ? noteBox(notes[k]) : "";
const myNoteKeys = () => Object.keys(notes).filter(k => notes[k] && notes[k] !== ((shared.notes || {})[k] || ""));
const sayOf = p => p.say || (p.layer === "food" || (p.layer === "maybe" && /restaurant|étterem|bistro|café|cafe|bar/i.test(p.name)) ? T.defaultSay : null);
function openSay(say, title) {
  openSheet(`<h2>🗣 מה לומר${title ? " · " + esc(title) : ""}</h2>
    <div class="say-en" dir="ltr" lang="en">${esc(say.en)}</div>
    ${say.hu ? `<div class="say-en" dir="ltr" lang="hu" style="margin-top:8px">🇭🇺 ${esc(say.hu)}</div>` : ""}
    <div class="muted small" style="margin:8px 0">${esc(say.he)}</div>
    <div class="row"><button class="btn acc" id="sayCopy">העתקה</button><button class="btn ghost" id="sayBig">הגדלה להצגה למלצר</button></div>`);
  $("#sayCopy").onclick = async () => { try { await navigator.clipboard.writeText(say.en); toast("הועתק"); } catch { toast("סמן את הטקסט והעתק"); } };
  $("#sayBig").onclick = () => $("#sheet").querySelectorAll(".say-en").forEach(e => e.classList.toggle("big"));
}
function openBooking(id) {
  const b = T.bookings.find(x => x.id === id); if (!b) return;
  const done = !!bookDone[b.id];
  openSheet(`<h2>🎫 ${esc(b.title.replace("✅ ", ""))}</h2>
    <div class="row"><span class="pill ${done ? "ok" : (b.urgency === "high" ? "book" : "")}">${done ? "✅ הוזמן" : "עוד לא הוזמן"}</span><span class="pill">${esc(b.when)}</span></div>
    <div class="why" style="white-space:pre-wrap">${esc(b.note)}</div>
    ${noteHtml("bk:" + b.id)}
    <div class="row" style="margin-top:10px">
      <label class="pill"><input type="checkbox" id="bkDone" ${done ? "checked" : ""}> הוזמן</label>
      ${b.say ? `<button class="btn acc sm" id="bkSay">🗣 מה לומר</button>` : ""}
      <button class="btn ghost sm" id="bkNote">📝 ${notes["bk:" + b.id] ? "עריכת הערה" : "הערה"}</button>
    </div>`);
  $("#bkDone").onchange = e => { bookDone[b.id] = e.target.checked; store.set("booked", bookDone); markShared(); openBooking(id); if (view === "today") renderToday(); };
  if (b.say) $("#bkSay").onclick = () => openSay(b.say, b.title.replace("✅ ", ""));
  $("#bkNote").onclick = () => editNote("bk:" + b.id, b.title, () => { openBooking(id); if (view === "today") renderToday(); });
}
function editNote(k, title, after) {
  openSheet(`<h2>📝 הערה</h2><p class="muted small">${esc(title)}</p>
    <div class="form"><textarea id="noteTxt" rows="4" placeholder="כתוב כאן הערה…">${esc(notes[k] || "")}</textarea>
    <div class="row"><button class="btn acc" id="noteSave">שמירה</button>${notes[k] ? `<button class="btn ghost" id="noteDel">מחיקת ההערה</button>` : ""}</div></div>`);
  const t = $("#noteTxt"); setTimeout(() => t.focus(), 50);
  $("#noteSave").onclick = () => { notes[k] = t.value.trim(); store.set("notes", notes); closeSheet(); toast("ההערה נשמרה"); markShared(); after && after(); };
  const d = $("#noteDel"); if (d) d.onclick = () => { notes[k] = ""; store.set("notes", notes); closeSheet(); markShared(); after && after(); };
}
let ideas = store.get("ideas", []).filter(x => !(T.applied || []).includes(x.id));
store.set("ideas", ideas);
let BASE_ITEMS = T.days.map(d => d.items.slice());
function setDays(days) { shared.days = days; T.days = days.map(d => ({ ...d, items: d.items.slice() })); BASE_ITEMS = T.days.map(d => d.items.slice()); applyIdeas(); }
const BASE_COUNT = T.places.length;
function applyIdeas() {
  T.places.length = BASE_COUNT;
  Object.keys(P).forEach(k => { if (k.startsWith("idea-")) delete P[k]; });
  ideas.forEach(x => { if (!x.place) return;
    const p = { id: "idea-" + x.id, name: x.place.name, he: x.place.name, layer: x.layer || "food", status: "maybe", mine: true, tags: [],
      q: x.place.name, lat: x.place.lat, lng: x.place.lng, why: (x.note ? x.note + " · " : "") + "ההצעה שלי. היא תיבדק ותשולב בעדכון הבא." };
    T.places.push(p); P[p.id] = p;
    if (x.place.gid && !infoCache[p.id]) infoCache[p.id] = { t: 0, gid: x.place.gid, lat: x.place.lat, lng: x.place.lng };
  });
  T.days.forEach((d, i) => { d.items = BASE_ITEMS[i].concat(ideas.filter(x => x.day === i && x.place).map(x => ({ time: "➕", text: "ההצעה שלי: " + x.place.name, place: "idea-" + x.id, mine: true }))); });
}
// תמונות נשמרות ב-IndexedDB
const idb = (() => { let dbp; const open = () => dbp ||= new Promise((res, rej) => { const r = indexedDB.open("tc-ideas", 1); r.onupgradeneeded = () => r.result.createObjectStore("img"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction("img", mode); const st = t.objectStore("img"); const r = fn(st); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); };
  return { put: (k, v) => tx("readwrite", st => st.put(v, k)).catch(() => {}), get: k => tx("readonly", st => st.get(k)).catch(() => null), del: k => tx("readwrite", st => st.delete(k)).catch(() => {}) }; })();
function shrink(file) { return new Promise(res => { const fr = new FileReader(); fr.onload = () => { const im = new Image(); im.onload = () => { const m = 1100, k = Math.min(1, m / Math.max(im.width, im.height));
  const c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", .72)); }; im.onerror = () => res(null); im.src = fr.result; }; fr.readAsDataURL(file); }); }
const dataToFile = (d, name) => { const [h, b] = d.split(","); const bin = atob(b); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new File([u], name, { type: h.match(/:(.*?);/)[1] }); };
const TAGS = { romantic: "רומנטי", indoor: "מקורה", view: "תצפית", quick: "קצר", sweet: "מתוק", drink: "לשתות", rest: "מנוחה" };

// ---------- עזרים ----------
const toast = (msg, ms = 2600) => { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, ms); };
const hav = (a, b) => { const R = 6371e3, r = x => x * Math.PI / 180; const dLa = r(b.lat - a.lat), dLo = r(b.lng - a.lng);
  const h = Math.sin(dLa/2)**2 + Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLo/2)**2; return 2*R*Math.asin(Math.sqrt(h)); };
const fmtDist = m => m < 950 ? Math.round(m / 10) * 10 + " מ'" : (m / 1000).toFixed(1) + " ק\"מ";
const fmtMin = s => { const m = Math.round(s / 60); return m < 60 ? m + " דק'" : Math.floor(m/60) + ":" + String(m%60).padStart(2,"0") + " ש'"; };
const loc = p => { const c = info(p.id); return c && c.lat ? { lat: c.lat, lng: c.lng } : { lat: p.lat, lng: p.lng }; };
const gmapsPlace = p => { const c = info(p.id), l = loc(p);
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(p.name + " " + l.lat + "," + l.lng) + (c && c.gid ? "&query_place_id=" + c.gid : ""); };
const gmapsDir = (p, mode = "walking") => { const c = info(p.id), l = loc(p);
  return "https://www.google.com/maps/dir/?api=1&travelmode=" + mode + "&destination=" + l.lat + "," + l.lng + (c && c.gid ? "&destination_place_id=" + c.gid : ""); };
const tripDayIndex = () => { const today = new Date().toLocaleDateString("en-CA", { timeZone: T.tz }); const i = T.days.findIndex(d => d.date === today); return i < 0 ? 0 : i; };
const dayLabel = d => { const dt = new Date(d.date + "T12:00:00"); return dt.toLocaleDateString("he-IL", { weekday: "short" }) + " " + dt.getDate() + "." + (dt.getMonth()+1); };

let day = tripDayIndex();
let view = "today";

// ---------- טעינת גוגל מפס ----------
let gReady = null;
const GERR = {
  ApiNotActivatedMapError: "השירות Maps JavaScript API לא מופעל בפרויקט. צריך להיכנס ל-Google Cloud ← APIs & Services ← Library ולהפעיל אותו (Enable).",
  RefererNotAllowedMapError: "המפתח נעול לכתובת אחרת. ב-Credentials, תחת Website restrictions, צריך להופיע בדיוק: https://shlomiyishai-sudo.github.io/*",
  ApiTargetBlockedMapError: "המפתח לא מורשה לשירות Maps JavaScript API. ב-Credentials, תחת API restrictions, צריך לסמן אותו.",
  BillingNotEnabledMapError: "אין חשבון חיוב פעיל בפרויקט. צריך לחבר Billing לפרויקט trip-companion.",
  InvalidKeyMapError: "המפתח לא תקין. כדאי להעתיק אותו שוב מ-Credentials.",
  ExpiredKeyMapError: "המפתח פג תוקף."
};
let gErr = null;
function loadGoogle() {
  if (gReady) return gReady;
  gReady = new Promise((res, rej) => {
    window.__gmInit = () => res(window.google);
    const ce = console.error.bind(console);
    console.error = (...a) => { try { const m = a.join(" "); const k = Object.keys(GERR).find(x => m.includes(x)); if (k || /Google Maps JavaScript API/.test(m)) { gErr = k || m.slice(0, 200); showMapError(k ? GERR[k] + " (" + k + ")" : m.slice(0, 200)); } } catch {} ce(...a); };
    const s = document.createElement("script");
    s.src = "https://maps.googleapis.com/maps/api/js?key=" + C.mapsKey + "&v=weekly&language=he&region=HU&loading=async&libraries=places,marker,geometry&callback=__gmInit";
    s.async = true; s.onerror = () => { gReady = null; rej(new Error("maps")); };
    window.gm_authFailure = () => { gErr = gErr || "auth"; showMapError(gErr !== "auth" && GERR[gErr] ? GERR[gErr] : "גוגל דחתה את מפתח המפות. לחץ על \"בדיקת חיבור לגוגל\" כדי לראות בדיוק מה הבעיה."); };
    document.head.appendChild(s);
  });
  return gReady;
}
function showMapError(msg) { const n = $("#mapNote"); n.innerHTML = `<b>⚠️ בעיה בחיבור לגוגל:</b> ${esc(msg)} <button class="btn ghost sm" id="diagBtn">בדיקת חיבור לגוגל</button>`; n.hidden = false; $("#diagBtn").onclick = diagnose; toast(msg, 6000); }
async function diagnose() {
  openSheet(`<h2>בדיקת חיבור לגוגל</h2><div id="diagOut" class="list"><p class="muted">בודק…</p></div>`);
  const out = [], add = (n, ok, msg) => out.push(`<div class="doc"><h3>${ok ? "✅" : "❌"} ${n}</h3><div style="direction:ltr;text-align:left;word-break:break-word">${esc(msg)}</div></div>`);
  const call = async (url, body, mask) => { try { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": C.mapsKey, "X-Goog-FieldMask": mask }, body: JSON.stringify(body) }); const j = await r.json(); return j.error ? [false, j.error.status + ": " + j.error.message] : [true, "OK"]; } catch (e) { return [false, String(e)]; } };
  add("Maps JavaScript API (המפה)", !gErr && !!window.google?.maps, gErr ? (GERR[gErr] ? gErr + ": " + GERR[gErr] : gErr) : window.google?.maps ? "OK" : "לא נטען עדיין. פתח קודם את לשונית המפה");
  add("Places API (New)", ...(await call("https://places.googleapis.com/v1/places:searchText", { textQuery: "Gerbeaud Budapest" }, "places.displayName")));
  add("Routes API", ...(await call("https://routes.googleapis.com/directions/v2:computeRoutes", { origin: { location: { latLng: { latitude: 47.5, longitude: 19.05 } } }, destination: { location: { latLng: { latitude: 47.49, longitude: 19.06 } } }, travelMode: "WALK" }, "routes.duration")));
  const box = $("#diagOut"); if (box) box.innerHTML = out.join("") + `<p class="muted small">צלם את המסך הזה ושלח ל-Claude.</p><p class="muted small" style="direction:ltr;text-align:left">${esc(location.href)}</p>`;
}

// ---------- מידע מגוגל על מקומות (עם מטמון) ----------
let infoCache = store.get("info", {});
const info = id => infoCache[id];
const FIELDS = ["id","location","displayName","rating","userRatingCount","regularOpeningHours","photos","priceLevel","googleMapsURI","formattedAddress","utcOffsetMinutes"];
const PRICE = { FREE: "חינם", INEXPENSIVE: "€", MODERATE: "€€", EXPENSIVE: "€€€", VERY_EXPENSIVE: "€€€€" };
async function resolve(p, fresh = false) {
  const c = info(p.id);
  if (c && !fresh && Date.now() - c.t < 5 * 864e5) return { cached: c };
  const g = await loadGoogle();
  const { Place } = g.maps.places;
  let place;
  try {
    if (c && c.gid) { place = new Place({ id: c.gid }); await place.fetchFields({ fields: FIELDS }); }
    else {
      const r = await Place.searchByText({ textQuery: p.q || p.name, fields: FIELDS, maxResultCount: 1,
        locationBias: { center: { lat: p.lat, lng: p.lng }, radius: 3000 }, language: "he" });
      place = r.places && r.places[0];
    }
  } catch (e) { console.warn("place", p.id, e); return { cached: c }; }
  if (!place) return { cached: c };
  const d = {
    t: Date.now(), gid: place.id, lat: place.location?.lat(), lng: place.location?.lng(),
    rating: place.rating, count: place.userRatingCount, price: PRICE[place.priceLevel] || "",
    hours: place.regularOpeningHours?.weekdayDescriptions || [], addr: place.formattedAddress || "",
    photo: place.photos && place.photos[0] ? place.photos[0].getURI({ maxWidth: 800 }) : "",
    periods: (place.regularOpeningHours?.periods || []).map(x => [x.open?.day, x.open?.hour, x.open?.minute, x.close ? x.close.day : null, x.close?.hour, x.close?.minute]),
    addrHu: c && c.addrHu
  };
  infoCache[p.id] = d; store.set("info", infoCache);
  return { cached: d, place };
}

// ---------- מסלולים (Routes API) ----------
let legCache = store.get("legs", {});
async function leg(a, b) {
  const A = loc(a), B = loc(b), straight = hav(A, B);
  const mode = straight > 2200 ? "TRANSIT" : "WALK";
  const k = [a.id, b.id, mode].join(">");
  if (legCache[k]) return legCache[k];
  try {
    const r = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": C.mapsKey, "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline" },
      body: JSON.stringify({ origin: { location: { latLng: { latitude: A.lat, longitude: A.lng } } },
        destination: { location: { latLng: { latitude: B.lat, longitude: B.lng } } }, travelMode: mode, languageCode: "he" })
    });
    const j = await r.json(); const rt = j.routes && j.routes[0];
    if (!rt) throw new Error(JSON.stringify(j.error || j));
    const v = { mode, sec: parseInt(rt.duration), m: rt.distanceMeters, poly: rt.polyline?.encodedPolyline };
    legCache[k] = v; store.set("legs", legCache); return v;
  } catch (e) {
    console.warn("route", e);
    const walk = straight * 1.3; return { mode, sec: mode === "WALK" ? walk / 1.25 : straight / 8, m: walk, est: true };
  }
}

// ---------- מזג אוויר (Open-Meteo, בלי מפתח) ----------
let wx = store.get("wx", null);
async function loadWeather() {
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${T.weather.lat}&longitude=${T.weather.lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,weather_code,sunset&current=temperature_2m,weather_code&timezone=${encodeURIComponent(T.tz)}&forecast_days=16`;
    const j = await (await fetch(u)).json();
    wx = { t: Date.now(), j }; store.set("wx", wx);
  } catch (e) { console.warn("weather", e); }
  renderHeaderWx(); if (view === "today") renderToday();
}
const WXI = c => c == null ? "" : c === 0 ? "☀️" : c <= 3 ? "⛅" : c <= 48 ? "🌫️" : c <= 67 ? "🌧️" : c <= 77 ? "🌨️" : c <= 82 ? "🌦️" : "⛈️";
function wxFor(date) { if (!wx) return null; const d = wx.j.daily; const i = d.time.indexOf(date); if (i < 0) return null;
  return { max: Math.round(d.temperature_2m_max[i]), min: Math.round(d.temperature_2m_min[i]), rain: d.precipitation_probability_max[i], wind: Math.round(d.wind_speed_10m_max[i]), code: d.weather_code[i], sunset: (d.sunset[i]||"").slice(11,16) }; }
function renderHeaderWx() { const el = $("#wxNow"); if (!wx || !wx.j.current) { el.textContent = ""; return; }
  el.innerHTML = `${WXI(wx.j.current.weather_code)} <b>${Math.round(wx.j.current.temperature_2m)}°</b><div class="small">עכשיו בבודפשט</div>`; }
function wxAdvice(w, d) {
  if (!w) return "התחזית לתאריך הזה תופיע כ-16 יום לפני.";
  const a = [];
  if (w.rain >= 60) a.push(d.date === "2026-11-09" ? "צפוי גשם ביום הטיול מחוץ לעיר. כדאי לשקול להחליף עם יום 4 (11.11)." : "צפוי גשם. ללבוש מעיל עמיד ולשלב עצירות במקומות מקורים (\"יורד גשם\" למטה).");
  else if (w.rain >= 30) a.push("יש סיכוי לטפטוף. כדאי מטרייה קטנה בתיק.");
  if (w.wind >= 35) a.push("רוח חזקה. בתצפיות הגבוהות (מבצר הדייגים, גבעת גלרט) יהיה קר, אז לקצר שם.");
  if (w.max <= 6) a.push("קר במיוחד: כובע, כפפות ושכבות.");
  if (!a.length) a.push("מזג אוויר טוב לשיטוט. התוכנית עומדת.");
  return a.join(" ");
}

// ---------- כותרת וימים ----------
$("#boardBtn").onclick = openBoard;
function renderHeader() {
  $("#tripTitle").textContent = T.title;
  $("#tripSub").textContent = T.subtitle + " · " + T.days.length + " ימים";
  $("#dayChips").innerHTML = T.days.map((d, i) => `<button data-day="${i}" class="${i === day ? "on" : ""}">יום ${i+1}<small>${dayLabel(d)}</small></button>`).join("");
}
$("#dayChips").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; day = +b.dataset.day; renderHeader(); render(); });

// ---------- תצוגת היום ----------
async function renderToday() {
  const tok = renderToday.tok = (renderToday.tok || 0) + 1;
  const d = T.days[day], w = wxFor(d.date), el = $("#view-today");
  const anchors = d.items.filter(i => i.anchor);
  const pending = d.items.filter(i => i.book && !bookDone[i.book]).map(i => T.bookings.find(b => b.id === i.book)).filter(Boolean);
  const uniq = [...new Map(pending.map(b => [b.id, b])).values()];
  const todayStr = budDate(), isToday = d.date === todayStr, nowM = budMin();
  const daysTo = Math.round((new Date(T.days[0].date + "T12:00:00") - new Date(todayStr + "T12:00:00")) / 864e5);
  const evening = isToday && nowM >= 18 * 60;
  el.innerHTML = `
    <section class="hero">
      <div class="hero-top"><span>יום ${day + 1} · ${esc(dayLabel(d))}${daysTo > 0 && day === 0 ? ` · ✈️ עוד ${daysTo} ${daysTo === 1 ? "יום" : "ימים"}` : ""}</span>
        <span class="hero-wx">${w ? `${WXI(w.code)} ${w.min}°–${w.max}° · ☔ ${w.rain}%${w.sunset ? ` · 🌇 ${w.sunset}` : ""}` : "🌤 התחזית בקרוב"}</span></div>
      <h2>${esc(d.title)}</h2>
      <p class="hero-sum">${esc(d.summary)}</p>
      <div class="hero-chips">
        ${evening || d.date < todayStr ? `<button class="hchip main" data-hero="summary">🌙 סיכום היום</button>` : ""}<button class="hchip ${evening || d.date < todayStr ? "" : "main"}" data-hero="brief">☀️ תדריך</button>
        ${anchors.length ? `<button class="hchip" data-hero="anchors">⏰ ${anchors.length} עוגנים</button>` : ""}
        ${uniq.length ? `<button class="hchip todo" data-hero="todo">🎫 ${uniq.length} להזמין</button>` : ""}
        <button class="hchip" data-hero="tips">💡 טיפים</button>
      </div>
    </section>
    <div id="nowBar"></div>
    <div class="daystats" id="dayStats">מחשב זמני הליכה…</div>
    <ol class="timeline" id="tl"></ol>`;
  el.querySelectorAll("[data-hero]").forEach(b => b.onclick = () => b.dataset.hero === "summary" ? openDaySummary(day) : heroSheet(b.dataset.hero, d, w, evening, anchors, uniq));
  const numT = d.items.map(it => /^\d{1,2}:\d{2}$/.test(it.time || "") ? tmin(it.time) : null);
  let curIdx = -1, nextIdx = -1;
  if (isToday) { numT.forEach((m, i) => { if (m == null) return; if (m <= nowM) curIdx = i; else if (nextIdx < 0) nextIdx = i; }); }
  const tl = $("#tl");
  let prev = null, tot = { walkM: 0, walkS: 0, transS: 0 }, longest = 0;
  const rows = [];
  for (const it of d.items) {
    const p = it.place && P[it.place];
    const isRem = !!removed[itemKey(d, it)];
    let legHtml = "";
    if (p && prev && prev.id !== p.id && !isRem) {
      const l = await leg(prev, p);
      if (l.mode === "WALK") { tot.walkM += l.m; tot.walkS += l.sec; } else tot.transS += l.sec;
      longest = Math.max(longest, l.sec);
      legHtml = `<li class="ti-item"><div class="leg ${l.sec > 1800 ? "long" : ""}">${l.mode === "WALK" ? "🚶" : "🚇"} ${fmtMin(l.sec)}${l.mode === "WALK" ? " · " + fmtDist(l.m) : " בתחבורה"}${l.est ? " (הערכה)" : ""}${l.sec > 1800 && l.mode === "WALK" ? " · מעל 30 דק', שווה מטרו או Bolt" : ""}</div></li>`;
    }
    if (p && !isRem) prev = p;
    const c = p && info(p.id);
    const rk = esc(itemKey(d, it));
    const nk = "it:" + itemKey(d, it);
    const ix = d.items.indexOf(it);
    rows.push(legHtml + `<li class="ti-item ${isRem ? "removed" : ""} ${it.mine ? "mine" : ""} ${ix === curIdx ? "is-now" : ""} ${ix === nextIdx ? "is-next" : ""}" data-ix="${ix}">
      <div class="ti-box ${it.anchor ? "anchor" : ""}">
        <button class="ti-main" ${p ? `data-place="${p.id}"` : "disabled"}>
          <span class="ti-head"><span class="ti-t">${esc(it.time)}</span>${p ? `<span class="dot" style="background:${colorOf(p)}"></span><span class="sb">${esc(p.he)}${c && c.rating ? ` · ★ ${c.rating}` : ""}</span>` : ""}
            <span class="tags">${it.anchor ? `<span class="pill anchor">עוגן</span>` : ""}${it.book ? (bookDone[it.book] ? `<span class="pill ok">הוזמן</span>` : `<span class="pill book">להזמין</span>`) : ""}${(it.alt||[]).length ? `<span class="pill">+ ${it.alt.length} חלופות</span>` : ""}${p && statusOf(p)==="visited" ? `<span class="pill ok">ביקרנו</span>` : ""}</span></span>
          <span class="nm">${esc(it.text)}</span>
          <span class="ti-photo">${c && c.photo ? `<img src="${esc(c.photo)}" alt="" loading="lazy">` : ""}</span>
        </button>
        ${isRem ? `<div class="rm-note">יוסר בעדכון הבא · ↺ לביטול</div>` : ""}${notes[nk] ? noteBox(notes[nk]) : ""}
        <div class="ti-acts">
          ${it.book && T.bookings.find(b => b.id === it.book) ? `<button class="act ${bookDone[it.book] ? "bk-ok" : "bk-todo"}" data-bk="${it.book}">🎫 ${bookDone[it.book] ? "ההזמנה" : "להזמין"}</button>` : ""}
          ${p && sayOf(p) ? `<button class="act" data-sayp="${p.id}">🗣 מה לומר</button>` : ""}
          ${it.more ? `<button class="act" data-more="${d.items.indexOf(it)}">${esc(it.more.label)}</button>` : ""}
          ${p && p.layer !== "hotel" ? `<a class="act" href="${gmapsDir(p, hav(HOTEL, loc(p)) > 2500 ? "transit" : "walking")}" target="_blank" rel="noopener">↗ ניווט</a>` : ""}
          <button class="act" data-note="${rk}">📝 הערה</button>
          ${it.mine ? `<button class="act" data-idea="${esc(it.place.slice(5))}">✕ מחיקה</button>`
            : `<button class="act" data-rm="${rk}" data-time="${esc(it.time)}">${isRem ? "↺ ביטול" : "✕ להסיר"}</button>`}
        </div>
      </div></li>`);
  }
  if (tok !== renderToday.tok) return;
  tl.innerHTML = rows.join("") + `<li class="ti-item"><button class="add-day" id="addToDay">➕ להוסיף משהו ליום הזה</button></li>`;
  $("#addToDay").onclick = () => openAdd(day);
  tl.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { const k = b.dataset.rm;
    if (removed[k]) delete removed[k]; else removed[k] = { date: d.date, time: b.dataset.time, text: k.split("|").slice(1).join("|") };
    store.set("removed", removed); toast(removed[k] ? "סומן להסרה. ייכנס לעדכון הבא" : "ההסרה בוטלה"); renderToday(); });
  el.querySelectorAll("[data-bk]").forEach(b => b.onclick = () => openBooking(b.dataset.bk));
  tl.querySelectorAll("[data-sayp]").forEach(b => b.onclick = () => { const p = P[b.dataset.sayp]; openSay(sayOf(p), p.he); });
  tl.querySelectorAll("[data-note]").forEach(b => b.onclick = () => { const k = b.dataset.note; editNote("it:" + k, k.split("|").slice(1).join("|"), renderToday); });
  tl.querySelectorAll("[data-idea]").forEach(b => b.onclick = () => deleteIdea(b.dataset.idea));
  tl.querySelectorAll("[data-more]").forEach(b => b.onclick = () => { const m = d.items[+b.dataset.more].more;
    openSheet(`<h2>${esc(m.label)}</h2><div class="why" style="white-space:pre-wrap">${esc(m.text)}</div>`); });
  const busy = tot.walkM > 12000;
  $("#dayStats").innerHTML = `🚶 <b>${fmtDist(tot.walkM)}</b> הליכה (${fmtMin(tot.walkS)})${tot.transS ? ` · 🚇 <b>${fmtMin(tot.transS)}</b> בתחבורה` : ""}${busy ? ` <span class="pill warn">יום ארוך ברגליים</span>` : ""} <button class="btn ghost" id="dayMap">על המפה</button>`;
  $("#dayMap").onclick = () => { mapLayer = "day"; go("map"); };
  lastStats = { day, walkM: tot.walkM, walkS: tot.walkS };
  if (isToday) { drawNowBar(d, curIdx, nextIdx); if (!renderToday.scrolled) { renderToday.scrolled = true; const li = tl.querySelector(".is-now, .is-next"); if (li) setTimeout(() => li.scrollIntoView({ behavior: "smooth", block: "center" }), 300); } }
  // השלמת תמונות ודירוגים ברקע
  for (const it of d.items) { const p = it.place && P[it.place]; if (p && !info(p.id)) { resolve(p).then(() => { if (view === "today" && T.days[day] === d) patchThumbs(); }); } }
}
function patchThumbs() { document.querySelectorAll(".ti-main[data-place]").forEach(b => { const c = info(b.dataset.place); const ph = b.querySelector(".ti-photo"); if (c && c.photo && ph && !ph.querySelector("img")) ph.innerHTML = `<img src="${esc(c.photo)}" alt="" loading="lazy">`; const sb = b.querySelector(".sb"); if (c && c.rating && sb && !sb.textContent.includes("★")) sb.textContent += " · ★ " + c.rating; }); }
function pickTips(d) {
  const ids = d.items.map(i => i.place); const t = T.tips;
  const out = [t[0], t[1]]; const byT = n => t.find(x => x.t === n); if (day === 0) out.unshift(byT("מהשדה למלון")); if (ids.includes("lift-var")) out.unshift(byT("המעלית לארמון"));
  if (ids.includes("szechenyi") || ids.includes("rudas")) out.push(t[5]);
  if (d.date === T.end) out.push(t[4]);
  out.push(t[t.length-1]); if (day === 0) out.push(t[3], t[2], t[7], t[8]); if (day === 1) out.push(t.find(x=>x.t==="תפריט צהריים")); if (day === 2) out.push(t[6]);
  return out;
}
document.addEventListener("click", e => { const b = e.target.closest("[data-place]"); if (b && !b.disabled) openPlace(P[b.dataset.place]); });

// ---------- כרטיס מקום ----------
async function openPlace(p) {
  const draw = (c, open) => {
    const st = statusOf(p);
    openSheet(`
      <h2>${esc(p.he)}</h2><div class="en">${esc(p.name)}${c && c.addr ? " · " + esc(c.addr) : ""}</div>
      ${c && c.photo ? `<img class="photo" src="${esc(c.photo)}" alt="${esc(p.he)}">` : ""}
      <div class="why"><b>למה זה מתאים לנו:</b> ${esc(p.why)}</div>
      ${sayOf(p) ? `<button class="btn acc sm" id="plSay" style="margin-inline-end:6px">🗣 ${p.layer === "hotel" ? "מה לומר בקבלה" : "מה לומר למלצר"}</button>` : ""}${noteHtml("pl:" + p.id)}<button class="btn ghost sm" id="plNote">📝 ${notes["pl:" + p.id] ? "עריכת ההערה שלי" : "הוספת הערה"}</button>
      <div class="facts">
        ${c && c.rating ? `<div><span class="k">ציון בגוגל:</span> ★ ${c.rating} (${(c.count||0).toLocaleString("he-IL")} ביקורות)${c.price ? " · " + c.price : ""}</div>` : ""}
        ${open != null ? `<div><span class="k">עכשיו:</span> ${open ? "<b style='color:var(--ok)'>פתוח</b>" : "<b style='color:var(--bad)'>סגור</b>"}</div>` : ""}
        <div id="fromHotel"><span class="k">מהמלון:</span> מחשב…</div>
        ${c && c.hours && c.hours.length ? `<details><summary class="k">שעות פתיחה</summary><ul class="hours">${c.hours.map(h => `<li>${esc(h)}</li>`).join("")}</ul></details>` : ""}
        ${(p.tags||[]).length ? `<div class="row">${p.tags.map(t => `<span class="pill">${TAGS[t]||t}</span>`).join("")}</div>` : ""}
      </div>
      <div class="acts">
        <a class="btn acc" href="${gmapsDir(p)}" target="_blank" rel="noopener">🚶 ניווט בגוגל מפס</a>
        <button class="btn" id="showOnMap">הצג במפה</button>
        <button class="btn ghost" id="taxiBtn">🚕 להראות לנהג</button>
        <a class="btn ghost" href="${c && c.gid ? gmapsPlace(p) : gmapsPlace(p)}" target="_blank" rel="noopener">פתח בגוגל מפס</a>
      </div>
      ${p.layer !== "hotel" ? `<div class="status" role="group" aria-label="סימון">${Object.entries(STATUS).map(([k, v]) => `<button data-st="${k}" class="${st === k ? "on" : ""}">${v}</button>`).join("")}</div>` : ""}
    `);
    if (sayOf(p)) $("#plSay").onclick = () => openSay(sayOf(p), p.he);
    $("#plNote").onclick = () => editNote("pl:" + p.id, p.he, () => openPlace(p));
    $("#showOnMap").onclick = () => { closeSheet(); mapLayer = "all"; go("map").then(() => focusPlace(p)); };
    $("#taxiBtn").onclick = () => openTaxi(p);
    $("#sheet").querySelectorAll("[data-st]").forEach(b => b.onclick = () => { statusOv[p.id] = b.dataset.st; if (b.dataset.st === "visited") markVisitedAt(p.id); store.set("status", statusOv); markShared(); draw(info(p.id), open); toast("סומן: " + STATUS[b.dataset.st]); refreshMarkers(); });
    if (p.id !== HOTEL.id) leg(HOTEL, p).then(l => { const f = $("#fromHotel"); if (f) f.innerHTML = `<span class="k">מהמלון:</span> ${l.mode === "WALK" ? "🚶" : "🚇"} ${fmtMin(l.sec)}${l.mode === "WALK" ? " (" + fmtDist(l.m) + ")" : ""}`; });
    else { const f = $("#fromHotel"); if (f) f.remove(); }
  };
  draw(info(p.id), null);
  try {
    const r = await resolve(p, true);
    let open = null; if (r.place) { try { open = await r.place.isOpen(); } catch {} }
    if (!$("#sheet").hidden) draw(r.cached, open ?? null);
  } catch (e) { console.warn(e); }
}
function openSheet(html) { const s = $("#sheet"); s.innerHTML = `<div class="grab"></div><button class="close" aria-label="סגור">×</button>` + html; s.hidden = false; $("#sheetBg").hidden = false; s.scrollTop = 0; s.querySelector(".close").onclick = closeSheet; }
function closeSheet() { $("#sheet").hidden = true; $("#sheetBg").hidden = true; }
$("#sheetBg").onclick = closeSheet;
document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });

// ---------- מפה ----------
let map, markers = [], dayLines = [], me = null, meMarker = null, mapLayer = "day";
const MAPLAYERS = () => [["day", "תוכנית היום", "#D9622B"], ...Object.entries(T.layers).map(([k, v]) => [k, v.name, v.color]), ["open", "פתוח עכשיו", "#1E9E6A"], ["visited", "ביקרנו", "#2E8B57"], ["all", "הכל", "#14262E"]];
function renderLayerBar() { $("#layerBar").innerHTML = MAPLAYERS().map(([k, n, c]) => `<button data-layer="${k}" class="${k === mapLayer ? "on" : ""}"><span class="sw" style="background:${c}"></span>${esc(n)}</button>`).join("") + `<button data-diag="1">🔧 בדיקת חיבור</button>`; }
$("#layerBar").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.diag) return diagnose(); mapLayer = b.dataset.layer; renderLayerBar(); refreshMarkers(); });
async function ensureMap() {
  if (map) return map;
  let g; try { g = await loadGoogle(); } catch { showMapError("לא הצלחתי לטעון את גוגל מפס. בדוק חיבור לאינטרנט."); return null; }
  if (gErr) return null;
  const { Map } = await g.maps.importLibrary("maps");
  map = new Map($("#map"), { center: T.center, zoom: 14, mapId: C.mapId, gestureHandling: "greedy", clickableIcons: true, fullscreenControl: false, streetViewControl: false, mapTypeControl: false });
  watchMe();
  return map;
}
function pinEl(p, label) {
  const d = document.createElement("div");
  const st = statusOf(p);
  d.className = "pin" + (p.layer === "hotel" ? " hotel" : "") + (st === "must" ? " must" : "") + (label ? " num" : "");
  d.style.background = st === "visited" ? "#2E8B57" : st === "skip" ? "#AAB4B9" : colorOf(p);
  d.innerHTML = `<span>${p.layer === "hotel" ? "🏨" : label || (st === "booked" ? "✓" : "")}</span>`;
  d.title = p.he; return d;
}
async function refreshMarkers() {
  if (!map) return;
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
  markers.forEach(m => m.map = null); markers = []; dayLines.forEach(l => l.setMap(null)); dayLines = [];
  let list, numbered = {};
  if (mapLayer === "day") {
    const ids = [...new Set(T.days[day].items.map(i => i.place).filter(Boolean))];
    ids.forEach((id, i) => numbered[id] = String(i + 1));
    list = ids.map(id => P[id]);
  } else if (mapLayer === "all") list = T.places;
  else if (mapLayer === "visited") list = T.places.filter(p => statusOf(p) === "visited");
  else if (mapLayer === "open") { list = T.places.filter(p => p.layer !== "hotel" && statusOf(p) !== "skip" && openNow(p) === true); fillHours();
    const n = $("#mapNote"); n.innerHTML = `🟢 ${list.length} מקומות מהרשימה שלנו פתוחים עכשיו, לפי שעון בודפשט (${String(Math.floor(budMin() / 60)).padStart(2, "0")}:${String(budMin() % 60).padStart(2, "0")}). <span class="muted small">מקומות בלי שעות פתיחה בגוגל לא מוצגים.</span>`; n.hidden = false; }
  else list = T.places.filter(p => layerOf(p) === mapLayer && statusOf(p) !== "skip");
  if (mapLayer !== "open" && !gErr) $("#mapNote").hidden = true;
  if (!list.includes(HOTEL)) list = [HOTEL, ...list];
  const bounds = new google.maps.LatLngBounds();
  for (const p of list) {
    const pos = loc(p);
    const m = new AdvancedMarkerElement({ map, position: pos, content: pinEl(p, numbered[p.id]), title: p.he, zIndex: p.layer === "hotel" ? 999 : undefined });
    m.addListener("click", () => openPlace(p));
    markers.push(m); bounds.extend(pos);
  }
  if (mapLayer === "day") drawDayRoute();
  if (list.length > 1) map.fitBounds(bounds, 50);
  // מיקומים מדויקים מגוגל ברקע
  list.forEach(p => { if (!info(p.id)) resolve(p).then(r => { const c = r.cached; const mk = markers.find(m => m.title === p.he); if (c && c.lat && mk) mk.position = { lat: c.lat, lng: c.lng }; }); });
}
async function drawDayRoute() {
  const items = T.days[day].items.map(i => i.place && P[i.place]).filter(Boolean);
  let prev = null;
  for (const p of items) {
    if (prev && prev.id !== p.id) {
      const l = await leg(prev, p);
      const path = l.poly ? google.maps.geometry.encoding.decodePath(l.poly) : [loc(prev), loc(p)];
      dayLines.push(new google.maps.Polyline({ map, path, strokeColor: l.mode === "WALK" ? "#D9622B" : "#2F6FDE", strokeOpacity: l.mode === "WALK" ? .9 : 0, strokeWeight: 4,
        icons: l.mode === "WALK" ? [] : [{ icon: { path: "M 0,-1 0,1", strokeOpacity: .9, scale: 3, strokeColor: "#2F6FDE" }, offset: "0", repeat: "12px" }] }));
    }
    prev = p;
  }
}
function focusPlace(p) { if (!map) return; map.panTo(loc(p)); map.setZoom(16); }
function watchMe() {
  if (!navigator.geolocation) return;
  navigator.geolocation.watchPosition(async pos => {
    me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    if (!map) return;
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
    if (!meMarker) { const d = document.createElement("div"); d.style.cssText = "width:16px;height:16px;border-radius:50%;background:#1A73E8;border:3px solid #fff;box-shadow:0 0 0 6px rgba(26,115,232,.25)"; meMarker = new AdvancedMarkerElement({ map, position: me, content: d, title: "אני", zIndex: 1000 }); }
    else meMarker.position = me;
  }, () => {}, { enableHighAccuracy: true, maximumAge: 15000 });
}
function getMe() {
  return new Promise(res => {
    if (me) return res(me);
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(p => { me = { lat: p.coords.latitude, lng: p.coords.longitude }; res(me); }, () => res(null), { enableHighAccuracy: true, timeout: 8000 });
  });
}

// ---------- רשימת מקומות ----------
let placeFilter = "all", placeQ = "";
function renderPlaces() {
  const el = $("#view-places");
  const F = [["all","הכל"],["sights",T.layers.sights.name],["food",T.layers.food.name],["shop",T.layers.shop.name],["must","חובה"],["maybe","אולי"],["visited","ביקרנו"],["open","🟢 פתוח עכשיו"]];
  if (placeFilter === "open") fillHours(renderPlaces);
  const match = p => p.layer !== "hotel" && (placeFilter === "open" ? statusOf(p) !== "skip" && openNow(p) === true : placeFilter === "all" ? statusOf(p) !== "skip" : ["must","maybe","visited"].includes(placeFilter) ? statusOf(p) === placeFilter : layerOf(p) === placeFilter);
  const ql = placeQ.trim().toLowerCase();
  const list = T.places.filter(p => ql ? p.layer !== "hotel" && (p.he + " " + p.name + " " + (p.why || "")).toLowerCase().includes(ql) : match(p)).sort((a, b) => hav(HOTEL, a) - hav(HOTEL, b));
  el.innerHTML = `<input id="placeQ" class="search" type="search" placeholder="🔎 חיפוש מקום לפי שם…" value="${esc(placeQ)}"><div class="filters">${F.map(([k, n]) => `<button data-f="${k}" class="${k === placeFilter ? "on" : ""}">${esc(n)}</button>`).join("")}</div>
    <div class="plist">${list.map(p => card(p, hav(HOTEL, loc(p)), "מהמלון")).join("") || `<p class="muted">${placeFilter === "open" ? "בודק שעות פתיחה בגוגל… (צריך חיבור לאינטרנט)" : "אין כאן עדיין מקומות."}</p>`}</div>`;
  el.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { placeFilter = b.dataset.f; renderPlaces(); });
  const pq = $("#placeQ"); pq.oninput = () => { placeQ = pq.value; renderPlaces(); const n = $("#placeQ"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
}
function card(p, dist, from) {
  const c = info(p.id), st = statusOf(p);
  return `<button class="ti-card" data-place="${p.id}"><span class="dot" style="background:${colorOf(p)}"></span>
    <span class="tx"><span class="nm">${esc(p.he)}</span><span class="sb">${esc(p.name)}${dist != null ? " · " + fmtDist(dist) + " " + from : ""}${c && c.rating ? " · ★ " + c.rating : ""}</span>
    <span class="tags"><span class="pill">${STATUS[st]}</span>${(p.tags||[]).slice(0,3).map(t => `<span class="pill">${TAGS[t]}</span>`).join("")}</span></span>
    ${c && c.photo ? `<img class="thumb" src="${esc(c.photo)}" alt="" loading="lazy">` : ""}</button>`;
}

// ---------- מסמכים, הזמנות, חירום ----------
function renderDocs() {
  const el = $("#view-docs");
  const shopping = store.get("shopping", "");
  const remList = Object.entries(removed), skipped = T.places.filter(p => !p.mine && statusOv[p.id] === "skip");
  const nChanges = remList.length + skipped.length + ideas.length + myNoteKeys().length;
  el.innerHTML = `
    <div class="tools">
      <button class="tool" data-tool="prep"><span>✈️</span>הכנה לטיסה</button>
      <button class="tool" data-tool="ics"><span>📅</span>ללוח השנה</button>
      <button class="tool" data-tool="exp"><span>💰</span>הוצאות</button>
      <button class="tool" data-tool="pack"><span>🎒</span>אריזה</button>
      <button class="tool" data-tool="vault"><span>🔒</span>מסמכים פרטיים</button>
      <button class="tool" data-tool="done"><span>🗺</span>מה שעשינו</button>
      <button class="tool" data-tool="sum"><span>🌙</span>סיכומי הימים</button>
    </div>
    <div class="doc syncbox"><div class="row nowrap" style="justify-content:space-between"><span><b>🔄 סנכרון:</b> ${ghToken ? "מחובר" : "לא מחובר במכשיר הזה"}${planDirty ? " · יש שינויים שממתינים" : ""}</span><button class="btn ghost sm" id="syncSet">${ghToken ? "הגדרות" : "חיבור"}</button></div></div>
    <div class="row" style="margin-top:8px"><button class="btn" id="openBoard2">🗂 לוח התכנון (גרירה בין ימים)</button></div>
    <h3 class="sec-title">📝 השינויים שלי לעדכון הבא${nChanges ? ` <span class="pill book">${nChanges}</span>` : ""}</h3>
    <div class="doc changes">
      ${nChanges ? "" : `<div>עוד אין שינויים. בתוכנית היומית לוחצים ✕ ליד מה שלא רוצים, ובכפתור "➕ הוספת המלצה" מוסיפים מקום חדש.</div>`}
      ${remList.map(([k, r]) => `<div class="chg"><span>✕ ${esc(r.time)} ${esc(r.text)}</span><button class="btn ghost sm" data-unrm="${esc(k)}">ביטול</button></div>`).join("")}
      ${skipped.map(p => `<div class="chg"><span>✕ ויתרנו: ${esc(p.he)}</span><button class="btn ghost sm" data-unskip="${p.id}">ביטול</button></div>`).join("")}
      ${myNoteKeys().length ? `<div class="chg"><span>📝 ${myNoteKeys().length} הערות שכתבת (יישלחו יחד עם השינויים)</span></div>` : ""}
      ${ideas.map(x => `<div class="chg"><span>➕ ${esc(x.place ? x.place.name : (x.text || "צילום מסך"))}${x.day != null ? ` · יום ${x.day + 1}` : ""}${x.note ? ` · ${esc(x.note)}` : ""}${x.imgs ? ` · 📷 ${x.imgs}` : ""}</span><button class="btn ghost sm" data-delidea="${x.id}">מחיקה</button></div>`).join("")}
      <div class="row" style="margin-top:10px"><button class="btn acc" id="sendChg" ${nChanges ? "" : "disabled"}>📤 שליחה ל-Claude</button><button class="btn ghost" id="addIdea">➕ הוספת המלצה</button></div>
      <div class="muted small" style="margin-top:6px">ב"שליחה" נפתח חלון שיתוף. בוחרים בו את Claude (או מעתיקים), וכל השינויים עוברים יחד עם צילומי המסך.</div>
    </div>
    <h3 class="sec-title">טיסות ומלון</h3>
    <div class="docs">${T.docs.map(d => `<div class="doc"><h3>${d.kind === "flight" ? "✈️" : "🏨"} ${esc(d.title)}</h3>${d.lines.map(l => `<div>${esc(l)}</div>`).join("")}${d.place ? `<div class="row" style="margin-top:8px"><a class="btn ghost" href="${gmapsDir(P[d.place])}" target="_blank" rel="noopener">ניווט למלון</a></div>` : ""}</div>`).join("")}
      ${(T.top12 || []).length ? `<div class="doc"><h3>📍 12 המקומות שאסור לפספס</h3><div class="muted small">מהמפה של Budapest Spotz. ליד כל מקום רשום באיזה יום הוא בתכנית.</div>
        <div class="list" style="margin-top:8px">${T.top12.map((x, i) => { const di = T.days.findIndex(d => d.items.some(it => it.place === x.id || (x.also || []).includes(it.place))); const p = P[x.id];
          return `<button class="ti-card" ${p ? `data-place="${p.id}"` : "disabled"}><b>${i + 1}.</b> ${esc(x.he)} <span class="pill ${di >= 0 ? "ok" : (x.note ? "warn" : "")}">${di >= 0 ? "יום " + (di + 1) + " · " + dayLabel(T.days[di]) : (x.note || "לא בתכנית")}</span></button>`; }).join("")}</div></div>` : ""}
      <div class="doc"><h3>🔒 מסמכים פרטיים</h3><div>דרכונים, אישורי הזמנה ומספרי הזמנה, מוצפנים בסיסמה ושמורים רק בטלפון הזה.</div><div class="row" style="margin-top:8px"><button class="btn" id="vaultBtn2">פתיחה</button></div></div>
    </div>
    <div class="doc"><div>🎫 כל ההזמנות, הביטולים וההערות נמצאים עכשיו ב"תכנית החופשה", בכפתור 🎫 ליד כל פריט.</div></div>
    <details class="inbox" ${store.get("inboxOpen", false) ? "open" : ""}><summary class="sec-title">המלצות מהקבוצה <span class="muted small">(${(T.inbox||[]).filter(x => !hiddenInbox[x.title]).length})</span></summary>
    <p class="muted small">✕ מסתיר המלצה שכבר טופלה. ↺ בתחתית מחזיר את כולן.</p>
    <div class="book-list">${(T.inbox||[]).filter(x => !hiddenInbox[x.title]).map(x => `<div class="book"><div class="bt"><span>${esc(x.title)}</span><span class="row nowrap"><span class="pill ${({yes:"ok",no:"book",pending:"warn",partial:"warn"})[x.verdict]||""}">${({yes:"נכנס",no:"לא מתאים",replaced:"הוחלף",partial:"חלקי",pending:"ממתין"})[x.verdict]}</span><button class="rm" data-hideinbox="${esc(x.title)}" aria-label="הסתרה">✕</button></span></div><p>${esc(x.note)}</p>${noteHtml("ib:" + x.title)}<button class="btn ghost sm" data-inote="${esc(x.title)}">📝 ${notes["ib:" + x.title] ? "עריכת הערה" : "הערה"}</button></div>`).join("")}</div>
    ${Object.keys(hiddenInbox).length ? `<button class="btn ghost sm" id="unhideInbox" style="margin-top:8px">↺ להחזיר ${Object.keys(hiddenInbox).length} המלצות מוסתרות</button>` : ""}
    </details>
    <h3 class="sec-title">חירום</h3>
    <div class="docs">${T.emergency.map(x => `<div class="doc"><h3>${esc(x.label)}</h3><div class="row">${x.q ? `<a class="btn ghost" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(x.q)}" target="_blank" rel="noopener">פתח בגוגל מפס</a>` : `<span class="copyable">${esc(x.value)}</span>`}</div></div>`).join("")}</div>
    <h3 class="sec-title">רשימת קניות ומתנות</h3>
    <textarea id="shopping" rows="5" style="width:100%;font:inherit;padding:10px;border-radius:12px;border:1px solid var(--line);background:var(--surface);color:var(--fg)" placeholder="למשל: פפריקה מעושנת לאמא · יין טוקאי · ...">${esc(shopping)}</textarea>
    <h3 class="sec-title">הטיפים של הטיול</h3>
    <div class="tips">${T.tips.map(t => `<div class="tip"><b>${esc(t.t)}</b>${esc(t.d)}</div>`).join("")}</div>
    <h3 class="sec-title">גוגל מפס</h3>
    <div class="doc"><h3>⭐ שמירה לרשימה "בודפשט 2026" בגוגל מפס</h3><div>גוגל לא מאפשרת לאפליקציה אחרת להוסיף מקומות לרשימה שלך, אז עוברים על המקומות אחד-אחד: לוחצים, גוגל מפס נפתח על המקום, לוחצים "שמירה" ובוחרים "בודפשט 2026", וחוזרים. האפליקציה זוכרת מה כבר נשמר.</div>
      <div class="row" style="margin-top:8px"><button class="btn acc" id="gmList">פתיחת רשימת השמירה</button></div></div>
    <div class="doc"><div>מוריד קובץ עם כל המקומות לפי שכבות. מייבאים אותו פעם אחת ל-Google My Maps, ואז כל השכבות מופיעות גם באפליקציית גוגל מפס, תחת "שמורים" ← "מפות".</div>
      <div class="row" style="margin-top:8px"><button class="btn" id="kmlAll">ייצוא כל המקומות</button><button class="btn ghost" id="kmlVisited">ייצוא "ביקרנו"</button><a class="btn ghost" href="https://www.google.com/maps/d/" target="_blank" rel="noopener">פתח את My Maps</a></div></div>
    <div class="row" style="margin-top:14px"><button class="btn ghost" id="diag2">🔧 בדיקת חיבור לגוגל</button></div>
    <p class="muted small" style="margin:18px 0">גרסה 30 · נתונים מגוגל מתעדכנים אוטומטית · הסימונים נשמרים במכשיר הזה</p>`;
  el.querySelectorAll("[data-unrm]").forEach(b => b.onclick = () => { delete removed[b.dataset.unrm]; store.set("removed", removed); renderDocs(); });
  el.querySelectorAll("[data-unskip]").forEach(b => b.onclick = () => { delete statusOv[b.dataset.unskip]; store.set("status", statusOv); renderDocs(); });
  el.querySelectorAll("[data-delidea]").forEach(b => b.onclick = () => deleteIdea(b.dataset.delidea));
  el.querySelectorAll("[data-inote]").forEach(b => b.onclick = () => editNote("ib:" + b.dataset.inote, b.dataset.inote, renderDocs));
  el.querySelectorAll("[data-hideinbox]").forEach(b => b.onclick = () => { hiddenInbox[b.dataset.hideinbox] = 1; store.set("hiddenInbox", hiddenInbox); renderDocs(); });
  const uh = $("#unhideInbox"); if (uh) uh.onclick = () => { hiddenInbox = {}; store.set("hiddenInbox", hiddenInbox); renderDocs(); };
  const ib = el.querySelector("details.inbox"); if (ib) ib.ontoggle = () => store.set("inboxOpen", ib.open);
  $("#syncSet").onclick = openSyncSettings; $("#openBoard2").onclick = openBoard;
  $("#diag2").onclick = diagnose; $("#sendChg").onclick = sendChanges; $("#addIdea").onclick = () => openAdd(null);
  $("#shopping").oninput = e => store.set("shopping", e.target.value);
  $("#gmList").onclick = openGmList;
  $("#vaultBtn2").onclick = openVault;
  el.querySelectorAll("[data-tool]").forEach(b => b.onclick = () => ({ prep: prepOffline, ics: exportIcs, exp: openExpenses, pack: openPacking, sum: () => openSheet(`<h2>🌙 סיכומי הימים</h2><div class="list">${T.days.map((d, i) => `<button class="ti-card" data-sumd="${i}"><span class="tx"><span class="nm">יום ${i + 1} · ${esc(dayLabel(d))}</span><span class="sb">${esc(d.title)}</span></span></button>`).join("")}</div>`) || $("#sheet").querySelectorAll("[data-sumd]").forEach(x => x.onclick = () => openDaySummary(+x.dataset.sumd)), vault: openVault, done: () => { mapLayer = "visited"; go("map"); toast("כל המקומות שסימנתם \"ביקרנו\". מכאן אפשר גם לייצא ל-My Maps") } })[b.dataset.tool]());
  $("#kmlAll").onclick = () => kml(T.places.filter(p => statusOf(p) !== "skip"), "budapest-all");
  $("#kmlVisited").onclick = () => { const v = T.places.filter(p => statusOf(p) === "visited"); if (!v.length) return toast("עוד לא סימנתם מקומות כ\"ביקרנו\""); kml(v, "budapest-visited"); };
}
let gmSaved = store.get("gmSaved", {});
function openGmList() {
  const order = [], seen = new Set();
  T.days.forEach(d => d.items.forEach(it => { if (it.place && !seen.has(it.place) && P[it.place] && P[it.place].layer !== "hotel" && !P[it.place].id.startsWith("bus27")) { seen.add(it.place); order.push(P[it.place]); } }));
  const rest = T.places.filter(p => !seen.has(p.id) && p.layer !== "hotel" && !p.id.startsWith("bus27") && statusOf(p) !== "skip");
  const all = [HOTEL, ...order, ...rest];
  const done = () => all.filter(p => gmSaved[p.id]).length;
  const row = p => `<div class="gmrow ${gmSaved[p.id] ? "ok" : ""}" data-gm="${p.id}"><a class="btn ${gmSaved[p.id] ? "ghost" : ""} sm" href="${gmapsPlace(p)}" target="_blank" rel="noopener" data-gmopen="${p.id}">פתיחה ↗</a><span class="tx">${esc(p.he)}<small>${esc(p.name)}</small></span><label><input type="checkbox" data-gmchk="${p.id}" ${gmSaved[p.id] ? "checked" : ""}> נשמר</label></div>`;
  openSheet(`<h2>⭐ שמירה ל"בודפשט 2026"</h2>
    <p class="small">בכל מקום: <b>פתיחה ↗</b> ← בגוגל מפס לוחצים <b>שמירה</b> ← בוחרים <b>בודפשט 2026</b> ← חוזרים לכאן. המקום מסומן "נשמר" אוטומטית.</p>
    <p class="small"><b id="gmCount">${done()}</b> מתוך ${all.length} נשמרו · קודם המקומות שבתוכנית, אחר כך כל השאר</p>
    <div class="list">${all.map(row).join("")}</div>`);
  const sh = $("#sheet");
  const mark = (id, v) => { if (v) gmSaved[id] = 1; else delete gmSaved[id]; store.set("gmSaved", gmSaved); const r = sh.querySelector(`[data-gm="${id}"]`); if (r) { r.classList.toggle("ok", !!v); r.querySelector("input").checked = !!v; } const c = $("#gmCount"); if (c) c.textContent = done(); };
  sh.querySelectorAll("[data-gmopen]").forEach(a => a.addEventListener("click", () => setTimeout(() => mark(a.dataset.gmopen, true), 400)));
  sh.querySelectorAll("[data-gmchk]").forEach(c => c.onchange = () => mark(c.dataset.gmchk, c.checked));
  all.forEach(p => { if (!info(p.id)) resolve(p).then(() => { const a = sh.querySelector(`[data-gmopen="${p.id}"]`); if (a) a.href = gmapsPlace(p); }); });
}
function kml(list, name) {
  const groups = {};
  list.forEach(p => { const L = p.layer === "hotel" ? "המלון" : (T.layers[layerOf(p)] || {}).name || "אחר"; (groups[L] ||= []).push(p); });
  const x = s => esc(s);
  const body = Object.entries(groups).map(([g, ps]) => `<Folder><name>${x(g)}</name>${ps.map(p => { const l = loc(p); return `<Placemark><name>${x(p.he + " · " + p.name)}</name><description>${x(p.why)}</description><Point><coordinates>${l.lng},${l.lat},0</coordinates></Point></Placemark>`; }).join("")}</Folder>`).join("");
  const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${x(T.title)}</name>${body}</Document></kml>`], { type: "application/vnd.google-earth.kml+xml" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name + ".kml"; document.body.appendChild(a); a.click(); a.remove();
  toast("הקובץ ירד. ב-My Maps: יצירת מפה חדשה ← ייבוא.");
}

// ---------- כפתורים מהירים ----------
const QUICK = [
  ["hungry", "🍽 רעבים"], ["drink", "🍷 משהו לשתות"], ["romantic", "❤️ משהו רומנטי"], ["rain", "☔ יורד גשם"],
  ["tired", "😮‍💨 עייפים"], ["hour", "⏳ שעה פנויה"], ["home", "🏨 הכי מהר למלון"]
];
QUICK.unshift(["add", "➕ הוספת המלצה"]); QUICK.unshift(["exp", "💰 הוצאה"]);
$("#quick").innerHTML = QUICK.map(([k, n]) => `<button data-q="${k}">${n}</button>`).join("");
$("#quick").addEventListener("click", e => { const b = e.target.closest("[data-q]"); if (b) quick(b.dataset.q); });
async function quick(k) {
  if (k === "add") return openAdd(null);
  if (k === "exp") return openExpense();
  openSheet(`<h2>${QUICK.find(q => q[0] === k)[1]}</h2><p class="muted">מאתר אתכם…</p>`);
  const here = await getMe(); const origin = here || loc(HOTEL);
  const note = here ? "" : `<p class="muted small">לא קיבלתי מיקום, אז המרחקים מחושבים מהמלון. אפשר לאשר מיקום בהגדרות הדפדפן.</p>`;
  if (k === "home") return quickHome(origin, note);
  const rule = {
    hungry: p => p.layer === "food" && !(p.tags||[]).includes("drink") || p.id === "market-hall",
    drink: p => (p.tags||[]).includes("drink"),
    romantic: p => (p.tags||[]).includes("romantic"),
    rain: p => (p.tags||[]).includes("indoor"),
    tired: p => (p.tags||[]).some(t => t === "sweet" || t === "rest"),
    hour: p => p.layer !== "hotel" && hav(origin, loc(p)) < 1300 && statusOf(p) !== "visited"
  }[k];
  const ours = T.places.filter(p => p.layer !== "hotel" && statusOf(p) !== "skip" && rule(p)).map(p => [p, hav(origin, loc(p))]).sort((a, b) => a[1] - b[1]).slice(0, 6);
  const title = QUICK.find(q => q[0] === k)[1];
  const nearbyType = { hungry: ["restaurant"], drink: ["bar","wine_bar","cocktail_bar"], tired: ["cafe","coffee_shop"], rain: ["cafe","shopping_mall"], romantic: ["wine_bar","fine_dining_restaurant"], hour: ["tourist_attraction"] }[k];
  const draw = (g) => openSheet(`<h2>${title}</h2>${note}
    ${k === "tired" ? `<div class="row" style="margin:8px 0"><button class="btn acc" id="goHome">🏨 הכי מהר למלון</button></div>` : ""}
    ${k === "hungry" || k === "drink" || k === "romantic" ? `<div class="row" style="margin:8px 0"><button class="btn ghost" id="qSay">🗣 מה לומר למלצר</button></div>` : ""}
    <h3 class="sec-title" style="margin-top:8px">מהרשימה שלנו</h3><div class="list">${ours.map(([p, d]) => card(p, d, "מכם")).join("") || `<p class="muted">אין משהו מהרשימה בקרבת מקום.</p>`}</div>
    <h3 class="sec-title">עוד בסביבה, לפי גוגל</h3><div class="list" id="gNear">${g == null ? `<p class="muted">מחפש…</p>` : g}</div>
    <p class="muted small" style="margin-top:10px">במקומות של גוגל צריך לבדוק בעצמכם התאמה למגבלות האוכל.</p>`);
  draw(null);
  if (k === "tired") $("#goHome").onclick = () => quick("home");
  const qs = $("#qSay"); if (qs) qs.onclick = () => openSay(T.defaultSay, "");
  try {
    const gg = await loadGoogle(); const { Place } = gg.maps.places;
    const r = await Place.searchNearby({ fields: ["id","displayName","location","rating","userRatingCount","googleMapsURI","primaryTypeDisplayName"], locationRestriction: { center: origin, radius: 700 }, includedPrimaryTypes: nearbyType, maxResultCount: 12, rankPreference: "POPULARITY", language: "he" });
    const ourGids = new Set(Object.values(infoCache).map(c => c.gid));
    const res = (r.places || []).filter(x => (x.rating || 0) >= 4.4 && (x.userRatingCount || 0) >= 150 && !ourGids.has(x.id)).slice(0, 6);
    const html = res.map(x => { const d = hav(origin, { lat: x.location.lat(), lng: x.location.lng() });
      return `<a class="ti-card" href="https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=${x.location.lat()},${x.location.lng()}&destination_place_id=${x.id}" target="_blank" rel="noopener"><span class="dot" style="background:var(--muted)"></span><span class="tx"><span class="nm">${esc(x.displayName)}</span><span class="sb">${esc(x.primaryTypeDisplayName || "")} · ★ ${x.rating} (${x.userRatingCount}) · ${fmtDist(d)} מכם</span></span><span class="pill">ניווט ↗</span></a>`; }).join("");
    const box = $("#gNear"); if (box) box.innerHTML = html || `<p class="muted">לא מצאתי מקומות עם דירוג גבוה ממש קרוב.</p>`;
  } catch (e) { const box = $("#gNear"); if (box) box.innerHTML = `<p class="muted">החיפוש בגוגל לא זמין כרגע.</p>`; console.warn(e); }
}
async function quickHome(origin, note) {
  const fake = { id: "__me", lat: origin.lat, lng: origin.lng };
  const call = async mode => { try {
    const r = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", { method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": C.mapsKey, "X-Goog-FieldMask": "routes.duration,routes.distanceMeters" },
      body: JSON.stringify({ origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } }, destination: { location: { latLng: { latitude: loc(HOTEL).lat, longitude: loc(HOTEL).lng } } }, travelMode: mode }) });
    const j = await r.json(); return j.routes && j.routes[0] ? parseInt(j.routes[0].duration) : null; } catch { return null; } };
  const [w, t, d] = await Promise.all([call("WALK"), call("TRANSIT"), call("DRIVE")]);
  const best = [["walking", "🚶 ברגל", w], ["transit", "🚇 תחבורה ציבורית", t], ["driving", "🚕 מונית או Bolt", d]].filter(x => x[2] != null).sort((a, b) => a[2] - b[2]);
  openSheet(`<h2>🏨 הכי מהר למלון</h2>${note}<div class="list">${best.map(([m, n, s], i) => `<a class="ti-card ${i === 0 ? "anchor" : ""}" href="${gmapsDir(HOTEL, m)}" target="_blank" rel="noopener"><span class="tx"><span class="nm">${n}</span><span class="sb">${fmtMin(s)}${i === 0 ? " · הכי מהיר" : ""}</span></span><span class="pill">ניווט ↗</span></a>`).join("") || `<p class="muted">לא הצלחתי לחשב. <a href="${gmapsDir(HOTEL)}" target="_blank" rel="noopener">פתח בגוגל מפס</a></p>`}</div>
    <div class="doc" style="margin-top:12px"><h3>להראות לנהג</h3><span class="copyable">Dessewffy utca 14, 1066 Budapest</span></div>`);
}

// ---------- הוספת המלצה ----------
const LAYER_OF_TYPE = t => /restaurant|cafe|coffee|bar|bakery|food|meal|ice_cream|dessert|pub|wine/.test(t || "") ? "food" : /store|shop|mall|market|clothing|shoe/.test(t || "") ? "shop" : "sights";
function openAdd(dayIdx) {
  let picked = null, imgs = [];
  openSheet(`<h2>➕ הוספת המלצה</h2>
    <p class="muted small">מדביקים קישור או כותבים שם של מקום, ואפשר לצרף צילום מסך. אם בוחרים מקום מגוגל, הוא מופיע מיד במפה (בשכבת "אולי"), ואם בוחרים יום, גם בתוכנית של אותו יום. Claude יבדוק אותו וישלב אותו בעדכון הבא.</p>
    <div class="form">
      <label for="addQ">שם המקום או קישור</label>
      <div class="row nowrap"><input id="addQ" type="text" placeholder="למשל: Gelato Rosa, או קישור מגוגל מפס / טיקטוק / פייסבוק" autocomplete="off"><button class="btn" id="addFind" type="button">חיפוש</button></div>
      <div id="addRes" class="list"></div>
      <label for="addNote">מה שמעניין בזה (לא חובה)</label>
      <textarea id="addNote" rows="2" placeholder="למשל: ראינו ברילס, מומלץ לשקיעה"></textarea>
      <label for="addImg">צילומי מסך (לא חובה)</label>
      <input id="addImg" type="file" accept="image/*" multiple>
      <div id="addThumbs" class="thumbs"></div>
      <div class="row">
        <label for="addDay" class="inl">לשבץ ביום</label>
        <select id="addDay"><option value="">בלי שיבוץ, רק להוסיף</option>${T.days.map((d, i) => `<option value="${i}" ${i === dayIdx ? "selected" : ""}>יום ${i + 1} · ${dayLabel(d)}</option>`).join("")}</select>
      </div>
      <div class="row">
        <label for="addLayer" class="inl">שכבה</label>
        <select id="addLayer">${["sights","food","shop"].map(k => `<option value="${k}">${esc(T.layers[k].name)}</option>`).join("")}</select>
      </div>
      <button class="btn acc" id="addSave" type="button">שמירה</button>
    </div>`);
  const q = $("#addQ"), res = $("#addRes");
  const find = async () => {
    let text = q.value.trim(); if (!text) return toast("כתוב שם מקום או הדבק קישור");
    const isUrl = /^https?:\/\//i.test(text);
    if (isUrl) { const m = text.match(/\/maps\/place\/([^/@?]+)/); if (m) text = decodeURIComponent(m[1].replace(/\+/g, " "));
      else { res.innerHTML = `<p class="muted small">את הקישור הזה אי אפשר לפתוח מכאן (טיקטוק, פייסבוק או קישור מקוצר). אפשר לשמור אותו כמו שהוא, עם צילום מסך, ו-Claude יזהה את המקום. אם אתה יודע את שם המקום, כתוב אותו כאן במקום הקישור כדי שיופיע במפה.</p>`; return; } }
    res.innerHTML = `<p class="muted">מחפש בגוגל…</p>`;
    try { const g = await loadGoogle(); const { Place } = g.maps.places;
      const r = await Place.searchByText({ textQuery: text, fields: ["id","displayName","location","formattedAddress","rating","primaryType","primaryTypeDisplayName"], maxResultCount: 5, locationBias: { center: T.center, radius: 20000 }, language: "he" });
      const list = r.places || [];
      res.innerHTML = list.map((x, i) => `<button class="ti-card pick" data-i="${i}" type="button"><span class="tx"><span class="nm">${esc(x.displayName)}</span><span class="sb">${esc(x.primaryTypeDisplayName || "")}${x.rating ? " · ★ " + x.rating : ""} · ${esc(x.formattedAddress || "")}</span></span></button>`).join("") || `<p class="muted">לא נמצא. אפשר לשמור בכל זאת, עם קישור או צילום.</p>`;
      res.querySelectorAll(".pick").forEach(b => b.onclick = () => { const x = list[+b.dataset.i];
        picked = { name: x.displayName, gid: x.id, lat: x.location.lat(), lng: x.location.lng(), addr: x.formattedAddress || "" };
        res.querySelectorAll(".pick").forEach(o => o.classList.toggle("anchor", o === b));
        $("#addLayer").value = LAYER_OF_TYPE(x.primaryType); });
    } catch (e) { res.innerHTML = `<p class="muted">החיפוש בגוגל לא זמין כרגע. אפשר לשמור בכל זאת.</p>`; }
  };
  $("#addFind").onclick = find; q.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); find(); } });
  $("#addImg").onchange = async e => { for (const f of e.target.files) { const d = await shrink(f); if (d) imgs.push(d); }
    $("#addThumbs").innerHTML = imgs.map(d => `<img src="${d}" alt="">`).join(""); };
  $("#addSave").onclick = async () => {
    const raw = q.value.trim(), note = $("#addNote").value.trim();
    if (!raw && !imgs.length && !note) return toast("אין מה לשמור עדיין");
    const id = Date.now().toString(36);
    const dv = $("#addDay").value;
    const x = { id, text: raw, note, day: dv === "" ? null : +dv, layer: $("#addLayer").value, place: picked, imgs: imgs.length, at: new Date().toISOString() };
    for (let i = 0; i < imgs.length; i++) await idb.put(id + ":" + i, imgs[i]);
    ideas.push(x); store.set("ideas", ideas); applyIdeas(); closeSheet();
    toast(picked ? "נוסף למפה" + (x.day != null ? " ולתוכנית של יום " + (x.day + 1) : "") + ". ייבדק בעדכון הבא" : "נשמר. ייבדק בעדכון הבא");
    render();
  };
  setTimeout(() => q.focus(), 50);
}
async function deleteIdea(id) {
  const x = ideas.find(i => i.id === id); if (!x) return;
  for (let i = 0; i < (x.imgs || 0); i++) idb.del(id + ":" + i);
  ideas = ideas.filter(i => i.id !== id); store.set("ideas", ideas); applyIdeas(); toast("ההצעה נמחקה"); render();
}
function changesText() {
  const L = [`עדכון לאפליקציית ${T.title} (${new Date().toLocaleDateString("he-IL")})`];
  const rem = Object.values(removed);
  if (rem.length) { L.push("", "להסיר מהתוכנית:"); rem.forEach(r => { const di = T.days.findIndex(d => d.date === r.date); L.push(`- יום ${di + 1} ${r.time}: ${r.text}`); }); }
  const skipped = T.places.filter(p => !p.mine && statusOv[p.id] === "skip");
  if (skipped.length) { L.push("", "ויתרנו על המקומות (להוריד):"); skipped.forEach(p => L.push(`- ${p.he} (${p.name})`)); }
  const st = T.places.filter(p => !p.mine && statusOv[p.id] && statusOv[p.id] !== "skip" && statusOv[p.id] !== p.status);
  if (st.length) { L.push("", "שינויי סימון:"); st.forEach(p => L.push(`- ${p.he}: ${STATUS[statusOv[p.id]]}`)); }
  if (ideas.length) { L.push("", "המלצות חדשות לשלב:"); ideas.forEach(x => {
    L.push(`- [#${x.id}] ${x.place ? x.place.name + (x.place.addr ? " · " + x.place.addr : "") : (x.text || "(צילום מסך)")}`);
    if (x.text && (!x.place || x.text !== x.place.name)) L.push(`  קישור/טקסט: ${x.text}`);
    if (x.note) L.push(`  הערה: ${x.note}`);
    if (x.day != null) L.push(`  לשבץ ביום ${x.day + 1}`);
    if (x.imgs) L.push(`  מצורפים ${x.imgs} צילומי מסך`); }); }
  const nk = myNoteKeys();
  if (nk.length) { L.push("", "ההערות שלי:"); nk.forEach(k => { const [t, ...r] = k.split(":"); const id = r.join(":");
    const label = t === "pl" ? (P[id] ? P[id].he : id) : t === "bk" ? ((T.bookings.find(b => b.id === id) || {}).title || id) : t === "it" ? id.replace("|", " · ") : id;
    L.push(`- ${label}: ${notes[k]}`); }); }
  return L.length > 1 ? L.join("\n") : "";
}
async function sendChanges() {
  const txt = changesText(); if (!txt) return toast("אין שינויים לשליחה");
  const files = []; for (const x of ideas) for (let i = 0; i < (x.imgs || 0); i++) { const d = await idb.get(x.id + ":" + i); if (d) files.push(dataToFile(d, `idea-${x.id}-${i + 1}.jpg`)); }
  try {
    if (navigator.share && (!files.length || (navigator.canShare && navigator.canShare({ files })))) { await navigator.share(files.length ? { text: txt, files } : { text: txt }); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(txt); toast(files.length ? "הטקסט הועתק. הדבק ב-Claude וצרף את צילומי המסך" : "הועתק. הדבק בצ'אט עם Claude", 4000); }
  catch { openSheet(`<h2>להעתקה</h2><textarea rows="12" style="width:100%">${esc(txt)}</textarea>`); }
}

// ---------- סנכרון עם GitHub ----------
const b64e = str => btoa(unescape(encodeURIComponent(str)));
const b64d = b => decodeURIComponent(escape(atob(b.replace(/\n/g, ""))));
const parsePlan = txt => JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
async function fetchRemote() {
  const h = { Accept: "application/vnd.github+json" }; if (ghToken) h.Authorization = "Bearer " + ghToken;
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${PLAN_PATH}?ref=main&t=${Date.now()}`, { headers: h, cache: "no-store" });
  if (!r.ok) throw new Error("GET " + r.status);
  const j = await r.json(); return { sha: j.sha, plan: parsePlan(b64d(j.content)) };
}
function applyShared(pl) {
  shared = pl; setDays(pl.days);
  notes = Object.assign({}, pl.notes || {}, planDirty ? store.get("notes", {}) : {}); store.set("notes", notes);
  statusOv = Object.assign({}, pl.status || {}, planDirty ? store.get("status", {}) : {}); store.set("status", statusOv);
  bookDone = Object.assign({}, pl.booked || {}, planDirty ? store.get("booked", {}) : {}); store.set("booked", bookDone);
  expenses = mergeExp(pl.expenses, expenses); store.set("exp", expenses);
}
let syncTimer = null, syncing = false;
function markShared(daysChanged) {
  const prev = store.get("plan", {}) || {};
  planDirty = true; store.set("plan", { ...shared, dirty: true, daysDirty: daysChanged || prev.daysDirty || false, baseRev: prev.dirty && prev.baseRev != null ? prev.baseRev : (shared.rev || 0) });
  if (ghToken) { clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 1200); }
}
async function syncNow(silent) {
  if (!ghToken) { if (!silent) toast("נשמר במכשיר הזה. כדי שיתעדכן בכל המכשירים, צריך לחבר סנכרון (במסך מסמכים)", 5000); return false; }
  if (syncing) return; syncing = true; setSyncBadge("⏳");
  try {
    const lp = store.get("plan", {}) || {};
    const { sha, plan: remote } = await fetchRemote();
    if (lp.daysDirty && (remote.rev || 0) > (lp.baseRev ?? 0)) toast("התוכנית עודכנה בינתיים במכשיר אחר, ולכן שינויי הלוח מהמכשיר הזה לא נשמרו. כדאי לפתוח את הלוח ולבצע אותם שוב", 7000);
    const merged = {
      rev: (remote.rev || 0) + 1, updated: new Date().toISOString(), by: navigator.userAgent.includes("iPad") ? "טאבלט" : "טלפון",
      days: (lp.daysDirty && (remote.rev || 0) <= (lp.baseRev ?? shared.rev ?? 0)) ? shared.days : remote.days,
      notes: Object.assign({}, remote.notes || {}, notes), status: Object.assign({}, remote.status || {}, statusOv), booked: Object.assign({}, remote.booked || {}, bookDone),
      expenses: mergeExp(remote.expenses, expenses)
    };
    const body = { message: "עדכון תוכנית מהאפליקציה (rev " + merged.rev + ")", content: b64e("// התוכנית היומית והמצב המשותף. האפליקציה כותבת לקובץ הזה ישירות כשלוחצים \"שמירה וסנכרון\".\nwindow.PLAN = " + JSON.stringify(merged, null, 1) + ";\n"), sha, branch: "main" };
    const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${PLAN_PATH}`, { method: "PUT", headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + ghToken, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.status === 409 || r.status === 422) { syncing = false; return syncNow(silent); }
    if (!r.ok) throw new Error("PUT " + r.status + " " + (await r.text()).slice(0, 120));
    planDirty = false; store.set("plan", { ...merged, dirty: false }); applyShared(merged);
    setSyncBadge("✓"); if (!silent) toast("נשמר ומסונכרן לכל המכשירים ✓");
    render(); return true;
  } catch (e) { console.warn(e); setSyncBadge("!"); toast("הסנכרון נכשל: " + e.message + ". השינויים שמורים במכשיר, ננסה שוב", 6000); return false; }
  finally { syncing = false; }
}
async function pullRemote() {
  try { const { plan } = await fetchRemote();
    if ((plan.rev || 0) > (shared.rev || 0)) { if (planDirty && ghToken) return syncNow(true); if (!planDirty) { applyShared(plan); store.set("plan", { ...plan, dirty: false }); renderHeader(); render(); toast("התוכנית עודכנה מהמכשיר השני ✓"); } }
    else if (planDirty && ghToken) syncNow(true);
    setSyncBadge(planDirty ? "•" : "✓");
  } catch (e) { setSyncBadge(planDirty ? "•" : ""); }
}
function setSyncBadge(t) { const b = $("#syncBadge"); if (b) b.textContent = t; }
function openSyncSettings() {
  openSheet(`<h2>🔄 סנכרון בין המכשירים</h2>
    <p class="small">כשהסנכרון מחובר, כל שינוי (גרירה בלוח התכנון, הערות, סימונים, "הוזמן") נשמר ב-GitHub ומופיע בכל המכשירים: בטאבלט, באייפון ובטלפון של אדווה. כדי לצפות בעדכונים לא צריך כלום. רק מכשיר שעורך צריך את המפתח.</p>
    <p class="small"><b>מצב:</b> ${ghToken ? "✅ מחובר במכשיר הזה" : "❌ לא מחובר במכשיר הזה"}${planDirty ? " · יש שינויים שעוד לא סונכרנו" : ""} · גרסה ${shared.rev || 0}</p>
    <div class="form"><label for="tokIn">מפתח GitHub (מתחיל ב-github_pat_)</label>
      <input id="tokIn" type="text" autocomplete="off" placeholder="github_pat_…" value="">
      <div class="row"><button class="btn acc" id="tokSave">חיבור ובדיקה</button>${ghToken ? `<button class="btn ghost" id="tokDel">ניתוק</button><button class="btn" id="syncNowBtn">סנכרון עכשיו</button>` : ""}</div></div>
    <p class="muted small">המפתח נשמר רק במכשיר הזה, ומתאים רק למאגר של האפליקציה.</p>`);
  $("#tokSave").onclick = async () => { const v = $("#tokIn").value.trim(); if (!v) return toast("הדבק את המפתח");
    try { const r = await fetch(`https://api.github.com/repos/${REPO}`, { headers: { Authorization: "Bearer " + v, Accept: "application/vnd.github+json" } }); const j = await r.json();
      if (!r.ok) throw new Error(j.message || r.status); if (!j.permissions || !j.permissions.push) throw new Error("למפתח אין הרשאת כתיבה (Contents: Read and write)");
      ghToken = v; store.set("ghToken", v); closeSheet(); toast("הסנכרון מחובר ✓"); if (planDirty) syncNow(); else pullRemote();
    } catch (e) { toast("המפתח לא עבד: " + e.message, 6000); } };
  const d = $("#tokDel"); if (d) d.onclick = () => { ghToken = ""; store.set("ghToken", ""); closeSheet(); toast("נותק"); };
  const sn = $("#syncNowBtn"); if (sn) sn.onclick = () => { closeSheet(); syncNow(); };
}

// ---------- לוח תכנון (גרירה בין ימים) ----------
let sortableReady = null;
const loadSortable = () => sortableReady ||= new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.2/Sortable.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
let draft = null, poolQ = "", poolLayer = "all";
const tmin = t => /^\d{1,2}:\d{2}$/.test(t || "") ? +t.split(":")[0] * 60 + +t.split(":")[1] : 9999;
async function openBoard() {
  draft = shared.days.map(d => ({ ...d, items: d.items.map(i => ({ ...i })) }));
  let bd = $("#board"); if (!bd) { bd = document.createElement("div"); bd.id = "board"; document.body.appendChild(bd); }
  bd.hidden = false; document.body.classList.add("board-open");
  drawBoard();
  try { await loadSortable(); bindSortables(); } catch { toast("לא הצלחתי לטעון את הגרירה. אפשר לערוך בלחיצה על פריט"); }
}
function drawBoard() {
  const bd = $("#board"), used = new Set(draft.flatMap(d => d.items.map(i => i.place)).filter(Boolean));
  const pool = T.places.filter(p => p.layer !== "hotel" && !p.mine && (poolLayer === "all" || (poolLayer === "unused" ? !used.has(p.id) : layerOf(p) === poolLayer)) && (!poolQ || (p.he + " " + p.name).toLowerCase().includes(poolQ.toLowerCase())));
  const card = (it, di, ii) => { const p = it.place && P[it.place]; return `<div class="bcard ${it.anchor ? "anchor" : ""}" data-d="${di}" data-i="${ii}"><span class="bt">${esc(it.time || "–")}</span><span class="bx">${esc(it.text)}${p ? `<small>${esc(p.he)}</small>` : ""}</span><span class="grip" aria-hidden="true">⋮⋮</span></div>`; };
  bd.innerHTML = `<div class="bhead"><b>🗂 לוח התכנון</b><span class="muted small">גוררים פריטים בין הימים, או גוררים מקום מהמאגר אל יום. לחיצה על פריט פותחת עריכה.</span>
      <span class="row nowrap"><button class="btn ghost" id="bCancel">ביטול</button><button class="btn acc" id="bSave">שמירה וסנכרון</button></span></div>
    <div class="bcols">
      ${draft.map((d, di) => `<section class="bcol"><header><b>יום ${di + 1}</b> · ${esc(dayLabel(d))}<div class="small muted">${esc(d.title)}</div>
        <div class="row nowrap"><button class="btn ghost sm" data-sortday="${di}">⏱ לפי שעה</button><button class="btn ghost sm" data-addfree="${di}">＋ פריט</button></div></header>
        <div class="blist" data-day="${di}">${d.items.map((it, ii) => card(it, di, ii)).join("")}</div></section>`).join("")}
      <section class="bcol pool"><header><b>מאגר המקומות</b>
        <input id="poolQ" type="search" placeholder="חיפוש…" value="${esc(poolQ)}">
        <select id="poolL"><option value="all">הכל</option><option value="unused" ${poolLayer === "unused" ? "selected" : ""}>לא משובצים</option>${["sights","food","shop","maybe"].map(k => `<option value="${k}" ${poolLayer === k ? "selected" : ""}>${esc(T.layers[k].name)}</option>`).join("")}</select></header>
        <div class="blist" data-pool="1">${pool.map(p => `<div class="bcard poolc" data-place="${p.id}"><span class="dot" style="background:${colorOf(p)}"></span><span class="bx">${esc(p.he)}<small>${used.has(p.id) ? "משובץ" : ""}</small></span><span class="grip">⋮⋮</span></div>`).join("")}</div></section>
    </div>`;
  $("#bCancel").onclick = closeBoard;
  $("#bSave").onclick = async () => { setDays(draft); markShared(true); closeBoard(); render(); if (ghToken) await syncNow(); else toast("נשמר במכשיר הזה. לחיבור סנכרון לכל המכשירים: מסמכים ← סנכרון", 5000); };
  $("#poolQ").oninput = e => { poolQ = e.target.value; drawBoard(); bindSortables(); const q = $("#poolQ"); q.focus(); q.setSelectionRange(q.value.length, q.value.length); };
  $("#poolL").onchange = e => { poolLayer = e.target.value; drawBoard(); bindSortables(); };
  bd.querySelectorAll("[data-sortday]").forEach(b => b.onclick = () => { const d = draft[+b.dataset.sortday]; d.items.sort((a, c) => tmin(a.time) - tmin(c.time)); drawBoard(); bindSortables(); });
  bd.querySelectorAll("[data-addfree]").forEach(b => b.onclick = () => { draft[+b.dataset.addfree].items.push({ time: "", text: "פריט חדש" }); editBoardItem(+b.dataset.addfree, draft[+b.dataset.addfree].items.length - 1); });
  bd.querySelectorAll(".bcard[data-d]").forEach(c => c.onclick = () => editBoardItem(+c.dataset.d, +c.dataset.i));
}
function bindSortables() {
  if (!window.Sortable) return;
  const rebuild = () => {
    const nd = draft.map(d => ({ ...d, items: [] }));
    document.querySelectorAll("#board .blist[data-day]").forEach(col => { const di = +col.dataset.day;
      col.querySelectorAll(".bcard").forEach(c => { if (c.dataset.place && !c.dataset.d) { const p = P[c.dataset.place]; nd[di].items.push({ time: "", text: p.he, place: p.id }); }
        else nd[di].items.push(draft[+c.dataset.d].items[+c.dataset.i]); }); });
    draft = nd; drawBoard(); bindSortables();
  };
  document.querySelectorAll("#board .blist[data-day]").forEach(col => Sortable.create(col, { group: "plan", animation: 150, delay: 120, delayOnTouchOnly: true, ghostClass: "bghost", onEnd: rebuild, onAdd: () => {} }));
  const pool = $("#board .blist[data-pool]"); if (pool) Sortable.create(pool, { group: { name: "plan", pull: "clone", put: false }, sort: false, delay: 120, delayOnTouchOnly: true });
}
function editBoardItem(di, ii) {
  const it = draft[di].items[ii];
  openSheet(`<h2>עריכת פריט</h2><div class="form">
    <label for="eT">שעה</label><input id="eT" type="time" value="${esc(/^\d{1,2}:\d{2}$/.test(it.time || "") ? it.time.padStart(5, "0") : "")}">
    <label for="eX">טקסט</label><textarea id="eX" rows="3">${esc(it.text)}</textarea>
    <label for="eD">יום</label><select id="eD">${draft.map((d, i) => `<option value="${i}" ${i === di ? "selected" : ""}>יום ${i + 1} · ${dayLabel(d)}</option>`).join("")}</select>
    <label class="inl"><input type="checkbox" id="eA" ${it.anchor ? "checked" : ""}> עוגן (התחייבות לשעה מסוימת)</label>
    <div class="row"><button class="btn acc" id="eOk">אישור</button><button class="btn ghost" id="eDel">🗑 מחיקה מהתוכנית</button></div></div>`);
  $("#eOk").onclick = () => { it.time = $("#eT").value || it.time; it.text = $("#eX").value.trim() || it.text; it.anchor = $("#eA").checked || undefined;
    const nd = +$("#eD").value; if (nd !== di) { draft[di].items.splice(ii, 1); draft[nd].items.push(it); draft[nd].items.sort((a, c) => tmin(a.time) - tmin(c.time)); }
    closeSheet(); drawBoard(); bindSortables(); };
  $("#eDel").onclick = () => { draft[di].items.splice(ii, 1); closeSheet(); drawBoard(); bindSortables(); };
}
function closeBoard() { const bd = $("#board"); if (bd) bd.hidden = true; document.body.classList.remove("board-open"); }

// ---------- זמן בבודפשט ----------
function budDate() { return new Date().toLocaleDateString("en-CA", { timeZone: T.tz }); }
function budMin() { const p = new Intl.DateTimeFormat("en-GB", { timeZone: T.tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date()); const g = t => +p.find(x => x.type === t).value; return (g("hour") % 24) * 60 + g("minute"); }
const tripLive = () => { const t = budDate(); return t >= T.days[0].date && t <= T.days[T.days.length - 1].date; };
let lastStats = null;

// ---------- כרטיס היום: תדריך, עוגנים, להזמין, טיפים ----------
function bringFor(d, w) {
  const ids = new Set(d.items.map(i => i.place).filter(Boolean)), books = new Set(d.items.map(i => i.book).filter(Boolean)), txt = d.items.map(i => i.text).join(" ");
  const b = [];
  if (d.items.some(i => i.kind === "flight")) b.push("🛂 דרכונים");
  if (books.has("car-rental")) b.push("🪪 רישיונות ודרכונים", "💳 כרטיס אשראי לפיקדון");
  if (ids.has("rudas") || ids.has("hotel-spa") || /בריכ/.test(txt)) b.push("🩱 בגד ים וכפכפים");
  if (ids.has("rudas")) b.push("🧺 מגבת ונרתיק עמיד למים");
  if (books.has("sunset-cruise")) b.push("💶 50€ במזומן לשיט");
  if (books.has("highnote") || books.has("special-dinner")) b.push("👔 לבוש מכובד לערב");
  if (w && w.rain >= 30) b.push("☂️ מטרייה");
  if (w && w.max <= 6) b.push("🧤 כובע, כפפות וצעיף");
  b.push("🔋 סוללה ניידת", "👟 נעליים נוחות");
  return [...new Set(b)];
}
function heroSheet(kind, d, w, evening, anchors, uniq) {
  if (kind === "anchors") return openSheet(`<h2>⏰ העוגנים של היום</h2><div class="list">${anchors.map(a => `<div class="ti-card"><b class="ti-t">${esc(a.time)}</b><span class="tx">${esc(a.text)}</span></div>`).join("")}</div>`);
  if (kind === "todo") { openSheet(`<h2>🎫 עוד להזמין</h2><div class="list">${uniq.map(b => `<button class="ti-card" data-bk2="${b.id}"><span class="tx"><span class="nm">${esc(b.title)}</span><span class="sb">${esc(b.when)}</span></span></button>`).join("")}</div>`);
    return $("#sheet").querySelectorAll("[data-bk2]").forEach(x => x.onclick = () => openBooking(x.dataset.bk2)); }
  if (kind === "tips") return openSheet(`<h2>💡 טיפים להיום</h2><div class="tips">${pickTips(d).filter(Boolean).map(t => `<div class="tip"><b>${esc(t.t)}</b>${esc(t.d)}</div>`).join("")}</div>`);
  const di = T.days.indexOf(d), next = T.days[di + 1];
  const placesToday = [...new Set(d.items.map(i => i.place).filter(Boolean))].map(id => P[id]).filter(p => p && p.layer !== "hotel");
  const visited = placesToday.filter(p => statusOf(p) === "visited").length;
  const st = lastStats && lastStats.day === day ? lastStats : null;
  const sum = evening ? `<div class="briefbox"><h3>🌙 היום שלכם</h3>
      <div class="bigstats"><div><b>${st ? fmtDist(st.walkM) : "–"}</b><span>הליכה לפי התכנית</span></div><div><b>${visited}/${placesToday.length}</b><span>מקומות שסימנתם "ביקרנו"</span></div></div>
      ${next ? `<p><b>מחר: ${esc(next.title)}.</b> ${esc((next.items.find(i => i.anchor) || next.items[0] || {}).time || "")} ${esc((next.items.find(i => i.anchor) || next.items[0] || {}).text || "")}</p>` : `<p>זה היה היום האחרון. טיסה טובה הביתה ❤️</p>`}
      ${next ? `<p class="muted small">לא לשכוח למחר: ${bringFor(next, wxFor(next.date)).slice(0, 5).join(" · ")}</p>` : ""}</div>` : "";
  openSheet(`<h2>${evening ? "🌙 סיכום היום" : "☀️ תדריך היום"}</h2>${sum}
    <div class="briefbox"><h3>🌤 מזג האוויר</h3><p>${w ? `${WXI(w.code)} ${w.min}°–${w.max}°, סיכוי לגשם ${w.rain}%, רוח ${w.wind} קמ"ש${w.sunset ? `, שקיעה ב-${w.sunset}` : ""}.` : ""} ${esc(wxAdvice(w, d))}</p></div>
    <div class="briefbox"><h3>🎒 לא לשכוח</h3><div class="row">${bringFor(d, w).map(x => `<span class="pill">${esc(x)}</span>`).join("")}</div></div>
    ${anchors.length ? `<div class="briefbox"><h3>⏰ עוגנים</h3>${anchors.map(a => `<div><b>${esc(a.time)}</b> ${esc(a.text)}</div>`).join("")}</div>` : ""}
    ${uniq.length ? `<div class="briefbox"><h3>🎫 עוד להזמין</h3>${uniq.map(b => `<div>${esc(b.title)}</div>`).join("")}</div>` : ""}`);
}

// ---------- מצב "עכשיו" ----------
async function drawNowBar(d, cur, nxt) {
  const box = $("#nowBar"); if (!box) return;
  const it = nxt >= 0 ? d.items[nxt] : null;
  if (!it) { box.innerHTML = cur >= 0 ? `<div class="nowbar"><span class="nb-k">עכשיו</span><span class="nb-t">${esc(d.items[cur].text)}</span></div>` : ""; return; }
  const mins = tmin(it.time) - budMin(), p = it.place && P[it.place];
  const inTxt = mins <= 0 ? "עכשיו" : mins < 60 ? `בעוד ${mins} דק'` : `בעוד ${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")} ש'`;
  box.innerHTML = `<div class="nowbar"><span class="nb-k">⏭ הבא בתור · ${inTxt}</span><span class="nb-t"><b>${esc(it.time)}</b> ${esc(it.text)}</span>
    <span class="nb-r"><span id="nbWalk"></span>${p ? `<button class="btn ghost sm" id="nbTaxi" aria-label="להראות לנהג">🚕</button>` : ""}${p ? `<a class="btn acc sm" href="${gmapsDir(p, hav(HOTEL, loc(p)) > 2500 ? "transit" : "walking")}" target="_blank" rel="noopener">↗ ניווט</a>` : ""}</span></div>`;
  if (!p) return;
  $("#nbTaxi").onclick = () => openTaxi(p);
  const from = me ? { id: "__me", lat: me.lat, lng: me.lng } : (cur >= 0 && d.items[cur].place ? P[d.items[cur].place] : null);
  if (!from || from.id === p.id) return;
  const A = from.id === "__me" ? from : loc(from), dist = hav(A, loc(p));
  const w = $("#nbWalk"); if (w) w.textContent = (dist > 2200 ? "🚇 " : "🚶 ") + (dist > 2200 ? "~" + fmtMin(dist / 6) : fmtMin(dist * 1.3 / 1.25)) + (me ? " ממך" : "");
}
setInterval(() => { if (view === "today" && T.days[day] && T.days[day].date === budDate()) renderToday(); }, 120000);

// ---------- המרה (פורינט / שקל / אירו) ----------
let fx = store.get("fx", null);
async function loadFx() {
  if (fx && Date.now() - fx.t < 12 * 3600e3) return fx;
  try { const j = await (await fetch("https://api.frankfurter.app/latest?from=EUR&to=HUF,ILS")).json(); if (j.rates && j.rates.HUF) { fx = { t: Date.now(), date: j.date, huf: j.rates.HUF, ils: j.rates.ILS }; store.set("fx", fx); } } catch {}
  return fx || { t: 0, date: "", huf: 390, ils: 3.8, est: true };
}
const hufToIls = (h, r) => h / r.huf * r.ils, hufToEur = (h, r) => h / r.huf;
const fmtN = (n, dgt = 0) => Number(n).toLocaleString("he-IL", { maximumFractionDigits: dgt });
async function openFx() {
  const r = await loadFx(); let cur = "HUF";
  openSheet(`<h2>💱 המרה</h2>
    <div class="fx"><div class="row nowrap"><input id="fxIn" type="number" inputmode="decimal" placeholder="סכום" class="fx-in">
      <select id="fxCur"><option value="HUF">פורינט</option><option value="ILS">₪ שקל</option><option value="EUR">€ אירו</option></select></div>
      <div class="row" id="fxQuick">${[1000, 2500, 5000, 10000, 20000].map(v => `<button class="pill" data-v="${v}">${fmtN(v)}</button>`).join("")}</div>
      <div id="fxOut" class="fx-out"></div>
      <div class="row"><button class="btn acc" id="fxExp">💰 לרשום כהוצאה</button></div>
      <p class="muted small">שער ${r.est ? "משוער" : "מ-" + esc(r.date) + " (הבנק המרכזי האירופי)"}: 1€ = ${fmtN(r.huf, 1)} פורינט · 1 ₪ = ${fmtN(r.huf / r.ils, 1)} פורינט. בטיפ במסעדה מקובל 10%–15%, אם לא נוסף כבר לחשבון ("szervízdíj").</p></div>`);
  const calc = () => { const v = parseFloat($("#fxIn").value) || 0; cur = $("#fxCur").value;
    const huf = cur === "HUF" ? v : cur === "EUR" ? v * r.huf : v / r.ils * r.huf;
    $("#fxOut").innerHTML = v ? `<div><b>${fmtN(huf)}</b> פורינט</div><div><b>${fmtN(hufToIls(huf, r), 1)}</b> ₪</div><div><b>${fmtN(hufToEur(huf, r), 1)}</b> €</div><div class="muted small">טיפ 10%: ${fmtN(huf * .1)} פורינט</div>` : `<div class="muted">מקלידים מחיר, למשל מהתפריט</div>`; };
  $("#fxIn").oninput = calc; $("#fxCur").onchange = calc; calc(); setTimeout(() => $("#fxIn").focus(), 60);
  $("#fxQuick").querySelectorAll("[data-v]").forEach(b => b.onclick = () => { $("#fxIn").value = b.dataset.v; $("#fxCur").value = "HUF"; calc(); });
  $("#fxExp").onclick = () => openExpense({ amt: parseFloat($("#fxIn").value) || "", cur: $("#fxCur").value });
}

// ---------- הוצאות ----------
let expenses = store.get("exp", null) || (shared.expenses || []);
function mergeExp(a, b) { const m = new Map(); [...(a || []), ...(b || [])].forEach(x => { const o = m.get(x.id); if (!o || x.del || (!o.del && (x.u || 0) > (o.u || 0))) m.set(x.id, x); }); return [...m.values()]; }
const EXPCAT = { food: "🍽 אוכל", drink: "🍷 שתייה", move: "🚕 תחבורה", fun: "🎟 כניסות", shop: "🛍 קניות", spa: "💆 פינוק", other: "• אחר" };
function saveExp() { store.set("exp", expenses); markShared(); }
async function expHuf(x) { const r = await loadFx(); return x.cur === "HUF" ? x.amt : x.cur === "EUR" ? x.amt * r.huf : x.amt / r.ils * r.huf; }
function openExpense(pre = {}) {
  openSheet(`<h2>💰 הוצאה חדשה</h2><div class="form">
    <div class="row nowrap"><input id="exA" type="number" inputmode="decimal" placeholder="סכום" class="fx-in" value="${esc(pre.amt ?? "")}">
      <select id="exC"><option value="HUF">פורינט</option><option value="EUR">€</option><option value="ILS">₪</option></select></div>
    <label for="exW">על מה</label><input id="exW" type="text" placeholder="למשל: קירטוש, מונית, כרטיסים" value="${esc(pre.what || "")}">
    <div class="row" id="exCat">${Object.entries(EXPCAT).map(([k, v], i) => `<button class="pill ${i === 0 ? "on" : ""}" data-c="${k}" type="button">${v}</button>`).join("")}</div>
    <div class="row"><label class="pill"><input type="checkbox" id="exCash"> מזומן</label></div>
    <button class="btn acc" id="exSave" type="button">שמירה</button></div>`);
  if (pre.cur) $("#exC").value = pre.cur;
  let cat = "food"; $("#exCat").querySelectorAll("[data-c]").forEach(b => b.onclick = () => { cat = b.dataset.c; $("#exCat").querySelectorAll("[data-c]").forEach(o => o.classList.toggle("on", o === b)); });
  setTimeout(() => $("#exA").focus(), 60);
  $("#exSave").onclick = () => { const amt = parseFloat($("#exA").value); if (!amt) return toast("כתוב סכום");
    expenses.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), u: Date.now(), date: budDate(), amt, cur: $("#exC").value, what: $("#exW").value.trim(), cat, cash: $("#exCash").checked || undefined });
    saveExp(); closeSheet(); toast("נרשם ✓"); };
}
async function openExpenses() {
  const r = await loadFx(), live = expenses.filter(x => !x.del).sort((a, b) => (b.u || 0) - (a.u || 0));
  const byDay = {}; for (const x of live) (byDay[x.date] ||= []).push(x);
  let total = 0; const dayTot = {};
  for (const x of live) { const h = await expHuf(x); total += h; dayTot[x.date] = (dayTot[x.date] || 0) + h; }
  const est = T.budget ? T.budget.estHuf : 0, maxH = T.budget ? T.budget.maxEur * r.huf : 0, pct = maxH ? Math.min(100, total / maxH * 100) : 0;
  openSheet(`<h2>💰 ההוצאות שלנו</h2>
    <div class="bigstats"><div><b>${fmtN(total)}</b><span>פורינט עד עכשיו</span></div><div><b>${fmtN(hufToIls(total, r))} ₪</b><span>${fmtN(hufToEur(total, r))}€</span></div></div>
    ${maxH ? `<div class="meter"><span style="width:${pct}%"></span></div><p class="muted small">ההערכה שלנו לטיול: כ-${fmtN(est)} פורינט (בלי מלון, טיסות וקניות). התקרה שהגדרתם: ${fmtN(T.budget.maxEur)}€.</p>` : ""}
    <div class="row"><button class="btn acc" id="exNew">➕ הוצאה חדשה</button><button class="btn ghost" id="exSiri">🎙 הוספה מסירי</button></div>
    ${Object.keys(byDay).sort().reverse().map(dt => `<h3 class="sec-title">${esc(dayLabel({ date: dt }))} · ${fmtN(dayTot[dt])} פורינט</h3><div class="list">${byDay[dt].map(x => `<div class="chg"><span>${EXPCAT[x.cat] ? EXPCAT[x.cat].split(" ")[0] : "•"} ${esc(x.what || "")} · <b>${fmtN(x.amt)} ${x.cur === "HUF" ? "פורינט" : x.cur === "EUR" ? "€" : "₪"}</b>${x.cash ? " · מזומן" : ""}</span><button class="btn ghost sm" data-exdel="${x.id}">מחיקה</button></div>`).join("")}</div>`).join("") || `<p class="muted">עוד לא נרשמו הוצאות.</p>`}
    <p class="muted small">ההוצאות מסונכרנות בין המכשירים שמחוברים לסנכרון.</p>`);
  $("#exNew").onclick = () => openExpense();
  $("#exSiri").onclick = siriHelp;
  $("#sheet").querySelectorAll("[data-exdel]").forEach(b => b.onclick = () => { const x = expenses.find(e => e.id === b.dataset.exdel); if (x) { x.del = true; x.u = Date.now(); saveExp(); openExpenses(); } });
}
function siriHelp() {
  const base = location.origin + location.pathname;
  openSheet(`<h2>🎙 הוספת הוצאה מסירי</h2>
    <p class="small">פעם אחת יוצרים קיצור דרך באפליקציית <b>קיצורים</b> (Shortcuts) באייפון, ואחר כך אומרים: <b>"היי סירי, הוצאה"</b>.</p>
    <ol class="small"><li>קיצורים ← ➕ קיצור חדש ← שם: <b>הוצאה</b>.</li>
      <li>פעולה: <b>בקש קלט</b> (Ask for Input), סוג: מספר, שאלה: "כמה פורינט?".</li>
      <li>פעולה: <b>בקש קלט</b> נוסף, סוג: טקסט, שאלה: "על מה?".</li>
      <li>פעולה: <b>פתח כתובות URL</b> (Open URLs), עם הכתובת הזו, ובמקום X ו-Y בוחרים את שני הקלטים:</li></ol>
    <div class="copyable" dir="ltr" style="word-break:break-all">${esc(base)}?exp=X&w=Y</div>
    <div class="row"><button class="btn" id="siriCopy">העתקת הכתובת</button></div>
    <p class="muted small">האפליקציה תיפתח ותרשום את ההוצאה. אפשר להפעיל את הקיצור גם מהשעון כשהטלפון קרוב, או מכפתור על מסך הבית.</p>`);
  $("#siriCopy").onclick = async () => { try { await navigator.clipboard.writeText(base + "?exp=X&w=Y"); toast("הועתק"); } catch { toast("סמן והעתק"); } };
}
(function expFromUrl() { const q = new URLSearchParams(location.search); const a = parseFloat(q.get("exp")); if (!a) return;
  expenses.push({ id: Date.now().toString(36), u: Date.now(), date: budDate(), amt: a, cur: q.get("c") || "HUF", what: q.get("w") || "", cat: "other" });
  store.set("exp", expenses); history.replaceState(null, "", location.pathname); setTimeout(() => { markShared(); toast(`נרשמה הוצאה: ${fmtN(a)} פורינט${q.get("w") ? " · " + q.get("w") : ""} ✓`, 4000); }, 800); })();

// ---------- לוח שנה (.ics) עם התראות ----------
function budToUtc(date, time) { const [y, m, d] = date.split("-").map(Number), [h, mi] = time.split(":").map(Number);
  let g = Date.UTC(y, m - 1, d, h, mi); for (let k = 0; k < 2; k++) { const parts = new Intl.DateTimeFormat("en-GB", { timeZone: T.tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(g));
    const v = t => +parts.find(x => x.type === t).value; const asLocal = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour") % 24, v("minute")); g += Date.UTC(y, m - 1, d, h, mi) - asLocal; } return new Date(g); }
const icsD = dt => dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsEsc = s => String(s).replace(/\\/g, "\\\\").replace(/[,;]/g, m => "\\" + m).replace(/\n/g, "\\n");
async function exportIcs() {
  const ev = [];
  T.days.forEach(d => d.items.forEach(it => { if (!(it.anchor || it.book) || !/^\d{1,2}:\d{2}$/.test(it.time || "")) return;
    const st = budToUtc(d.date, it.time), en = new Date(st.getTime() + (it.kind === "flight" ? 3.5 : 1.5) * 3600e3), p = it.place && P[it.place];
    const alarm = it.kind === "flight" ? 180 : 45, nk = notes["it:" + d.date + "|" + it.text];
    ev.push(["BEGIN:VEVENT", "UID:" + d.date + "-" + it.time.replace(":", "") + "-" + (it.place || it.kind || "x") + "@trip-companion", "DTSTAMP:" + icsD(new Date()), "DTSTART:" + icsD(st), "DTEND:" + icsD(en),
      "SUMMARY:" + icsEsc((it.text.replace(/^[⭐🚗🍷🌃🍹🚶 ]+/u, "")).slice(0, 70)), p ? "LOCATION:" + icsEsc(p.name) : "", "DESCRIPTION:" + icsEsc(it.text + (nk ? "\n\n" + nk : "")),
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEsc(it.text.slice(0, 60)), "TRIGGER:-PT" + alarm + "M", "END:VALARM", "END:VEVENT"].filter(Boolean).join("\r\n")); }));
  const txt = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//trip-companion//HE", "CALSCALE:GREGORIAN", "X-WR-CALNAME:" + icsEsc(T.title), ...ev, "END:VCALENDAR"].join("\r\n");
  const file = new File([txt], "budapest-2026.ics", { type: "text/calendar" });
  openSheet(`<h2>📅 העוגנים ללוח השנה</h2><p class="small">${ev.length} אירועים: כל ההזמנות והעוגנים, כל אחד עם התראה 45 דק' לפני (בטיסות 3 שעות לפני). השעות לפי שעון בודפשט. לוח השנה באייפון מעביר את ההתראות גם לשעון.</p>
    <div class="row"><button class="btn acc" id="icsGo">הורדה והוספה ללוח</button></div>
    <p class="muted small">באייפון: אחרי ההורדה לוחצים על הקובץ ← "הוספת הכל". אם משנים את התכנית, אפשר להוריד שוב, והאירועים יתעדכנו.</p>`);
  $("#icsGo").onclick = async () => { try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "בודפשט 2026" }); return; } } catch (e) { if (e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); };
}

// ---------- רשימת אריזה ----------
let pack = store.get("pack", { done: {}, extra: [] });
function openPacking() {
  const groups = [...(T.packing || []), ...(pack.extra.length ? [{ g: "שהוספנו", items: pack.extra }] : [])];
  const all = groups.flatMap(g => g.items), n = all.filter(x => pack.done[x]).length;
  openSheet(`<h2>🎒 רשימת אריזה <span class="pill">${n}/${all.length}</span></h2>
    ${groups.map(g => `<h3 class="sec-title">${esc(g.g)}</h3><div class="list">${g.items.map(x => `<label class="packrow ${pack.done[x] ? "ok" : ""}"><input type="checkbox" data-pk="${esc(x)}" ${pack.done[x] ? "checked" : ""}> ${esc(x)}</label>`).join("")}</div>`).join("")}
    <div class="row nowrap" style="margin-top:12px"><input id="pkNew" type="text" placeholder="להוסיף פריט…"><button class="btn" id="pkAdd">הוספה</button></div>
    <p class="muted small">הסימונים נשמרים בטלפון הזה, כך שכל אחד מכם יכול לסמן את מה שהוא ארז.</p>`);
  $("#sheet").querySelectorAll("[data-pk]").forEach(c => c.onchange = () => { if (c.checked) pack.done[c.dataset.pk] = 1; else delete pack.done[c.dataset.pk]; store.set("pack", pack); c.parentElement.classList.toggle("ok", c.checked); });
  $("#pkAdd").onclick = () => { const v = $("#pkNew").value.trim(); if (!v) return; pack.extra.push(v); store.set("pack", pack); openPacking(); };
}

// ---------- מסמכים פרטיים מוצפנים ----------
const vdb = (() => { let p; const open = () => p ||= new Promise((res, rej) => { const r = indexedDB.open("tc-vault", 1); r.onupgradeneeded = () => r.result.createObjectStore("v"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction("v", mode); const r = fn(t.objectStore("v")); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); };
  return { put: (k, v) => tx("readwrite", s => s.put(v, k)), get: k => tx("readonly", s => s.get(k)), del: k => tx("readwrite", s => s.delete(k)), keys: () => tx("readonly", s => s.getAllKeys()) }; })();
let vaultKey = null;
async function deriveKey(pw, salt) { const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]); }
async function enc(buf) { const iv = crypto.getRandomValues(new Uint8Array(12)); return { iv, data: await crypto.subtle.encrypt({ name: "AES-GCM", iv }, vaultKey, buf) }; }
const dec = o => crypto.subtle.decrypt({ name: "AES-GCM", iv: o.iv }, vaultKey, o.data);
async function openVault() {
  if (!window.crypto || !crypto.subtle) return toast("הדפדפן הזה לא תומך בהצפנה");
  const meta = await vdb.get("__meta").catch(() => null);
  if (!vaultKey) {
    openSheet(`<h2>🔒 מסמכים פרטיים</h2>
      <p class="small">${meta ? "הקלד את הסיסמה כדי לפתוח." : "בוחרים סיסמה פעם אחת. המסמכים נשמרים <b>מוצפנים רק בטלפון הזה</b>, לא באינטרנט ולא בסנכרון, ועובדים גם בלי חיבור. <b>אם שוכחים את הסיסמה, אי אפשר לשחזר אותם.</b>"}</p>
      <div class="form"><input id="vPw" type="password" placeholder="סיסמה" autocomplete="current-password">${meta ? "" : `<input id="vPw2" type="password" placeholder="שוב את הסיסמה">`}
      <button class="btn acc" id="vGo">${meta ? "פתיחה" : "יצירת אזור פרטי"}</button></div>`);
    setTimeout(() => $("#vPw").focus(), 60);
    $("#vGo").onclick = async () => { const pw = $("#vPw").value; if (pw.length < 4) return toast("סיסמה של 4 תווים לפחות");
      try {
        if (!meta) { if (pw !== $("#vPw2").value) return toast("הסיסמאות לא זהות"); const salt = crypto.getRandomValues(new Uint8Array(16)); vaultKey = await deriveKey(pw, salt);
          const chk = await enc(new TextEncoder().encode("ok")); await vdb.put("__meta", { salt, chk }); }
        else { vaultKey = await deriveKey(pw, meta.salt); await dec(meta.chk); }
        openVault();
      } catch { vaultKey = null; toast("סיסמה שגויה"); } };
    return;
  }
  const keys = (await vdb.keys()).filter(k => k !== "__meta"), items = [];
  for (const k of keys) { try { const o = await vdb.get(k); items.push({ k, m: JSON.parse(new TextDecoder().decode(await dec(o.meta))), at: o.at }); } catch {} }
  items.sort((a, b) => b.at - a.at);
  openSheet(`<h2>🔓 מסמכים פרטיים</h2>
    <div class="list">${items.map(x => `<div class="chg"><button class="linkish" data-vopen="${x.k}">${x.m.type.startsWith("image") ? "🖼" : x.m.type === "text" ? "📝" : "📄"} ${esc(x.m.name)}</button><button class="btn ghost sm" data-vdel="${x.k}">מחיקה</button></div>`).join("") || `<p class="muted">עוד אין מסמכים.</p>`}</div>
    <div class="form" style="margin-top:12px"><label for="vFile">הוספת צילום או PDF (דרכון, אישור הזמנה, ביטוח)</label><input id="vFile" type="file" accept="image/*,application/pdf" multiple>
      <label for="vTxt">או טקסט (למשל מספרי הזמנה)</label><textarea id="vTxt" rows="3" placeholder="CarFlexi: …"></textarea><input id="vTn" type="text" placeholder="כותרת לטקסט">
      <div class="row"><button class="btn acc" id="vAdd">שמירה מוצפנת</button><button class="btn ghost" id="vLock">🔒 נעילה</button></div></div>`);
  const sh = $("#sheet");
  sh.querySelectorAll("[data-vopen]").forEach(b => b.onclick = async () => { const o = await vdb.get(b.dataset.vopen); const m = JSON.parse(new TextDecoder().decode(await dec(o.meta))); const buf = await dec(o.blob);
    if (m.type === "text") return openSheet(`<h2>📝 ${esc(m.name)}</h2><div class="copyable" style="white-space:pre-wrap">${esc(new TextDecoder().decode(buf))}</div><div class="row"><button class="btn ghost" id="vBack">חזרה</button></div>`), $("#vBack").onclick = openVault;
    const url = URL.createObjectURL(new Blob([buf], { type: m.type }));
    openSheet(`<h2>${esc(m.name)}</h2>${m.type.startsWith("image") ? `<img class="photo" src="${url}" alt="">` : `<p><a class="btn acc" href="${url}" target="_blank" rel="noopener">פתיחת ה-PDF</a></p>`}<div class="row"><button class="btn ghost" id="vBack">חזרה</button></div>`); $("#vBack").onclick = openVault; });
  sh.querySelectorAll("[data-vdel]").forEach(b => b.onclick = async () => { await vdb.del(b.dataset.vdel); openVault(); });
  $("#vLock").onclick = () => { vaultKey = null; closeSheet(); toast("ננעל"); };
  $("#vAdd").onclick = async () => { const files = [...$("#vFile").files], t = $("#vTxt").value.trim();
    for (const f of files) { const m = await enc(new TextEncoder().encode(JSON.stringify({ name: f.name, type: f.type || "application/octet-stream" }))); const b = await enc(await f.arrayBuffer()); await vdb.put("d" + Date.now() + Math.random().toString(36).slice(2, 6), { meta: m, blob: b, at: Date.now() }); }
    if (t) { const m = await enc(new TextEncoder().encode(JSON.stringify({ name: $("#vTn").value.trim() || "הערה", type: "text" }))); const b = await enc(new TextEncoder().encode(t)); await vdb.put("t" + Date.now(), { meta: m, blob: b, at: Date.now() }); }
    if (files.length || t) { toast("נשמר מוצפן ✓"); openVault(); } else toast("בחר קובץ או כתוב טקסט"); };
}
document.addEventListener("visibilitychange", () => { if (document.hidden) vaultKey = null; });

// ---------- הכנה לטיסה (עבודה בלי אינטרנט) ----------
async function prepOffline() {
  openSheet(`<h2>✈️ הכנה לטיסה</h2><p class="small">מוריד לטלפון את כל מה שצריך כדי שהתכנית, הכרטיסים, התמונות וזמני ההליכה יעבדו גם בלי אינטרנט. כדאי להריץ בוויי-פיי בבית.</p>
    <div class="meter"><span id="prepBar" style="width:0%"></span></div><p class="small" id="prepTxt">מתחיל…</p>
    <div class="briefbox"><h3>🗺 גם המפה של גוגל בלי אינטרנט</h3><p class="small">המפה באפליקציה צריכה אינטרנט. בשביל ניווט בלי חיבור: באפליקציית <b>Google Maps</b> ← התמונה שלך למעלה ← <b>מפות אופליין</b> ← <b>בחירת מפה משלך</b> ← מסמנים את בודפשט ואת עיקול הדנובה ← <b>הורדה</b>.</p></div>`);
  const bar = () => $("#prepBar"), txt = () => $("#prepTxt");
  const places = T.places.filter(p => statusOf(p) !== "skip" && !p.mine), pairs = [];
  T.days.forEach(d => { let prev = null; d.items.forEach(it => { const p = it.place && P[it.place]; if (!p) return; if (prev && prev.id !== p.id) pairs.push([prev, p]); prev = p; }); });
  const total = places.length + pairs.length + 1; let done = 0; const tick = m => { done++; if (bar()) bar().style.width = Math.round(done / total * 100) + "%"; if (txt()) txt().textContent = m; };
  try { await loadGoogle(); } catch {}
  for (const p of places) { try { await resolve(p); } catch {} tick("פרטי מקומות: " + p.he); }
  for (const [a, b] of pairs) { try { await leg(a, b); } catch {} tick("זמני הליכה: " + b.he); }
  try { const c = await caches.open("tc-img"); const urls = [...new Set(Object.values(infoCache).map(x => x.photo).filter(Boolean))];
    for (let i = 0; i < urls.length; i += 6) await Promise.all(urls.slice(i, i + 6).map(u => fetch(u, { mode: "no-cors" }).then(r => c.put(u, r)).catch(() => {}))); } catch {}
  await loadWeather(); await loadFx(); tick("מזג אוויר ושערי מטבע");
  if (txt()) txt().innerHTML = "<b>✅ מוכן.</b> הכל שמור בטלפון. כדאי להריץ שוב יום לפני הטיסה, כדי שהתחזית תהיה עדכנית.";
}

// ---------- "ביקרנו" לפי מיקום ----------
let proxSeen = {};
function startProximity() {
  if (!navigator.geolocation || !tripLive()) return;
  navigator.geolocation.watchPosition(pos => {
    me = { lat: pos.coords.latitude, lng: pos.coords.longitude }; recordTrack(pos); if (pos.coords.accuracy > 120) return;
    const d = T.days.find(x => x.date === budDate()); if (!d) return;
    for (const it of d.items) { const p = it.place && P[it.place]; if (!p || p.layer === "hotel" || proxSeen[p.id] || statusOf(p) === "visited") continue;
      if (hav(me, loc(p)) < 90) { proxSeen[p.id] = 1; showProx(p); break; } }
  }, () => {}, { enableHighAccuracy: true, maximumAge: 30000 });
}
function showProx(p) {
  let b = $("#prox"); if (!b) { b = document.createElement("div"); b.id = "prox"; b.className = "prox"; document.body.appendChild(b); }
  b.innerHTML = `<span>📍 אתם ב<b>${esc(p.he)}</b>?</span><button class="btn acc sm" id="pxYes">✓ ביקרנו</button><button class="btn ghost sm" id="pxNo">לא עכשיו</button>`; b.hidden = false;
  $("#pxYes").onclick = () => { statusOv[p.id] = "visited"; markVisitedAt(p.id); store.set("status", statusOv); markShared(); b.hidden = true; toast("סומן: ביקרנו ✓"); if (view === "today") renderToday(); };
  $("#pxNo").onclick = () => b.hidden = true;
}


// ---------- פתוח עכשיו ----------
function budWeekMin() { const wd = new Intl.DateTimeFormat("en-US", { timeZone: T.tz, weekday: "short" }).format(new Date()); return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(wd) * 1440 + budMin(); }
function openNow(p) {
  const c = info(p.id); if (!c || !c.periods || !c.periods.length) return null;
  const now = budWeekMin(), W = 10080;
  return c.periods.some(([od, oh, om, cd, ch, cm]) => { if (od == null) return false; const o = od * 1440 + (oh || 0) * 60 + (om || 0);
    let cl = cd == null ? o + W : cd * 1440 + (ch || 0) * 60 + (cm || 0); if (cl <= o) cl += W; return (now >= o && now < cl) || (now + W >= o && now + W < cl); });
}
let hoursFilling = false; const hoursTried = new Set();
async function fillHours(after) {
  if (hoursFilling) return; const need = T.places.filter(p => p.layer !== "hotel" && statusOf(p) !== "skip" && !p.mine && !hoursTried.has(p.id) && !(info(p.id) && info(p.id).periods)); if (!need.length) return;
  need.forEach(p => hoursTried.add(p.id));
  hoursFilling = true; try { for (let i = 0; i < need.length; i += 5) await Promise.all(need.slice(i, i + 5).map(p => resolve(p, true).catch(() => {}))); } finally { hoursFilling = false; }
  if (after) after(); else if (view === "map" && mapLayer === "open") refreshMarkers();
}

// ---------- להראות לנהג המונית ----------
async function openTaxi(p) {
  const c = info(p.id) || {};
  const addr0 = p.id === HOTEL.id ? "Dessewffy utca 14, 1066 Budapest" : (c.addrHu || "");
  openSheet(`<div class="taxi"><div class="tx-hu">Kérem, vigyen el ide:</div><div class="tx-name">${esc(p.name)}</div>
      <div class="tx-addr" id="txAddr">${esc(addr0 || p.q || "")}</div><div class="tx-en">Please take me here · בבקשה, קח אותי לכאן</div></div>
    <div class="row" style="justify-content:center"><a class="btn acc" href="${gmapsDir(p, "driving")}" target="_blank" rel="noopener">↗ ניווט ברכב</a><button class="btn ghost" id="txCopy">העתקת הכתובת</button></div>
    <p class="muted small" style="text-align:center">מסובבים את הטלפון לנהג. ב-Bolt מדביקים את הכתובת ביעד.</p>`);
  $("#txCopy").onclick = async () => { try { await navigator.clipboard.writeText(($("#txAddr").textContent || "").trim()); toast("הועתק"); } catch { toast("סמן והעתק"); } };
  if (addr0 || !c.gid) return;
  try { const g = await loadGoogle(); const pl = new g.maps.places.Place({ id: c.gid, requestedLanguage: "hu" }); await pl.fetchFields({ fields: ["formattedAddress"] });
    if (pl.formattedAddress) { c.addrHu = pl.formattedAddress.replace(/, Magyarország$|, Hungary$/, ""); infoCache[p.id] = { ...info(p.id), addrHu: c.addrHu }; store.set("info", infoCache); const a = $("#txAddr"); if (a) a.textContent = c.addrHu; } } catch {}
}
// ---------- סיכום יומי עם מפה מונפשת ----------
const STEP_M = 0.65, STEP_PER_M = 1 / STEP_M; // 65 ס"מ לצעד
function trackOf(date) { return store.get("trk:" + date, []); }
function recordTrack(pos) {
  if (pos.coords.accuracy > 60) return; const date = budDate(), t = trackOf(date), pt = [+pos.coords.latitude.toFixed(6), +pos.coords.longitude.toFixed(6), Date.now()];
  const last = t[t.length - 1]; if (last && hav({ lat: last[0], lng: last[1] }, { lat: pt[0], lng: pt[1] }) < 35) return;
  t.push(pt); if (t.length > 3000) t.shift(); store.set("trk:" + date, t);
}
function markVisitedAt(id) { const v = store.get("vat", {}); v[id] = { t: Date.now(), d: budDate() }; store.set("vat", v); }
function summaryStops(d) {
  const custom = store.get("sumOrder", {})[d.date];
  if (custom && custom.length) return custom.map(id => P[id]).filter(Boolean);
  const vat = store.get("vat", {});
  const extra = Object.entries(vat).filter(([id, x]) => x.d === d.date && P[id] && !d.items.some(it => it.place === id)).map(([id]) => id);
  const auto = summaryStopsPlan(d, extra);
  const timed = auto.filter(p => vat[p.id] && vat[p.id].d === d.date);
  if (timed.length >= 2) { const sorted = timed.slice().sort((a, b) => vat[a.id].t - vat[b.id].t); let k = 0; return auto.map(p => vat[p.id] && vat[p.id].d === d.date ? sorted[k++] : p); }
  return auto;
}
function summaryStopsPlan(d, extra = []) {
  const isToday = d.date === budDate(), nowM = budMin(), seen = [];
  const items = d.items.filter(it => it.place && P[it.place] && !(isToday && /^\d{1,2}:\d{2}$/.test(it.time || "") && tmin(it.time) > nowM + 30));
  const anyVisited = items.some(it => statusOf(P[it.place]) === "visited");
  for (const it of items) { const p = P[it.place]; if (p.mine) continue;
    if (anyVisited && p.layer !== "hotel" && statusOf(p) !== "visited") continue;
    if (seen.length && seen[seen.length - 1].id === p.id) continue; seen.push(p); }
  extra.forEach(id => { if (!seen.some(p => p.id === id)) seen.push(P[id]); });
  if (seen.length && seen[0].id !== HOTEL.id && d.date !== T.days[0].date) seen.unshift(HOTEL);
  if (seen.length && seen[seen.length - 1].id !== HOTEL.id && (!isToday || nowM >= 21 * 60)) seen.push(HOTEL);
  return seen.map(p => p.id === "hotel-spa" ? HOTEL : p).filter((p, i, a) => !i || a[i - 1].id !== p.id);
}
let sumAnim = null;
async function openDaySummary(di = day) {
  const d = T.days[di], next = T.days[di + 1], stops = summaryStops(d);
  const legs = []; for (let i = 1; i < stops.length; i++) legs.push(await leg(stops[i - 1], stops[i]));
  const walkM = legs.filter(l => l.mode === "WALK").reduce((a, l) => a + l.m, 0), rideS = legs.filter(l => l.mode !== "WALK").reduce((a, l) => a + l.sec, 0);
  const trk = trackOf(d.date); let gpsM = 0; for (let i = 1; i < trk.length; i++) gpsM += hav({ lat: trk[i - 1][0], lng: trk[i - 1][1] }, { lat: trk[i][0], lng: trk[i][1] });
  const stepsMan = store.get("steps", {})[d.date], kmMan = store.get("kmDay", {})[d.date];
  const routeM = Math.max(walkM, gpsM * 0.85);
  const km = kmMan ? kmMan * 1000 : stepsMan ? stepsMan * STEP_M : routeM, estSteps = Math.round(km * STEP_PER_M / 100) * 100;
  const kmLbl = kmMan ? "ק\"מ (מהטלפון)" : stepsMan ? "ק\"מ (לפי הצעדים)" : "ק\"מ ברגל (הערכה)";
  const w2 = next && wxFor(next.date);
  const nFirst = next && (next.items.find(i => i.anchor && /^\d/.test(i.time)) || next.items.find(i => /^\d/.test(i.time)));
  openSheet(`<h2>🌙 סיכום יום ${di + 1} · ${esc(dayLabel(d))}</h2><p class="muted small" style="margin-top:-4px">${esc(d.title)}</p>
    <div class="sum-map-wrap"><div id="sumMap" class="sum-map"></div><button class="btn sm sum-replay" id="sumReplay">▶ שוב</button></div>
    <div class="bigstats three">
      <div><b id="stepsVal">${stepsMan ? fmtN(stepsMan) : "~" + fmtN(estSteps)}</b><span>${stepsMan ? "צעדים (מהטלפון)" : "צעדים (הערכה)"}</span></div>
      <div><b>${(km / 1000).toFixed(1)}</b><span>${kmLbl}</span></div>
      <div><b>${stops.filter(p => p.layer !== "hotel").length}</b><span>מקומות</span></div>
    </div>
    ${rideS ? `<p class="muted small" style="margin:0">🚕 ועוד כ-${fmtMin(rideS)} בנסיעות.${trk.length > 10 ? ` GPS תיעד ${(gpsM / 1000).toFixed(1)} ק"מ כשהאפליקציה הייתה פתוחה.` : ""}</p>` : ""}
    <div class="row nowrap" style="margin:8px 0"><input id="stepsIn" type="number" inputmode="numeric" placeholder="צעדים" value="${stepsMan || ""}"><input id="kmIn" type="number" inputmode="decimal" step="0.1" placeholder="ק&quot;מ" value="${kmMan || ""}"><button class="btn ghost sm" id="stepsSave">שמירה</button></div>
    <p class="muted small" style="margin:-4px 0 6px">מעתיקים מאפליקציית הבריאות את הצעדים ואת "מרחק הליכה וריצה". אם יש רק צעדים, הק"מ מחושב מהם.</p>
    <h3 class="sec-title">📍 המסלול שלנו היום <button class="btn ghost sm" id="sumEdit">✏️ סידור</button></h3>
    <ol class="sum-list">${stops.map((p, i) => `<li><span class="sum-n">${i + 1}</span><span>${esc(p.he)}</span>${i ? `<small>${legs[i - 1].mode === "WALK" ? "🚶 " + fmtDist(legs[i - 1].m) : "🚕 " + fmtMin(legs[i - 1].sec)}</small>` : ""}</li>`).join("")}</ol>
    ${next ? `<div class="promo"><div class="promo-k">מחר · יום ${di + 2} · ${esc(dayLabel(next))}</div>
      <div class="promo-wx">${w2 ? `<span class="promo-ic">${WXI(w2.code)}</span><span><b>${w2.min}°–${w2.max}°</b><br><small>☔ ${w2.rain}% · 💨 ${w2.wind} קמ"ש${w2.sunset ? " · 🌇 " + w2.sunset : ""}</small></span>` : `<span>🌤 התחזית עוד לא זמינה</span>`}</div>
      <div class="promo-t">${esc(next.title)}</div>
      ${nFirst ? `<div class="small">⏰ מתחילים ב-${esc(nFirst.time)}: ${esc(nFirst.text.slice(0, 80))}</div>` : ""}
      <div class="small" style="margin-top:4px">${esc(wxAdvice(w2, next))}</div>
      <div class="row" style="margin-top:6px">${bringFor(next, w2).slice(0, 5).map(x => `<span class="pill">${esc(x)}</span>`).join("")}</div></div>` : `<div class="promo"><div class="promo-t">זה היה היום האחרון. טיסה טובה הביתה ❤️</div></div>`}`);
  $("#stepsSave").onclick = () => { const v = parseInt($("#stepsIn").value), k = parseFloat($("#kmIn").value); const s = store.get("steps", {}), kd = store.get("kmDay", {});
    if (v) s[d.date] = v; else delete s[d.date]; if (k) kd[d.date] = k; else delete kd[d.date]; store.set("steps", s); store.set("kmDay", kd); toast("נשמר"); openDaySummary(di); };
  $("#sumEdit").onclick = () => editSummaryStops(di, stops.map(p => p.id));
  drawSummaryMap(stops, legs, trk);
}
async function drawSummaryMap(stops, legs, trk) {
  let g; try { g = await loadGoogle(); } catch { const m = $("#sumMap"); if (m) m.innerHTML = `<p class="muted" style="padding:20px">המפה צריכה אינטרנט</p>`; return; }
  const el = $("#sumMap"); if (!el || !stops.length) return;
  const { Map } = await g.maps.importLibrary("maps"), { AdvancedMarkerElement } = await g.maps.importLibrary("marker");
  const m = new Map(el, { center: loc(stops[0]), zoom: 14, mapId: C.mapId, disableDefaultUI: true, gestureHandling: "cooperative" });
  const b = new g.maps.LatLngBounds(); stops.forEach(p => b.extend(loc(p))); m.fitBounds(b, 40);
  const segs = legs.map((l, i) => ({ mode: l.mode, path: (l.poly ? g.maps.geometry.encoding.decodePath(l.poly).map(x => ({ lat: x.lat(), lng: x.lng() })) : [loc(stops[i]), loc(stops[i + 1])]) }));
  const pins = stops.map((p, i) => { const e = document.createElement("div"); e.className = "pin num sum-pin"; e.style.background = p.layer === "hotel" ? "#111" : colorOf(p); e.innerHTML = `<span>${p.layer === "hotel" ? "🏨" : i + 1}</span>`; e.style.opacity = i ? "0" : "1";
    return new AdvancedMarkerElement({ map: m, position: loc(p), content: e, title: p.he }); });
  const mover = document.createElement("div"); mover.className = "sum-mover"; mover.textContent = "🚶";
  const mk = new AdvancedMarkerElement({ map: m, position: loc(stops[0]), content: mover, zIndex: 999 });
  if (trk.length > 10) new g.maps.Polyline({ map: m, path: trk.map(t => ({ lat: t[0], lng: t[1] })), strokeColor: "#7A4DD8", strokeOpacity: .35, strokeWeight: 3 });
  const run = () => {
    if (sumAnim) cancelAnimationFrame(sumAnim); const lines = [];
    pins.forEach((p, i) => p.content.style.opacity = i ? "0" : "1");
    let si = 0, pi = 0, line = null; const speed = Math.max(2, Math.round(segs.reduce((a, s) => a + s.path.length, 0) / 260));
    const step = () => {
      if (!$("#sumMap")) return;
      const s = segs[si]; if (!s) { mover.textContent = "🏁"; return; }
      if (!line) { mover.textContent = s.mode === "WALK" ? "🚶" : "🚕";
        line = new g.maps.Polyline({ map: m, path: [], strokeColor: s.mode === "WALK" ? "#D9622B" : "#2F6FDE", strokeOpacity: s.mode === "WALK" ? .95 : 0, strokeWeight: 5,
          icons: s.mode === "WALK" ? [] : [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3.5, strokeColor: "#2F6FDE" }, offset: "0", repeat: "12px" }] }); lines.push(line); }
      for (let k = 0; k < speed && pi < s.path.length; k++, pi++) line.getPath().push(new g.maps.LatLng(s.path[pi]));
      mk.position = s.path[Math.min(pi, s.path.length - 1)];
      if (pi >= s.path.length) { si++; pi = 0; line = null; if (pins[si]) pins[si].content.style.opacity = "1"; }
      sumAnim = requestAnimationFrame(step);
    };
    run.lines && run.lines.forEach(l => l.setMap(null)); run.lines = lines; step();
  };
  run(); $("#sumReplay").onclick = run;
}

function editSummaryStops(di, ids) {
  const d = T.days[di];
  const draw = () => {
    const opts = T.places.filter(p => !p.mine && statusOf(p) !== "skip").sort((a, b) => a.he.localeCompare(b.he, "he"));
    openSheet(`<h2>✏️ המסלול של יום ${di + 1}</h2><p class="small muted">מסדרים לפי הסדר שבו באמת הייתם. ↑↓ מזיזים, ✕ מוחק.</p>
      <ol class="sum-list">${ids.map((id, i) => `<li><span class="sum-n">${i + 1}</span><span>${esc(P[id].he)}</span><span class="row nowrap" style="margin-inline-start:auto"><button class="btn ghost sm" data-up="${i}" ${i ? "" : "disabled"}>↑</button><button class="btn ghost sm" data-dn="${i}" ${i < ids.length - 1 ? "" : "disabled"}>↓</button><button class="btn ghost sm" data-x="${i}">✕</button></span></li>`).join("")}</ol>
      <div class="row nowrap"><select id="sumAdd" style="flex:1;min-width:0"><option value="">➕ להוסיף מקום…</option>${opts.map(p => `<option value="${p.id}">${esc(p.he)}</option>`).join("")}</select></div>
      <div class="row" style="margin-top:10px"><button class="btn acc" id="sumSave">שמירה</button><button class="btn ghost" id="sumReset">איפוס לפי התכנית</button></div>`);
    const sh = $("#sheet");
    sh.querySelectorAll("[data-up]").forEach(b => b.onclick = () => { const i = +b.dataset.up; [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]; draw(); });
    sh.querySelectorAll("[data-dn]").forEach(b => b.onclick = () => { const i = +b.dataset.dn; [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]]; draw(); });
    sh.querySelectorAll("[data-x]").forEach(b => b.onclick = () => { ids.splice(+b.dataset.x, 1); draw(); });
    $("#sumAdd").onchange = e => { if (e.target.value) { ids.push(e.target.value); draw(); } };
    $("#sumSave").onclick = () => { const o = store.get("sumOrder", {}); o[d.date] = ids; store.set("sumOrder", o); ids.forEach(id => { if (P[id].layer !== "hotel" && statusOf(P[id]) !== "visited") { statusOv[id] = "visited"; } }); store.set("status", statusOv); markShared(); openDaySummary(di); };
    $("#sumReset").onclick = () => { const o = store.get("sumOrder", {}); delete o[d.date]; store.set("sumOrder", o); openDaySummary(di); };
  };
  draw();
}
// ---------- ניווט בין מסכים ----------
async function go(v) {
  view = v;
  document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.view === v));
  ["today","map","places","docs"].forEach(x => $("#view-" + x).hidden = x !== v);
  window.scrollTo(0, 0);
  await render();
}
async function render() {
  if (view === "today") return renderToday();
  if (view === "places") return renderPlaces();
  if (view === "docs") return renderDocs();
  if (view === "map") { renderLayerBar(); await ensureMap(); return refreshMarkers(); }
}
document.querySelector(".tabs").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.act === "fx") return openFx(); go(b.dataset.view); });

// ---------- התחלה ----------
applyIdeas(); renderHeader(); renderHeaderWx(); go("today");
pullRemote(); document.addEventListener("visibilitychange", () => { if (!document.hidden) pullRemote(); });
if (!wx || Date.now() - wx.t > 3 * 3600e3) loadWeather();
loadGoogle().catch(() => {});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
startProximity();
})();
