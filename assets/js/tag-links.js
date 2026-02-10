/**
 * 글 상세 페이지에서 .article__tags 텍스트(#태그 · #태그 ...)를
 * 클릭 가능한 링크로 바꿉니다.
 * - 링크: /tags.html?tag=태그
 */
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function buildTagLinks(el){
  const raw = (el.textContent || "").trim();
  if(!raw) return;

  // "#보관 · #대파 · #냉장" -> ["보관","대파","냉장"]
  const parts = raw.split("·").map(s => s.trim()).filter(Boolean).map(s => s.replace(/^#/, "").trim()).filter(Boolean);
  if(parts.length === 0) return;

  const html = parts.map((t, i) => {
    // 글 상세는 보통 /posts/ 아래에 있으므로, 상대 경로를 상황에 맞게 계산
    const tagsPage = location.pathname.includes("/posts/") ? "../tags.html" : "./tags.html";
    const href = `${tagsPage}?tag=${encodeURIComponent(t)}`;
    const label = escapeHtml(t);
    const sep = i === 0 ? "" : ` <span class="article__dot" aria-hidden="true">·</span> `;
    return `${sep}<a class="article__taglink" href="${href}">#${label}</a>`;
  }).join("");

  el.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", () => {
  const el = document.querySelector(".article__tags");
  if(el) buildTagLinks(el);
});
