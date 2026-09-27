# TravelGPT — Cinematic AI Travel Companion

An AI-powered cinematic travel companion that learns about the traveler first, then visually takes them on a journey toward their chosen destination.

## Flow

LANDING → Traveler Profile (name, age, interests) → "Start My Journey ✈️" → cinematic transition → AI chatbot → destination search → **Grand Destination Reveal** (images + animations) → budget / trip type / duration → personalized recommendations.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000 in Chrome/Edge, allow microphone access
```

## Deploy (Vercel / Netlify)

Static site — no build step. Point the deployment at this folder. On Vercel: `vercel` in this directory (framework preset: **Other**). On Netlify: drag-and-drop or connect the repo with publish directory = project root.

## Feature map

| Area | Details |
|---|---|
| Traveler profile | Full-screen glassmorphism screen; name, age (validated), multi-select interests; saved in `localStorage` (`tg_profile`); personalized greeting + recommendations |
| Cinematic reveal | Darken → destination name → location pin → hero image scale/fade → supporting images staggered → animated route line → shimmer + particles (1–3 s total) |
| Destination images | Fetched live from free sources: Wikipedia REST summary (hero) + Wikimedia Commons search (supporting). Custom destinations work too; graceful emoji/gradient fallback offline |
| Chatbot engine | Original rule-based logic preserved (budget/type/duration → recommendations, exact if/elif/else order), now destination-first |
| Voice | SpeechRecognition mic input + SpeechSynthesis output with synced talking animation (word-boundary mouth pulses) |
| Nature ambience | 🔊 toggle in the top-right; procedurally synthesized wind/stream/birds via WebAudio (no files needed); auto-ducks while the assistant speaks; starts only after user interaction; preference kept for the session; drop `assets/audio/ambience.mp3` to use a real file instead |
| Animations | Airplane take-off with trail, 3-layer parallax clouds, twinkling stars, floating particles, glass glow, staggered cards — all GPU-friendly (transform/opacity) |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` disables decorative animation |
| Responsive | Desktop / tablet / mobile; stacked cards, full-width chat panel, large touch targets, no horizontal scroll |

## Files

- `index.html` — structure: atmosphere layers, profile screen, site, reveal overlay, chat widget
- `style.css` — premium theme, animations, responsive rules
- `script.js` — profile, ambience, gallery + reveal, chat/voice engine
- `assets/audio/ambience.mp3` *(optional)* — add to switch from synthesized to real nature audio

## Notes

- Images load from Wikipedia/Wikimedia (free, CORS-enabled, no API key). Offline or blocked → cards fall back to tasteful emoji panels, never unrelated photos.
- The chatbot never exposes profile data anywhere else on the page; it stays in `localStorage` on the user's device.
"# TravelGPTFrontend" 
