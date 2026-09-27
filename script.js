/* ============================================================
   TravelGPT — cinematic AI travel companion
   - Preserves the original rule-based chatbot + voice engine
   - Adds: traveler profile, destination reveal + gallery,
     ambient nature sounds, premium animations hooks
   - 100% browser APIs, Vercel/Netlify static friendly
   ============================================================ */

// ---------------- elements ----------------
const $ = (id) => document.getElementById(id);
const botBubble = $("botBubble"), botPanel = $("botPanel"), chatMsgs = $("chatMessages");
const chatInput = $("chatInput"), micBtn = $("micBtn"), micHint = $("micHint");
const muteBtn = $("muteBtn"), chipsRow = $("chipsRow"), botStatus = $("botStatus"), notifDot = $("notifDot");
const profileScreen = $("profileScreen"), site = $("site");
const revealEl = $("reveal"), revealName = $("revealName"), revealSub = $("revealSub"), revealGrid = $("revealGrid");

const avatars = [
  { root: $("panelAvatar"), mouth: $("panelMouth") },
  { root: $("bubbleAvatar"), mouth: $("bubbleMouth") },
];

// ---------------- state ----------------
let muted = false, recognizing = false, recognition = null;
let revealOpen = false, pendingAfterReveal = null;
let step = "destination";            // destination -> budget -> type -> duration -> done
const answers = { destination: null, budget: null, type: null, duration: null };

// ---------------- auth dashboard (demo, client-side only) ----------------
const authScreen = $("authScreen"), authEmail = $("authEmail"), authPass = $("authPass"), authName = $("authName");
const authSubmit = $("authSubmit");
let authMode = "login";

function getUsers() { try { return JSON.parse(localStorage.getItem("tg_users")) || {}; } catch { return {}; } }
function saveUsers(u) { try { localStorage.setItem("tg_users", JSON.stringify(u)); } catch {} }
function getSession() { try { return JSON.parse(localStorage.getItem("tg_session")); } catch { return null; } }
function setSession(s) { try { s ? localStorage.setItem("tg_session", JSON.stringify(s)) : localStorage.removeItem("tg_session"); } catch {} }

async function hashPass(pw) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("tgpt::" + pw));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

function initAuth() {
  document.querySelectorAll(".auth-tab").forEach((tab) =>
    tab.addEventListener("click", () => {
      authMode = tab.dataset.tab;
      document.querySelectorAll(".auth-tab").forEach((t) => t.classList.toggle("selected", t === tab));
      $("nameGroup").classList.toggle("hidden", authMode === "login");
      authSubmit.textContent = authMode === "login" ? "Sign In ✈️" : "Create Account & Start ✈️";
      clearAuthErrors();
    })
  );
  authSubmit.addEventListener("click", submitAuth);
  [authEmail, authPass, authName].forEach((el) => el.addEventListener("keydown", (e) => { if (e.key === "Enter") submitAuth(); }));
  $("logoutBtn").addEventListener("click", () => {
    setSession(null);
    profileScreen.classList.add("hidden");
    authScreen.classList.remove("hidden");
    authPass.value = "";
  });
}

function clearAuthErrors() { ["errEmail", "errPass", "errAuthName"].forEach((id) => ($(id).textContent = "")); }

async function submitAuth() {
  clearAuthErrors();
  const email = authEmail.value.trim().toLowerCase();
  const pass = authPass.value;
  let ok = true;
  if (!emailOk(email)) { $("errEmail").textContent = "Enter a valid email address."; ok = false; }
  if (pass.length < 6) { $("errPass").textContent = "Password must be at least 6 characters."; ok = false; }
  if (!ok) return;

  const users = getUsers();
  const hash = await hashPass(pass);

  if (authMode === "signup") {
    const name = authName.value.trim();
    if (!name) { $("errAuthName").textContent = "Please enter a display name."; return; }
    if (users[email]) { $("errEmail").textContent = "An account with this email already exists — please sign in."; return; }
    users[email] = { hash, name, created: Date.now() };
    saveUsers(users);
    setSession({ email, name });
    enterDashboard(name);
  } else {
    const u = users[email];
    if (!u || u.hash !== hash) { $("errPass").textContent = "Invalid email or password."; return; }
    setSession({ email, name: u.name });
    enterDashboard(u.name);
  }
}

