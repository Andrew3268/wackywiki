/**
 * more-related.js
 * post.html의 "글 더보기" 섹션: 현재 글과 같은 카테고리 글을 렌더링합니다(최대 3개, 최소 2개 이상일 때만 표시).
 * - 데이터: ../data/posts.json (post.html이 /posts/ 아래라는 전제)
 * - UI: 왼쪽 이미지 / 오른쪽 텍스트 (리스트형)
 */
(function () {
  const POSTS_JSON = "../data/posts.json";

  const MIN_REQUIRED = 2;
  const SHOW_MAX = 3;

  
  // ✅ 배포 환경에 따라 사이트가 하위 경로(/wackywiki/...)에서 서비스될 수 있어
  // location.pathname과 posts.json의 url(/posts/...)이 정확히 일치하지 않는 경우가 있습니다.
  // 아래 로직은 "끝 경로" 기준으로 매칭하고, 링크도 현재 베이스 경로를 자동으로 보정합니다.
  const BASE_PREFIX = (() => {
    const p = String(location.pathname || "");
    const idx = p.indexOf("/posts/");
    if (idx <= 0) return "";
    return p.slice(0, idx); // 예: "/wackywiki"
  })();

  function resolveUrl(u) {
    const s = String(u || "").trim();
    if (!s) return s;
    // 이미 베이스 프리픽스가 포함돼 있으면 그대로
    if (BASE_PREFIX && s.startsWith(BASE_PREFIX + "/")) return s;
    // 루트 절대경로(/posts/...)만 베이스 프리픽스 보정
    if (BASE_PREFIX && s.startsWith("/")) return BASE_PREFIX + s;
    return s;
  }

  
function normalizePath(input) {
  let s = String(input || "");
  if (!s) return "";
  // URL 전체가 들어오면 pathname만 추출
  try { s = new URL(s, location.origin).pathname; } catch (e) {}
  // query/hash 제거
  s = s.split("?")[0].split("#")[0];

  // 디코딩(한글 슬러그 대비)
  try { s = decodeURI(s); } catch (e) {}

  // 끝 슬래시 제거
  if (s.length > 1) s = s.replace(/\/+$/, "");

  // .html 제거(Pretty URL 대응)
  s = s.replace(/\.html$/i, "");

  return s;
}

function samePath(urlLike, pathLike) {
  const a0 = String(urlLike || "");
  const b0 = String(pathLike || "");
  if (!a0 || !b0) return false;

  const a = normalizePath(a0);
  const b = normalizePath(b0);

  if (!a || !b) return false;
  if (a === b) return true;

  // 하위 경로 배포 대비: 끝 경로가 같으면 동일 글로 취급
  return a.endsWith(b) || b.endsWith(a);
}
function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function parseDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
    if (!m) return new Date(0);
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  function normalizeCategory(p) {
    const raw = (p && typeof p.category === "string") ? p.category.trim() : "";
    return raw || "기타";
  }

  function pathOf(url) {
    try {
      return new URL(url, location.origin).pathname;
    } catch (e) {
      return "";
    }
  }

  function pickThumb(p) {
    const a = (typeof p.thumb === "string") ? p.thumb.trim() : "";
    const b = (typeof p.cover === "string") ? p.cover.trim() : "";
    return a || b || "";
  }

  function render(items, category) {
    const list = document.getElementById("moreList");
    const empty = document.getElementById("moreEmpty");
    if (!list) return;

    list.innerHTML = "";

    const desc = document.getElementById("moreDesc");
    if (desc) {
      desc.textContent = category
        ? `같은 카테고리( ${category} ) 글을 더 보여드려요.`
        : "같은 카테고리의 글을 더 보여드려요.";
    }

    if (!items || items.length === 0) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    for (const p of items) {
      const title = esc(p.title || "제목 없음");
      const url = esc(resolveUrl(p.url || "#"));
      const date = esc(String(p.date || "").trim());
      const excerpt = esc(p.excerpt || "");
      const author = esc(p.author || ""); // 있으면 사용, 없으면 공백
      const thumb = pickThumb(p);

      const a = document.createElement("a");
      a.className = "more-item";
      a.href = url;
      a.setAttribute("aria-label", `${title} 글 열기`);

      a.innerHTML = `
        <div class="more-thumb" aria-hidden="${thumb ? "false" : "true"}">
          ${
            thumb
              ? `<img src="${esc(thumb)}" alt="${title} 대표 이미지" loading="lazy" width="1200" height="630">`
              : `<div class="more-thumb__ph" aria-hidden="true"></div>`
          }
        </div>

        <div class="more-body">
          <h3 class="more-item__title">${title}</h3>
          <p class="more-item__excerpt">${excerpt}</p>
          <div class="more-item__meta">
            ${author ? `<span class="more-item__author">${author}</span><span class="more-item__slash">/</span>` : ``}
            <time datetime="${date}">${date || ""}</time>
          </div>
        </div>
      `;
      list.appendChild(a);
    }
  }

  async function run() {
    const list = document.getElementById("moreList");
    if (!list) return;

    const currentPath = location.pathname;

    let posts = [];
    try {
      const res = await fetch(POSTS_JSON, { cache: "no-store" });
      if (!res.ok) throw new Error("posts.json fetch failed");
      const data = await res.json();
      posts = Array.isArray(data) ? data : [];
    } catch (e) {
      document.getElementById("moreEmpty")?.removeAttribute("hidden");
      return;
    }

    const currentItem = posts.find((p) => samePath(pathOf(p.url), currentPath)) || null;
    const currentCategory = currentItem ? normalizeCategory(currentItem) : null;

    if (!currentCategory) {
      document.getElementById("moreEmpty")?.removeAttribute("hidden");
      return;
    }

    const related = posts
      .filter((p) => normalizeCategory(p) === currentCategory)
      .filter((p) => !samePath(pathOf(p.url), currentPath));

    // 최신순
    related.sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());

    if (related.length < MIN_REQUIRED) {
      document.getElementById("moreEmpty")?.removeAttribute("hidden");
      return;
    }

    render(related.slice(0, SHOW_MAX), currentCategory);
  }

  run();
})();