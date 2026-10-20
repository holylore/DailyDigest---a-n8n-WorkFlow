// ---------- SETTINGS ----------
const MAX_PER_SECTION_SOURCE = 7;
const SNIPPET_LIMIT = 250;
const WINDOW_MS = 36 * 60 * 60 * 1000; // 36h window
const now = Date.now();

const SECTION_ORDER = [
  "GLOBAL UPDATES",
  "EUROPEAN GEOPOLITICS & BUSINESS",
  "TECH & AI",
  "TAIWAN & ASIA GEOPOLITICS",
  "ARTS & CULTURE",
];

// ---------- FEEDS ----------
// match = array of strings searched in each article (link, guid, etc.). First feed matched wins.
const FEEDS = [
  { name: "BBC News",      match: ["bbc.co.uk"],                    section: "GLOBAL UPDATES" },
  { name: "Reuters",       match: ["reuters.com"],                  section: "GLOBAL UPDATES" },
  { name: "Euronews",      match: ["euronews.com"],                 section: "EUROPEAN GEOPOLITICS & BUSINESS" },
  { name: "EconomyUp",     match: ["economyup.it"],                 section: "EUROPEAN GEOPOLITICS & BUSINESS" },
  { name: "Stratechery",   match: ["stratechery.com"],              section: "TECH & AI" },
  { name: "ImportAI",      match: ["importai"],                     section: "TECH & AI" },
  { name: "AI Rundown",    match: ["kill-the-newsletter"],          section: "TECH & AI" },
  { name: "Focus Taiwan",  match: ["rsscna", "focustaiwan"],        section: "TAIWAN & ASIA GEOPOLITICS" },
  { name: "Atlas Obscura", match: ["atlasobscura.com"],             section: "ARTS & CULTURE" },
  { name: "Animenomics",   match: ["animenomics.com"],              section: "ARTS & CULTURE" },
];

// ---------- SCORING KEYWORDS ----------
const KEYWORDS = {
  "GLOBAL UPDATES": ["tensions", "inflation", "protests", "conflict", "sanctions", "supply chain",
    "tariffs", "trade", "summit", "ceasefire", "election", "recession", "oil", "central bank",
    "geopolitics", "war"],
  "EUROPEAN GEOPOLITICS & BUSINESS": ["inflation", "energy", "industry", "investment", "startup",
    "Italy", "Italian", "Brussels", "EU", "ECB", "protests", "housing", "health", "crisis", "ecosystem"],
  "TECH & AI": ["AI", "artificial intelligence", "machine learning", "deep learning", "privacy",
    "regulation", "compliance", "bubble", "funding", "round", "Europe", "chip", "model", "agent", "innovation"],
  "TAIWAN & ASIA GEOPOLITICS": ["semiconductor", "chip", "TSMC", "security", "China", "Chinese",
    "tension", "trade", "military", "export", "Taipei", "defense"],
  "ARTS & CULTURE:CURIOSITIES": ["forgotten", "hidden", "secret", "mystery", "discovered", "lost",
    "unusual", "strange", "rare", "ancient"],
  "ARTS & CULTURE:ANIME/MANGA BUSINESS": ["anime", "manga", "studio", "revenue", "sales", "licensing",
    "streaming", "market", "box office", "funding"],
};

const scoringKey = (feed) =>
  feed.section === "ARTS & CULTURE"
    ? `ARTS & CULTURE:${feed.name === "Atlas Obscura" ? "CURIOSITIES" : "ANIME/MANGA BUSINESS"}`
    : feed.section;

const hasWord = (text, word) =>
  new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);

const scoreItem = (key, title, desc) =>
  (KEYWORDS[key] || []).reduce(
    (s, k) => s + (hasWord(title, k) ? 2 : 0) + (hasWord(desc, k) ? 1 : 0), 0);

// ---------- BANNED WORDS ----------
const BANNED = {
  "Focus Taiwan": ["baseball", "football", "soccer", "basketball", "volleyball", "tennis", "golf",
    "cricket", "rugby", "hockey", "championship", "World Cup", "Asian Games", "Para Games", "Paralympic"],
};
const BANNED_ALL = ["sponsored"];