function enterDashboard(name) {
  // prefill traveler profile with the account identity
  const profile = getProfile() || {};
  if (!profile.name) { profile.name = name; saveProfile(profile); }
  if (!$("pfName").value) $("pfName").value = name;

  authScreen.classList.add("leaving");
  setTimeout(() => {
    authScreen.classList.add("hidden");
    profileScreen.classList.remove("hidden");
  }, 700);
}

// ---------------- traveler profile ----------------
const INTERESTS = [
  ["🧗", "Adventure"], ["🏖️", "Beaches"], ["🌿", "Nature"], ["🏔️", "Mountains"],
  ["👨‍👩‍👧", "Family"], ["💎", "Luxury"], ["🍜", "Food"], ["🏛️", "Culture"],
  ["🛍️", "Shopping"], ["📸", "Photography"], ["🏯", "Historical places"],
];

function getProfile() {
  try { return JSON.parse(localStorage.getItem("tg_profile")) || null; } catch { return null; }
}
function saveProfile(p) { try { localStorage.setItem("tg_profile", JSON.stringify(p)); } catch {} }

function initProfile() {
  // interest chips
  const wrap = $("interests");
  INTERESTS.forEach(([icon, label]) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "interest";
    b.innerHTML = `<span>${icon}</span>${label}`;
    b.dataset.label = label;
    b.addEventListener("click", () => b.classList.toggle("selected"));
    wrap.appendChild(b);
  });

  const saved = getProfile();
  if (saved) { $("pfName").value = saved.name || ""; $("pfAge").value = saved.age || ""; }

  $("startBtn").addEventListener("click", submitProfile);
  ["pfName", "pfAge"].forEach((id) =>
    $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") submitProfile(); })
  );
}

function submitProfile() {
  const name = $("pfName").value.trim();
  const age = parseInt($("pfAge").value, 10);
  const picks = [...document.querySelectorAll(".interest.selected")].map((b) => b.dataset.label || b.textContent.trim());

  let ok = true;
  $("errName").textContent = name ? "" : "Please tell us your name.";
  $("errAge").textContent = age >= 5 && age <= 100 ? "" : "Enter an age between 5 and 100.";
  $("errInterests").textContent = picks.length ? "" : "Pick at least one travel interest.";
  if (!name || !(age >= 5 && age <= 100) || !picks.length) ok = false;
  if (!ok) return;

  saveProfile({ name, age, interests: picks });
  startJourney();
}

function startJourney() {
  profileScreen.classList.add("leaving");
  setTimeout(() => {
    profileScreen.classList.add("hidden");
    site.classList.remove("hidden");
    openChat();
    // personalized greeting
    const p = getProfile();
    const likes = p.interests.slice(0, 3).join(", ").replace(/, ([^,]*)$/, " and $1");
    const hello = `Hi ${p.name}! 👋 I'm TravelGPT. Since you love ${likes}, let's plan a trip that matches your travel style.\n\nWhat destination or region are you dreaming about?`;
    addMsg(hello, "bot");
    speak(hello);
    showChips(["Kerala", "Goa", "Manali", "Dubai", "Bali", "Paris", "Switzerland", "Surprise me 🎲"]);
  }, 850);
}

// ---------------- ambient nature sounds (WebAudio synth) ----------------
// Structured for audio files: if assets/audio/ambience.mp3 exists it is used
// instead of the built-in synthesizer. Nothing autoplays — starts only after
// the user enables sound (or after first interaction if they previously chose ON).
const soundBtn = $("soundBtn");
let audioCtx = null, ambience = null, ambienceOn = false;
const AMBIENCE_FILE = "assets/audio/ambience.mp3";

