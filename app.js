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
let statusOv = store.get("status", {});   // id -> status
let bookDone = store.get("booked", {});   // bookingId -> true
const statusOf = p => statusOv[p.id] || p.status || "nice";
const STATUS = { must: "חובה", booked: "הוזמן", nice: "נחמד", maybe: "אולי", visited: "ביקרנו", skip: "ויתרנו" };
const layerOf = p => p.layer === "hotel" ? "hotel" : (statusOf(p) === "maybe" ? "maybe" : (p.layer === "maybe" ? "food" : p.layer));
const colorOf = p => p.layer === "hotel" ? "#111" : (T.layers[p.layer === "maybe" ? "maybe" : p.layer] || T.layers.maybe).color;
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
function loadGoogle() {
  if (gReady) return gReady;
  gReady = new Promise((res, rej) => {
    window.__gmInit = () => res(window.google);
    const s = document.createElement("script");
    s.src = "https://maps.googleapis.com/maps/api/js?key=" + C.mapsKey + "&v=weekly&language=he&region=HU&loading=async&libraries=places,marker,geometry&callback=__gmInit";
    s.async = true; s.onerror = () => rej(new Error("maps"));
    window.gm_authFailure = () => { showMapError("גוגל דחתה את מפתח המפות. בדוק שהמפתח נעול לכתובת https://shlomiyishai-sudo.github.io/* ושהשירותים מופעלים."); };
    document.head.appendChild(s);
  });
  return gReady;
}
function showMapError(msg) { const n = $("#mapNote"); n.textContent = msg; n.hidden = false; toast(msg, 5000); }

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
  if (w.rain >= 60) a.push(d.date === "2026-11-10" ? "צפוי גשם ביום הטיול מחוץ לעיר. כדאי לשקול להחליף עם יום 4 (11.11)." : "צפוי גשם. ללבוש מעיל עמיד ולשלב עצירות במקומות מקורים (\"יורד גשם\" למטה).");
  else if (w.rain >= 30) a.push("יש סיכוי לטפטוף. כדאי מטרייה קטנה בתיק.");
  if (w.wind >= 35) a.push("רוח חזקה. בתצפיות הגבוהות (מבצר הדייגים, גבעת גלרט) יהיה קר, אז לקצר שם.");
  if (w.max <= 6) a.push("קר במיוחד: כובע, כפפות ושכבות.");
  if (!a.length) a.push("מזג אוויר טוב לשיטוט. התוכנית עומדת.");
  return a.join(" ");
}

// ---------- כותרת וימים ----------
function renderHeader() {
  $("#tripTitle").textContent = T.title;
  $("#tripSub").textContent = T.subtitle + " · " + T.days.length + " ימים";
  $("#dayChips").innerHTML = T.days.map((d, i) => `<button data-day="${i}" class="${i === day ? "on" : ""}">יום ${i+1}<small>${dayLabel(d)}</small></button>`).join("");
}
$("#dayChips").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; day = +b.dataset.day; renderHeader(); render(); });