// ---------- HELPERS ----------
const clean = (v) => {
  if (Array.isArray(v)) v = v[0];
  if (v && typeof v === "object") v = v._ || v.text || "";
  return String(v || "").replace(/<[^>]*>/g, "").replace(/\s+- Reuters$/i, "").trim();
};

// Find article objects under any "item" (RSS) or "entry" (Atom) key,
// whether the value is an array or a single object. Channel metadata is skipped.
function findItems(obj, out = []) {
  if (!obj || typeof obj !== "object") return out;
  if (Array.isArray(obj)) {
    obj.forEach((x) => findItems(x, out));
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k === "item" || k === "entry") {
      (Array.isArray(v) ? v : [v]).forEach((x) => x && typeof x === "object" && out.push(x));
    } else {
      findItems(v, out);
    }
  }
  return out;
}

// ---------- MAIN ----------
const sections = {};
const stats = { received: 0, noItems: 0, skippedNoFeed: 0, skippedOld: 0, skippedBanned: 0, kept: {} };

for (const { json } of $input.all()) {
  stats.received++;
  const batchRaw = JSON.stringify(json).toLowerCase();
  const batchFeed = FEEDS.find((f) => f.match.some((m) => batchRaw.includes(m)));

  const items = findItems(json);
  if (items.length === 0) stats.noItems++;

  for (const art of items) {
    // Prefer the article's own link/guid for attribution; fall back to the batch.
    const artRaw = JSON.stringify(art).toLowerCase();
    const feed = FEEDS.find((f) => f.match.some((m) => artRaw.includes(m))) || batchFeed;
    if (!feed) { stats.skippedNoFeed++; continue; }

    const title = clean(art.title);
    if (title.length < 5) continue;

    const dateStr = clean(art.pubDate || art.published || art.updated);
    const parsed = dateStr ? Date.parse(dateStr) : NaN;
const maxAge = feed.section === "ARTS & CULTURE" ? 7 * 24 * 60 * 60 * 1000 : WINDOW_MS;
if (!Number.isNaN(parsed) && now - parsed > maxAge) { stats.skippedOld++; continue; }
    const time = Number.isNaN(parsed) ? 0 : parsed;

    const desc = clean(art.description || art.summary || art.content);
    const text = `${title} ${desc}`;

    const banned = [...(BANNED[feed.name] || []), ...BANNED_ALL];
    if (banned.some((w) => hasWord(text, w))) { stats.skippedBanned++; continue; }

    let section = feed.section;
    if (feed.name === "EconomyUp") {
      section = scoreItem("TECH & AI", title, desc) > scoreItem("EUROPEAN GEOPOLITICS & BUSINESS", title, desc)
        ? "TECH & AI" : "EUROPEAN GEOPOLITICS & BUSINESS";
    }

    const score = scoreItem(scoringKey({ ...feed, section }), title, desc); // zero scores are kept
    const snippet = desc.length > SNIPPET_LIMIT ? desc.slice(0, SNIPPET_LIMIT) + "..." : desc || title;

    sections[section] ??= {};
    sections[section][feed.name] ??= [];
    sections[section][feed.name].push({
      score,
      time,
      line: `[${feed.name}] ${title}\n${snippet}\n`,
    });
    stats.kept[feed.name] = (stats.kept[feed.name] || 0) + 1;
  }
}

// ---------- OUTPUT ----------
const MAX_PER_SECTION = 7;
let text = "";
for (const section of SECTION_ORDER) {
  if (!sections[section]) continue;
  // Merge all sources in this section, then sort by score and recency
  const all = Object.values(sections[section]).flat()
    .sort((a, b) => b.score - a.score || b.time - a.time)
    .slice(0, MAX_PER_SECTION)
    .map((x) => x.line);
  text += `\n===== ${section} =====\n` + all.join("\n");
}

return [{
  json: {
    allArticles: text.trim() || "[No fresh items in the last 36 hours.]",
    debug: stats,
  },
}];

return [{
  json: {
    allArticles: text.trim() || "[No fresh items in the last 36 hours.]",
    debug: stats,
  },
}];