function synthAmbience() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);

  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { // brown-ish noise = soft wind
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.2;
  }
  // wind layer
  const wind = ctx.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true;
  const windLP = ctx.createBiquadFilter(); windLP.type = "lowpass"; windLP.frequency.value = 420;
  const windGain = ctx.createGain(); windGain.gain.value = 0.5;
  wind.connect(windLP).connect(windGain).connect(master);
  // slow swell
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.18;
  lfo.connect(lfoGain).connect(windGain.gain);
  // stream layer
  const water = ctx.createBufferSource(); water.buffer = noiseBuf; water.loop = true;
  const waterBP = ctx.createBiquadFilter(); waterBP.type = "bandpass"; waterBP.frequency.value = 1400; waterBP.Q.value = 0.6;
  const waterGain = ctx.createGain(); waterGain.gain.value = 0.08;
  water.connect(waterBP).connect(waterGain).connect(master);
  // birds: occasional chirps
  let birdTimer = null;
  const chirp = () => {
    if (!ambienceOn) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    const t0 = ctx.currentTime, base = 2100 + Math.random() * 900;
    o.frequency.setValueAtTime(base, t0);
    o.frequency.exponentialRampToValueAtTime(base * 1.5, t0 + 0.09);
    o.frequency.exponentialRampToValueAtTime(base * 0.8, t0 + 0.18);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + 0.24);
    birdTimer = setTimeout(chirp, 5000 + Math.random() * 9000);
  };

  wind.start(); water.start(); lfo.start();
  return {
    start() { ambienceOn = true; master.gain.setTargetAtTime(0.16, ctx.currentTime, 1.2); chirp(); },
    duck() { master.gain.setTargetAtTime(0.05, ctx.currentTime, 0.3); },      // while TTS speaks
    unduck() { if (ambienceOn) master.gain.setTargetAtTime(0.16, ctx.currentTime, 0.6); },
    stop() { ambienceOn = false; clearTimeout(birdTimer); master.gain.setTargetAtTime(0, ctx.currentTime, 0.4); },
  };
}

async function ensureAmbience() {
  if (ambience) return ambience;
  try { // optional real audio file
    const res = await fetch(AMBIENCE_FILE, { method: "HEAD" });
    if (res.ok) {
      const el = new Audio(AMBIENCE_FILE); el.loop = true; el.volume = 0;
      ambience = {
        start() { ambienceOn = true; el.play().catch(() => {}); el.volume = 0.1; },
        duck() { el.volume = 0.03; },
        unduck() { if (ambienceOn) el.volume = 0.1; },
        stop() { ambienceOn = false; el.pause(); },
      };
      return ambience;
    }
  } catch {}
  ambience = synthAmbience();
  return ambience;
}

function setSound(on) {
  sessionStorage.setItem("tg_sound", on ? "on" : "off");
  soundBtn.textContent = on ? "🔊 Nature Sounds ON" : "🔇 Nature Sounds OFF";
  soundBtn.classList.toggle("on", on);
  if (on) ensureAmbience().then((a) => a && a.start());
  else if (ambience) ambience.stop();
}
soundBtn.addEventListener("click", () => setSound(!sessionStorage.getItem("tg_sound")?.endsWith("on")));
// never autoplay: only restore after a real user gesture
document.addEventListener("pointerdown", function firstTouch() {
  document.removeEventListener("pointerdown", firstTouch);
  if (sessionStorage.getItem("tg_sound") === "on" && !ambienceOn) setSound(true);
}, { once: false });

