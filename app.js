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
let statusOv = Object.assign({}, shared.status || {}, store.get("status", {}));   // id -> status
let bookDone = Object.assign({}, shared.booked || {}, store.get("booked", {}));   // bookingId -> true
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
let notes = Object.assign({}, shared.notes || {}, store.get("notes", {}));        // key -> text ("" = נמחק)
let hiddenInbox = store.get("hiddenInbox", {});
const noteHtml = k => notes[k] ? `<div class="mynote">📝 ${esc(notes[k])}</div>` : "";
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
    photo: place.photos && place.photos[0] ? place.photos[0].getURI({ maxWidth: 800 }) : ""
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
  el.innerHTML = `
    <div class="brief">
      <h2>${esc(d.title)}</h2>
      <p>${esc(d.summary)}</p>
      <div class="wxline">
        ${w ? `<span class="pill">${WXI(w.code)} ${w.min}°–${w.max}°</span><span class="pill ${w.rain>=50?"warn":""}">☔ ${w.rain}%</span><span class="pill ${w.wind>=35?"warn":""}">💨 ${w.wind} קמ"ש</span>${w.sunset?`<span class="pill">🌇 ${w.sunset}</span>`:""}` : `<span class="pill">תחזית עוד לא זמינה</span>`}
      </div>
      <div class="advice">${esc(wxAdvice(w, d))}</div>
      ${anchors.length ? `<div class="row">${anchors.map(a => `<span class="pill anchor">⏰ ${a.time} ${esc(a.text)}</span>`).join("")}</div>` : ""}
      ${uniq.length ? `<div class="row">${uniq.map(b => `<span class="pill book">להזמין: ${esc(b.title)}</span>`).join("")}</div>` : ""}
    </div>
    <div class="daystats" id="dayStats">מחשב זמני הליכה…</div>
    <ol class="timeline" id="tl"></ol>
    <h3 class="sec-title">טיפים להיום</h3>
    <div class="tips">${pickTips(d).map(t => `<div class="tip"><b>${esc(t.t)}</b>${esc(t.d)}</div>`).join("")}</div>`;
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
      legHtml = `<li class="ti-item"><div></div><div class="leg ${l.sec > 1800 ? "long" : ""}">${l.mode === "WALK" ? "🚶" : "🚇"} ${fmtMin(l.sec)}${l.mode === "WALK" ? " · " + fmtDist(l.m) : " בתחבורה"}${l.est ? " (הערכה)" : ""}${l.sec > 1800 && l.mode === "WALK" ? " · מעל 30 דק', שווה מטרו או Bolt" : ""}</div></li>`;
    }
    if (p && !isRem) prev = p;
    const c = p && info(p.id);
    const rk = esc(itemKey(d, it));
    rows.push(legHtml + `<li class="ti-item ${isRem ? "removed" : ""} ${it.mine ? "mine" : ""}"><div class="ti-time">${esc(it.time)}</div>
      <div class="ti-row">
      <button class="ti-card ${it.anchor ? "anchor" : ""}" ${p ? `data-place="${p.id}"` : "disabled"}>
        ${p ? `<span class="dot" style="background:${colorOf(p)}"></span>` : `<span class="dot" style="background:var(--line)"></span>`}
        <span class="tx"><span class="nm">${esc(it.text)}</span>
          ${p ? `<span class="sb">${esc(p.he)}${c && c.rating ? ` · ★ ${c.rating}` : ""}</span>` : ""}
          <span class="tags">${it.anchor ? `<span class="pill anchor">עוגן</span>` : ""}${it.book ? (bookDone[it.book] ? `<span class="pill ok">הוזמן</span>` : `<span class="pill book">להזמין</span>`) : ""}${(it.alt||[]).length ? `<span class="pill">+ ${it.alt.length} חלופות</span>` : ""}${p && statusOf(p)==="visited" ? `<span class="pill ok">ביקרנו</span>` : ""}</span>
        </span>
        ${c && c.photo ? `<img class="thumb" src="${esc(c.photo)}" alt="" loading="lazy">` : ""}
      </button>
      <button class="rm nb" data-note="${rk}" aria-label="הערה" title="הערה">📝</button>
      ${it.mine ? `<button class="rm" data-idea="${esc(it.place.slice(5))}" aria-label="מחיקת ההצעה" title="מחיקת ההצעה">✕</button>`
        : `<button class="rm" data-rm="${rk}" data-time="${esc(it.time)}" aria-label="${isRem ? "ביטול ההסרה" : "להסיר מהתוכנית"}" title="${isRem ? "ביטול ההסרה" : "להסיר מהתוכנית"}">${isRem ? "↺" : "✕"}</button>`}
      </div>${isRem ? `<div class="rm-note">יוסר בעדכון הבא · ↺ לביטול</div>` : ""}${notes["it:" + itemKey(d, it)] ? `<div class="mynote ti-n">📝 ${esc(notes["it:" + itemKey(d, it)])}</div>` : ""}</li>`);
  }
  if (tok !== renderToday.tok) return;
  tl.innerHTML = rows.join("") + `<li class="ti-item"><div></div><button class="add-day" id="addToDay">➕ להוסיף משהו ליום הזה</button></li>`;
  $("#addToDay").onclick = () => openAdd(day);
  tl.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { const k = b.dataset.rm;
    if (removed[k]) delete removed[k]; else removed[k] = { date: d.date, time: b.dataset.time, text: k.split("|").slice(1).join("|") };
    store.set("removed", removed); toast(removed[k] ? "סומן להסרה. ייכנס לעדכון הבא" : "ההסרה בוטלה"); renderToday(); });
  tl.querySelectorAll("[data-note]").forEach(b => b.onclick = () => { const k = b.dataset.note; editNote("it:" + k, k.split("|").slice(1).join("|"), renderToday); });
  tl.querySelectorAll("[data-idea]").forEach(b => b.onclick = () => deleteIdea(b.dataset.idea));
  const busy = tot.walkM > 12000;
  $("#dayStats").innerHTML = `🚶 <b>${fmtDist(tot.walkM)}</b> הליכה (${fmtMin(tot.walkS)})${tot.transS ? ` · 🚇 <b>${fmtMin(tot.transS)}</b> בתחבורה` : ""}${busy ? ` <span class="pill warn">יום ארוך ברגליים</span>` : ""} <button class="btn ghost" id="dayMap">על המפה</button>`;
  $("#dayMap").onclick = () => { mapLayer = "day"; go("map"); };
  // השלמת תמונות ודירוגים ברקע
  for (const it of d.items) { const p = it.place && P[it.place]; if (p && !info(p.id)) { resolve(p).then(() => { if (view === "today" && T.days[day] === d) patchThumbs(); }); } }
}
function patchThumbs() { document.querySelectorAll(".ti-card[data-place]").forEach(b => { const c = info(b.dataset.place); if (c && c.photo && !b.querySelector(".thumb")) b.insertAdjacentHTML("beforeend", `<img class="thumb" src="${esc(c.photo)}" alt="" loading="lazy">`); const sb = b.querySelector(".sb"); if (c && c.rating && sb && !sb.textContent.includes("★")) sb.textContent += " · ★ " + c.rating; }); }
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
      ${sayOf(p) ? `<button class="btn acc sm" id="plSay" style="margin-inline-end:6px">🗣 מה לומר למלצר</button>` : ""}${noteHtml("pl:" + p.id)}<button class="btn ghost sm" id="plNote">📝 ${notes["pl:" + p.id] ? "עריכת ההערה שלי" : "הוספת הערה"}</button>
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
        <a class="btn ghost" href="${c && c.gid ? gmapsPlace(p) : gmapsPlace(p)}" target="_blank" rel="noopener">פתח בגוגל מפס</a>
      </div>
      ${p.layer !== "hotel" ? `<div class="status" role="group" aria-label="סימון">${Object.entries(STATUS).map(([k, v]) => `<button data-st="${k}" class="${st === k ? "on" : ""}">${v}</button>`).join("")}</div>` : ""}
    `);
    if (sayOf(p)) $("#plSay").onclick = () => openSay(sayOf(p), p.he);
    $("#plNote").onclick = () => editNote("pl:" + p.id, p.he, () => openPlace(p));
    $("#showOnMap").onclick = () => { closeSheet(); mapLayer = "all"; go("map").then(() => focusPlace(p)); };
    $("#sheet").querySelectorAll("[data-st]").forEach(b => b.onclick = () => { statusOv[p.id] = b.dataset.st; store.set("status", statusOv); markShared(); draw(info(p.id), open); toast("סומן: " + STATUS[b.dataset.st]); refreshMarkers(); });
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
const MAPLAYERS = () => [["day", "תוכנית היום", "#D9622B"], ...Object.entries(T.layers).map(([k, v]) => [k, v.name, v.color]), ["visited", "ביקרנו", "#2E8B57"], ["all", "הכל", "#14262E"]];
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
  else list = T.places.filter(p => layerOf(p) === mapLayer && statusOf(p) !== "skip");
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
let placeFilter = "all";
function renderPlaces() {
  const el = $("#view-places");
  const F = [["all","הכל"],["sights",T.layers.sights.name],["food",T.layers.food.name],["shop",T.layers.shop.name],["must","חובה"],["maybe","אולי"],["visited","ביקרנו"]];
  const match = p => p.layer !== "hotel" && (placeFilter === "all" ? statusOf(p) !== "skip" : ["must","maybe","visited"].includes(placeFilter) ? statusOf(p) === placeFilter : layerOf(p) === placeFilter);
  const list = T.places.filter(match).sort((a, b) => hav(HOTEL, a) - hav(HOTEL, b));
  el.innerHTML = `<div class="filters">${F.map(([k, n]) => `<button data-f="${k}" class="${k === placeFilter ? "on" : ""}">${esc(n)}</button>`).join("")}</div>
    <div class="plist">${list.map(p => card(p, hav(HOTEL, loc(p)), "מהמלון")).join("") || `<p class="muted">אין כאן עדיין מקומות.</p>`}</div>`;
  el.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { placeFilter = b.dataset.f; renderPlaces(); });
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
  const nChanges = remList.length + skipped.length + ideas.length + Object.keys(notes).filter(k => notes[k]).length;
  el.innerHTML = `
    <div class="doc syncbox"><div class="row nowrap" style="justify-content:space-between"><span><b>🔄 סנכרון:</b> ${ghToken ? "מחובר" : "לא מחובר במכשיר הזה"}${planDirty ? " · יש שינויים שממתינים" : ""}</span><button class="btn ghost sm" id="syncSet">${ghToken ? "הגדרות" : "חיבור"}</button></div></div>
    <div class="row" style="margin-top:8px"><button class="btn" id="openBoard2">🗂 לוח התכנון (גרירה בין ימים)</button></div>
    <h3 class="sec-title">📝 השינויים שלי לעדכון הבא${nChanges ? ` <span class="pill book">${nChanges}</span>` : ""}</h3>
    <div class="doc changes">
      ${nChanges ? "" : `<div>עוד אין שינויים. בתוכנית היומית לוחצים ✕ ליד מה שלא רוצים, ובכפתור "➕ הוספת המלצה" מוסיפים מקום חדש.</div>`}
      ${remList.map(([k, r]) => `<div class="chg"><span>✕ ${esc(r.time)} ${esc(r.text)}</span><button class="btn ghost sm" data-unrm="${esc(k)}">ביטול</button></div>`).join("")}
      ${skipped.map(p => `<div class="chg"><span>✕ ויתרנו: ${esc(p.he)}</span><button class="btn ghost sm" data-unskip="${p.id}">ביטול</button></div>`).join("")}
      ${Object.keys(notes).filter(k => notes[k]).length ? `<div class="chg"><span>📝 ${Object.keys(notes).filter(k => notes[k]).length} הערות שכתבת (יישלחו יחד עם השינויים)</span></div>` : ""}
      ${ideas.map(x => `<div class="chg"><span>➕ ${esc(x.place ? x.place.name : (x.text || "צילום מסך"))}${x.day != null ? ` · יום ${x.day + 1}` : ""}${x.note ? ` · ${esc(x.note)}` : ""}${x.imgs ? ` · 📷 ${x.imgs}` : ""}</span><button class="btn ghost sm" data-delidea="${x.id}">מחיקה</button></div>`).join("")}
      <div class="row" style="margin-top:10px"><button class="btn acc" id="sendChg" ${nChanges ? "" : "disabled"}>📤 שליחה ל-Claude</button><button class="btn ghost" id="addIdea">➕ הוספת המלצה</button></div>
      <div class="muted small" style="margin-top:6px">ב"שליחה" נפתח חלון שיתוף. בוחרים בו את Claude (או מעתיקים), וכל השינויים עוברים יחד עם צילומי המסך.</div>
    </div>
    <h3 class="sec-title">טיסות ומלון</h3>
    <div class="docs">${T.docs.map(d => `<div class="doc"><h3>${d.kind === "flight" ? "✈️" : "🏨"} ${esc(d.title)}</h3>${d.lines.map(l => `<div>${esc(l)}</div>`).join("")}${d.place ? `<div class="row" style="margin-top:8px"><a class="btn ghost" href="${gmapsDir(P[d.place])}" target="_blank" rel="noopener">ניווט למלון</a></div>` : ""}</div>`).join("")}
      <div class="doc"><h3>🔒 מסמכים אישיים</h3><div>צילומי דרכונים, אישורי הזמנה ומספרי הזמנה יישמרו באזור פרטי שנוסיף בגרסה הבאה, מוגן בסיסמה ומסונכרן ביניכם.</div></div>
    </div>
    <h3 class="sec-title">מה צריך להזמין</h3>
    <div class="book-list">${T.bookings.map(b => `<div class="book ${bookDone[b.id] ? "done" : ""}"><div class="bt"><span>${esc(b.title)}</span><span class="pill ${b.urgency === "high" && !bookDone[b.id] ? "book" : ""}">${esc(b.when)}</span></div><p>${esc(b.note)}</p>${noteHtml("bk:" + b.id)}<div class="row">${b.say ? `<button class="btn acc sm" data-say="${b.id}">🗣 מה לומר למלצר</button>` : ""}<label><input type="checkbox" data-book="${b.id}" ${bookDone[b.id] ? "checked" : ""}> הוזמן</label><button class="btn ghost sm" data-bnote="${b.id}">📝 ${notes["bk:" + b.id] ? "עריכת הערה" : "הערה"}</button></div></div>`).join("")}</div>
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
    <div class="doc"><div>מוריד קובץ עם כל המקומות לפי שכבות. מייבאים אותו פעם אחת ל-Google My Maps, ואז כל השכבות מופיעות גם באפליקציית גוגל מפס, תחת "שמורים" ← "מפות".</div>
      <div class="row" style="margin-top:8px"><button class="btn" id="kmlAll">ייצוא כל המקומות</button><button class="btn ghost" id="kmlVisited">ייצוא "ביקרנו"</button><a class="btn ghost" href="https://www.google.com/maps/d/" target="_blank" rel="noopener">פתח את My Maps</a></div></div>
    <div class="row" style="margin-top:14px"><button class="btn ghost" id="diag2">🔧 בדיקת חיבור לגוגל</button></div>
    <p class="muted small" style="margin:18px 0">גרסה 21 · נתונים מגוגל מתעדכנים אוטומטית · הסימונים נשמרים במכשיר הזה</p>`;
  el.querySelectorAll("[data-unrm]").forEach(b => b.onclick = () => { delete removed[b.dataset.unrm]; store.set("removed", removed); renderDocs(); });
  el.querySelectorAll("[data-unskip]").forEach(b => b.onclick = () => { delete statusOv[b.dataset.unskip]; store.set("status", statusOv); renderDocs(); });
  el.querySelectorAll("[data-delidea]").forEach(b => b.onclick = () => deleteIdea(b.dataset.delidea));
  el.querySelectorAll("[data-say]").forEach(b => b.onclick = () => { const x = T.bookings.find(y => y.id === b.dataset.say); openSay(x.say, x.title.replace("✅ ", "")); });
  el.querySelectorAll("[data-bnote]").forEach(b => b.onclick = () => { const x = T.bookings.find(y => y.id === b.dataset.bnote); editNote("bk:" + x.id, x.title, renderDocs); });
  el.querySelectorAll("[data-inote]").forEach(b => b.onclick = () => editNote("ib:" + b.dataset.inote, b.dataset.inote, renderDocs));
  el.querySelectorAll("[data-hideinbox]").forEach(b => b.onclick = () => { hiddenInbox[b.dataset.hideinbox] = 1; store.set("hiddenInbox", hiddenInbox); renderDocs(); });
  const uh = $("#unhideInbox"); if (uh) uh.onclick = () => { hiddenInbox = {}; store.set("hiddenInbox", hiddenInbox); renderDocs(); };
  const ib = el.querySelector("details.inbox"); if (ib) ib.ontoggle = () => store.set("inboxOpen", ib.open);
  $("#syncSet").onclick = openSyncSettings; $("#openBoard2").onclick = openBoard;
  $("#diag2").onclick = diagnose; $("#sendChg").onclick = sendChanges; $("#addIdea").onclick = () => openAdd(null);
  el.querySelectorAll("[data-book]").forEach(i => i.onchange = () => { bookDone[i.dataset.book] = i.checked; store.set("booked", bookDone); markShared(); renderDocs(); });
  $("#shopping").oninput = e => store.set("shopping", e.target.value);
  $("#kmlAll").onclick = () => kml(T.places.filter(p => statusOf(p) !== "skip"), "budapest-all");
  $("#kmlVisited").onclick = () => { const v = T.places.filter(p => statusOf(p) === "visited"); if (!v.length) return toast("עוד לא סימנתם מקומות כ\"ביקרנו\""); kml(v, "budapest-visited"); };
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
QUICK.unshift(["add", "➕ הוספת המלצה"]);
$("#quick").innerHTML = QUICK.map(([k, n]) => `<button data-q="${k}">${n}</button>`).join("");
$("#quick").addEventListener("click", e => { const b = e.target.closest("[data-q]"); if (b) quick(b.dataset.q); });
async function quick(k) {
  if (k === "add") return openAdd(null);
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
  const nk = Object.keys(notes).filter(k => notes[k]);
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
}
let syncTimer = null, syncing = false;
function markShared(daysChanged) {
  planDirty = true; store.set("plan", { ...shared, dirty: true, daysDirty: daysChanged || (store.get("plan", {}) || {}).daysDirty || false });
  if (ghToken) { clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 1200); }
}
async function syncNow(silent) {
  if (!ghToken) { if (!silent) toast("נשמר במכשיר הזה. כדי שיתעדכן בכל המכשירים, צריך לחבר סנכרון (במסך מסמכים)", 5000); return false; }
  if (syncing) return; syncing = true; setSyncBadge("⏳");
  try {
    const lp = store.get("plan", {}) || {};
    const { sha, plan: remote } = await fetchRemote();
    const merged = {
      rev: (remote.rev || 0) + 1, updated: new Date().toISOString(), by: navigator.userAgent.includes("iPad") ? "טאבלט" : "טלפון",
      days: lp.daysDirty ? shared.days : remote.days,
      notes: Object.assign({}, remote.notes || {}, notes), status: Object.assign({}, remote.status || {}, statusOv), booked: Object.assign({}, remote.booked || {}, bookDone)
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
document.querySelector(".tabs").addEventListener("click", e => { const b = e.target.closest("button"); if (b) go(b.dataset.view); });

// ---------- התחלה ----------
applyIdeas(); renderHeader(); renderHeaderWx(); go("today");
pullRemote(); document.addEventListener("visibilitychange", () => { if (!document.hidden) pullRemote(); });
if (!wx || Date.now() - wx.t > 3 * 3600e3) loadWeather();
loadGoogle().catch(() => {});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
