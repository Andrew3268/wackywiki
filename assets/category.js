/**
 * category.html 전용 (index와 동일 카드 UI/동작)
 * - ✅ /data/posts.json 은 원본(관리용)이며, 배포 시 자동 생성된 /data/category/<slug>.json 을 로드
 * - ?c=값 으로 1차 필터
 * - 검색(q) + 최신/오래된 정렬 지원
 * - ✅ 더보기(12개 단위) 지원
 */

const PAGE_SIZE = 12;

const CATEGORY_DIR_URL = "./data/category/";


// -------------------------
// 유틸
// -------------------------
function safeText(v){ return String(v ?? "").trim(); }

function parseDate(dateStr) {
  const s = safeText(dateStr);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function formatKoreanDate(dateStr) {
  const dt = parseDate(dateStr);
  if (!dt) return safeText(dateStr) || "-";
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2,"0")}.${String(dt.getDate()).padStart(2,"0")}`;
}


function slugifyLabel(label){
  const raw = safeText(label);
  if(!raw) return "unknown";
  const lowered = raw.toLowerCase();
  let out = "";
  for(const ch of lowered){
    const code = ch.codePointAt(0);
    const isAZ = code >= 97 && code <= 122;
    const is09 = code >= 48 && code <= 57;
    const isHangul = code >= 0xAC00 && code <= 0xD7A3;
    if(isAZ || is09 || isHangul) out += ch;
    else if(ch === " " || ch === "_" || ch === "-" || ch === "·" || ch === "—" || ch === "–") out += "-";
    else out += "-";
  }
  out = out.replace(/-+/g,"-").replace(/^-|-$/g,"");
  if(out) return out;
  try{
    const hex = Array.from(new TextEncoder().encode(raw)).map(b=>b.toString(16).padStart(2,"0")).join("");
    return "k-" + hex.slice(0,16);
  }catch(e){
    return "unknown";
  }
}

function normalize(str) { return safeText(str).toLowerCase(); }

async function fetchJson(url){
  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok) throw new Error(`리소스를 불러오지 못했습니다: ${url}`);
  return await res.json();
}

async function loadCategoryPosts(catName){
  const slug = slugifyLabel(catName);
  const url = `${CATEGORY_DIR_URL}${encodeURIComponent(slug)}.json`;
  const data = await fetchJson(url);
  return Array.isArray(data) ? data : [];
}

function setMeta({ total=0, shown=0, catName="-", sortDesc=true } = {}){
  const countEl = document.getElementById("count");
  const hintEl  = document.getElementById("hint");
  const pillEl  = document.getElementById("catPill");
  const sortBtn = document.getElementById("sortBtn");

  if (countEl) countEl.textContent = String(shown);
  if (pillEl)  pillEl.textContent  = `카테고리: ${catName}`;

  if (hintEl) {
    hintEl.textContent = `총 ${total}개 · ${sortDesc ? "최신순" : "오래된순"} · 카테고리: ${catName}`;
  }

  if (sortBtn) {
    sortBtn.style.display = (total >= 2) ? "inline-flex" : "none";
    sortBtn.textContent = sortDesc ? "최신순" : "오래된순";
    sortBtn.setAttribute("aria-pressed", String(sortDesc));
  }
}

function showState(msg){
  const stateEl = document.getElementById("state");
  if(!stateEl) return;
  stateEl.hidden = false;
  stateEl.innerHTML = `
    <div style="font-weight:700; font-size:18px; color:#fff; margin-bottom:8px;">${safeText(msg || "표시할 결과가 없습니다.")}</div>
    <div>카테고리 값과 data/posts.json의 category 값을 확인해보세요.</div>
  `;
}

function hideState(){
  const stateEl = document.getElementById("state");
  if(!stateEl) return;
  stateEl.hidden = true;
  stateEl.innerHTML = "";
}

// -------------------------
// 렌더 (index 카드 구조와 동일)
// -------------------------
function render(posts){
  const gridEl  = document.getElementById("grid");
  if(!gridEl) return;

  gridEl.innerHTML = "";

  const frag = document.createDocumentFragment();

  posts.forEach((p) => {
    const title   = safeText(p.title);
    const url     = safeText(p.url);
    const excerpt = safeText(p.excerpt);
    const thumb   = safeText(p.thumb) || safeText(p.cover);
    const dateRaw = safeText(p.date);

    const card = document.createElement("article");
    card.className = "card";

    card.innerHTML = `
      <a href="${url || '#'}" aria-label="${title} 리포트 읽기">
        ${thumb
          ? `<img src="${thumb}" class="thumb" alt="${title}" loading="lazy" decoding="async">`
          : `<div class="thumb" aria-hidden="true"></div>`
        }
        <div class="content">
          <div class="sub">
            <span class="tag">${formatKoreanDate(dateRaw)}</span>
            ${p.category ? `<span class="tag" style="color:var(--accent)">${safeText(p.category)}</span>` : ''}
          </div>
          <h2 class="title">${title || "제목 없음"}</h2>
          <p class="excerpt">${excerpt || "요약 내용이 없습니다."}</p>
        </div>
      </a>
    `;
    frag.appendChild(card);
  });

  gridEl.appendChild(frag);
}

// -------------------------
// 메인
// -------------------------
document.addEventListener("DOMContentLoaded", async () => {  const qEl     = document.getElementById("q");
  const sortBtn = document.getElementById("sortBtn");

  const loadMoreWrap = document.getElementById("loadMoreWrap");
  const loadMoreBtn  = document.getElementById("loadMoreBtn");

  const qs = new URLSearchParams(location.search);
  const cat = safeText(qs.get("c"));

  let allPosts = [];
  let sortDesc = true;

  let currentList = [];
  let visibleCount = PAGE_SIZE;

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  function setLoadMoreVisibility(){
    if(!loadMoreWrap || !loadMoreBtn) return;
    const shouldShow = currentList.length >= (PAGE_SIZE + 1) && visibleCount < currentList.length;
    loadMoreWrap.hidden = !shouldShow;
  }

  function renderPage(){
    hideState();

    if(!currentList.length){
      render([]);
      showState("표시할 결과가 없습니다.");
      if(loadMoreWrap) loadMoreWrap.hidden = true;
      setMeta({ total:0, shown:0, catName: cat || "(미지정)", sortDesc });
      return;
    }

    const slice = currentList.slice(0, visibleCount);
    render(slice);
    setLoadMoreVisibility();
    setMeta({ total: currentList.length, shown: slice.length, catName: cat, sortDesc });
  }

  if(!cat){
    setMeta({ total:0, shown:0, catName:"(미지정)", sortDesc:true });
    showState("카테고리가 지정되지 않았어요. 글에서 카테고리를 눌러 들어오세요.");
    if(loadMoreWrap) loadMoreWrap.hidden = true;
    return;
  }

  try{
    allPosts = await loadCategoryPosts(cat);
  }catch(e){
    console.error(e);
    setMeta({ total:0, shown:0, catName:cat, sortDesc:true });
    showState("카테고리 글 목록을 불러오지 못했어요. 자동 생성된 data/category/*.json 파일을 확인해 주세요.");
    if(loadMoreWrap) loadMoreWrap.hidden = true;
    return;
  }

  const base = allPosts;

  function apply(resetPage=true){
    const q = normalize(qEl?.value);
    let list = base.slice();

    if(q){
      list = list.filter(p => {
        const t = normalize(p.title);
        const e = normalize(p.excerpt);
        const c = normalize(p.category);
        const tags = Array.isArray(p.tags) ? p.tags.map(normalize).join(" ") : "";
        return t.includes(q) || e.includes(q) || c.includes(q) || tags.includes(q);
      });
    }

    list.sort((a,b)=>{
      const da = parseDate(a.date)?.getTime() ?? 0;
      const db = parseDate(b.date)?.getTime() ?? 0;
      return sortDesc ? (db - da) : (da - db);
    });

    currentList = list;
    if(resetPage) visibleCount = PAGE_SIZE;
    renderPage();
  }

  if(qEl){
    qEl.addEventListener("input", () => apply(true));
  }

  if(sortBtn){
    sortBtn.addEventListener("click", () => {
      sortDesc = !sortDesc;
      apply(true);
    });
  }

  if(loadMoreBtn){
    loadMoreBtn.addEventListener("click", () => {
      visibleCount = Math.min(visibleCount + PAGE_SIZE, currentList.length);
      renderPage();
    });
  }

  apply(true);
});