// ---------------- destination database ----------------
const DESTINATIONS = [
  { key: "kerala", names: ["kerala", "alleppey", "kochi", "munnar"], sub: "God's Own Country", tags: ["nature", "beaches", "food"], queries: ["Kerala backwaters", "Kerala beach", "Kathakali Kerala"] },
  { key: "goa", names: ["goa"], sub: "Sun, Sand & Sea", tags: ["beaches", "food", "shopping"], queries: ["Goa Palolem beach", "Panaji Goa", "Goa church"] },
  { key: "manali", names: ["manali", "solang"], sub: "Valley of the Gods", tags: ["mountains", "adventure", "nature"], queries: ["Manali Himachal", "Solang Valley", "Kullu Manali"] },
  { key: "kashmir", names: ["kashmir", "srinagar", "gulmarg", "leh", "ladakh"], sub: "Paradise on Earth", tags: ["mountains", "nature", "photography"], queries: ["Dal Lake Srinagar", "Gulmarg Kashmir", "Ladakh landscape"] },
  { key: "rajasthan", names: ["rajasthan", "jaipur", "udaipur", "jaisalmer"], sub: "Land of Kings", tags: ["culture", "historical places", "photography"], queries: ["Hawa Mahal Jaipur", "Lake Palace Udaipur", "Jaisalmer fort"] },
  { key: "dubai", names: ["dubai", "uae"], sub: "City of Gold", tags: ["luxury", "shopping", "adventure"], queries: ["Burj Khalifa", "Dubai Marina", "Dubai desert"] },
  { key: "bali", names: ["bali", "ubud"], sub: "Island of the Gods", tags: ["beaches", "nature", "food"], queries: ["Bali temple", "Tegallalang rice terrace", "Bali beach"] },
  { key: "paris", names: ["paris"], sub: "The City of Light", tags: ["culture", "food", "shopping"], queries: ["Eiffel Tower", "Louvre Pyramid", "Seine Paris"] },
  { key: "london", names: ["london"], sub: "The Old World Capital", tags: ["culture", "historical places", "shopping"], queries: ["Tower Bridge", "Big Ben", "London Eye"] },
  { key: "tokyo", names: ["tokyo"], sub: "Neon & Tradition", tags: ["food", "culture", "shopping"], queries: ["Tokyo Tower", "Shibuya crossing", "Senso-ji temple"] },
  { key: "new york", names: ["new york", "nyc", "newyork"], sub: "The City That Never Sleeps", tags: ["shopping", "culture", "photography"], queries: ["Manhattan skyline", "Statue of Liberty", "Central Park"] },
  { key: "switzerland", names: ["switzerland", "swiss", "zermatt", "interlaken"], sub: "Alpine Paradise", tags: ["mountains", "nature", "adventure"], queries: ["Matterhorn", "Lucerne Chapel Bridge", "Lauterbrunnen valley"] },
];

function findDestination(text) {
  const t = text.toLowerCase();
  for (const d of DESTINATIONS) if (d.names.some((n) => t.includes(n))) return d;
  // graceful custom fallback: treat the phrase as a free-text destination
  const cleaned = text.replace(/[^a-zA-Z\s']/g, "").trim();
  if (cleaned.length >= 3 && !/^(hi|hello|hey|no|yes|ok|help)\b/.test(t))
    return { key: cleaned.toLowerCase(), names: [cleaned.toLowerCase()], sub: "Your Chosen Escape", tags: [], queries: [cleaned, cleaned + " travel", cleaned + " landscape"], custom: true };
  return null;
}

// ---------------- gallery: free Wikipedia/Wikimedia sources ----------------
const imgCache = {};
function commonsThumbs(query, limit = 3) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=${limit + 2}&gsrsearch=${encodeURIComponent(query)}&prop=imageinfo&iiprop=url|mime&iiurlwidth=900`;
  return fetch(url).then((r) => r.json()).then((j) => {
    const pages = j?.query?.pages || {};
    return Object.values(pages)
      .map((p) => p.imageinfo?.[0])
      .filter((ii) => ii && /image\/(jpeg|png)/.test(ii.mime) && ii.thumburl)
      .slice(0, limit)
      .map((ii) => ii.thumburl);
  }).catch(() => []);
}

async function getGallery(dest) {
  if (imgCache[dest.key]) return imgCache[dest.key];
  let main = null, support = [];
  try { // hero image from Wikipedia article page image
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(dest.custom ? dest.names[0] : dest.key)}`);
    if (r.ok) { const j = await r.json(); main = j?.thumbnail?.source || j?.originalimage?.source || null; }
  } catch {}
  // supporting images from Wikimedia Commons search per theme
  const lists = await Promise.all(dest.queries.slice(0, 3).map((q) => commonsThumbs(q, 2)));
  support = lists.flat().filter((u) => u !== main).slice(0, 2);
  const gallery = { main: main || support[0] || null, support: (support.length ? support : ["fallback"]) };
  imgCache[dest.key] = gallery;
  return gallery;
}

