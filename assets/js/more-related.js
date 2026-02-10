/**
 * more-related.js
 * post.html의 "글 더보기" 섹션: 현재 글과 같은 카테고리 글 3개를 렌더링합니다.
 * - 데이터: ../data/posts.json (post.html이 /posts/ 아래라는 전제)
 * - UI: 왼쪽 이미지 / 오른쪽 텍스트 (리스트형)
 */
(function () {
  const POSTS_JSON = "../data/posts.json";

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
        ? `같은 카테고리( ${category} ) 글을 3개 더 보여드려요.`
        : "같은 카테고리의 글을 3개 더 보여드려요.";
    }

    if (!items || items.length === 0) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    for (const p of items) {
      const title = esc(p.title || "제목 없음");
      const url = esc(p.url || "#");
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

    const currentItem = posts.find((p) => pathOf(p.url) === currentPath) || null;
    const currentCategory = currentItem ? normalizeCategory(currentItem) : null;

    if (!currentCategory) {
      document.getElementById("moreEmpty")?.removeAttribute("hidden");
      return;
    }

    const related = posts
      .filter((p) => normalizeCategory(p) === currentCategory)
      .filter((p) => pathOf(p.url) !== currentPath);

    // 최신순
    related.sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());

    render(related.slice(0, 3), currentCategory);
  }

  run();
})();