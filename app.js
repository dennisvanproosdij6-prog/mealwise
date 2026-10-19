/* ============================================================
   MealWise — application logic
   Single-page app, no build step, no external runtime deps.
   Persistence: localStorage. AI suggestions run on-device (demo mode).
   ============================================================ */
(function () {
  "use strict";

  const MW = window.MW;
  const RECIPES = MW.RECIPES;
  const {
    CURRENCIES, FX, DIETS, ALLERGENS, CUISINES, GOALS, SKILLS,
    ING_CATEGORIES, DEFAULT_SETTINGS, SEED_PANTRY,
  } = MW;

  /* ---------------------------------------------------------
     Utilities
     --------------------------------------------------------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  const uid = () => Math.random().toString(36).slice(2, 10);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const DAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const SLOTS = [
    { id: "breakfast", label: "Breakfast" },
    { id: "lunch", label: "Lunch" },
    { id: "dinner", label: "Dinner" },
  ];

  function money(eur) {
    const code = state.settings.currency;
    const cur = CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
    const v = (Number(eur) || 0) * (MW.FX[code] || 1);
    const sym = cur.symbol.length > 1 ? cur.symbol + " " : cur.symbol;
    return sym + v.toFixed(2);
  }
  function iso(d) {
    const x = d instanceof Date ? d : new Date(d);
    return x.toISOString().slice(0, 10);
  }
  function today() { return iso(new Date()); }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function mondayOf(date) {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7; // Mon=0
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function humanDate(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d)) return "";
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }
  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d)) return null;
    const t = new Date(today() + "T00:00:00");
    return Math.round((d - t) / 86400000);
  }
  function fracLabel(x) {
    const whole = Math.floor(x);
    const f = Math.round((x - whole) * 100) / 100;
    const map = { 0.25: "¼", 0.5: "½", 0.75: "¾" };
    if (map[f] !== undefined) return (whole ? whole : "") + map[f];
    return String(Math.round(x * 100) / 100);
  }
  function qtyLabel(q, u) {
    if (q == null || q === "") return u || "";
    let n = Math.round(Number(q) * 100) / 100;
    let unit = u || "";
    if (unit === "g" && n >= 1000) { n = n / 1000; unit = "kg"; }
    if (unit === "ml" && n >= 1000) { n = n / 1000; unit = "l"; }
    const countish = ["piece", "slice", "clove", "can", "handful", "tbsp", "tsp"].indexOf(unit) !== -1;
    let num;
    if (countish) {
      const r = Math.round(n * 4) / 4;
      num = fracLabel(r);
      unit = r === 1 ? unit : unit === "piece" ? "pieces" : unit;
    } else {
      num = String(n);
    }
    return num + " " + unit;
  }

  /* ---------------------------------------------------------
     Icons
     --------------------------------------------------------- */
  const I = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h2.4l2.5 12.2A2 2 0 0 0 8.9 17h9.4a2 2 0 0 0 2-1.6L22 7H5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17.5H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
    basket: '<path d="M4 9h16l-1.5 11.5a1.5 1.5 0 0 1-1.5 1.3H7a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M8.5 9 12 2.5 15.5 9M9 13v5M15 13v5"/>',
    wallet: '<rect x="2.5" y="5.5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/><circle cx="17" cy="15" r="1.3"/>',
    sparkles: '<path d="M12 2.5 13.8 8 19 9.8 13.8 11.6 12 17l-1.8-5.4L5 9.8 10.2 8z"/><path d="M19 15.5 19.8 18 22 18.8 19.8 19.6 19 22l-.8-2.4L16 18.8 18.2 18z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M4 12.5 9.5 18 20 6.5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    chevR: '<path d="M9 5l7 7-7 7"/>',
    chevL: '<path d="M15 5l-7 7 7 7"/>',
    chevD: '<path d="M5 9l7 7 7-7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    heart: '<path d="M12 20.5S3.5 15 3.5 8.9A4.9 4.9 0 0 1 12 5.6a4.9 4.9 0 0 1 8.5 3.3C20.5 15 12 20.5 12 20.5z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.3l3.3 2"/>',
    users: '<circle cx="9" cy="8" r="3.4"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.2a3.4 3.4 0 0 1 0 6.6M17.5 20a6.5 6.5 0 0 0-2-4.7"/>',
    flame: '<path d="M12 22c4 0 7-2.7 7-6.6 0-4.4-4.5-6.9-4.5-10.4C14.5 3 13 2 12 2c0 3-2 4.5-3.6 6.3A8 8 0 0 0 6 14c0 4 2.6 8 6 8z"/>',
    leaf: '<path d="M20 4C10 4 4 9 4 16c0 2 1 4 1 4s1-8 9-11c0 0-6 4-7 13 0 0 12 3 14-18z"/>',
    trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 14h9l1-14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14.5 5.5l4 4"/>',
    camera: '<path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.8l1.2-2h6.9l1.2 2h1.8A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="3.6"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.3"/><path d="M20 4.5V11h-6.5"/>',
    shuffle: '<path d="M17 4l3 3-3 3"/><path d="M17 14l3 3-3 3"/><path d="M4 7h4l8 10h5M4 17h4l2-2.5M14 9.5 16 7h5"/>',
    arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    alert: '<path d="M12 3 2.5 20h19z"/><path d="M12 9.5v5M12 17.5v.2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.6v.2"/>',
    star: '<path d="m12 3 2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17.9 6.4 20l1.2-6.2L3 9.5l6.3-.8z"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    bag: '<path d="M5.5 8h13l1 12.5h-15z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    lock: '<rect x="4.5" y="10" width="15" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    cameraOff: "",
    minus: '<path d="M5 12h14"/>',
    send: '<path d="M22 3 11 14M22 3l-7 18-4-7-7-4z"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/>',
    shield: '<path d="M12 2.5 20 5.5v6c0 5-3.4 8.7-8 10.5-4.6-1.8-8-5.5-8-10.5v-6z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/>',
  };
  function icon(name, cls) {
    const p = I[name] || "";
    return '<svg class="' + (cls || "ico") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + "</svg>";
  }

  /* ---------------------------------------------------------
     State + persistence
     --------------------------------------------------------- */
  let state = null;
  const listeners = [];

  function blankState() {
    return {
      settings: Object.assign({}, DEFAULT_SETTINGS),
      pantry: MW.SEED_PANTRY.map((p) => ({
        id: uid(),
        name: p.name,
        q: p.q,
        u: p.u,
        expiry: p.expiry === "soon" ? iso(addDays(new Date(), 2)) : p.expiry || null,
      })),
      favorites: [],
      cooked: [], // {id, at}
      plan: { created: false, weekStart: iso(mondayOf(new Date())), meals: {}, servings: 2 },
      savedPlans: [],
      grocery: { items: [], updated: null, fromPlan: false },
      savedRecipes: [], // user-generated
      budgetLog: [], // {id, label, amount, date}
      planGenerations: 0,
      meta: { createdAt: new Date().toISOString(), version: MW.APP.version },
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(MW.APP.storageKey);
      if (!raw) return blankState();
      const parsed = JSON.parse(raw);
      const s = blankState();
      // shallow-merge to survive schema additions
      const merged = Object.assign({}, s, parsed);
      merged.settings = Object.assign({}, s.settings, parsed.settings || {});
      merged.plan = Object.assign({}, s.plan, parsed.plan || {});
      merged.grocery = Object.assign({}, s.grocery, parsed.grocery || {});
      merged.pantry = Array.isArray(parsed.pantry) ? parsed.pantry : s.pantry;
      merged.favorites = Array.isArray(parsed.favorites) ? parsed.favorites : [];
      merged.cooked = Array.isArray(parsed.cooked) ? parsed.cooked : [];
      merged.savedRecipes = Array.isArray(parsed.savedRecipes) ? parsed.savedRecipes : [];
      merged.budgetLog = Array.isArray(parsed.budgetLog) ? parsed.budgetLog : [];
      merged.savedPlans = Array.isArray(parsed.savedPlans) ? parsed.savedPlans : [];
      return merged;
    } catch (e) {
      console.warn("MealWise: could not read saved data, starting fresh.", e);
      return blankState();
    }
  }

  let saveTimer = null;
  function save(immediate) {
    const doSave = () => {
      try {
        localStorage.setItem(MW.APP.storageKey, JSON.stringify(state));
      } catch (e) {
        console.warn("MealWise: save failed", e);
        toast("Could not save to this browser's storage.", "error");
      }
    };
    if (immediate) { doSave(); return; }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, 200);
  }

  function subscribe(fn) { listeners.push(fn); }
  function emit() { listeners.forEach((f) => f()); }

  /* ---------------------------------------------------------
     Toast + modal
     --------------------------------------------------------- */
  function toast(msg, type) {
    const root = $("#toast-root");
    const el = document.createElement("div");
    el.className = "toast " + (type || "");
    const ico = type === "error" ? "alert" : type === "success" ? "check" : "info";
    el.innerHTML = icon(ico) + "<span>" + esc(msg) + "</span>";
    root.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .3s"; }, 2600);
    setTimeout(() => el.remove(), 3000);
  }

  let lastFocus = null;
  function openModal(opts) {
    lastFocus = document.activeElement;
    const root = $("#modal-root");
    root.innerHTML =
      '<div class="modal-backdrop" data-action="modal-close"></div>' +
      '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(opts.label || opts.title || "Dialog") + '">' +
        '<div class="sheet-grip"></div>' +
        '<div class="sheet-hd">' +
          '<h2 style="margin:0;flex:1;font-size:1.2rem">' + esc(opts.title || "") + "</h2>" +
          '<button class="btn ghost sm icon" data-action="modal-close" aria-label="Close">' + icon("close") + "</button>" +
        "</div>" +
        '<div class="sheet-body">' + (opts.body || "") + "</div>" +
      "</div>";
    root.classList.add("open");
    document.body.style.overflow = "hidden";
    const focusable = root.querySelector("input,select,textarea,button:not([data-action='modal-close'])");
    if (focusable) setTimeout(() => focusable.focus(), 60);
    const onKey = (e) => { if (e.key === "Escape") closeModal(); };
    document.addEventListener("keydown", onKey);
    root._onKey = onKey;
  }
  function closeModal() {
    const root = $("#modal-root");
    if (root._onKey) document.removeEventListener("keydown", root._onKey);
    root.classList.remove("open");
    root.innerHTML = "";
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---------------------------------------------------------
     Domain helpers
     --------------------------------------------------------- */
  function allRecipes() { return RECIPES.concat(state.savedRecipes || []); }
  function getRecipe(id) { return allRecipes().find((r) => r.id === id) || null; }
  function recipeCost(r) { return (r.ingredients || []).reduce((s, i) => s + (Number(i.cost) || 0), 0); }
  function costPerServing(r) { return recipeCost(r) / (r.servings || 1); }
  function isFavorite(id) { return state.favorites.indexOf(id) !== -1; }

  function dietAllows(r) {
    const d = state.settings.diet;
    if (!d || d === "none" || d === "other") return true;
    const rd = r.diet || [];
    if (d === "vegan") return rd.indexOf("vegan") !== -1;
    if (d === "vegetarian") return rd.indexOf("vegetarian") !== -1 || rd.indexOf("vegan") !== -1;
    if (d === "pescatarian") return rd.indexOf("pescatarian") !== -1 || rd.indexOf("vegetarian") !== -1 || rd.indexOf("vegan") !== -1;
    return true;
  }
  function allergenConflict(r) {
    const mine = state.settings.allergies || [];
    if (!mine.length) return [];
    return (r.allergens || []).filter((a) => mine.indexOf(a) !== -1);
  }
  function avoidedConflict(r) {
    const avoid = (state.settings.avoid || []).filter(Boolean).map((x) => String(x).toLowerCase().trim());
    if (!avoid.length) return [];
    return (r.ingredients || [])
      .filter((i) => avoid.some((a) => i.n.toLowerCase().indexOf(a) !== -1))
      .map((i) => i.n);
  }
  function safeRecipes() {
    return allRecipes().filter((r) => dietAllows(r) && allergenConflict(r).length === 0 && avoidedConflict(r).length === 0);
  }
  function pantryNames() { return state.pantry.map((p) => p.name.toLowerCase()); }
  function pantryMatch(r) {
    const pn = pantryNames();
    if (!pn.length) return 0;
    const hit = (r.ingredients || []).filter((i) => pn.some((p) => i.n.toLowerCase().indexOf(p) !== -1 || p.indexOf(i.n.toLowerCase()) !== -1)).length;
    return (r.ingredients || []).length ? hit / r.ingredients.length : 0;
  }
  function totalTime(r) { return (r.time || 0) + (r.cook || 0); }
  function skillRank(s) { return { beginner: 0, confident: 1, advanced: 2 }[s] || 0; }

  function scoreRecipe(r, ctx) {
    let s = 0;
    const goal = state.settings.goal;
    s += pantryMatch(r) * 40;
    if (goal === "save_money") s += Math.max(0, 12 - costPerServing(r) * 3);
    if (goal === "save_time") s += Math.max(0, 15 - totalTime(r) * 0.25);
    if (goal === "eat_healthy") s += r.nutrition ? Math.max(0, 8 - Math.abs((r.nutrition.kcal || 500) - 550) / 60) : 0;
    if (goal === "reduce_waste") s += pantryMatch(r) * 25;
    if ((state.settings.cuisines || []).indexOf(r.cuisine) !== -1) s += 8;
    if (skillRank(r.skill) <= skillRank(state.settings.skill)) s += 5;
    if (ctx && ctx.ingredients && ctx.ingredients.length) {
      const want = ctx.ingredients.map((x) => x.toLowerCase());
      const hit = (r.ingredients || []).filter((i) => want.some((w) => i.n.toLowerCase().indexOf(w) !== -1 || w.indexOf(i.n.toLowerCase()) !== -1)).length;
      s += hit * 12;
    }
    return s;
  }

  /* ---------------------------------------------------------
     Grocery list
     --------------------------------------------------------- */
  function normalizeUnit(q, u) {
    if (u === "g" && q >= 1000) return { q: q / 1000, u: "kg" };
    if (u === "ml" && q >= 1000) return { q: q / 1000, u: "l" };
    return { q, u };
  }

  function planMealsList() {
    const out = [];
    for (let d = 0; d < 7; d++) {
      SLOTS.forEach((sl) => {
        const key = d + ":" + sl.id;
        const m = state.plan.meals[key];
        if (!m || !m.recipeId) return;
        if (m.status === "skipped") return;
        out.push({ key, day: d, slot: sl.id, meal: m });
      });
    }
    return out;
  }

  function planCost() {
    let total = 0;
    planMealsList().forEach(({ meal }) => {
      const r = getRecipe(meal.recipeId);
      if (!r) return;
      if (meal.leftoverFrom) return; // already counted with the source meal
      total += recipeCost(r) * ((meal.servings || state.settings.people) / (r.servings || 1));
    });
    return total;
  }

  function buildGroceryFromPlan(keepChecked) {
    const agg = {};
    const covered = [];
    planMealsList().forEach(({ meal }) => {
      const r = getRecipe(meal.recipeId);
      if (!r) return;
      const factor = (meal.servings || state.settings.people) / (r.servings || 1);
      (r.ingredients || []).forEach((ing) => {
        const key = ing.n.toLowerCase().trim() + "|" + ing.u;
        if (!agg[key]) {
          agg[key] = { name: ing.n, q: 0, u: ing.u, cost: 0, category: MW.categoryFor(ing.n), recipes: [] };
        }
        agg[key].q += (Number(ing.q) || 0) * factor;
        agg[key].cost += (Number(ing.cost) || 0) * factor;
        if (agg[key].recipes.indexOf(r.name) === -1) agg[key].recipes.push(r.name);
      });
    });

    // subtract pantry
    const items = [];
    Object.keys(agg).forEach((k) => {
      const a = agg[k];
      const p = state.pantry.find((x) => x.name.toLowerCase().trim() === a.name.toLowerCase().trim());
      let q = a.q;
      if (p && p.u === a.u && Number(p.q) > 0) {
        const before = q;
        q = Math.max(0, q - Number(p.q));
        if (q < before) covered.push({ name: a.name, amount: before - q, u: a.u });
      }
      if (q <= 0) return;
      const nrm = normalizeUnit(q, a.u);
      items.push({
        id: uid(), name: a.name, q: Math.round(nrm.q * 100) / 100, u: nrm.u,
        category: a.category, checked: false, custom: false,
        est: a.cost * (q / a.q), sources: a.recipes,
      });
    });

    // preserve checked state + custom items if requested
    if (keepChecked) {
      items.forEach((it) => {
        const prev = state.grocery.items.find((x) => x.name.toLowerCase() === it.name.toLowerCase() && !x.custom);
        if (prev && prev.checked) it.checked = true;
      });
      state.grocery.items.filter((x) => x.custom).forEach((c) => items.push(c));
    }
    items.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    return { items, covered };
  }

  function groceryTotal() {
    return state.grocery.items.reduce((s, i) => s + (Number(i.est) || 0), 0);
  }

  function addIngredientsToGrocery(recipe, servings, onlyMissing) {
    const factor = (servings || recipe.servings || 1) / (recipe.servings || 1);
    let added = 0;
    (recipe.ingredients || []).forEach((ing) => {
      const have = state.pantry.find((p) => p.name.toLowerCase().trim() === ing.n.toLowerCase().trim());
      if (onlyMissing && have && Number(have.q) >= Number(ing.q) * factor && have.u === ing.u) return;
      const nrm = normalizeUnit((Number(ing.q) || 0) * factor, ing.u);
      const existing = state.grocery.items.find(
        (i) => i.name.toLowerCase().trim() === ing.n.toLowerCase().trim() && i.u === nrm.u
      );
      if (existing) {
        existing.q = Math.round((existing.q + nrm.q) * 100) / 100;
        existing.est = (Number(existing.est) || 0) + (Number(ing.cost) || 0) * factor;
      } else {
        state.grocery.items.push({
          id: uid(), name: ing.n, q: Math.round(nrm.q * 100) / 100, u: nrm.u,
          category: MW.categoryFor(ing.n), checked: false, custom: false,
          est: (Number(ing.cost) || 0) * factor, sources: [recipe.name],
        });
      }
      added++;
    });
    state.grocery.updated = new Date().toISOString();
    state.grocery.fromPlan = state.grocery.fromPlan || planMealsList().length > 0;
    save();
    return added;
  }

  /* ---------------------------------------------------------
     On-device meal generator (demo mode)
     --------------------------------------------------------- */
  function generateSuggestions(opts) {
    opts = opts || {};
    const pool = safeRecipes().filter((r) => {
      if (opts.maxTime && totalTime(r) > opts.maxTime) return false;
      if (opts.mealType && (r.meals || []).indexOf(opts.mealType) === -1) return false;
      return true;
    });
    const ctx = { ingredients: opts.ingredients || [] };
    const scored = pool.map((r) => ({ r, s: scoreRecipe(r, ctx) + Math.random() * 3 })).sort((a, b) => b.s - a.s);
    const n = opts.count || 6;
    return scored.slice(0, n).map((x) => x.r);
  }

  function pickRecipeFor(day, slot) {
    const used = {};
    Object.keys(state.plan.meals).forEach((k) => {
      const m = state.plan.meals[k];
      if (m && m.recipeId) used[m.recipeId] = (used[m.recipeId] || 0) + 1;
    });
    const pool = safeRecipes().filter((r) => (r.meals || []).indexOf(slot) !== -1);
    const ctx = { ingredients: state.pantry.map((p) => p.name) };
    const scored = pool
      .map((r) => {
        const n = (used[r.id] || 0) + 1;
        return { r, s: scoreRecipe(r, ctx) - Math.pow(n, 2) * 9 + Math.random() * 10 };
      })
      .sort((a, b) => b.s - a.s);
    return scored.length ? scored[0].r : null;
  }

  function generatePlan() {
    const meals = {};
    state.plan.meals = meals; // assign up-front so pickRecipeFor sees what's already been placed
    for (let d = 0; d < 7; d++) {
      SLOTS.forEach((sl) => {
        const r = pickRecipeFor(d, sl.id);
        if (r) meals[d + ":" + sl.id] = { recipeId: r.id, servings: state.settings.people, status: "planned" };
      });
    }
    state.plan.created = true;
    state.plan.weekStart = iso(mondayOf(new Date()));
    state.plan.servings = state.settings.people;
    state.planGenerations = (state.planGenerations || 0) + 1;
  }

  function consumeCredit() {
    if (state.settings.plan === "premium") return true;
    if (state.settings.aiCredits > 0) { state.settings.aiCredits -= 1; return true; }
    return false;
  }

  /* ---------------------------------------------------------
     Router
     --------------------------------------------------------- */
  const ROUTES = ["onboarding", "home", "generator", "plan", "groceries", "pantry", "recipes", "recipe", "budget", "premium", "profile", "privacy"];
  function parseRoute() {
    let h = location.hash.replace(/^#\/?/, "");
    if (!h) h = state && state.settings.onboarded ? "home" : "onboarding";
    const parts = h.split("/");
    let name = parts[0] || "home";
    if (ROUTES.indexOf(name) === -1) name = "home";
    return { name, param: parts[1] || null };
  }

  function nav(path) {
    if (location.hash === "#/" + path) render();
    else location.hash = "#/" + path;
  }

  /* ---------------------------------------------------------
     Shell rendering
     --------------------------------------------------------- */
  const NAV_ITEMS = [
    { route: "home", label: "Home", icon: "home" },
    { route: "plan", label: "Meal Plan", icon: "calendar" },
    { route: "groceries", label: "Groceries", icon: "cart" },
    { route: "profile", label: "Profile", icon: "user" },
  ];
  const SIDE_GROUPS = [
    { label: "Plan", items: [
      { route: "home", label: "Home", icon: "home" },
      { route: "plan", label: "Meal Plan", icon: "calendar" },
      { route: "generator", label: "What can I cook?", icon: "sparkles" },
    ]},
    { label: "Kitchen", items: [
      { route: "recipes", label: "Recipes", icon: "book" },
      { route: "groceries", label: "Groceries", icon: "cart", count: () => state.grocery.items.filter((i) => !i.checked).length },
      { route: "pantry", label: "Pantry", icon: "basket" },
    ]},
    { label: "Insights", items: [
      { route: "budget", label: "Budget", icon: "wallet" },
      { route: "premium", label: "MealWise Premium", icon: "sparkles" },
      { route: "profile", label: "Profile & Settings", icon: "user" },
    ]},
  ];

  function renderShell(route) {
    const active = route.name === "recipe" ? "recipes" : route.name;
    // bottom nav
    $("#bottomnav").innerHTML = NAV_ITEMS.map((it) => {
      const cur = active === it.route ? ' aria-current="page"' : "";
      let badge = "";
      if (it.route === "groceries") {
        const c = state.grocery.items.filter((i) => !i.checked).length;
        if (c) badge = '<span class="badge-count">' + c + "</span>";
      }
      return (
        '<button class="navbtn" data-action="nav" data-route="' + it.route + '"' + cur + ' aria-label="' + esc(it.label) + '">' +
          '<span style="position:relative">' + icon(it.icon, "navicon") + badge + "</span>" +
          "<span>" + esc(it.label) + "</span>" +
        "</button>"
      );
    }).join("");

    // sidebar
    $("#sidebar").innerHTML =
      '<div class="side-brand"><div class="logo">M</div><div class="name">MealWise</div></div>' +
      SIDE_GROUPS.map((g) =>
        '<div class="navgroup"><div class="glabel">' + esc(g.label) + '</div><ul class="sidenav">' +
        g.items.map((it) => {
          const cur = active === it.route ? ' aria-current="page"' : "";
          const c = it.count ? it.count() : 0;
          return '<li><button data-action="nav" data-route="' + it.route + '"' + cur + ">" +
            icon(it.icon, "navicon") + "<span>" + esc(it.label) + "</span>" +
            (c ? '<span class="pill">' + c + "</span>" : "") + "</button></li>";
        }).join("") + "</ul></div>"
      ).join("") +
      '<div style="margin-top:auto;padding:14px 8px 4px">' +
        (state.settings.plan === "premium"
          ? '<div class="banner sage">' + icon("sparkles") + "<div><strong>Premium active</strong><br><span class='tiny'>Unlimited AI generations</span></div></div>"
          : '<button class="btn block sm" data-action="nav" data-route="premium">' + icon("sparkles") + " Upgrade to Premium</button>") +
      "</div>";

    // topbar
    const titles = { home: "Home", plan: "Weekly Meal Plan", generator: "What can I cook?", groceries: "Grocery List", pantry: "Pantry", recipes: "Recipes", recipe: "Recipe", budget: "Budget & Savings", premium: "MealWise Premium", profile: "Profile & Settings", privacy: "Privacy & Data" };
    $("#topbar").innerHTML =
      '<div class="tb-title">' + esc(titles[route.name] || "MealWise") + "</div>" +
      '<div class="spacer"></div>' +
      (state.settings.plan === "premium"
        ? '<span class="tag gold">' + icon("sparkles") + " Premium</span>"
        : '<span class="tag line">' + icon("sparkles") + " " + state.settings.aiCredits + " AI left</span>");
  }

  /* ---------------------------------------------------------
     Screens
     --------------------------------------------------------- */
  const screens = {};

  /* ---- Onboarding ---- */
  let onb = null;
  screens.onboarding = function () {
    if (!onb) {
      onb = {
        step: 0,
        people: state.settings.people || 2,
        budget: state.settings.budget || 60,
        currency: state.settings.currency || "EUR",
        diet: state.settings.diet || "none",
        dietOther: state.settings.dietOther || "",
        allergies: (state.settings.allergies || []).slice(),
        avoid: (state.settings.avoid || []).join(", "),
        cuisines: (state.settings.cuisines || []).slice(),
        skill: state.settings.skill || "beginner",
        maxTime: state.settings.maxTime || 30,
        goal: state.settings.goal || "save_money",
      };
    }
    const steps = 6;
    const bar = Array.from({ length: steps }).map((_, i) => '<span class="' + (i <= onb.step ? "on" : "") + '"></span>').join("");

    const bodies = [
      // 0 welcome
      function () {
        return (
          '<div class="welcome">' +
            '<div class="wlogo">M</div>' +
            "<h1>Welcome to MealWise</h1>" +
            '<p class="muted" style="max-width:42ch;margin:0 auto 22px">Plan healthy meals, spend less on groceries, use what you already have and waste less food. A few quick questions and we\'ll personalise everything.</p>' +
            '<button class="btn lg block" data-action="onb-next">Get started</button>' +
            '<p class="tiny muted" style="margin-top:16px">Everything is stored privately in this browser. No account needed. ' +
            '<a href="#/privacy" data-action="nav" data-route="privacy">How your data is handled</a></p>' +
          "</div>"
        );
      },
      // 1 household + budget
      function () {
        return (
          '<h1 class="onb-title">Who are you cooking for?</h1>' +
          '<p class="onb-sub">We use this to size portions and estimate costs.</p>' +
          '<div class="field"><label for="onb-people">People you cook for</label>' +
            '<div class="row"><button class="btn ghost icon" data-action="onb-people" data-delta="-1" aria-label="Fewer people">' + icon("minus") + "</button>" +
            '<input class="input" id="onb-people" type="number" min="1" max="12" value="' + onb.people + '" style="text-align:center;max-width:110px" />' +
            '<button class="btn ghost icon" data-action="onb-people" data-delta="1" aria-label="More people">' + icon("plus") + "</button></div></div>" +
          '<div class="grid2">' +
            '<div class="field"><label for="onb-budget">Weekly grocery budget</label>' +
              '<input class="input" id="onb-budget" type="number" min="0" step="5" value="' + onb.budget + '" /></div>' +
            '<div class="field"><label for="onb-currency">Currency</label><select class="input" id="onb-currency">' +
              CURRENCIES.map((c) => '<option value="' + c.code + '"' + (c.code === onb.currency ? " selected" : "") + ">" + esc(c.label) + "</option>").join("") +
            "</select></div>" +
          "</div>" +
          '<div class="banner info">' + icon("info") + "<div>Budgets and costs in MealWise are <strong>estimates</strong> to guide your planning, not guaranteed prices.</div></div>"
        );
      },
      // 2 diet
      function () {
        return (
          '<h1 class="onb-title">Any dietary preference?</h1>' +
          '<p class="onb-sub">We\'ll only suggest meals that fit.</p>' +
          '<div class="opt-grid">' +
            DIETS.map((d) =>
              '<button class="opt" data-action="onb-diet" data-id="' + d.id + '" aria-pressed="' + (onb.diet === d.id) + '">' +
              '<span class="dot"></span><span><span class="ot">' + esc(d.label) + '</span><br><span class="od">' + esc(d.desc) + "</span></span></button>"
            ).join("") +
          "</div>" +
          (onb.diet === "other"
            ? '<div class="field" style="margin-top:14px"><label for="onb-dietother">Describe your preference</label><input class="input" id="onb-dietother" value="' + esc(onb.dietOther) + '" placeholder="e.g. no red meat, low FODMAP" /></div>'
            : "")
        );
      },
      // 3 allergies
      function () {
        return (
          '<h1 class="onb-title">Allergies &amp; ingredients to avoid</h1>' +
          '<p class="onb-sub">Select anything that applies. We\'ll filter these out of suggestions.</p>' +
          '<div class="chip-row" style="margin-bottom:18px">' +
            ALLERGENS.map((a) => '<button class="chip" data-action="onb-allergen" data-id="' + a.id + '" aria-pressed="' + (onb.allergies.indexOf(a.id) !== -1) + '">' + esc(a.label) + "</button>").join("") +
          "</div>" +
          '<div class="field"><label for="onb-avoid">Other ingredients to avoid</label>' +
            '<input class="input" id="onb-avoid" value="' + esc(onb.avoid) + '" placeholder="e.g. mushrooms, coriander" />' +
            '<div class="hint">Separate with commas.</div></div>' +
          '<div class="banner warn">' + icon("alert") + "<div><strong>Important:</strong> MealWise flags allergens from recipe data, but it cannot verify every product. Always check labels and packaging yourself — never treat a meal as allergy-safe based on this app alone.</div></div>"
        );
      },
      // 4 cuisines + time + skill
      function () {
        return (
          '<h1 class="onb-title">What do you like to cook?</h1>' +
          '<p class="onb-sub">Pick any cuisines you enjoy.</p>' +
          '<div class="chip-row" style="margin-bottom:20px">' +
            CUISINES.map((c) => '<button class="chip" data-action="onb-cuisine" data-id="' + esc(c) + '" aria-pressed="' + (onb.cuisines.indexOf(c) !== -1) + '">' + esc(c) + "</button>").join("") +
          "</div>" +
          '<div class="field"><label for="onb-time">Maximum time per meal: <strong id="onb-time-val">' + onb.maxTime + " min</strong></label>" +
            '<input type="range" id="onb-time" min="10" max="90" step="5" value="' + onb.maxTime + '" style="width:100%" data-action="onb-time" /></div>' +
          '<div class="field"><label>Cooking skill</label><div class="opt-grid two">' +
            SKILLS.map((s) =>
              '<button class="opt" data-action="onb-skill" data-id="' + s.id + '" aria-pressed="' + (onb.skill === s.id) + '">' +
              '<span class="dot"></span><span><span class="ot">' + esc(s.label) + '</span><br><span class="od">' + esc(s.desc) + "</span></span></button>"
            ).join("") + "</div></div>"
        );
      },
      // 5 goal
      function () {
        return (
          '<h1 class="onb-title">What matters most right now?</h1>' +
          '<p class="onb-sub">We\'ll weight your meal suggestions towards this goal.</p>' +
          '<div class="opt-grid two">' +
            GOALS.map((g) =>
              '<button class="opt" data-action="onb-goal" data-id="' + g.id + '" aria-pressed="' + (onb.goal === g.id) + '">' +
              '<span class="dot"></span><span><span class="ot">' + esc(g.label) + '</span><br><span class="od">' + esc(g.desc) + "</span></span></button>"
            ).join("") +
          "</div>" +
          '<div class="banner sage" style="margin-top:16px">' + icon("shield") + "<div>You can change any of this later in Profile &amp; Settings.</div></div>"
        );
      },
    ];

    const isLast = onb.step === steps - 1;
    const isFirst = onb.step === 0;
    return (
      '<div class="onb">' +
        (isFirst ? "" :
          '<div class="onb-top">' +
            '<button class="btn ghost sm icon" data-action="onb-back" aria-label="Back">' + icon("chevL") + "</button>" +
            '<div class="onb-steps">' + bar + "</div>" +
            '<span class="tiny muted nowrap">' + (onb.step + 1) + "/" + steps + "</span>" +
          "</div>") +
        bodies[onb.step]() +
        (isFirst ? "" :
          '<div class="onb-foot">' +
            '<button class="btn ' + (isLast ? "" : "block") + '" style="flex:1" data-action="onb-next">' + (isLast ? "Build my MealWise" : "Continue") + "</button>" +
          "</div>") +
      "</div>"
    );
  };

  function finishOnboarding() {
    state.settings.people = clamp(Number(onb.people) || 2, 1, 12);
    state.settings.budget = Math.max(0, Number(onb.budget) || 0);
    state.settings.currency = onb.currency;
    state.settings.diet = onb.diet;
    state.settings.dietOther = onb.dietOther;
    state.settings.allergies = onb.allergies;
    state.settings.avoid = onb.avoid.split(",").map((x) => x.trim()).filter(Boolean);
    state.settings.cuisines = onb.cuisines;
    state.settings.skill = onb.skill;
    state.settings.maxTime = onb.maxTime;
    state.settings.goal = onb.goal;
    state.settings.onboarded = true;
    // seed a starter plan so the app feels alive
    generatePlan();
    const built = buildGroceryFromPlan(false);
    state.grocery.items = built.items;
    state.grocery.fromPlan = true;
    state.grocery.updated = new Date().toISOString();
    save(true);
    onb = null;
    nav("home");
    toast("Your MealWise plan is ready.", "success");
  }

  /* ---- Home ---- */
  screens.home = function () {
    const s = state.settings;
    const hour = new Date().getHours();
    const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const spend = planCost();
    const budget = Number(s.budget) || 0;
    const pct = budget > 0 ? clamp((spend / budget) * 100, 0, 100) : 0;
    const over = budget > 0 && spend > budget;
    const barClass = over ? "over" : pct > 85 ? "warn" : "";
    const todayIdx = (new Date().getDay() + 6) % 7;

    // today's meals
    const todayMeals = SLOTS.map((sl) => {
      const m = state.plan.meals[todayIdx + ":" + sl.id];
      const r = m && getRecipe(m.recipeId);
      return (
        '<div class="slot ' + (r ? "" : "empty") + '">' +
          '<div class="st">' + sl.label + "</div>" +
          '<div class="sc">' + (r ? mealCardInner(r, m, todayIdx, sl.id) : "Nothing planned yet") + "</div>" +
        "</div>"
      );
    }).join("");

    // use soon
    const soon = state.pantry
      .map((p) => ({ p, d: daysUntil(p.expiry) }))
      .filter((x) => x.d !== null && x.d <= 4)
      .sort((a, b) => a.d - b.d)
      .slice(0, 5);

    // upcoming (next 3 days, excluding today)
    const upcoming = [];
    for (let d = todayIdx; d < 7 && upcoming.length < 6; d++) {
      SLOTS.forEach((sl) => {
        if (d === todayIdx && upcoming.length < 3) return;
        const m = state.plan.meals[d + ":" + sl.id];
        if (m && m.recipeId && m.status !== "skipped") {
          const r = getRecipe(m.recipeId);
          if (r) upcoming.push({ d, sl, r, m });
        }
      });
    }

    const cookCount = state.grocery.items.filter((i) => !i.checked).length;

    return (
      '<section class="hero"><div class="hinner">' +
        '<div class="eyebrow" style="color:#CBD8C1">' + greet + "</div>" +
        "<h1>" + (s.goal === "save_money" ? "Eat well, spend less" : s.goal === "eat_healthy" ? "Eat a little better today" : s.goal === "save_time" ? "Dinner, sorted" : "Waste nothing this week") + "</h1>" +
        '<p>' + (state.plan.created ? "Your week is planned for " + s.people + (s.people > 1 ? " people" : " person") + ". Here\'s today at a glance." : "Let\'s build your first week of meals.") + "</p>" +
        '<div class="hbtns">' +
          '<button class="btn white" data-action="nav" data-route="generator">' + icon("sparkles") + " What can I cook?</button>" +
          '<button class="btn ghost" style="color:#fff;border-color:rgba(255,255,255,.35)" data-action="home-generate">' + icon("refresh") + (state.plan.created ? " Regenerate week" : " Generate weekly plan") + "</button>" +
        "</div>" +
      "</div></section>" +

      '<div class="sec-head"><h2>This week</h2></div>' +
      '<div class="home-week">' +
        '<div class="card">' +
          '<div class="meter-row"><span class="muted small">Estimated ingredient cost</span><strong>' + money(spend) + " / " + money(budget) + "</strong></div>" +
          '<div class="bar ' + barClass + '"><span style="width:' + pct + '%"></span></div>' +
          '<p class="tiny muted" style="margin:8px 0 0">' + (budget > 0 ? (over ? "Estimated cost is " + money(spend - budget) + " over your budget. Try swapping a meal or two." : money(budget - spend) + " of budget remaining (estimate).") : "Set a weekly budget in Profile to track this.") + "</p>" +
        "</div>" +
        '<div class="stat"><div class="sv">' + planMealsList().length + '</div><div class="sl">Meals planned</div></div>' +
        '<div class="stat"><div class="sv">' + cookCount + '</div><div class="sl">To buy</div></div>' +
      "</div>" +

      '<div class="sec-head"><h2>Today\'s meals</h2><button class="link" data-action="nav" data-route="plan">Full plan ' + icon("chevR", "ico") + "</button></div>" +
      '<div class="dayblock"><div class="slots">' + todayMeals + "</div></div>" +

      (soon.length
        ? '<div class="sec-head"><h2>Use these soon</h2><button class="link" data-action="nav" data-route="pantry">Pantry ' + icon("chevR", "ico") + "</button></div>" +
          '<div class="card">' +
            '<div class="row wrap" style="gap:8px">' +
            soon.map((x) => {
              const d = x.d;
              const cls = d < 0 ? "red" : d <= 1 ? "amber" : "";
              const label = d < 0 ? "expired?" : d === 0 ? "today" : d === 1 ? "tomorrow" : d + " days";
              return '<span class="tag ' + cls + '">' + MW.emojiFor(x.p.name) + " " + esc(x.p.name) + " · " + label + "</span>";
            }).join("") +
            "</div>" +
            '<button class="btn subtle sm" style="margin-top:12px" data-action="cook-with-soon">' + icon("sparkles") + " Find recipes for these</button>" +
          "</div>"
        : "") +

      (upcoming.length
        ? '<div class="sec-head"><h2>Coming up</h2></div><div class="hscroll">' +
          upcoming.map((u) => {
            const r = u.r;
            return '<button class="rcard" style="text-align:left;border:1px solid var(--line);cursor:pointer" data-action="open-recipe" data-id="' + r.id + '">' +
              thumb(r) +
              '<div class="rbody"><div class="rname">' + esc(r.name) + "</div>" +
              '<div class="rmeta">' + DAYS[u.d] + " · " + u.sl.label + "</div></div></button>";
          }).join("") + "</div>"
        : "") +

      '<div class="sec-head"><h2>Quick actions</h2></div>' +
      '<div class="qa-grid">' +
        '<button class="card" style="text-align:left;cursor:pointer;border:1px solid var(--line)" data-action="nav" data-route="recipes"><div class="row">' + icon("book", "navicon") + '<div><div style="font-weight:700">Browse recipes</div><span class="tiny muted">' + allRecipes().length + ' recipes to explore</span></div></div></button>' +
        '<button class="card" style="text-align:left;cursor:pointer;border:1px solid var(--line)" data-action="nav" data-route="groceries"><div class="row">' + icon("cart", "navicon") + '<div><div style="font-weight:700">Grocery list</div><span class="tiny muted">' + cookCount + ' items to buy</span></div></div></button>' +
        '<button class="card" style="text-align:left;cursor:pointer;border:1px solid var(--line)" data-action="nav" data-route="pantry"><div class="row">' + icon("basket", "navicon") + '<div><div style="font-weight:700">Pantry</div><span class="tiny muted">' + state.pantry.length + ' items tracked</span></div></div></button>' +
        '<button class="card" style="text-align:left;cursor:pointer;border:1px solid var(--line)" data-action="nav" data-route="budget"><div class="row">' + icon("wallet", "navicon") + '<div><div style="font-weight:700">Budget insights</div><span class="tiny muted">See where the money goes</span></div></div></button>' +
      "</div>" +
      '<p class="tiny muted center" style="margin-top:24px">Costs and nutrition are estimates. Prices vary by shop and season. ' +
      (MW.APP.aiMode === "demo" ? "Meal suggestions run on your device in demo mode." : "") + "</p>"
    );
  };

  function thumb(r) {
    const ph = '<div class="ph">' + MW.emojiFor(r.name) + "</div>";
    const img = r.image ? '<img src="' + esc(r.image) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'" />' : "";
    return '<div class="thumb">' + ph + img +
      '<div class="badges">' +
        ((r.diet || []).indexOf("vegan") !== -1 ? '<span class="tag">Vegan</span>' : (r.diet || []).indexOf("vegetarian") !== -1 ? '<span class="tag">Veggie</span>' : "") +
      "</div></div>";
  }

  function recipeCard(r, opts) {
    opts = opts || {};
    const cps = costPerServing(r);
    const warn = allergenConflict(r).length || avoidedConflict(r).length;
    return (
      '<article class="rcard">' +
        '<div style="position:relative">' + thumb(r) +
          '<button class="fav-btn" style="position:absolute;top:8px;right:8px" data-action="toggle-fav" data-id="' + r.id + '" aria-pressed="' + isFavorite(r.id) + '" aria-label="Save recipe">' + icon("heart") + "</button>" +
        "</div>" +
        '<div class="rbody">' +
          '<button class="rname" style="background:none;border:0;padding:0;text-align:left;cursor:pointer;font:inherit" data-action="open-recipe" data-id="' + r.id + '">' + esc(r.name) + "</button>" +
          '<div class="rmeta">' +
            '<span class="m">' + icon("clock") + totalTime(r) + " min</span>" +
            '<span class="m">' + icon("users") + r.servings + "</span>" +
            '<span class="m">' + esc(r.cuisine) + "</span>" +
          "</div>" +
          (warn ? '<div><span class="tag red">' + icon("alert") + " Contains your allergens</span></div>" : "") +
          '<div class="rfoot">' +
            '<span class="price">' + money(cps) + '<span class="tiny muted"> / serving</span></span>' +
            '<div class="spacer"></div>' +
            '<button class="btn subtle sm" data-action="open-recipe" data-id="' + r.id + '">View</button>' +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  function mealCardInner(r, m, day, slot) {
    const done = m && m.status === "eaten";
    return (
      '<div class="mealcard ' + (done ? "done" : "") + '">' +
        '<div class="mthumb" style="cursor:pointer" data-action="open-recipe" data-id="' + r.id + '">' + (r.image ? '<img src="' + esc(r.image) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:12px" onerror="this.replaceWith(document.createTextNode(\'' + MW.emojiFor(r.name) + '\'))" />' : MW.emojiFor(r.name)) + "</div>" +
        '<div style="flex:1;min-width:0">' +
          '<div class="mtitle" style="cursor:pointer" data-action="open-recipe" data-id="' + r.id + '">' + esc(r.name) + "</div>" +
          '<div class="msub">' + totalTime(r) + " min · " + money(costPerServing(r) * ((m && m.servings) || state.settings.people)) + (m && m.leftoverFrom ? ' · <span class="tag line">Leftovers</span>' : "") + "</div>" +
        "</div>" +
        '<div class="mactions">' +
          '<button class="btn ghost sm icon" data-action="meal-more" data-day="' + day + '" data-slot="' + slot + '" aria-label="Meal options">' + icon("chevD") + "</button>" +
        "</div>" +
      "</div>"
    );
  }

  /* ---- Generator ---- */
  let gen = { ingredients: [], maxTime: 30, mealType: "", results: null, busy: false, usedPantry: false };
  screens.generator = function () {
    const res = gen.results;
    return (
      '<div class="page-head"><h1>What can I cook?</h1><p>Tell us what you have and we\'ll suggest meals that fit your budget, diet and time.</p></div>' +
      (MW.APP.aiMode === "demo"
        ? '<div class="banner info" style="margin-bottom:16px">' + icon("info") + "<div><strong>On-device demo mode.</strong> Suggestions come from a local recipe-matching engine in your browser — no external AI service is called. " + (state.settings.plan === "premium" ? "Premium: unlimited generations." : "Free plan: " + state.settings.aiCredits + " of " + state.settings.aiCreditsMax + " generations left.") + "</div></div>"
        : "") +

      '<div class="card">' +
        '<div class="field"><label for="gen-ing">Ingredients you already have</label>' +
          '<textarea class="input" id="gen-ing" placeholder="e.g. eggs, spinach, rice, half an onion…">' + esc(gen.ingredients.join(", ")) + "</textarea>" +
          '<div class="hint">Separate with commas. We\'ll also count your pantry items.</div></div>' +
        (state.pantry.length
          ? '<div class="field"><label>From your pantry</label><div class="chip-row">' +
            state.pantry.slice(0, 12).map((p) => '<button class="chip" data-action="gen-pantry" data-name="' + esc(p.name) + '" aria-pressed="' + (gen.ingredients.some((x) => x.toLowerCase() === p.name.toLowerCase())) + '">' + MW.emojiFor(p.name) + " " + esc(p.name) + "</button>").join("") +
            "</div></div>"
          : "") +
        '<div class="grid2">' +
          '<div class="field"><label for="gen-time">Time limit</label><select class="input" id="gen-time">' +
            [15, 20, 30, 45, 60, 90].map((t) => '<option value="' + t + '"' + (gen.maxTime === t ? " selected" : "") + ">Up to " + t + " min</option>").join("") +
          "</select></div>" +
          '<div class="field"><label for="gen-meal">Meal</label><select class="input" id="gen-meal">' +
            '<option value=""' + (gen.mealType === "" ? " selected" : "") + ">Any meal</option>" +
            SLOTS.map((s) => '<option value="' + s.id + '"' + (gen.mealType === s.id ? " selected" : "") + ">" + s.label + "</option>").join("") +
          "</select></div>" +
        "</div>" +
        '<div class="row" style="gap:10px">' +
          '<button class="btn" style="flex:1" data-action="gen-run" ' + (gen.busy ? "disabled" : "") + ">" + icon("sparkles") + (gen.busy ? " Thinking…" : " Generate meals") + "</button>" +
          '<button class="btn ghost" data-action="gen-clear">Clear</button>' +
        "</div>" +
        '<p class="tiny muted" style="margin:10px 0 0">Photo upload: not enabled in this build — it needs an image-recognition service. Ingredient text input works fully.</p>' +
      "</div>" +

      (gen.busy ? '<div class="card" style="margin-top:16px"><div class="skel" style="height:20px;width:40%;margin-bottom:12px"></div><div class="skel" style="height:14px;width:80%;margin-bottom:8px"></div><div class="skel" style="height:14px;width:60%"></div></div>' : "") +

      (res
        ? '<div class="sec-head"><h2>' + res.length + " meal idea" + (res.length === 1 ? "" : "s") + '</h2><button class="link" data-action="gen-add-all">Add all missing to list</button></div>' +
          (res.length
            ? '<div class="recipe-grid">' + res.map((r) => recipeCard(r)).join("") + "</div>"
            : '<div class="empty"><div class="eicon">🍳</div><h3>No matches</h3><p>Try increasing the time limit, clearing a filter, or removing an ingredient.</p><button class="btn" data-action="gen-clear">Start over</button></div>')
        : '<div class="empty"><div class="eicon">🥕</div><h3>What\'s in your kitchen?</h3><p>Add a few ingredients and tap generate. We\'ll rank meals by what you can make right now.</p></div>')
    );
  };

  /* ---- Meal plan ---- */
  screens.plan = function () {
    const todayIdx = (new Date().getDay() + 6) % 7;
    const weekStart = new Date(state.plan.weekStart + "T00:00:00");
    const cost = planCost();
    const budget = Number(state.settings.budget) || 0;

    if (!state.plan.created) {
      return (
        '<div class="page-head"><h1>Weekly Meal Plan</h1><p>Seven days of breakfast, lunch and dinner, built around your budget and preferences.</p></div>' +
        '<div class="empty"><div class="eicon">📅</div><h3>No plan yet</h3><p>Generate a personalised week in one tap. You can swap, move or skip any meal afterwards.</p>' +
          '<button class="btn" data-action="plan-generate">' + icon("sparkles") + " Generate my week</button></div>" +
        '<div class="grid3" style="margin-top:10px">' +
          '<div class="stat"><div class="sv">' + state.settings.people + '</div><div class="sl">People</div></div>' +
          '<div class="stat"><div class="sv">' + money(state.settings.budget) + '</div><div class="sl">Weekly budget</div></div>' +
          '<div class="stat"><div class="sv">' + (state.settings.cuisines || []).length + '</div><div class="sl">Cuisines</div></div>' +
        "</div>"
      );
    }

    const days = DAYS.map((dn, d) => {
      const date = addDays(weekStart, d);
      const isToday = d === todayIdx;
      const slots = SLOTS.map((sl) => {
        const m = state.plan.meals[d + ":" + sl.id];
        const r = m && getRecipe(m.recipeId);
        return (
          '<div class="slot ' + (r ? "" : "empty") + '" style="' + (isToday ? "background:var(--sage-50)" : "") + '">' +
            '<div class="st">' + sl.label + "</div>" +
            '<div class="sc">' +
              (r
                ? mealCardInner(r, m, d, sl.id)
                : '<button class="btn ghost sm" data-action="meal-add" data-day="' + d + '" data-slot="' + sl.id + '">' + icon("plus") + " Add meal</button>") +
            "</div>" +
          "</div>"
        );
      }).join("");
      return (
        '<div class="dayblock">' +
          '<div class="dayhead"><div class="dn">' + DAYS_FULL[d] + '</div><div class="dd">' + date.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + "</div>" +
            (isToday ? '<span class="tag" style="margin-left:auto">Today</span>' : "") +
            '<button class="btn ghost sm icon" data-action="day-fill" data-day="' + d + '" aria-label="Fill empty slots" title="Fill empty slots">' + icon("sparkles") + "</button>" +
          "</div>" +
          '<div class="slots">' + slots + "</div>" +
        "</div>"
      );
    }).join("");

    return (
      '<div class="page-head"><h1>Weekly Meal Plan</h1><p>' + humanDate(state.plan.weekStart) + " – " + humanDate(iso(addDays(weekStart, 6))) + " · " + state.settings.people + " people</p></div>" +

      '<div class="card" style="margin-bottom:16px">' +
        '<div class="row wrap" style="gap:12px">' +
          '<div style="flex:1;min-width:180px">' +
            '<div class="meter-row"><span class="muted small">Estimated ingredient cost</span><strong>' + money(cost) + " / " + money(budget) + "</strong></div>" +
            '<div class="bar ' + (budget && cost > budget ? "over" : "") + '"><span style="width:' + (budget > 0 ? clamp((cost / budget) * 100, 0, 100) : 0) + '%"></span></div>' +
          "</div>" +
          '<button class="btn subtle sm" data-action="plan-generate">' + icon("refresh") + " Regenerate</button>" +
          '<button class="btn sm" data-action="plan-to-grocery">' + icon("cart") + " Build grocery list</button>" +
        "</div>" +
      "</div>" +

      '<div class="stack">' + days + "</div>" +

      '<div class="card" style="margin-top:16px">' +
        '<div class="card-hd"><h3>' + icon("sparkles") + " Plan tools</h3></div>" +
        '<div class="row wrap" style="gap:10px">' +
          (state.settings.plan === "premium"
            ? '<button class="btn ghost sm" data-action="plan-save">' + icon("check") + " Save this plan</button>"
            : '<span class="tag line">' + icon("lock") + " Saving multiple plans is a Premium feature</span>") +
          '<button class="btn ghost sm" data-action="plan-clear">' + icon("trash") + " Clear plan</button>" +
        "</div>" +
        (state.savedPlans && state.savedPlans.length
          ? '<div class="hr"></div><div class="small muted" style="margin-bottom:8px">Saved plans</div>' +
            state.savedPlans.map((p, i) => '<div class="kv"><span class="k">Week of ' + esc(humanDate(p.weekStart)) + " · " + p.count + " meals</span>" +
              '<button class="btn ghost sm" data-action="plan-load" data-idx="' + i + '">Load</button></div>').join("")
          : "") +
      "</div>" +
      '<p class="tiny muted center" style="margin-top:18px">Tap the ▼ on a meal to replace it, move it, mark it eaten, skip it or turn it into leftovers.</p>'
    );
  };

  /* ---- Groceries ---- */
  let shopMode = false;
  screens.groceries = function () {
    const items = state.grocery.items;
    if (shopMode) return groceryShopMode(items);

    const total = groceryTotal();
    const budget = Number(state.settings.budget) || 0;
    const remaining = budget - total;
    const checked = items.filter((i) => i.checked).length;

    if (!items.length) {
      return (
        '<div class="page-head"><h1>Grocery List</h1><p>Your shopping list, built from your meal plan.</p></div>' +
        '<div class="empty"><div class="eicon">🛒</div><h3>Your list is empty</h3><p>Build a meal plan or add items by hand. We\'ll combine duplicate ingredients and subtract what\'s already in your pantry.</p>' +
          '<div class="row" style="justify-content:center;gap:10px;flex-wrap:wrap">' +
            '<button class="btn" data-action="plan-to-grocery">' + icon("calendar") + " Build from meal plan</button>" +
            '<button class="btn ghost" data-action="grocery-add">' + icon("plus") + " Add item</button>" +
          "</div></div>"
      );
    }

    const byCat = {};
    items.forEach((i) => { (byCat[i.category] = byCat[i.category] || []).push(i); });
    const cats = ING_CATEGORIES.filter((c) => byCat[c.id]);

    return (
      '<div class="page-head"><h1>Grocery List</h1><p>' + items.length + " items · " + checked + " checked off</p></div>" +

      '<div class="card" style="margin-bottom:16px">' +
        '<div class="row wrap" style="gap:12px">' +
          '<div style="flex:1;min-width:160px">' +
            '<div class="meter-row"><span class="muted small">Estimated total</span><strong>' + money(total) + "</strong></div>" +
            '<div class="bar"><span style="width:' + (budget > 0 ? clamp((total / budget) * 100, 0, 100) : 0) + '%"></span></div>' +
            '<p class="tiny muted" style="margin:8px 0 0">' + (budget > 0 ? (remaining >= 0 ? money(remaining) + " left of your " + money(budget) + " budget (estimate)" : money(-remaining) + " over budget (estimate)") : "No budget set") + "</p>" +
          "</div>" +
          '<div class="stack-sm">' +
            '<button class="btn sm" data-action="shop-mode">' + icon("bag") + " Shopping mode</button>" +
            '<button class="btn ghost sm" data-action="grocery-add">' + icon("plus") + " Add item</button>" +
          "</div>" +
        "</div>" +
        (state.grocery.updated ? '<p class="tiny muted" style="margin:12px 0 0">Last updated ' + new Date(state.grocery.updated).toLocaleString() + "</p>" : "") +
      "</div>" +

      cats.map((c) =>
        '<div class="gcat"><h3>' + c.emoji + " " + esc(c.label) + "</h3>" +
        byCat[c.id].map((i) =>
          '<div class="gitem ' + (i.checked ? "checked" : "") + '">' +
            '<button class="gcheck" data-action="g-check" data-id="' + i.id + '" aria-pressed="' + i.checked + '" aria-label="Toggle ' + esc(i.name) + '">' + (i.checked ? icon("check") : "") + "</button>" +
            '<div class="gbody">' +
              '<div class="gname">' + esc(i.name) + (i.custom ? ' <span class="tag line">custom</span>' : "") + "</div>" +
              '<div class="gsub">' + (i.est ? money(i.est) + " est." : "") + (i.sources && i.sources.length ? " · " + esc(i.sources.slice(0, 2).join(", ")) : "") + "</div>" +
              '<div class="gcontrols">' +
                '<div class="gqty">' +
                  '<button data-action="g-dec" data-id="' + i.id + '" aria-label="Decrease">−</button>' +
                  "<span>" + qtyLabel(i.q, i.u) + "</span>" +
                  '<button data-action="g-inc" data-id="' + i.id + '" aria-label="Increase">+</button>' +
                "</div>" +
                '<div class="spacer"></div>' +
                '<button class="btn ghost sm icon" data-action="g-edit" data-id="' + i.id + '" aria-label="Edit">' + icon("edit") + "</button>" +
                '<button class="btn ghost sm icon" data-action="g-del" data-id="' + i.id + '" aria-label="Delete">' + icon("trash") + "</button>" +
              "</div>" +
            "</div>" +
          "</div>"
        ).join("") + "</div>"
      ).join("") +

      '<div class="row" style="gap:10px;margin-top:16px">' +
        '<button class="btn ghost sm" data-action="g-clear-checked">Clear checked</button>' +
        '<button class="btn ghost sm" data-action="g-rebuild">Rebuild from plan</button>' +
      "</div>" +
      '<p class="tiny muted center" style="margin-top:16px">Prices are estimates based on typical supermarket prices and will vary.</p>'
    );
  };

  function groceryShopMode(items) {
    const byCat = {};
    items.forEach((i) => { (byCat[i.category] = byCat[i.category] || []).push(i); });
    const cats = ING_CATEGORIES.filter((c) => byCat[c.id]);
    const left = items.filter((i) => !i.checked).length;
    return (
      '<div class="row" style="margin-bottom:14px">' +
        '<button class="btn ghost sm" data-action="shop-mode">' + icon("chevL") + " Exit shopping mode</button>" +
        '<div class="spacer"></div><span class="tag">' + left + " left</span>" +
      "</div>" +
      '<h1 style="margin-bottom:14px">Shopping list</h1>' +
      cats.map((c) =>
        '<div class="gcat"><h3>' + c.emoji + " " + esc(c.label) + "</h3>" +
        byCat[c.id].map((i) =>
          '<button class="gitem" style="width:100%;text-align:left;cursor:pointer;' + (i.checked ? "opacity:.5" : "") + '" data-action="g-check" data-id="' + i.id + '">' +
            '<span class="gcheck" style="' + (i.checked ? "background:var(--forest-600);border-color:var(--forest-600);color:#fff" : "") + '">' + (i.checked ? icon("check") : "") + "</span>" +
            '<span style="flex:1"><span class="gname" style="' + (i.checked ? "text-decoration:line-through" : "") + '">' + esc(i.name) + '</span><br><span class="gsub">' + qtyLabel(i.q, i.u) + "</span></span>" +
          "</button>"
        ).join("") + "</div>"
      ).join("")
    );
  }

  /* ---- Pantry ---- */
  screens.pantry = function () {
    const items = state.pantry.slice().sort((a, b) => {
      const da = daysUntil(a.expiry), db = daysUntil(b.expiry);
      if (da === null && db === null) return a.name.localeCompare(b.name);
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
    const soon = items.filter((p) => { const d = daysUntil(p.expiry); return d !== null && d <= 4; });
    const suggestions = soon.length ? generateSuggestions({ ingredients: soon.map((p) => p.name), count: 4 }) : [];

    return (
      '<div class="page-head"><h1>Pantry</h1><p>Track what you have so the app can use it up before it goes to waste.</p></div>' +

      (soon.length
        ? '<div class="card" style="margin-bottom:16px;background:var(--amber-bg);border-color:#EFD9B0">' +
            '<div class="row">' + icon("alert", "navicon") + "<div><strong>" + soon.length + " item" + (soon.length > 1 ? "s" : "") + " should be used soon</strong><br><span class=\"tiny\">" + soon.map((p) => esc(p.name)).join(", ") + "</span></div></div>" +
          "</div>"
        : "") +

      '<div class="row" style="margin-bottom:14px"><button class="btn" data-action="pantry-add">' + icon("plus") + " Add ingredient</button>" +
        (state.pantry.length ? '<button class="btn ghost sm" data-action="pantry-clear">Clear all</button>' : "") + "</div>" +

      (items.length
        ? '<div class="stack-sm">' + items.map((p) => {
            const d = daysUntil(p.expiry);
            const tag = d === null ? "" : d < 0 ? '<span class="tag red">Check date</span>' : d <= 1 ? '<span class="tag amber">Use ' + (d <= 0 ? "today" : "tomorrow") + "</span>" : d <= 4 ? '<span class="tag amber">' + d + " days</span>" : '<span class="tag line">' + humanDate(p.expiry) + "</span>";
            return '<div class="pitem">' +
              '<div class="picon">' + MW.emojiFor(p.name) + "</div>" +
              '<div style="flex:1;min-width:0"><div class="gname">' + esc(p.name) + "</div><div class=\"gsub\">" + qtyLabel(p.q, p.u) + (p.expiry ? " · best before " + humanDate(p.expiry) : "") + "</div></div>" +
              tag +
              '<button class="btn ghost sm icon" data-action="pantry-edit" data-id="' + p.id + '" aria-label="Edit">' + icon("edit") + "</button>" +
              '<button class="btn ghost sm icon" data-action="pantry-del" data-id="' + p.id + '" aria-label="Remove">' + icon("trash") + "</button>" +
            "</div>";
          }).join("") + "</div>"
        : '<div class="empty"><div class="eicon">🥫</div><h3>Your pantry is empty</h3><p>Add the ingredients you already own and we\'ll factor them into suggestions and your grocery list.</p><button class="btn" data-action="pantry-add">' + icon("plus") + " Add ingredient</button></div>") +

      (suggestions.length
        ? '<div class="sec-head"><h2>Use it up</h2></div><div class="recipe-grid">' + suggestions.map((r) => recipeCard(r)).join("") + "</div>"
        : "") +

      '<div class="banner warn" style="margin-top:18px">' + icon("info") + "<div>Expiry dates you enter are a reminder only. They are <strong>not a food-safety guarantee</strong> — always use your judgement and check packaging.</div></div>"
    );
  };

  /* ---- Recipes ---- */
  let rf = { q: "", cuisine: "", diet: "", maxTime: "", maxCost: "", availableOnly: false, sort: "match" };
  screens.recipes = function () {
    let list = allRecipes().slice();
    const q = rf.q.toLowerCase().trim();
    if (q) list = list.filter((r) => r.name.toLowerCase().indexOf(q) !== -1 || (r.ingredients || []).some((i) => i.n.toLowerCase().indexOf(q) !== -1));
    if (rf.cuisine) list = list.filter((r) => r.cuisine === rf.cuisine);
    if (rf.diet) list = list.filter((r) => (r.diet || []).indexOf(rf.diet) !== -1);
    if (rf.maxTime) list = list.filter((r) => totalTime(r) <= Number(rf.maxTime));
    if (rf.maxCost) list = list.filter((r) => costPerServing(r) <= Number(rf.maxCost));
    if (rf.availableOnly) list = list.filter((r) => pantryMatch(r) >= 0.5);
    if (rf.sort === "cost") list.sort((a, b) => costPerServing(a) - costPerServing(b));
    else if (rf.sort === "time") list.sort((a, b) => totalTime(a) - totalTime(b));
    else if (rf.sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    else list.sort((a, b) => scoreRecipe(b, {}) - scoreRecipe(a, {}));

    const favs = state.favorites.map(getRecipe).filter(Boolean);
    const recentlyCooked = state.cooked.slice().sort((a, b) => b.at - a.at).map((c) => getRecipe(c.id)).filter(Boolean).slice(0, 6);
    const filtersActive = rf.q || rf.cuisine || rf.diet || rf.maxTime || rf.maxCost || rf.availableOnly;

    return (
      '<div class="page-head"><h1>Recipes</h1><p>' + allRecipes().length + " recipes, filtered to your preferences.</p></div>" +

      '<div class="card" style="margin-bottom:16px">' +
        '<div class="row" style="gap:10px;margin-bottom:12px">' +
          '<div style="position:relative;flex:1">' + icon("search", "ico") .replace("<svg", '<svg style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--muted);width:18px;height:18px"') +
            '<input class="input" id="rf-q" placeholder="Search recipes or ingredients" value="' + esc(rf.q) + '" style="padding-left:42px" data-action="rf-input" data-key="q" /></div>' +
          '<button class="btn ghost sm icon" data-action="rf-toggle" aria-label="Show filters">' + icon("filter") + "</button>" +
        "</div>" +
        '<div id="rf-filters" style="' + (filtersActive ? "" : "display:none") + '">' +
          '<div class="grid2">' +
            '<div class="field"><label for="rf-cuisine">Cuisine</label><select class="input" id="rf-cuisine" data-action="rf-select" data-key="cuisine"><option value="">All cuisines</option>' +
              CUISINES.map((c) => '<option' + (rf.cuisine === c ? " selected" : "") + ">" + esc(c) + "</option>").join("") + "</select></div>" +
            '<div class="field"><label for="rf-diet">Diet</label><select class="input" id="rf-diet" data-action="rf-select" data-key="diet"><option value="">Any diet</option>' +
              ["vegan", "vegetarian", "pescatarian"].map((c) => '<option' + (rf.diet === c ? " selected" : "") + ">" + c.charAt(0).toUpperCase() + c.slice(1) + "</option>").join("") + "</select></div>" +
            '<div class="field"><label for="rf-time">Max time</label><select class="input" id="rf-time" data-action="rf-select" data-key="maxTime"><option value="">Any time</option>' +
              [15, 20, 30, 45, 60].map((t) => '<option value="' + t + '"' + (String(rf.maxTime) === String(t) ? " selected" : "") + ">≤ " + t + " min</option>").join("") + "</select></div>" +
            '<div class="field"><label for="rf-cost">Max cost / serving</label><select class="input" id="rf-cost" data-action="rf-select" data-key="maxCost"><option value="">Any cost</option>' +
              [1, 1.5, 2, 3, 4].map((t) => '<option value="' + t + '"' + (String(rf.maxCost) === String(t) ? " selected" : "") + ">≤ " + money(t) + "</option>").join("") + "</select></div>" +
          "</div>" +
          '<div class="row wrap" style="gap:10px">' +
            '<button class="chip" data-action="rf-available" aria-pressed="' + rf.availableOnly + '">' + icon("basket") + " Mostly from my pantry</button>" +
            '<div class="spacer"></div>' +
            '<select class="input" style="max-width:180px" data-action="rf-select" data-key="sort">' +
              '<option value="match"' + (rf.sort === "match" ? " selected" : "") + ">Best match</option>" +
              '<option value="cost"' + (rf.sort === "cost" ? " selected" : "") + ">Cheapest</option>" +
              '<option value="time"' + (rf.sort === "time" ? " selected" : "") + ">Quickest</option>" +
              '<option value="name"' + (rf.sort === "name" ? " selected" : "") + ">A–Z</option>" +
            "</select>" +
          "</div>" +
        "</div>" +
      "</div>" +

      (favs.length && !filtersActive
        ? '<div class="sec-head"><h2>Saved recipes</h2><span class="tag">' + favs.length + "</span></div>" +
          '<div class="hscroll">' + favs.map((r) => '<button class="rcard" style="text-align:left;border:1px solid var(--line);cursor:pointer" data-action="open-recipe" data-id="' + r.id + '">' + thumb(r) + '<div class="rbody"><div class="rname">' + esc(r.name) + '</div><div class="rmeta">' + money(costPerServing(r)) + " / serving</div></div></button>").join("") + "</div>"
        : "") +

      (recentlyCooked.length && !filtersActive
        ? '<div class="sec-head"><h2>Recently cooked</h2></div><div class="hscroll">' +
          recentlyCooked.map((r) => '<button class="rcard" style="text-align:left;border:1px solid var(--line);cursor:pointer" data-action="open-recipe" data-id="' + r.id + '">' + thumb(r) + '<div class="rbody"><div class="rname">' + esc(r.name) + "</div></div></button>").join("") + "</div>"
        : "") +

      '<div class="sec-head"><h2>' + (filtersActive ? "Results" : "All recipes") + "</h2><span class=\"muted small\">" + list.length + " shown</span></div>" +
      (list.length
        ? '<div class="recipe-grid">' + list.map((r) => recipeCard(r)).join("") + "</div>"
        : '<div class="empty"><div class="eicon">🔍</div><h3>No recipes match</h3><p>Try clearing a filter or searching for something else.</p><button class="btn" data-action="rf-reset">Reset filters</button></div>')
    );
  };

  /* ---- Recipe detail ---- */
  let detailServings = null;
  screens.recipe = function (route) {
    const r = getRecipe(route.param);
    if (!r) return '<div class="empty"><div class="eicon">🤔</div><h3>Recipe not found</h3><p>It may have been removed.</p><button class="btn" data-action="nav" data-route="recipes">Back to recipes</button></div>';
    if (detailServings == null) detailServings = r.servings;
    const factor = detailServings / (r.servings || 1);
    const total = recipeCost(r) * factor;
    const cps = total / detailServings;
    const conf = allergenConflict(r);
    const avo = avoidedConflict(r);
    const inPantry = (r.ingredients || []).filter((i) => state.pantry.some((p) => p.name.toLowerCase().trim() === i.n.toLowerCase().trim()));

    return (
      '<button class="btn ghost sm" data-action="nav" data-route="recipes" style="margin-bottom:14px">' + icon("chevL") + " All recipes</button>" +
      '<div class="rcard" style="margin-bottom:16px">' +
        '<div class="thumb" style="aspect-ratio:16/9"><div class="ph">' + MW.emojiFor(r.name) + "</div>" + (r.image ? '<img src="' + esc(r.image) + '" alt="" onerror="this.style.display=\'none\'" />' : "") + "</div>" +
      "</div>" +
      '<h1>' + esc(r.name) + "</h1>" +
      '<p class="muted">' + esc(r.desc || "") + "</p>" +
      '<div class="row wrap" style="gap:8px;margin-bottom:16px">' +
        '<span class="tag">' + icon("clock") + " " + totalTime(r) + " min</span>" +
        '<span class="tag">' + icon("users") + " " + detailServings + " servings</span>" +
        '<span class="tag">' + esc(r.cuisine) + "</span>" +
        '<span class="tag">' + esc(r.skill) + "</span>" +
        (r.diet || []).map((d) => '<span class="tag">' + esc(d) + "</span>").join("") +
      "</div>" +

      (conf.length || avo.length
        ? '<div class="banner danger" style="margin-bottom:16px">' + icon("alert") + "<div><strong>Allergen flag.</strong> This recipe lists " + esc(conf.concat(avo).join(", ")) + ", which conflicts with your preferences. Check every ingredient label before cooking.</div></div>"
        : '<div class="banner warn" style="margin-bottom:16px">' + icon("info") + "<div>Contains: " + esc((r.allergens || []).join(", ") || "no major allergens listed") + ". Always check product labels — MealWise cannot verify ingredients for you.</div></div>") +

      '<div class="row wrap" style="gap:10px;margin-bottom:18px">' +
        '<button class="btn ' + (isFavorite(r.id) ? "subtle" : "") + '" data-action="toggle-fav" data-id="' + r.id + '" aria-pressed="' + isFavorite(r.id) + '">' + icon("heart") + (isFavorite(r.id) ? " Saved" : " Save recipe") + "</button>" +
        '<button class="btn ghost" data-action="recipe-add-grocery" data-id="' + r.id + '" data-missing="1">' + icon("cart") + " Add missing to list</button>" +
        '<button class="btn ghost" data-action="recipe-cooked" data-id="' + r.id + '">' + icon("check") + " I cooked this</button>" +
      "</div>" +

      '<div class="grid3" style="margin-bottom:18px">' +
        '<div class="stat"><div class="sv">' + money(cps) + '</div><div class="sl">Est. / serving</div></div>' +
        '<div class="stat"><div class="sv">' + money(total) + '</div><div class="sl">Est. total</div></div>' +
        (r.nutrition ? '<div class="stat"><div class="sv">' + r.nutrition.kcal + '</div><div class="sl">kcal (approx)</div></div>' : '<div class="stat"><div class="sv">—</div><div class="sl">No nutrition</div></div>') +
      "</div>" +

      '<div class="card" style="margin-bottom:16px">' +
        '<div class="card-hd"><h3>Ingredients</h3><div class="spacer"></div>' +
          '<div class="row" style="gap:6px"><button class="btn ghost sm icon" data-action="serv-dec" aria-label="Fewer servings">−</button>' +
          '<span style="min-width:70px;text-align:center;font-weight:600">' + detailServings + " serv.</span>" +
          '<button class="btn ghost sm icon" data-action="serv-inc" aria-label="More servings">+</button></div>' +
        "</div>" +
        '<ul class="inglist">' +
          (r.ingredients || []).map((i) => {
            const have = state.pantry.some((p) => p.name.toLowerCase().trim() === i.n.toLowerCase().trim());
            const q = Math.round((Number(i.q) || 0) * factor * 100) / 100;
            return '<li><span class="q">' + qtyLabel(q, i.u) + "</span><span>" + esc(i.n) + (have ? ' <span class="tag">in pantry</span>' : "") + "</span></li>";
          }).join("") +
        "</ul>" +
        (inPantry.length ? '<p class="tiny muted" style="margin:12px 0 0">' + inPantry.length + " of these are already in your pantry.</p>" : "") +
      "</div>" +

      '<div class="card" style="margin-bottom:16px">' +
        '<div class="card-hd"><h3>Method</h3></div>' +
        '<ol class="steplist">' + (r.steps || []).map((s) => "<li>" + esc(s) + "</li>").join("") + "</ol>" +
      "</div>" +

      (r.nutrition
        ? '<div class="card" style="margin-bottom:16px"><div class="card-hd"><h3>Nutrition (per serving, approx.)</h3></div>' +
          '<div class="grid3">' +
            '<div class="stat"><div class="sv">' + r.nutrition.protein + 'g</div><div class="sl">Protein</div></div>' +
            '<div class="stat"><div class="sv">' + r.nutrition.carbs + 'g</div><div class="sl">Carbs</div></div>' +
            '<div class="stat"><div class="sv">' + r.nutrition.fat + 'g</div><div class="sl">Fat</div></div>' +
          "</div><p class=\"tiny muted\" style=\"margin:12px 0 0\">Estimates only — real values depend on exact brands and quantities.</p></div>"
        : '<div class="banner info" style="margin-bottom:16px">' + icon("info") + "<div>No reliable nutrition data is available for this recipe, so we don't show any.</div></div>") +

      ((r.substitutions || []).length
        ? '<div class="card" style="margin-bottom:16px"><div class="card-hd"><h3>Substitutions</h3></div><div class="stack-sm">' +
          r.substitutions.map((s) => '<div class="kv"><span class="k">' + esc(s.for) + '</span><span class="v">' + esc(s.alt) + "</span></div>").join("") +
          "</div></div>"
        : "") +

      (r.tip ? '<div class="banner sage" style="margin-bottom:16px">' + icon("leaf") + "<div><strong>Tip:</strong> " + esc(r.tip) + "</div></div>" : "") +

      (r.generated
        ? '<div class="banner info">' + icon("sparkles") + "<div>This recipe was generated on-device. Costs and nutrition are rough estimates.</div></div>"
        : "")
    );
  };

  /* ---- Budget ---- */
  screens.budget = function () {
    const budget = Number(state.settings.budget) || 0;
    const planned = planCost();
    const actual = state.budgetLog.reduce((s, e) => s + Number(e.amount || 0), 0);
    const items = state.grocery.items;
    const catTotals = {};
    items.forEach((i) => { catTotals[i.category] = (catTotals[i.category] || 0) + (Number(i.est) || 0); });
    const plannedRemaining = budget - planned;
    const actualRemaining = budget - actual;

    // cheaper swaps
    const swaps = [];
    const planIds = planMealsList().map((x) => x.meal.recipeId);
    const uniquePlan = Array.from(new Set(planIds)).map(getRecipe).filter(Boolean);
    uniquePlan.sort((a, b) => costPerServing(b) - costPerServing(a));
    uniquePlan.slice(0, 3).forEach((r) => {
      const cheaper = allRecipes().filter((x) => x.meals.some((m) => (r.meals || []).indexOf(m) !== -1) && dietAllows(x) && allergenConflict(x).length === 0 && costPerServing(x) < costPerServing(r)).sort((a, b) => costPerServing(a) - costPerServing(b))[0];
      if (cheaper) swaps.push({ from: r, to: cheaper, save: (costPerServing(r) - costPerServing(cheaper)) * (state.settings.people || 1) });
    });

    return (
      '<div class="page-head"><h1>Budget &amp; Savings</h1><p>Understand your estimated food costs and find cheaper options.</p></div>' +

      '<div class="grid3" style="margin-bottom:16px">' +
        '<div class="stat forest"><div class="sv">' + money(budget) + '</div><div class="sl">Weekly budget</div></div>' +
        '<div class="stat"><div class="sv">' + money(planned) + '</div><div class="sl">Planned (estimate)</div></div>' +
        '<div class="stat"><div class="sv">' + money(actual) + '</div><div class="sl">Logged spend</div></div>' +
      "</div>" +

      '<div class="card" style="margin-bottom:16px">' +
        '<div class="card-hd"><h3>Planned vs budget</h3></div>' +
        '<div class="meter-row"><span class="muted small">' + (plannedRemaining >= 0 ? "Remaining" : "Over budget") + "</span><strong>" + money(Math.abs(plannedRemaining)) + "</strong></div>" +
        '<div class="bar ' + (plannedRemaining < 0 ? "over" : "") + '"><span style="width:' + (budget > 0 ? clamp((planned / budget) * 100, 0, 100) : 0) + '%"></span></div>' +
        '<p class="tiny muted" style="margin:10px 0 0">Estimated ingredient cost of your current meal plan, based on typical supermarket prices. This is a guide, not a guarantee.</p>' +
      "</div>" +

      '<div class="card" style="margin-bottom:16px">' +
        '<div class="card-hd"><h3>Estimated spend by category</h3></div>' +
        (items.length
          ? ING_CATEGORIES.filter((c) => catTotals[c.id]).map((c) =>
              '<div style="margin-bottom:10px"><div class="meter-row"><span>' + c.emoji + " " + esc(c.label) + "</span><strong>" + money(catTotals[c.id]) + "</strong></div>" +
              '<div class="bar"><span style="width:' + clamp((catTotals[c.id] / (groceryTotal() || 1)) * 100, 2, 100) + '%"></span></div></div>'
            ).join("")
          : '<p class="muted small">Build a grocery list to see a category breakdown.</p>') +
      "</div>" +

      (swaps.length
        ? '<div class="card" style="margin-bottom:16px"><div class="card-hd"><h3>' + icon("leaf") + " Cheaper swaps</h3></div>" +
          '<div class="stack-sm">' + swaps.map((s) =>
            '<div class="gitem"><div style="flex:1"><div class="gname">' + esc(s.from.name) + '</div><div class="gsub">could become ' + esc(s.to.name) + " · save about " + money(s.save) + " per meal</div></div>" +
            '<button class="btn ghost sm" data-action="open-recipe" data-id="' + s.to.id + '">View</button></div>'
          ).join("") + "</div>" +
          '<p class="tiny muted" style="margin:12px 0 0">Estimated savings only. Actual prices vary by shop, brand and season.</p></div>'
        : "") +

      '<div class="card">' +
        '<div class="card-hd"><h3>Log actual spend</h3><div class="spacer"></div><button class="btn subtle sm" data-action="budget-add">' + icon("plus") + " Add</button></div>" +
        (state.budgetLog.length
          ? '<div class="stack-sm">' + state.budgetLog.slice().reverse().map((e) =>
              '<div class="kv"><span class="k">' + esc(e.label) + " · " + humanDate(e.date) + '</span><span class="v">' + money(e.amount) + ' <button class="btn ghost sm icon" data-action="budget-del" data-id="' + e.id + '" aria-label="Delete">' + icon("trash") + "</button></span></div>"
            ).join("") + "</div>" +
            '<div class="hr"></div><div class="kv"><span class="k">Total logged this week</span><span class="v">' + money(actual) + "</span></div>" +
            '<div class="kv"><span class="k">' + (actualRemaining >= 0 ? "Under budget by" : "Over budget by") + "</span><span class=\"v\">" + money(Math.abs(actualRemaining)) + "</span></div>"
          : '<p class="muted small">Log what you actually spend to compare it with the estimate. Stored only on this device.</p>') +
      "</div>" +

      '<div class="banner info" style="margin-top:16px">' + icon("info") + "<div>MealWise never claims guaranteed savings. Estimated costs come from recipe data; actual spending is whatever you log.</div></div>"
    );
  };

  /* ---- Premium ---- */
  screens.premium = function () {
    const s = state.settings;
    const monthly = Number(s.premiumMonthly) || 5.99;
    const yearly = Number(s.premiumYearly) || 49.99;
    const isPrem = s.plan === "premium";
    const feats = [
      { t: "AI meal generations", f: "5 per week", p: "Unlimited" },
      { t: "Saved meal plans", f: "1 active plan", p: "Unlimited saved plans" },
      { t: "Recipe collection", f: "Full access", p: "Full access" },
      { t: "Grocery list", f: "Included", p: "Included" },
      { t: "Pantry & waste tracker", f: "Included", p: "Included" },
      { t: "Advanced budget tools", f: "Basic", p: "Cost breakdowns & swaps" },
      { t: "Personalised planning", f: "Standard", p: "Goal-weighted planning" },
    ];
    return (
      '<div class="premium-hero" style="margin-bottom:18px">' +
        '<div class="eyebrow" style="color:#CBD8C1">MealWise Premium</div>' +
        "<h1>" + (isPrem ? "You're on Premium" : "Plan better, waste less") + "</h1>" +
        '<p style="color:#DCE7D6">More AI generations, unlimited saved plans and deeper budget tools. Essential features stay free, always.</p>' +
        (isPrem ? '<span class="tag gold">' + icon("sparkles") + " Active</span>" : "") +
      "</div>" +

      '<div class="stack">' +
        '<div class="plan-card' + (!isPrem ? " featured" : "") + '">' +
          '<div class="row"><div><div class="eyebrow">Free</div><div class="pricetag">€0</div><div class="tiny muted">Forever</div></div>' +
            '<div class="spacer"></div>' + (!isPrem ? '<span class="tag">Current plan</span>' : "") + "</div>" +
          '<ul class="plan-feats">' +
            '<li>' + icon("check") + "<span>Basic meal suggestions</span></li>" +
            '<li>' + icon("check") + "<span>One weekly meal plan</span></li>" +
            '<li>' + icon("check") + "<span>Grocery list & pantry tracker</span></li>" +
            '<li>' + icon("check") + "<span>5 AI generations per week</span></li>" +
          "</ul>" +
        "</div>" +

        '<div class="plan-card' + (!isPrem ? " featured" : "") + '">' +
          '<div class="row"><div><div class="eyebrow">Premium</div>' +
            '<div class="pricetag">' + money(monthly) + '<span class="tiny muted" style="font-size:.8rem;font-weight:400"> / month</span></div>' +
            '<div class="tiny muted">or ' + money(yearly) + " / year</div></div>" +
            '<div class="spacer"></div>' + (isPrem ? '<span class="tag gold">Active</span>' : '<span class="tag">Best value</span>') + "</div>" +
          '<ul class="plan-feats">' +
            '<li>' + icon("check") + "<span>Unlimited AI generations</span></li>" +
            '<li>' + icon("check") + "<span>Unlimited saved meal plans</span></li>" +
            '<li>' + icon("check") + "<span>Advanced budget tools & cheaper swaps</span></li>" +
            '<li>' + icon("check") + "<span>Personalised, goal-weighted planning</span></li>" +
          "</ul>" +
          '<div style="margin-top:16px">' +
            (isPrem
              ? '<button class="btn ghost block" data-action="premium-cancel">Switch back to Free (demo)</button>'
              : '<button class="btn block lg" data-action="premium-upgrade">' + icon("sparkles") + " Upgrade to Premium</button>") +
          "</div>" +
        "</div>" +
      "</div>" +

      '<div class="banner info" style="margin-top:18px">' + icon("info") + "<div><strong>No payment provider is connected in this build.</strong> Upgrading is a local demo toggle so you can try the premium experience — no money changes hands and no subscription is created. Before a real launch, connect a provider such as Stripe and show renewal terms and cancellation details before purchase.</div></div>" +

      '<div class="card" style="margin-top:18px"><div class="card-hd"><h3>Pricing settings</h3></div>' +
        '<p class="small muted">Configure the prices shown above. These are display values only.</p>' +
        '<div class="grid2">' +
          '<div class="field"><label for="prem-m">Monthly price</label><input class="input" id="prem-m" type="number" step="0.01" value="' + monthly + '" data-action="prem-price" data-key="premiumMonthly" /></div>' +
          '<div class="field"><label for="prem-y">Yearly price</label><input class="input" id="prem-y" type="number" step="0.01" value="' + yearly + '" data-action="prem-price" data-key="premiumYearly" /></div>' +
        "</div>" +
        '<div class="field"><label for="prem-b">Default billing period</label><select class="input" id="prem-b" data-action="prem-billing">' +
          '<option value="monthly"' + (s.premiumBilling === "monthly" ? " selected" : "") + ">Monthly</option>" +
          '<option value="yearly"' + (s.premiumBilling === "yearly" ? " selected" : "") + ">Yearly</option>" +
        "</select></div>" +
        '<p class="tiny muted">Renewal terms: a real subscription would renew automatically each period until cancelled. Shown here for transparency only.</p>' +
      "</div>" +

      '<div class="card" style="margin-top:16px"><div class="card-hd"><h3>Feature comparison</h3></div>' +
        '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.86rem">' +
        '<thead><tr><th style="text-align:left;padding:8px 6px;border-bottom:1px solid var(--line)">Feature</th><th style="text-align:left;padding:8px 6px;border-bottom:1px solid var(--line)">Free</th><th style="text-align:left;padding:8px 6px;border-bottom:1px solid var(--line)">Premium</th></tr></thead><tbody>' +
        feats.map((f) => '<tr><td style="padding:9px 6px;border-bottom:1px solid var(--line-2)">' + esc(f.t) + '</td><td style="padding:9px 6px;border-bottom:1px solid var(--line-2);color:var(--muted)">' + esc(f.f) + '</td><td style="padding:9px 6px;border-bottom:1px solid var(--line-2);font-weight:600">' + esc(f.p) + "</td></tr>").join("") +
        "</tbody></table></div></div>"
    );
  };

  /* ---- Profile ---- */
  screens.profile = function () {
    const s = state.settings;
    return (
      '<div class="page-head"><h1>Profile &amp; Settings</h1><p>Your household, budget and preferences. Stored only in this browser.</p></div>' +

      '<div class="card" style="margin-bottom:16px">' +
        '<div class="card-hd"><h3>Household</h3></div>' +
        '<div class="grid2">' +
          '<div class="field"><label for="set-people">People you cook for</label><input class="input" id="set-people" type="number" min="1" max="12" value="' + s.people + '" data-action="set-num" data-key="people" /></div>' +
          '<div class="field"><label for="set-budget">Weekly budget</label><input class="input" id="set-budget" type="number" min="0" step="5" value="' + s.budget + '" data-action="set-num" data-key="budget" /></div>' +
          '<div class="field"><label for="set-currency">Currency</label><select class="input" id="set-currency" data-action="set-select" data-key="currency">' +
            CURRENCIES.map((c) => '<option value="' + c.code + '"' + (c.code === s.currency ? " selected" : "") + ">" + esc(c.label) + "</option>").join("") + "</select></div>" +
          '<div class="field"><label for="set-units">Units</label><select class="input" id="set-units" data-action="set-select" data-key="units">' +
            '<option value="metric"' + (s.units === "metric" ? " selected" : "") + ">Metric (g / ml)</option>" +
            '<option value="imperial"' + (s.units === "imperial" ? " selected" : "") + ">Imperial (oz / cups)</option></select>" +
            '<div class="hint">Metric is the default. Imperial display is planned.</div></div>' +
        "</div>" +
      "</div>" +

      '<div class="card" style="margin-bottom:16px">' +
        '<div class="card-hd"><h3>Diet &amp; preferences</h3></div>' +
        '<div class="field"><label for="set-diet">Dietary preference</label><select class="input" id="set-diet" data-action="set-select" data-key="diet">' +
          DIETS.map((d) => '<option value="' + d.id + '"' + (d.id === s.diet ? " selected" : "") + ">" + esc(d.label) + "</option>").join("") + "</select></div>" +
        (s.diet === "other" ? '<div class="field"><label for="set-dietother">Describe it</label><input class="input" id="set-dietother" value="' + esc(s.dietOther || "") + '" data-action="set-text" data-key="dietOther" /></div>' : "") +
        '<div class="field"><label>Allergies</label><div class="chip-row">' +
          ALLERGENS.map((a) => '<button class="chip" data-action="set-allergen" data-id="' + a.id + '" aria-pressed="' + ((s.allergies || []).indexOf(a.id) !== -1) + '">' + esc(a.label) + "</button>").join("") +
        "</div></div>" +
        '<div class="field"><label for="set-avoid">Ingredients to avoid</label><input class="input" id="set-avoid" value="' + esc((s.avoid || []).join(", ")) + '" data-action="set-avoid" /></div>' +
        '<div class="field"><label>Preferred cuisines</label><div class="chip-row">' +
          CUISINES.map((c) => '<button class="chip" data-action="set-cuisine" data-id="' + esc(c) + '" aria-pressed="' + ((s.cuisines || []).indexOf(c) !== -1) + '">' + esc(c) + "</button>").join("") +
        "</div></div>" +
        '<div class="grid2">' +
          '<div class="field"><label for="set-skill">Cooking skill</label><select class="input" id="set-skill" data-action="set-select" data-key="skill">' +
            SKILLS.map((k) => '<option value="' + k.id + '"' + (k.id === s.skill ? " selected" : "") + ">" + esc(k.label) + "</option>").join("") + "</select></div>" +
          '<div class="field"><label for="set-maxtime">Max prep + cook time (min)</label><input class="input" id="set-maxtime" type="number" min="10" max="120" step="5" value="' + s.maxTime + '" data-action="set-num" data-key="maxTime" /></div>' +
        "</div>" +
        '<div class="field"><label for="set-goal">Main goal</label><select class="input" id="set-goal" data-action="set-select" data-key="goal">' +
          GOALS.map((g) => '<option value="' + g.id + '"' + (g.id === s.goal ? " selected" : "") + ">" + esc(g.label) + "</option>").join("") + "</select></div>" +
      "</div>" +

      '<div class="card" style="margin-bottom:16px">' +
        '<div class="card-hd"><h3>Plan &amp; usage</h3></div>' +
        '<div class="kv"><span class="k">Current plan</span><span class="v">' + (s.plan === "premium" ? "Premium" : "Free") + "</span></div>" +
        '<div class="kv"><span class="k">AI generations left</span><span class="v">' + (s.plan === "premium" ? "Unlimited" : s.aiCredits + " of " + s.aiCreditsMax) + "</span></div>" +
        '<div class="kv"><span class="k">Saved recipes</span><span class="v">' + state.favorites.length + "</span></div>" +
        '<div class="kv"><span class="k">Pantry items</span><span class="v">' + state.pantry.length + "</span></div>" +
        '<div style="margin-top:12px"><button class="btn subtle sm" data-action="nav" data-route="premium">' + icon("sparkles") + " Manage subscription</button></div>" +
      "</div>" +

      '<div class="card" style="margin-bottom:16px">' +
        '<div class="card-hd"><h3>Privacy &amp; your data</h3></div>' +
        '<p class="small">MealWise stores everything — your preferences, pantry, plans and lists — locally in this browser. There is no account and nothing is uploaded to a server in this build. Clearing your browser data removes it.</p>' +
        '<div class="row wrap" style="gap:10px">' +
          '<button class="btn ghost sm" data-action="nav" data-route="privacy">' + icon("shield") + " Read the privacy notes</button>" +
          '<button class="btn ghost sm" data-action="data-export">' + icon("arrowR") + " Export my data</button>" +
        "</div>" +
      "</div>" +

      '<div class="card" style="margin-bottom:16px">' +
        '<div class="card-hd"><h3>Integrations &amp; status</h3></div>' +
        '<p class="small muted">This build runs entirely in your browser. Here is exactly what is real and what would need connecting for a production launch.</p>' +
        '<div class="stack-sm">' +
          '<div class="kv"><span class="k">AI meal suggestions</span><span class="v"><span class="tag amber">Demo engine</span></span></div>' +
          '<div class="kv"><span class="k">Payments &amp; subscriptions</span><span class="v"><span class="tag red">Not connected</span></span></div>' +
          '<div class="kv"><span class="k">Accounts &amp; cloud sync</span><span class="v"><span class="tag red">Not connected</span></span></div>' +
          '<div class="kv"><span class="k">Food photo recognition</span><span class="v"><span class="tag red">Not connected</span></span></div>' +
          '<div class="kv"><span class="k">Live grocery prices</span><span class="v"><span class="tag red">Estimates only</span></span></div>' +
        '</div>' +
        '<details class="accordion" style="margin-top:12px"><summary>What is still needed for production?' + icon("chevR", "ico caret") + '</summary><div class="abody small">' +
          '<p>1. <strong>AI provider</strong> — route recipe generation through a server endpoint that holds the API key (never in client code) and set <code>MW.APP.aiMode = "connected"</code>.</p>' +
          '<p>2. <strong>Payments</strong> — connect a provider such as Stripe, show renewal and cancellation terms before purchase, and verify entitlements server-side.</p>' +
          '<p>3. <strong>Accounts &amp; backend</strong> — add authentication and a database so plans, lists and pantry sync across devices, with proper data protection.</p>' +
          '<p>4. <strong>Image recognition</strong> — connect a vision service to enable ingredient photo upload.</p>' +
          '<p>5. <strong>Price data</strong> — integrate retailer or basket price feeds to replace the current estimates.</p>' +
        '</div></details>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-hd"><h3>Danger zone</h3></div>' +
        '<p class="small muted">Reset removes all plans, lists and preferences from this browser and starts onboarding again.</p>' +
        '<div class="row wrap" style="gap:10px">' +
          '<button class="btn ghost sm" data-action="data-reset-soft">Reset preferences</button>' +
          '<button class="btn danger sm" data-action="data-reset">Delete all my data</button>' +
        "</div>" +
      "</div>" +

      '<p class="tiny muted center" style="margin-top:22px">MealWise v' + MW.APP.version + " · " + (MW.APP.aiMode === "demo" ? "Demo mode: on-device suggestions, no external AI, no payments." : "Connected mode.") + "</p>"
    );
  };

  /* ---- Privacy ---- */
  screens.privacy = function () {
    return (
      '<div class="page-head"><h1>Privacy &amp; Data</h1><p>Plain-language notes on what MealWise does with your information.</p></div>' +
      '<div class="stack">' +
        '<div class="card"><h3>What we store</h3><p class="small">Your household size, budget, dietary preferences, allergies, pantry items, meal plans, grocery lists, saved recipes and settings. In this build all of it lives in your browser\'s local storage on this device.</p></div>' +
        '<div class="card"><h3>What we don\'t do</h3><p class="small">We don\'t create an account, we don\'t upload your data to a server, we don\'t sell it, and we don\'t use it for advertising. No analytics or tracking scripts run on this page.</p></div>' +
        '<div class="card"><h3>Allergy &amp; health information</h3><p class="small">Allergies you enter are used only to filter suggestions on your device. They are treated as sensitive and never shared. MealWise flags allergens from its recipe data but cannot verify products — always check labels.</p></div>' +
        '<div class="card"><h3>AI suggestions</h3><p class="small">' + (MW.APP.aiMode === "demo" ? "Suggestions are produced by an on-device matching engine. No text you type is sent anywhere." : "When a real AI provider is connected, only the ingredient text you enter would be sent, never your personal details.") + "</p></div>" +
        '<div class="card"><h3>Payments</h3><p class="small">No payment provider is connected. The Premium upgrade is a local demo switch and takes no payment.</p></div>' +
        '<div class="card"><h3>Your control</h3><p class="small">You can export or delete all your data from Profile &amp; Settings at any time.</p></div>' +
      "</div>" +
      '<div style="margin-top:18px"><button class="btn ghost" data-action="nav" data-route="profile">' + icon("chevL") + " Back to profile</button></div>"
    );
  };

  /* ---------------------------------------------------------
     Meal plan actions
     --------------------------------------------------------- */
  function openMealActions(day, slot) {
    const key = day + ":" + slot;
    const m = state.plan.meals[key];
    if (!m || !m.recipeId) { openAddMeal(day, slot); return; }
    const r = getRecipe(m.recipeId);
    const isEaten = m.status === "eaten";
    openModal({
      title: DAYS_FULL[day] + " · " + (SLOTS.find((s) => s.id === slot) || {}).label,
      label: "Meal options",
      body:
        '<div class="row" style="gap:12px;margin-bottom:16px">' +
          '<div class="mthumb" style="width:64px;height:64px">' + (r.image ? '<img src="' + esc(r.image) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:12px" />' : MW.emojiFor(r.name)) + "</div>" +
          '<div><div style="font-weight:600">' + esc(r.name) + '</div><div class="tiny muted">' + totalTime(r) + " min · " + money(costPerServing(r) * (m.servings || state.settings.people)) + " est.</div></div>" +
        "</div>" +
        '<div class="stack-sm">' +
          '<button class="btn ghost block" data-action="meal-replace" data-day="' + day + '" data-slot="' + slot + '">' + icon("shuffle") + " Replace with another suggestion</button>" +
          '<button class="btn ghost block" data-action="meal-move" data-day="' + day + '" data-slot="' + slot + '">' + icon("calendar") + " Move to another day</button>" +
          '<button class="btn ghost block" data-action="meal-eaten" data-day="' + day + '" data-slot="' + slot + '">' + icon("check") + (isEaten ? " Mark as not eaten" : " Mark as eaten") + "</button>" +
          '<button class="btn ghost block" data-action="meal-leftover" data-day="' + day + '" data-slot="' + slot + '">' + icon("leaf") + " Use as leftovers tomorrow</button>" +
          '<button class="btn ghost block" data-action="meal-skip" data-day="' + day + '" data-slot="' + slot + '">' + icon("close") + " Skip this meal</button>" +
          '<button class="btn ghost block" data-action="open-recipe" data-id="' + r.id + '">' + icon("book") + " View full recipe</button>" +
        "</div>",
    });
  }

  function openAddMeal(day, slot) {
    const pool = safeRecipes().filter((r) => (r.meals || []).indexOf(slot) !== -1);
    const ranked = pool.map((r) => ({ r, s: scoreRecipe(r, { ingredients: state.pantry.map((p) => p.name) }) })).sort((a, b) => b.s - a.s).slice(0, 12);
    openModal({
      title: "Add " + (SLOTS.find((s) => s.id === slot) || {}).label.toLowerCase(),
      label: "Choose a meal",
      body: '<div class="stack-sm">' + ranked.map(({ r }) =>
        '<button class="gitem" style="width:100%;text-align:left;cursor:pointer" data-action="meal-set" data-day="' + day + '" data-slot="' + slot + '" data-id="' + r.id + '">' +
          '<span class="mthumb" style="width:44px;height:44px;border-radius:10px;background:var(--sage-100);display:grid;place-items:center">' + MW.emojiFor(r.name) + "</span>" +
          '<span style="flex:1"><span class="gname">' + esc(r.name) + '</span><br><span class="gsub">' + totalTime(r) + " min · " + money(costPerServing(r)) + " / serving</span></span>" +
          icon("plus") +
        "</button>"
      ).join("") + "</div>",
    });
  }

  function openMoveMeal(day, slot) {
    let html = '<p class="small muted" style="margin-bottom:12px">Move this meal to another slot or day.</p><div class="stack-sm">';
    for (let d = 0; d < 7; d++) {
      SLOTS.forEach((sl) => {
        if (d === day && sl.id === slot) return;
        const occupied = state.plan.meals[d + ":" + sl.id];
        html += '<button class="gitem" style="width:100%;text-align:left;cursor:pointer" data-action="meal-move-to" data-day="' + day + '" data-slot="' + slot + '" data-tday="' + d + '" data-tslot="' + sl.id + '">' +
          '<span style="flex:1"><span class="gname">' + DAYS[d] + " · " + sl.label + '</span>' + (occupied ? ' <span class="tag line">replace</span>' : ' <span class="tag">free</span>') + "</span>" + icon("arrowR") + "</button>";
      });
    }
    html += "</div>";
    openModal({ title: "Move meal", label: "Move meal", body: html });
  }

  /* ---------------------------------------------------------
     Pantry / grocery forms
     --------------------------------------------------------- */
  function openPantryForm(item) {
    const it = item || { name: "", q: 1, u: "piece", expiry: "" };
    openModal({
      title: item ? "Edit ingredient" : "Add ingredient",
      label: "Pantry ingredient",
      body:
        '<div class="field"><label for="p-name">Ingredient</label><input class="input" id="p-name" value="' + esc(it.name) + '" placeholder="e.g. Spinach" /></div>' +
        '<div class="grid2">' +
          '<div class="field"><label for="p-qty">Quantity</label><input class="input" id="p-qty" type="number" min="0" step="0.5" value="' + it.q + '" /></div>' +
          '<div class="field"><label for="p-unit">Unit</label><select class="input" id="p-unit">' + MW.UNITS.map((u) => '<option' + (u === it.u ? " selected" : "") + ">" + u + "</option>").join("") + "</select></div>" +
        "</div>" +
        '<div class="field"><label for="p-expiry">Best before (optional)</label><input class="input" id="p-expiry" type="date" value="' + esc(it.expiry || "") + '" />' +
          '<div class="hint">A reminder only — not a food-safety guarantee.</div></div>' +
        '<button class="btn block" data-action="pantry-save" data-id="' + (item ? item.id : "") + '">' + (item ? "Save changes" : "Add to pantry") + "</button>",
    });
  }

  function openGroceryForm(item) {
    const it = item || { name: "", q: 1, u: "piece", category: "produce", est: "" };
    openModal({
      title: item ? "Edit item" : "Add item",
      label: "Grocery item",
      body:
        '<div class="field"><label for="g-name">Item</label><input class="input" id="g-name" value="' + esc(it.name) + '" placeholder="e.g. Olive oil" /></div>' +
        '<div class="grid2">' +
          '<div class="field"><label for="g-qty">Quantity</label><input class="input" id="g-qty" type="number" min="0" step="0.5" value="' + it.q + '" /></div>' +
          '<div class="field"><label for="g-unit">Unit</label><select class="input" id="g-unit">' + MW.UNITS.map((u) => '<option' + (u === it.u ? " selected" : "") + ">" + u + "</option>").join("") + "</select></div>" +
          '<div class="field"><label for="g-cat">Category</label><select class="input" id="g-cat">' + ING_CATEGORIES.map((c) => '<option value="' + c.id + '"' + (c.id === it.category ? " selected" : "") + ">" + esc(c.label) + "</option>").join("") + "</select></div>" +
          '<div class="field"><label for="g-est">Estimated price</label><input class="input" id="g-est" type="number" min="0" step="0.1" value="' + (it.est || "") + '" placeholder="optional" /></div>' +
        "</div>" +
        '<button class="btn block" data-action="grocery-save" data-id="' + (item ? item.id : "") + '">' + (item ? "Save changes" : "Add to list") + "</button>",
    });
  }

  function openBudgetForm() {
    openModal({
      title: "Log spend",
      label: "Log grocery spend",
      body:
        '<div class="field"><label for="b-label">What was it for?</label><input class="input" id="b-label" placeholder="e.g. Weekly shop" value="Weekly shop" /></div>' +
        '<div class="grid2">' +
          '<div class="field"><label for="b-amount">Amount</label><input class="input" id="b-amount" type="number" min="0" step="0.5" placeholder="0.00" /></div>' +
          '<div class="field"><label for="b-date">Date</label><input class="input" id="b-date" type="date" value="' + today() + '" /></div>' +
        "</div>" +
        '<button class="btn block" data-action="budget-save">Add entry</button>',
    });
  }

  function openCustomRecipeForm() {
    openModal({
      title: "Save a generated recipe",
      label: "Save recipe",
      body: '<p class="small muted">Generated recipes can be saved to your collection so they persist. Enter the details below.</p>' +
        '<div class="field"><label for="cr-name">Recipe name</label><input class="input" id="cr-name" placeholder="e.g. Leftover veg frittata" /></div>' +
        '<div class="grid2">' +
          '<div class="field"><label for="cr-serv">Servings</label><input class="input" id="cr-serv" type="number" min="1" value="2" /></div>' +
          '<div class="field"><label for="cr-time">Time (min)</label><input class="input" id="cr-time" type="number" min="1" value="20" /></div>' +
        "</div>" +
        '<div class="field"><label for="cr-ing">Ingredients (one per line, "quantity unit name")</label><textarea class="input" id="cr-ing" placeholder="2 piece eggs&#10;100 g spinach"></textarea></div>' +
        '<div class="field"><label for="cr-steps">Method (one step per line)</label><textarea class="input" id="cr-steps"></textarea></div>' +
        '<button class="btn block" data-action="custom-recipe-save">Save recipe</button>',
    });
  }

  /* ---------------------------------------------------------
     Action handlers
     --------------------------------------------------------- */
  function handleAction(action, el) {
    const d = el.dataset;
    switch (action) {
      /* navigation */
      case "nav": nav(d.route); break;
      case "modal-close": closeModal(); break;

      /* onboarding */
      case "onb-next":
        if (onb.step === 1) { onb.people = clamp(Number($("#onb-people").value) || 2, 1, 12); onb.budget = Math.max(0, Number($("#onb-budget").value) || 0); onb.currency = $("#onb-currency").value; }
        if (onb.step === 2 && onb.diet === "other") onb.dietOther = $("#onb-dietother") ? $("#onb-dietother").value : onb.dietOther;
        if (onb.step === 3) onb.avoid = ($("#onb-avoid") ? $("#onb-avoid").value : onb.avoid) || "";
        if (onb.step === 5) { finishOnboarding(); return; }
        onb.step = Math.min(5, onb.step + 1); render(); break;
      case "onb-back": onb.step = Math.max(0, onb.step - 1); render(); break;
      case "onb-people": onb.people = clamp(onb.people + Number(d.delta), 1, 12); render(); break;
      case "onb-diet": onb.diet = d.id; render(); break;
      case "onb-allergen": toggleArr(onb.allergies, d.id); render(); break;
      case "onb-cuisine": toggleArr(onb.cuisines, d.id); render(); break;
      case "onb-skill": onb.skill = d.id; render(); break;
      case "onb-goal": onb.goal = d.id; render(); break;

      /* home */
      case "home-generate":
        if (!consumeCredit()) { nav("premium"); toast("You've used your free AI generations. Premium is unlimited.", "error"); return; }
        generatePlan();
        state.grocery.items = buildGroceryFromPlan(false).items;
        state.grocery.fromPlan = true;
        state.grocery.updated = new Date().toISOString();
        save(); render(); toast("New week generated.", "success");
        break;
      case "cook-with-soon": {
        const names = state.pantry.filter((p) => { const dd = daysUntil(p.expiry); return dd !== null && dd <= 4; }).map((p) => p.name);
        gen.ingredients = names; gen.results = null; gen.usedPantry = true; nav("generator");
        break;
      }

      /* generator */
      case "gen-pantry": {
        const n = d.name;
        const i = gen.ingredients.findIndex((x) => x.toLowerCase() === n.toLowerCase());
        if (i === -1) gen.ingredients.push(n); else gen.ingredients.splice(i, 1);
        render(); break;
      }
      case "gen-run": {
        const ta = $("#gen-ing");
        if (ta) gen.ingredients = ta.value.split(",").map((x) => x.trim()).filter(Boolean);
        gen.maxTime = Number($("#gen-time").value) || 30;
        gen.mealType = $("#gen-meal").value || "";
        if (!consumeCredit()) { nav("premium"); toast("You've used your free AI generations this week.", "error"); return; }
        gen.busy = true; render();
        setTimeout(() => {
          gen.busy = false;
          gen.results = generateSuggestions({ ingredients: gen.ingredients, maxTime: gen.maxTime, mealType: gen.mealType, count: 6 });
          save(); render();
          if (!gen.results.length) toast("No matches — try widening your filters.", "error");
        }, 700);
        break;
      }
      case "gen-clear": gen = { ingredients: [], maxTime: 30, mealType: "", results: null, busy: false, usedPantry: false }; render(); break;
      case "gen-add-all": {
        if (!gen.results) break;
        let n = 0;
        gen.results.forEach((r) => { n += addIngredientsToGrocery(r, state.settings.people, true); });
        toast(n + " ingredients added to your grocery list.", "success");
        render(); break;
      }

      /* plan */
      case "plan-generate":
        if (state.plan.created && !consumeCredit()) { nav("premium"); toast("You've used your free AI generations. Premium is unlimited.", "error"); return; }
        generatePlan(); save(); render(); toast("Your week is planned.", "success"); break;
      case "plan-clear":
        openModal({ title: "Clear this plan?", label: "Confirm", body: '<p class="small">This removes all meals from the current week. Your saved recipes and pantry stay.</p><div class="row" style="gap:10px"><button class="btn ghost" data-action="modal-close">Cancel</button><button class="btn danger" data-action="plan-clear-confirm">Clear plan</button></div>' });
        break;
      case "plan-clear-confirm": state.plan = { created: false, weekStart: iso(mondayOf(new Date())), meals: {}, servings: state.settings.people }; closeModal(); save(); render(); toast("Plan cleared."); break;
      case "plan-to-grocery": {
        if (!state.plan.created) { toast("Generate a plan first.", "error"); break; }
        const built = buildGroceryFromPlan(true);
        state.grocery.items = built.items; state.grocery.fromPlan = true; state.grocery.updated = new Date().toISOString();
        save(); nav("groceries");
        toast(built.items.length + " items on your list" + (built.covered.length ? " · " + built.covered.length + " covered by your pantry" : "") + ".", "success");
        break;
      }
      case "plan-save": {
        state.savedPlans.push({ weekStart: state.plan.weekStart, meals: JSON.parse(JSON.stringify(state.plan.meals)), count: planMealsList().length });
        save(); render(); toast("Plan saved.", "success"); break;
      }
      case "plan-load": {
        const p = state.savedPlans[Number(d.idx)];
        if (p) { state.plan.meals = JSON.parse(JSON.stringify(p.meals)); state.plan.weekStart = p.weekStart; state.plan.created = true; save(); render(); toast("Plan loaded.", "success"); }
        break;
      }
      case "meal-more": openMealActions(Number(d.day), d.slot); break;
      case "meal-add": openAddMeal(Number(d.day), d.slot); break;
      case "meal-set": {
        state.plan.meals[d.day + ":" + d.slot] = { recipeId: d.id, servings: state.settings.people, status: "planned" };
        state.plan.created = true; closeModal(); save(); render(); toast("Meal added.", "success"); break;
      }
      case "meal-replace": {
        const key = d.day + ":" + d.slot;
        const cur = state.plan.meals[key];
        const pool = safeRecipes().filter((r) => (r.meals || []).indexOf(d.slot) !== -1 && (!cur || r.id !== cur.recipeId));
        if (!pool.length) { toast("No other suggestion available.", "error"); break; }
        const ctx = { ingredients: state.pantry.map((p) => p.name) };
        const used = {};
        Object.keys(state.plan.meals).forEach((k) => { const m = state.plan.meals[k]; if (m && m.recipeId) used[m.recipeId] = (used[m.recipeId] || 0) + 1; });
        pool.sort((a, b) =>
          (scoreRecipe(b, ctx) - Math.pow((used[b.id] || 0) + 1, 2) * 9 + Math.random() * 6) -
          (scoreRecipe(a, ctx) - Math.pow((used[a.id] || 0) + 1, 2) * 9 + Math.random() * 6)
        );
        const r = pool[0];
        state.plan.meals[key] = { recipeId: r.id, servings: state.settings.people, status: "planned" };
        closeModal(); save(); render(); toast("Swapped for " + r.name + ".", "success");
        break;
      }
      case "meal-move": openMoveMeal(Number(d.day), d.slot); break;
      case "meal-move-to": {
        const from = d.day + ":" + d.slot;
        const to = d.tday + ":" + d.tslot;
        state.plan.meals[to] = state.plan.meals[from];
        delete state.plan.meals[from];
        closeModal(); save(); render(); toast("Meal moved.", "success"); break;
      }
      case "meal-eaten": {
        const m = state.plan.meals[d.day + ":" + d.slot];
        if (m) { m.status = m.status === "eaten" ? "planned" : "eaten"; if (m.status === "eaten") { state.cooked.push({ id: m.recipeId, at: Date.now() }); state.cooked = state.cooked.slice(-40); } }
        closeModal(); save(); render(); break;
      }
      case "meal-skip": {
        const m = state.plan.meals[d.day + ":" + d.slot];
        if (m) m.status = "skipped";
        closeModal(); save(); render(); toast("Meal skipped."); break;
      }
      case "meal-leftover": {
        const src = state.plan.meals[d.day + ":" + d.slot];
        const nd = Number(d.day) + 1;
        if (nd > 6) { toast("That's the last day of the week.", "error"); break; }
        state.plan.meals[nd + ":lunch"] = { recipeId: src.recipeId, servings: state.settings.people, status: "planned", leftoverFrom: d.day + ":" + d.slot };
        closeModal(); save(); render(); toast("Saved as tomorrow's lunch.", "success"); break;
      }
      case "day-fill": {
        const day = Number(d.day);
        SLOTS.forEach((sl) => {
          if (!state.plan.meals[day + ":" + sl.id]) {
            const r = pickRecipeFor(day, sl.id);
            if (r) state.plan.meals[day + ":" + sl.id] = { recipeId: r.id, servings: state.settings.people, status: "planned" };
          }
        });
        state.plan.created = true; save(); render(); toast("Empty slots filled.", "success"); break;
      }

      /* grocery */
      case "shop-mode": shopMode = !shopMode; render(); break;
      case "g-check": { const i = state.grocery.items.find((x) => x.id === d.id); if (i) i.checked = !i.checked; save(); render(); break; }
      case "g-inc": { const i = state.grocery.items.find((x) => x.id === d.id); if (i) { i.q = Math.round((i.q + 1) * 100) / 100; } save(); render(); break; }
      case "g-dec": { const i = state.grocery.items.find((x) => x.id === d.id); if (i) { i.q = Math.max(0, Math.round((i.q - 1) * 100) / 100); } save(); render(); break; }
      case "g-del": state.grocery.items = state.grocery.items.filter((x) => x.id !== d.id); save(); render(); break;
      case "g-edit": openGroceryForm(state.grocery.items.find((x) => x.id === d.id)); break;
      case "grocery-add": openGroceryForm(null); break;
      case "grocery-save": {
        const name = $("#g-name").value.trim();
        if (!name) { toast("Please enter an item name.", "error"); break; }
        const obj = { name: name, q: Number($("#g-qty").value) || 1, u: $("#g-unit").value, category: $("#g-cat").value, est: Number($("#g-est").value) || 0 };
        if (d.id) { Object.assign(state.grocery.items.find((x) => x.id === d.id), obj); }
        else { state.grocery.items.push(Object.assign({ id: uid(), checked: false, custom: true }, obj)); }
        state.grocery.updated = new Date().toISOString(); closeModal(); save(); render(); toast("Saved.", "success"); break;
      }
      case "g-clear-checked": state.grocery.items = state.grocery.items.filter((x) => !x.checked); save(); render(); toast("Checked items removed."); break;
      case "g-rebuild": { const b = buildGroceryFromPlan(true); state.grocery.items = b.items; state.grocery.updated = new Date().toISOString(); save(); render(); toast("List rebuilt from your plan.", "success"); break; }

      /* pantry */
      case "pantry-add": openPantryForm(null); break;
      case "pantry-edit": openPantryForm(state.pantry.find((x) => x.id === d.id)); break;
      case "pantry-del": state.pantry = state.pantry.filter((x) => x.id !== d.id); save(); render(); break;
      case "pantry-clear":
        openModal({ title: "Clear pantry?", label: "Confirm", body: '<p class="small">This removes all pantry items.</p><div class="row" style="gap:10px"><button class="btn ghost" data-action="modal-close">Cancel</button><button class="btn danger" data-action="pantry-clear-confirm">Clear</button></div>' });
        break;
      case "pantry-clear-confirm": state.pantry = []; closeModal(); save(); render(); toast("Pantry cleared."); break;
      case "pantry-save": {
        const name = $("#p-name").value.trim();
        if (!name) { toast("Please enter an ingredient name.", "error"); break; }
        const obj = { name: name, q: Number($("#p-qty").value) || 0, u: $("#p-unit").value, expiry: $("#p-expiry").value || null };
        if (d.id) Object.assign(state.pantry.find((x) => x.id === d.id), obj);
        else state.pantry.push(Object.assign({ id: uid() }, obj));
        closeModal(); save(); render(); toast("Pantry updated.", "success"); break;
      }

      /* recipes */
      case "rf-input": rf.q = $("#rf-q").value; break; // handled on input, re-render debounced
      case "rf-toggle": { const f = $("#rf-filters"); f.style.display = f.style.display === "none" ? "block" : "none"; break; }
      case "rf-available": rf.availableOnly = !rf.availableOnly; render(); break;
      case "rf-reset": rf = { q: "", cuisine: "", diet: "", maxTime: "", maxCost: "", availableOnly: false, sort: "match" }; render(); break;
      case "toggle-fav": {
        const i = state.favorites.indexOf(d.id);
        if (i === -1) { state.favorites.push(d.id); toast("Recipe saved.", "success"); }
        else { state.favorites.splice(i, 1); toast("Removed from saved."); }
        save(); render(); break;
      }
      case "open-recipe": detailServings = null; closeModal(); nav("recipe/" + d.id); break;
      case "recipe-add-grocery": {
        const r = getRecipe(d.id);
        if (r) { const n = addIngredientsToGrocery(r, detailServings || r.servings, d.missing === "1"); toast(n + " ingredients added to your grocery list.", "success"); }
        break;
      }
      case "recipe-cooked": {
        state.cooked.push({ id: d.id, at: Date.now() }); state.cooked = state.cooked.slice(-40);
        save(); render(); toast("Nice — added to recently cooked.", "success"); break;
      }
      case "serv-inc": detailServings = clamp((detailServings || 1) + 1, 1, 20); render(); break;
      case "serv-dec": detailServings = clamp((detailServings || 1) - 1, 1, 20); render(); break;
      case "custom-recipe-save": {
        const name = $("#cr-name").value.trim();
        if (!name) { toast("Please enter a name.", "error"); break; }
        const ings = $("#cr-ing").value.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
          const m = l.match(/^([\d.]+)\s*([a-z]+)?\s+(.*)$/i);
          if (m) return { n: m[3], q: Number(m[1]), u: m[2] || "piece", cost: 0 };
          return { n: l, q: 1, u: "piece", cost: 0 };
        });
        const steps = $("#cr-steps").value.split("\n").map((l) => l.trim()).filter(Boolean);
        state.savedRecipes.push({
          id: "custom-" + uid(), name: name, cuisine: "International", diet: ["none"], meals: ["lunch", "dinner"],
          time: Number($("#cr-time").value) || 20, cook: 0, skill: "beginner", servings: Number($("#cr-serv").value) || 2,
          desc: "Your saved recipe.", nutrition: null, allergens: [], ingredients: ings, steps: steps.length ? steps : ["Add your method."],
          substitutions: [], generated: true, image: null,
        });
        closeModal(); save(); render(); toast("Recipe saved to your collection.", "success"); break;
      }

      /* budget */
      case "budget-add": openBudgetForm(); break;
      case "budget-save": {
        const amt = Number($("#b-amount").value);
        if (!amt || amt <= 0) { toast("Enter an amount.", "error"); break; }
        state.budgetLog.push({ id: uid(), label: $("#b-label").value.trim() || "Grocery shop", amount: amt, date: $("#b-date").value || today() });
        closeModal(); save(); render(); toast("Spend logged.", "success"); break;
      }
      case "budget-del": state.budgetLog = state.budgetLog.filter((x) => x.id !== d.id); save(); render(); break;

      /* premium */
      case "premium-upgrade":
        state.settings.plan = "premium"; save(); render(); toast("Premium enabled (demo). No payment was taken.", "success"); break;
      case "premium-cancel": state.settings.plan = "free"; save(); render(); toast("Switched back to Free."); break;
      case "prem-price": {
        const v = Number(el.value) || 0;
        state.settings[d.key] = v; save(); break;
      }
      case "prem-billing": state.settings.premiumBilling = el.value; save(); break;

      /* settings */
      case "set-allergen": toggleArr(state.settings.allergies, d.id); save(); render(); break;
      case "set-cuisine": {
        const arr = state.settings.cuisines || (state.settings.cuisines = []);
        toggleArr(arr, d.id); save(); render(); break;
      }
      case "set-avoid": state.settings.avoid = el.value.split(",").map((x) => x.trim()).filter(Boolean); save(); break;
      case "data-export": exportData(); break;
      case "data-reset-soft":
        openModal({ title: "Reset preferences?", label: "Confirm", body: '<p class="small">This resets your preferences to defaults but keeps your pantry, plans and lists.</p><div class="row" style="gap:10px"><button class="btn ghost" data-action="modal-close">Cancel</button><button class="btn danger" data-action="data-reset-soft-confirm">Reset</button></div>' });
        break;
      case "data-reset-soft-confirm": state.settings = Object.assign({}, DEFAULT_SETTINGS, { onboarded: true }); closeModal(); save(); render(); toast("Preferences reset.", "success"); break;
      case "data-reset":
        openModal({ title: "Delete everything?", label: "Confirm", body: '<p class="small">This permanently removes all your MealWise data from this browser, including plans, pantry, lists and saved recipes.</p><div class="row" style="gap:10px"><button class="btn ghost" data-action="modal-close">Cancel</button><button class="btn danger" data-action="data-reset-confirm">Delete everything</button></div>' });
        break;
      case "data-reset-confirm":
        try { localStorage.removeItem(MW.APP.storageKey); } catch (e) {}
        state = blankState(); onb = null; gen = { ingredients: [], maxTime: 30, mealType: "", results: null, busy: false, usedPantry: false };
        closeModal(); nav("onboarding"); toast("All data deleted.", "success"); break;
    }
  }

  function toggleArr(arr, id) {
    const i = arr.indexOf(id);
    if (i === -1) arr.push(id); else arr.splice(i, 1);
  }

  function exportData() {
    try {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "mealwise-data.json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast("Data exported.", "success");
    } catch (e) { toast("Export failed in this browser.", "error"); }
  }

  /* ---------------------------------------------------------
     Global event delegation
     --------------------------------------------------------- */
  function bindEvents() {
    document.addEventListener("click", (e) => {
      const el = e.target.closest("[data-action]");
      if (!el) return;
      const action = el.getAttribute("data-action");
      // input-driven actions handled separately
      if (["rf-input", "set-num", "set-text", "set-select", "onb-time", "prem-price", "prem-billing", "set-avoid"].indexOf(action) !== -1) return;
      if (el.tagName === "A") e.preventDefault();
      handleAction(action, el);
    });

    document.addEventListener("input", (e) => {
      const el = e.target.closest("[data-action]");
      if (!el) return;
      const action = el.getAttribute("data-action");
      const key = el.getAttribute("data-key");
      if (action === "rf-input") {
        rf.q = el.value;
        clearTimeout(bindEvents._rfT);
        bindEvents._rfT = setTimeout(() => { const v = el.value; render(); const f = $("#rf-q"); if (f) { f.value = v; f.focus(); } }, 350);
      } else if (action === "onb-time") {
        onb.maxTime = Number(el.value);
        const lab = $("#onb-time-val"); if (lab) lab.textContent = el.value + " min";
      } else if (action === "set-num") {
        state.settings[key] = Number(el.value) || 0; save();
      } else if (action === "set-text") {
        state.settings[key] = el.value; save();
      } else if (action === "prem-price") {
        state.settings[key] = Number(el.value) || 0; save();
      }
    });

    document.addEventListener("change", (e) => {
      const el = e.target.closest("[data-action]");
      if (!el) return;
      const action = el.getAttribute("data-action");
      const key = el.getAttribute("data-key");
      if (action === "set-select") {
        state.settings[key] = el.value; save(); render();
        if (key === "diet") render();
      } else if (action === "rf-select") {
        rf[key] = el.value; render();
      } else if (action === "prem-billing") {
        state.settings.premiumBilling = el.value; save();
      }
    });

    window.addEventListener("hashchange", () => { closeModal(); render(); });
  }

  /* ---------------------------------------------------------
     Render loop
     --------------------------------------------------------- */
  function render() {
    const route = parseRoute();
    if (!state.settings.onboarded && route.name !== "onboarding" && route.name !== "privacy") {
      if (location.hash !== "#/onboarding") { location.hash = "#/onboarding"; return; }
    }
    document.getElementById("app").setAttribute("data-route", route.name);
    renderShell(route);
    const main = $("#main");
    const fn = screens[route.name] || screens.home;
    try {
      main.innerHTML = fn(route);
    } catch (err) {
      console.error(err);
      main.innerHTML = '<div class="empty"><div class="eicon">⚠️</div><h3>Something went wrong</h3><p>We hit an error rendering this screen.</p><button class="btn" data-action="nav" data-route="home">Go home</button></div>';
    }
    if (route.name === "onboarding") document.getElementById("app").setAttribute("data-route", "onboarding");
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  /* ---------------------------------------------------------
     Init
     --------------------------------------------------------- */
  function init() {
    state = load();
    // ensure avoid exists
    if (!Array.isArray(state.settings.avoid)) state.settings.avoid = [];
    if (!Array.isArray(state.settings.allergies)) state.settings.allergies = [];
    bindEvents();
    if (!location.hash) location.hash = state.settings.onboarded ? "#/home" : "#/onboarding";
    render();
    // Re-render when storage changes in another tab
    window.addEventListener("storage", (e) => {
      if (e.key === MW.APP.storageKey) { state = load(); render(); }
    });
    // expose for debugging / integration
    window.MealWise = {
      get state() { return state; },
      reset() { try { localStorage.removeItem(MW.APP.storageKey); } catch (e) {} state = blankState(); render(); },
      generateSuggestions: generateSuggestions,
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