// ---------------- grand destination reveal ----------------
const SPARKLES = ["✨", "🧭", "☁️", "🕊️", "🌴", "⭐"];
function openReveal(dest) {
  revealOpen = true;
  revealEl.classList.remove("hidden");
  revealEl.setAttribute("aria-hidden", "false");
  revealName.textContent = dest.key.toUpperCase();
  revealSub.textContent = `"${dest.sub}"` + (dest.tags.length ? `  ·  ${dest.tags.slice(0, 3).join(" · ")}` : "");
  revealGrid.innerHTML = "";

  // sparkles
  for (let i = 0; i < 8; i++) {
    const s = document.createElement("span");
    s.className = "sparkle"; s.textContent = SPARKLES[i % SPARKLES.length];
    s.style.left = 4 + Math.random() * 92 + "%";
    s.style.animationDuration = 7 + Math.random() * 7 + "s";
    s.style.animationDelay = Math.random() * 6 + "s";
    revealEl.appendChild(s);
  }

  revealEl.querySelector(".reveal-content").scrollTop = 0;
  $("revealContinue").disabled = true;
  $("revealContinue").textContent = "Loading destination…";

  getGallery(dest).then((g) => {
    const cards = [];
    cards.push(g.main ? imgCard(g.main, "📍 " + dest.key.toUpperCase(), dest.sub, true) : fallbackCard(dest));
    g.support.slice(0, 2).forEach((u, i) => {
      cards.push(u === "fallback" ? fallbackCard(dest) : imgCard(u, ["📸", "🌿"][i] + " " + (dest.tags[i] || "Highlights"), dest.queries[i + 1] || dest.sub, false));
    });
    cards.forEach((c) => revealGrid.appendChild(c));
    $("revealContinue").disabled = false;
    $("revealContinue").textContent = "Plan this trip with TravelGPT 💬";
  });

  $("revealContinue").onclick = closeReveal;
}

function imgCard(url, label, sub, tall) {
  const d = document.createElement("div");
  d.className = "reveal-card" + (tall ? " tall" : "");
  const img = document.createElement("img");
  img.loading = "lazy"; img.alt = label; img.src = url;
  img.onerror = () => { d.innerHTML = ""; d.appendChild(fallbackEl(label)); };
  const ov = document.createElement("div");
  ov.className = "ov"; ov.innerHTML = `<b>${label}</b><small>${sub}</small>`;
  d.append(img, ov);
  return d;
}
function fallbackCard(dest) {
  const d = document.createElement("div");
  d.className = "reveal-card";
  d.appendChild(fallbackEl("🌍"));
  const ov = document.createElement("div");
  ov.className = "ov"; ov.innerHTML = `<b>📍 ${dest.key.toUpperCase()}</b><small>${dest.sub}</small>`;
  d.appendChild(ov);
  return d;
}
function fallbackEl(emoji) {
  const f = document.createElement("div");
  f.className = "fallback"; f.textContent = emoji;
  return f;
}

function closeReveal() {
  if (!revealOpen) return;
  revealOpen = false;
  revealEl.classList.add("hidden");
  revealEl.setAttribute("aria-hidden", "true");
  revealEl.querySelectorAll(".sparkle").forEach((s) => s.remove());
  const next = pendingAfterReveal;
  pendingAfterReveal = null;
  if (next) next();
}