// ---------- תצוגת היום ----------
async function renderToday() {
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
    let legHtml = "";
    if (p && prev && prev.id !== p.id) {
      const l = await leg(prev, p);
      if (l.mode === "WALK") { tot.walkM += l.m; tot.walkS += l.sec; } else tot.transS += l.sec;
      longest = Math.max(longest, l.sec);
      legHtml = `<li class="ti-item"><div></div><div class="leg ${l.sec > 1800 ? "long" : ""}">${l.mode === "WALK" ? "🚶" : "🚇"} ${fmtMin(l.sec)}${l.mode === "WALK" ? " · " + fmtDist(l.m) : " בתחבורה"}${l.est ? " (הערכה)" : ""}${l.sec > 1800 && l.mode === "WALK" ? " · מעל 30 דק', שווה מטרו או Bolt" : ""}</div></li>`;
    }
    if (p) prev = p;
    const c = p && info(p.id);
    rows.push(legHtml + `<li class="ti-item"><div class="ti-time">${esc(it.time)}</div>
      <button class="ti-card ${it.anchor ? "anchor" : ""}" ${p ? `data-place="${p.id}"` : "disabled"}>
        ${p ? `<span class="dot" style="background:${colorOf(p)}"></span>` : `<span class="dot" style="background:var(--line)"></span>`}
        <span class="tx"><span class="nm">${esc(it.text)}</span>
          ${p ? `<span class="sb">${esc(p.he)}${c && c.rating ? ` · ★ ${c.rating}` : ""}</span>` : ""}
          <span class="tags">${it.anchor ? `<span class="pill anchor">עוגן</span>` : ""}${it.book ? (bookDone[it.book] ? `<span class="pill ok">הוזמן</span>` : `<span class="pill book">להזמין</span>`) : ""}${(it.alt||[]).length ? `<span class="pill">+ ${it.alt.length} חלופות</span>` : ""}${p && statusOf(p)==="visited" ? `<span class="pill ok">ביקרנו</span>` : ""}</span>
        </span>
        ${c && c.photo ? `<img class="thumb" src="${esc(c.photo)}" alt="" loading="lazy">` : ""}
      </button></li>`);
  }
  tl.innerHTML = rows.join("");
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
    $("#showOnMap").onclick = () => { closeSheet(); mapLayer = "all"; go("map").then(() => focusPlace(p)); };
    $("#sheet").querySelectorAll("[data-st]").forEach(b => b.onclick = () => { statusOv[p.id] = b.dataset.st; store.set("status", statusOv); draw(info(p.id), open); toast("סומן: " + STATUS[b.dataset.st]); refreshMarkers(); });
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
function renderLayerBar() { $("#layerBar").innerHTML = MAPLAYERS().map(([k, n, c]) => `<button data-layer="${k}" class="${k === mapLayer ? "on" : ""}"><span class="sw" style="background:${c}"></span>${esc(n)}</button>`).join(""); }
$("#layerBar").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; mapLayer = b.dataset.layer; renderLayerBar(); refreshMarkers(); });
async function ensureMap() {
  if (map) return map;
  let g; try { g = await loadGoogle(); } catch { showMapError("לא הצלחתי לטעון את גוגל מפס. בדוק חיבור לאינטרנט."); return null; }
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
  el.innerHTML = `
    <h3 class="sec-title" style="margin-top:4px">טיסות ומלון</h3>
    <div class="docs">${T.docs.map(d => `<div class="doc"><h3>${d.kind === "flight" ? "✈️" : "🏨"} ${esc(d.title)}</h3>${d.lines.map(l => `<div>${esc(l)}</div>`).join("")}${d.place ? `<div class="row" style="margin-top:8px"><a class="btn ghost" href="${gmapsDir(P[d.place])}" target="_blank" rel="noopener">ניווט למלון</a></div>` : ""}</div>`).join("")}
      <div class="doc"><h3>🔒 מסמכים אישיים</h3><div>צילומי דרכונים, אישורי הזמנה ומספרי הזמנה יישמרו באזור פרטי שנוסיף בגרסה הבאה, מוגן בסיסמה ומסונכרן ביניכם.</div></div>
    </div>
    <h3 class="sec-title">מה צריך להזמין</h3>
    <div class="book-list">${T.bookings.map(b => `<div class="book ${bookDone[b.id] ? "done" : ""}"><div class="bt"><span>${esc(b.title)}</span><span class="pill ${b.urgency === "high" && !bookDone[b.id] ? "book" : ""}">${esc(b.when)}</span></div><p>${esc(b.note)}</p><label><input type="checkbox" data-book="${b.id}" ${bookDone[b.id] ? "checked" : ""}> הוזמן</label></div>`).join("")}</div>
    <h3 class="sec-title">המלצות מהקבוצה</h3>
    <div class="book-list">${(T.inbox||[]).map(x => `<div class="book"><div class="bt"><span>${esc(x.title)}</span><span class="pill ${({yes:"ok",no:"book",pending:"warn",partial:"warn"})[x.verdict]||""}">${({yes:"נכנס",no:"לא מתאים",replaced:"הוחלף",partial:"חלקי",pending:"ממתין"})[x.verdict]}</span></div><p>${esc(x.note)}</p></div>`).join("")}</div>
    <h3 class="sec-title">חירום</h3>
    <div class="docs">${T.emergency.map(x => `<div class="doc"><h3>${esc(x.label)}</h3><div class="row">${x.q ? `<a class="btn ghost" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(x.q)}" target="_blank" rel="noopener">פתח בגוגל מפס</a>` : `<span class="copyable">${esc(x.value)}</span>`}</div></div>`).join("")}</div>
    <h3 class="sec-title">רשימת קניות ומתנות</h3>
    <textarea id="shopping" rows="5" style="width:100%;font:inherit;padding:10px;border-radius:12px;border:1px solid var(--line);background:var(--surface);color:var(--fg)" placeholder="למשל: פפריקה מעושנת לאמא · יין טוקאי · ...">${esc(shopping)}</textarea>
    <h3 class="sec-title">הטיפים של הטיול</h3>
    <div class="tips">${T.tips.map(t => `<div class="tip"><b>${esc(t.t)}</b>${esc(t.d)}</div>`).join("")}</div>
    <h3 class="sec-title">גוגל מפס</h3>
    <div class="doc"><div>מוריד קובץ עם כל המקומות לפי שכבות. מייבאים אותו פעם אחת ל-Google My Maps, ואז כל השכבות מופיעות גם באפליקציית גוגל מפס, תחת "שמורים" ← "מפות".</div>
      <div class="row" style="margin-top:8px"><button class="btn" id="kmlAll">ייצוא כל המקומות</button><button class="btn ghost" id="kmlVisited">ייצוא "ביקרנו"</button><a class="btn ghost" href="https://www.google.com/maps/d/" target="_blank" rel="noopener">פתח את My Maps</a></div></div>
    <p class="muted small" style="margin:18px 0">גרסה 1 · נתונים מגוגל מתעדכנים אוטומטית · הסימונים נשמרים במכשיר הזה</p>`;
  el.querySelectorAll("[data-book]").forEach(i => i.onchange = () => { bookDone[i.dataset.book] = i.checked; store.set("booked", bookDone); renderDocs(); });
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
$("#quick").innerHTML = QUICK.map(([k, n]) => `<button data-q="${k}">${n}</button>`).join("");
$("#quick").addEventListener("click", e => { const b = e.target.closest("[data-q]"); if (b) quick(b.dataset.q); });
async function quick(k) {
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
    <h3 class="sec-title" style="margin-top:8px">מהרשימה שלנו</h3><div class="list">${ours.map(([p, d]) => card(p, d, "מכם")).join("") || `<p class="muted">אין משהו מהרשימה בקרבת מקום.</p>`}</div>
    <h3 class="sec-title">עוד בסביבה, לפי גוגל</h3><div class="list" id="gNear">${g == null ? `<p class="muted">מחפש…</p>` : g}</div>
    <p class="muted small" style="margin-top:10px">במקומות של גוגל צריך לבדוק בעצמכם התאמה למגבלות האוכל.</p>`);
  draw(null);
  if (k === "tired") $("#goHome").onclick = () => quick("home");
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
renderHeader(); renderHeaderWx(); go("today");
if (!wx || Date.now() - wx.t > 3 * 3600e3) loadWeather();
loadGoogle().catch(() => {});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
