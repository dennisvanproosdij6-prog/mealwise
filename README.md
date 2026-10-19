# MealWise

A mobile-first meal-planning web app that helps people **save money on groceries, plan
healthy meals, use ingredients they already have, and reduce food waste**.

It is a working app — not a mockup. Open `index.html` in a browser and use it.

---

## Run it

No build step, no server, no dependencies.

- **Simplest:** open `files/index.html` directly in a browser.
- **Recommended** (so the browser treats it as a proper origin for storage):

  ```bash
  cd files
  python3 -m http.server 8080
  # then visit http://localhost:8080
  ```

All data is stored in the browser's `localStorage`. There is no account and nothing is
uploaded.

---

## What works

| Area | Status |
|---|---|
| Personalised onboarding (household, budget, diet, allergies, cuisines, skill, time, goal) | ✅ Working |
| Home dashboard (today's meals, weekly budget, use-soon pantry, quick actions) | ✅ Working |
| "What can I cook?" generator (ingredients, time limit, meal type) | ✅ Working (on-device engine) |
| Weekly planner — 7 days × breakfast/lunch/dinner, replace / move / skip / eaten / leftovers / fill day / regenerate | ✅ Working |
| Automatic grocery list — merges duplicates, subtracts pantry, groups by category, edit / check / delete, shopping mode | ✅ Working |
| Pantry & waste tracker with expiry reminders and "use it up" suggestions | ✅ Working |
| Recipe collection — 20 full recipes, search, filters (cuisine, diet, time, cost, pantry), favourites, recently cooked | ✅ Working |
| Budget & savings — planned vs budget, category breakdown, cheaper swaps, manual spend log | ✅ Working |
| Premium screen with free/premium comparison and configurable pricing | ✅ Working (demo toggle) |
| Settings, data export, data reset, privacy notes | ✅ Working |
| Loading / empty / success / error states, toasts, input validation | ✅ Working |
| Persistence across reloads | ✅ Working |

The final quality check journey (onboard → set budget → generate a week → open a recipe →
add missing items → check items off → save a pantry item → reload → verify persistence) is
covered by an automated browser test and passes with **zero console errors**.

---

## Real vs. demo — read this

MealWise is honest about what is connected. It does **not** pretend to call services it
doesn't have.

| Feature | Reality in this build |
|---|---|
| **AI meal suggestions** | A **local, on-device recipe-matching engine** (scoring by pantry match, budget, time, goal, diet, cuisine). Clearly labelled "on-device demo mode". No external AI is called. |
| **Food photos** | Six bundled, AI-generated sample photos reused across recipes. No live photo search. |
| **Photo upload for ingredients** | **Not enabled** — it needs an image-recognition service. Text input works fully. |
| **Payments / subscriptions** | **Not connected.** The Premium upgrade is a local demo switch. No money changes hands and no subscription is created. |
| **Accounts / cloud sync** | **Not connected.** Everything lives in this browser's local storage. |
| **Grocery prices** | **Estimates** from recipe data, not live retailer prices. |
| **Nutrition** | **Approximate** values, shown only where available, always labelled as estimates. |
| **Allergen safety** | Recipes carry allergen flags and the app filters/ warns, but it **cannot verify products**. The UI states this explicitly and tells users to check labels. |

---

## What integration is still needed for production

1. **AI provider** — move generation behind a server endpoint that holds the API key
   (never in client code). The app already exposes the seam: set
   `MW.APP.aiMode = "connected"` in `data.js` and call your endpoint from
   `generateSuggestions()` in `app.js`.
2. **Payments** — connect a provider such as Stripe, show renewal and cancellation terms
   *before* purchase, and verify entitlements server-side. Prices are already configurable
   in the Premium screen.
3. **Accounts & backend** — authentication plus a database so plans, lists and pantry sync
   across devices, with proper protection of personal and allergy data.
4. **Image recognition** — a vision service to enable ingredient photo upload.
5. **Price data** — retailer or basket price feeds to replace estimated costs.
6. **Currency FX** — the current currency switcher relabels estimates with fixed
   multipliers (`MW.FX`), not live rates.

---

## Files

```
files/
├── index.html   App shell (bottom nav on mobile, sidebar on desktop)
├── app.css      Design system — warm off-white, forest green, sage
├── data.js      Seed data: 20 recipes, currencies, categories, defaults
├── app.js       State, persistence, router, screens, actions
└── food-*.png   Bundled sample food photography
```

## Design & technical notes

- **Design system** — warm off-white ground, deep forest-green accents, sage tones,
  Fraunces display type + Inter body, rounded cards, generous spacing, tasteful icons.
- **Responsive** — persistent bottom navigation on mobile (Home, Meal Plan, Groceries,
  Profile); grouped sidebar on desktop.
- **Accessibility** — semantic landmarks, skip link, focus-visible outlines, ARIA on
  interactive controls, live regions for toasts, touch targets ≥ 44 px, AA-contrast text.
- **Units** — metric (g, ml, °C) and euros by default; currency and units are configurable.
- **Privacy** — no trackers, no analytics, no uploads. Data can be exported or deleted
  from Profile & Settings.

## Disclaimer

Costs, nutrition and expiry information are estimates and reminders only. They are not
guarantees of price, nutritional content, or food safety. Always check product labels.