// ---------------- chat UI (existing engine) ----------------
function addMsg(text, who) {
  const div = document.createElement("div");
  div.className = "msg " + who;
  div.textContent = text;
  chatMsgs.appendChild(div);
  chatMsgs.scrollTop = chatMsgs.scrollHeight;
  return div;
}
function addReco(title, places, note) {
  const div = document.createElement("div");
  div.className = "reco-card";
  div.innerHTML = "<b>" + title + "</b><ul>" + places.map((p) => "<li>" + p + "</li>").join("") + "</ul><div class='reco-note'>" + note + "</div>";
  chatMsgs.appendChild(div);
  chatMsgs.scrollTop = chatMsgs.scrollHeight;
}
function showChips(options) {
  chipsRow.innerHTML = "";
  options.forEach((opt) => {
    const b = document.createElement("button");
    b.className = "chip"; b.textContent = opt;
    b.addEventListener("click", () => { chipsRow.innerHTML = ""; handleUserMessage(opt); });
    chipsRow.appendChild(b);
  });
}
function openChat() { botBubble.classList.add("hidden"); botPanel.classList.remove("hidden"); }
function showBubble() { botPanel.classList.add("hidden"); botBubble.classList.remove("hidden"); notifDot.style.display = "none"; }

botBubble.addEventListener("click", openChat);
$("minBtn").addEventListener("click", showBubble);
$("closeBtn").addEventListener("click", () => { stopSpeech(); showBubble(); });
$("sendBtn").addEventListener("click", sendTyped);
chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendTyped(); });
muteBtn.addEventListener("click", () => {
  muted = !muted;
  muteBtn.textContent = muted ? "🔇" : "🔊";
  muteBtn.classList.toggle("muted", muted);
  if (muted) stopSpeech();
});
function sendTyped() { const t = chatInput.value.trim(); if (t) handleUserMessage(t); }

// ---------------- speech synthesis + talking animation ----------------
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => /Google UK English Female|Google US English/i.test(v.name)) ||
    voices.find((v) => /Samantha|Zira|Aria|Jenny/i.test(v.name)) ||
    voices.find((v) => v.lang.startsWith("en")) ||
    voices[0]
  );
}
speechSynthesis.onvoiceschanged = () => {};

function speak(text, { onDone } = {}) {
  if (muted) { onDone && onDone(); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) u.voice = v;
  u.rate = 1.02; u.pitch = 1.05; u.volume = 1;

  u.onstart = () => { avatars.forEach((a) => a.root.classList.add("talking")); botStatus.textContent = "● speaking…"; if (ambience) ambience.duck(); };
  u.onboundary = () => avatars.forEach((a) => { a.mouth.style.height = "11px"; setTimeout(() => (a.mouth.style.height = ""), 90); });
  u.onend = u.onerror = () => {
    avatars.forEach((a) => a.root.classList.remove("talking"));
    botStatus.textContent = "● online · voice enabled";
    if (ambience) ambience.unduck();
    onDone && onDone();
  };
  speechSynthesis.speak(u);
}
function stopSpeech() { speechSynthesis.cancel(); avatars.forEach((a) => a.root.classList.remove("talking")); }

// ---------------- speech recognition ----------------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SR) {
  recognition = new SR();
  recognition.lang = "en-IN";
  recognition.interimResults = false;
  recognition.onstart = () => { recognizing = true; micBtn.classList.add("listening"); micHint.classList.remove("hidden"); };
  recognition.onend = () => { recognizing = false; micBtn.classList.remove("listening"); micHint.classList.add("hidden"); };
  recognition.onresult = (e) => { const t = e.results[0][0].transcript.trim(); if (t) handleUserMessage(t); };
  recognition.onerror = (e) => addMsg(e.error === "not-allowed" ? "Microphone blocked — please allow mic access." : "Sorry, I didn't catch that.", "bot");
  micBtn.addEventListener("click", () => {
    if (recognizing) { recognition.stop(); return; }
    stopSpeech(); recognition.start();
  });
} else micBtn.style.display = "none";

