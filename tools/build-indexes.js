/**
 * Build indexes for WackyWiki (Cloudflare Pages + Git workflow)
 * Source of truth: /data/posts.json
 *
 * Generates:
 *  - /data/posts-lite.json               (latest 12 posts)
 *  - /data/categories-index.json         (category list w/ counts)
 *  - /data/tags-index.json               (tag list w/ counts)
 *  - /data/category/<slug>.json          (posts per category)
 *  - /data/tag/<slug>.json               (posts per tag)
 *
 * Run: node tools/build-indexes.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");

const POSTS_SRC = path.join(DATA_DIR, "posts.json");
const OUT_LITE  = path.join(DATA_DIR, "posts-lite.json");
const OUT_CAT_INDEX = path.join(DATA_DIR, "categories-index.json");
const OUT_TAG_INDEX = path.join(DATA_DIR, "tags-index.json");
const OUT_CAT_DIR = path.join(DATA_DIR, "category");
const OUT_TAG_DIR = path.join(DATA_DIR, "tag");

const LITE_SIZE = 12;

function safeText(v){ return String(v ?? "").trim(); }

function parseDate(s){
  const m = safeText(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function slugify(label){
  // Keep Hangul; make filename-safe across platforms
  const raw = safeText(label);
  if (!raw) return "unknown";

  const lowered = raw.toLowerCase();
  let out = "";
  for (const ch of lowered) {
    const code = ch.codePointAt(0);
    const isAsciiAZ = code >= 97 && code <= 122;
    const isAscii09 = code >= 48 && code <= 57;
    const isHangul  = code >= 0xAC00 && code <= 0xD7A3;
    if (isAsciiAZ || isAscii09 || isHangul) out += ch;
    else if (ch === " " || ch === "_" || ch === "-" || ch === "·" || ch === "—" || ch === "–") out += "-";
    else out += "-";
  }
  out = out.replace(/-+/g, "-").replace(/^-|-$/g, "");
  return out || ("k-" + Buffer.from(raw, "utf8").toString("hex").slice(0, 16));
}

function ensureDir(p){
  fs.mkdirSync(p, { recursive: true });
}

function writeJson(filePath, data){
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function main(){
  if (!fs.existsSync(POSTS_SRC)) {
    console.error("posts.json not found:", POSTS_SRC);
    process.exit(1);
  }

  const posts = JSON.parse(fs.readFileSync(POSTS_SRC, "utf8"));
  if (!Array.isArray(posts)) {
    console.error("posts.json must be an array");
    process.exit(1);
  }

  // Normalize + sort (latest first)
  const normalized = posts
    .map(p => ({
      title: safeText(p.title),
      excerpt: safeText(p.excerpt),
      date: safeText(p.date),
      url: safeText(p.url),
      cover: safeText(p.cover),
      category: safeText(p.category),
      tags: Array.isArray(p.tags) ? p.tags.map(t => safeText(t)).filter(Boolean) : []
    }))
    .filter(p => p.url) // require url
    .sort((a,b) => {
      const da = parseDate(a.date);
      const db = parseDate(b.date);
      if (da && db) return db - da;
      if (da && !db) return -1;
      if (!da && db) return 1;
      return 0;
    });

  // posts-lite
  writeJson(OUT_LITE, normalized.slice(0, LITE_SIZE));

  // build category + tag maps
  const catMap = new Map(); // name -> posts
  const tagMap = new Map(); // name -> posts

  for (const p of normalized) {
    const c = p.category || "미분류";
    if (!catMap.has(c)) catMap.set(c, []);
    catMap.get(c).push(p);

    for (const t of (p.tags || [])) {
      if (!tagMap.has(t)) tagMap.set(t, []);
      tagMap.get(t).push(p);
    }
  }

  // indexes
  const categoriesIndex = Array.from(catMap.entries())
    .map(([name, list]) => ({
      name,
      slug: slugify(name),
      count: list.length
    }))
    .sort((a,b) => b.count - a.count || a.name.localeCompare(b.name, "ko"));

  const tagsIndex = Array.from(tagMap.entries())
    .map(([name, list]) => ({
      name,
      slug: slugify(name),
      count: list.length
    }))
    .sort((a,b) => b.count - a.count || a.name.localeCompare(b.name, "ko"));

  writeJson(OUT_CAT_INDEX, categoriesIndex);
  writeJson(OUT_TAG_INDEX, tagsIndex);

  // per-category / per-tag
  ensureDir(OUT_CAT_DIR);
  ensureDir(OUT_TAG_DIR);

  for (const item of categoriesIndex) {
    const list = catMap.get(item.name) || [];
    writeJson(path.join(OUT_CAT_DIR, `${item.slug}.json`), list);
  }

  for (const item of tagsIndex) {
    const list = tagMap.get(item.name) || [];
    writeJson(path.join(OUT_TAG_DIR, `${item.slug}.json`), list);
  }

  console.log("✅ Index build complete");
  console.log("- posts-lite:", path.relative(ROOT, OUT_LITE));
  console.log("- categories:", categoriesIndex.length, "tags:", tagsIndex.length);
}

main();