// ---------------- travel logic (original, preserved) ----------------
function recommend(budget, type_, duration) {
  const b = budget.toLowerCase(), t = type_.toLowerCase(), d = duration.toLowerCase();
  if (t.includes("adventure") && b.includes("low"))
    return { title: "Adventure on a budget — great combo!", places: ["Local trekking", "Camping", "Nature trails"] };
  else if (t.includes("family"))
    return { title: "Perfect picks for the family", places: ["Historical places", "Theme parks", "Family resorts"] };
  else if (t.includes("relaxation"))
    return { title: "Time to unwind — here you go", places: ["Beach resort", "Hill station", "Wellness retreat"] };
  else
    return { title: "Safe and enjoyable options", places: ["Local tourist attractions", "Museums", "Nature parks"] };
}

// parsers
const contains = (t, words) => words.some((w) => t.includes(w));
function parseBudget(t) {
  t = (t || "").toLowerCase();
  if (contains(t, ["low", "cheap", "tight", "budget", "less"])) return "low";
  if (contains(t, ["medium", "moderate", "mid", "normal"])) return "medium";
  if (contains(t, ["high", "luxury", "premium", "expensive", "rich"])) return "high";
  return null;
}
function parseType(t) {
  t = (t || "").toLowerCase();
  if (contains(t, ["adventure", "trek", "hik", "thrill", "camp"])) return "adventure";
  if (contains(t, ["family", "kids", "children", "parents"])) return "family";
  if (contains(t, ["relax", "chill", "peace", "beach", "spa", "calm"])) return "relaxation";
  return null;
}
function parseDuration(t) {
  t = (t || "").toLowerCase();
  if (contains(t, ["short", "weekend", "couple", "few"])) return "short";
  if (contains(t, ["long", "week", "extended", "month"])) return "long";
  const m = t.match(/(\d+)/);
  if (m) return parseInt(m[1], 10) <= 4 ? "short" : "long";
  return null;
}

const QUESTIONS = {
  budget: { q: "Love it! Now — what's your travel budget: low, medium or high?", chips: ["Low", "Medium", "High"] },
  type: { q: "And what kind of trip are you planning — adventure, family or relaxation?", chips: ["Adventure", "Family", "Relaxation"] },
  duration: { q: "How long will you travel — a short trip or a long one?", chips: ["Short", "Long"] },
};

function askStep(stepKey) {
  const conf = QUESTIONS[stepKey];
  addMsg(conf.q, "bot");
  showChips(conf.chips);
  speak(conf.q);
}

// ---------------- main message flow ----------------
function handleUserMessage(text) {
  addMsg(text, "user");
  chipsRow.innerHTML = "";

  setTimeout(() => {
    if (step === "destination") {
      const dest = /surprise|random|anywhere|roulette/.test(text.toLowerCase()) ? DESTINATIONS[Math.floor(Math.random() * DESTINATIONS.length)] : findDestination(text);
      if (!dest) return askAgain("Tell me a destination or region — for example Kerala, Dubai, Paris or Switzerland. 🌍");
      answers.destination = dest;
      // cinematic reveal first, questions continue after it closes
      pendingAfterReveal = () => { step = "budget"; askStep("budget"); };
      addMsg(`Beautiful choice! Let me take you there for a moment… ✈️`, "bot");
      openReveal(dest);

    } else if (step === "budget") {
      const b = parseBudget(text);
      if (!b) return askAgain("Please choose low, medium or high — or say something like \"low budget\".");
      answers.budget = b; step = "type"; askStep("type");

    } else if (step === "type") {
      const t = parseType(text);
      if (!t) return askAgain("Pick adventure, family or relaxation — which one sounds like your trip?");
      answers.type = t; step = "duration"; askStep("duration");

    } else if (step === "duration") {
      const d = parseDuration(text);
      if (!d) return askAgain("Is it a short trip or a long one?");
      answers.duration = d; step = "done";
      giveRecommendations(answers);

    } else {
      followUp(text);
    }
  }, 600 + Math.random() * 400);
}

function askAgain(msg) {
  addMsg(msg, "bot");
  const conf = QUESTIONS[step];
  if (conf) showChips(conf.chips);
  speak(msg);
}

function followUp(text) {
  const q = text.toLowerCase();
  if (contains(q, ["again", "restart", "new trip", "reset"])) return restart();
  if (contains(q, ["thank"])) return reply("You're most welcome! Have a wonderful trip! 👋");
  if (contains(q, ["weather"])) return reply("Great question! Check the local weather forecast for your dates before you travel — safety first!");
  if (contains(q, ["book", "price", "cost"])) return reply("You can find packages and prices on this page, or say \"restart\" and I'll plan a new trip for you!");
  reply("These are educational travel suggestions. Do check current weather, travel rules, prices and availability before travelling. Want a new recommendation? Just say \"restart\"!");
}

function reply(text) { addMsg(text, "bot"); speak(text); }

// ---------------- personalized recommendations ----------------
function giveRecommendations(a) {
  const p = getProfile() || { name: "traveler", interests: [] };
  const dest = a.destination;
  const { title, places } = recommend(a.budget, a.type, a.duration);

  const matched = (dest.tags || []).filter((tag) => p.interests.some((i) => i.toLowerCase().includes(tag) || tag.includes(i.toLowerCase())));
  const matchLine = matched.length
    ? ` It's a wonderful match for your love of ${matched.slice(0, 3).join(", ")}.`
    : "";
  const intro = `Great choice, ${p.name}! 🌿 ${dest.key.charAt(0).toUpperCase() + dest.key.slice(1)} pairs beautifully with your plans.` + matchLine;

  const durTip = a.duration === "short"
    ? "For a short trip, pick the option closest to home so you spend more time enjoying than travelling."
    : "For a long trip, plan rest days between activities so the trip stays fun.";

  addMsg(intro + "\nPossible Travel Recommendations for your " + a.budget + "-budget, " + a.type + " trip (" + a.duration + "):", "bot");
  addReco(
    "✨ " + dest.key.toUpperCase() + " — " + dest.sub,
    places,
    durTip + " These are educational travel suggestions — check current weather, travel rules, prices and availability before travelling."
  );
  speak(intro + " For a " + a.budget + " budget " + a.type + " trip, I recommend: " + places.join(", ") + ". " + durTip);
  showChips(["🔁 New recommendation", "Thanks"]);
}

function restart() {
  step = "destination";
  Object.keys(answers).forEach((k) => (answers[k] = null));
  const p = getProfile();
  addMsg("Starting over! Let's plan a new trip. 🧳\nWhat destination or region are you dreaming about this time?", "bot");
  showChips(["Kerala", "Goa", "Manali", "Dubai", "Bali", "Paris", "Switzerland", "Surprise me 🎲"]);
  speak("Let's plan a new trip! What destination are you dreaming about this time" + (p ? ", " + p.name : "") + "?");
}

// ---------------- hero tiles + particles + boot ----------------
function initDecor() {
  const tiles = ["🌿 Nature", "🏔️ Mountains", "🏖️ Beaches", "🍜 Food", "📸 Photography", "🏛️ Culture"];
  const hero = $("heroTiles");
  tiles.forEach((t) => {
    const s = document.createElement("span");
    s.className = "hero-tile"; s.textContent = t;
    hero.appendChild(s);
  });
  const part = $("particles");
  const icons = ["✈️", "🗺️", "🧭", "☁️", "🌴"];
  for (let i = 0; i < 12; i++) {
    const s = document.createElement("span");
    s.className = "particle"; s.textContent = icons[i % icons.length];
    s.style.left = Math.random() * 96 + "%";
    s.style.animationDuration = 16 + Math.random() * 18 + "s";
    s.style.animationDelay = Math.random() * 18 + "s";
    part.appendChild(s);
  }
}

initProfile();
initAuth();
initDecor();

// gate: auth -> profile -> chatbot
const session = getSession();
if (session) {
  // returning user this browser: skip auth
  authScreen.classList.add("hidden");
  profileScreen.classList.remove("hidden");
  if (!$("pfName").value) $("pfName").value = session.name || "";
} else {
  profileScreen.classList.add("hidden");
}
