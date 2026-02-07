/**
 * index.html 전용 목록 렌더링 (Cloudflare Pages + Git)
 *
 * ✅ 운영 원칙: /data/posts.json 만 수정 (원본)
 * ✅ 배포(build) 시 tools/build-indexes.js 가 자동 생성:
 *   - /data/posts-lite.json (최신 12개)
 *   - /data/category/<slug>.json
 *   - /data/tag/<slug>.json
 *   - /data/categories-index.json
 *   - /data/tags-index.json
 *
 * 이 파일은 초기에는 posts-lite만 로드하고,
 * - 더보기(13개 이상) 클릭 시에만 전체 posts.json을 추가 로드합니다.
 * - 카테고리 선택 시에는 category/<slug>.json을 우선 사용합니다.
 */

const PAGE_SIZE = 12;

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function parseDate(s){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||"").trim());
  if(!m) return new Date(0);
  return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
}

function normalizeText(v){
  return String(v ?? "").trim().toLowerCase();
}

function normalizeCategory(p){
  const raw = (p && typeof p.category === "string") ? p.category.trim() : "";
  return raw || "기타";
}


function slugifyLabel(label){
  const raw = String(label ?? "").trim();
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
  // fallback: short hex
  try{
    const hex = Array.from(new TextEncoder().encode(raw)).map(b=>b.toString(16).padStart(2,"0")).join("");
    return "k-" + hex.slice(0,16);
  }catch(e){
    return "unknown";
  }
}

function formatKoreanDate(dateStr){
  const dt = parseDate(dateStr);
  if(!dt || isNaN(dt.getTime())) return escapeHtml(String(dateStr||"")) || "-";
  const y = dt.getFullYear();
  const m = String(dt.getMonth()+1).padStart(2,'0');
  const d = String(dt.getDate()).padStart(2,'0');
  return `${y}.${m}.${d}`;
}

function setMeta({ total=0, shown=0, category="전체", sortDesc=true, q="" } = {}){
  const countEl = document.getElementById("count");
  const hintEl  = document.getElementById("hint");

  if(countEl) countEl.textContent = String(total);

  if(hintEl){
    const sortText = sortDesc ? "최신순" : "오래된순";
    const qText = q ? ` · 검색: ${q}` : "";
    hintEl.textContent = `총 ${total}개 · ${sortText} · 카테고리: ${category}${qText}`;
  }

  const sortBtn = document.getElementById("sortBtn");
  if(sortBtn){
    sortBtn.style.display = (total >= 2) ? "inline-flex" : "none";
    sortBtn.textContent = sortDesc ? "최신순" : "오래된순";
    sortBtn.setAttribute("aria-pressed", String(sortDesc));
  }
}

function showState(msg){
  const state = document.getElementById("state");
  if(!state) return;
  state.hidden = false;
  state.innerHTML = `
    <div class="empty-card" role="status" aria-live="polite">
      <p class="empty-title">${escapeHtml(msg || "표시할 글이 없어요.")}</p>
      <p class="empty-desc">data/posts.json 경로와 각 항목의 url, category 값을 확인해 주세요.</p>
    </div>
  `;
}

function hideState(){
  const state = document.getElementById("state");
  if(state){
    state.hidden = true;
    state.innerHTML = "";
  }
}

async function fetchJson(url){
  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok) throw new Error(`리소스를 불러오지 못했습니다: ${url}`);
  return await res.json();
}

// 메모리 캐시
let __postsLite = null;
let __postsFull = null;
let __categoriesIndex = null;
const __categoryCache = new Map(); // catName -> posts[]

async function loadPostsLite(){
  if(__postsLite) return __postsLite;
  const data = await fetchJson(POSTS_LITE_URL);
  __postsLite = Array.isArray(data) ? data : [];
  return __postsLite;
}

async function loadPostsFull(){
  if(__postsFull) return __postsFull;
  const data = await fetchJson(POSTS_FULL_URL);
  __postsFull = Array.isArray(data) ? data : [];
  return __postsFull;
}

async function loadCategoriesIndex(){
  if(__categoriesIndex) return __categoriesIndex;
  const data = await fetchJson(CATEGORIES_INDEX_URL);
  __categoriesIndex = Array.isArray(data) ? data : [];
  return __categoriesIndex;
}

async function loadCategoryPosts(catName){
  const key = String(catName || "").trim();
  if(!key) return [];
  if(__categoryCache.has(key)) return __categoryCache.get(key);

  const slug = slugifyLabel(key);
  const url = `${CATEGORY_DIR_URL}${encodeURIComponent(slug)}.json`;
  const data = await fetchJson(url);
  const list = Array.isArray(data) ? data : [];
  __categoryCache.set(key, list);
  return list;
}

function buildCategoryStatsFromIndex(categoriesIndex){
  const map = new Map();
  const cats = [];
  for(const item of (categoriesIndex || [])){
    const name = String(item?.name ?? "").trim();
    const count = Number(item?.count ?? 0) || 0;
    if(!name) continue;
    map.set(name, count);
    cats.push(name);
  }
  cats.sort((a,b)=>String(a).localeCompare(String(b), "ko"));
  return { map, cats };
}

function buildCategoryStats(posts){
(posts){
  const map = new Map();
  for(const p of posts){
    const c = normalizeCategory(p);
    map.set(c, (map.get(c) || 0) + 1);
  }
  const cats = [...map.keys()].sort((a,b)=>String(a).localeCompare(String(b), "ko"));
  return { map, cats };
}

function renderCategoryBar({ cats, counts, selected, onSelect }){
  const bar = document.getElementById("categoryBar");
  if(!bar) return;

  const allCount = [...counts.values()].reduce((a,b)=>a+b,0);
  const chipBtn = (name, count, key) => `
    <button class="chip ${selected===key ? "is-active":""}"
            type="button"
            role="tab"
            aria-selected="${selected===key ? "true":"false"}"
            data-cat="${escapeHtml(key)}">
      <span class="chip__name">${escapeHtml(name)}</span>
      <span class="chip__count">${count}</span>
    </button>
  `;

  bar.innerHTML = [
    chipBtn("전체", allCount, "all"),
    ...cats.map(c => chipBtn(c, counts.get(c) || 0, c))
  ].join("");

  bar.querySelectorAll("button[data-cat]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const cat = btn.getAttribute("data-cat") || "all";
      onSelect(cat);
    });
  });
}

function getInitialSelectedCategory(counts){
  // 우선순위: URL(cat)만 허용, 그 외엔 all
  const params = new URLSearchParams(location.search);
  const urlCat = (params.get("cat") || "").trim();

  let selected = "all";

  if (urlCat && counts.has(urlCat)) {
    selected = urlCat;
  } else {
    localStorage.setItem("selectedCategory", "all");
  }

  if(selected !== "all" && !counts.has(selected)){
    selected = "all";
    localStorage.setItem("selectedCategory", "all");
    const sp = new URLSearchParams(location.search);
    sp.delete("cat");
    const nextUrl = `${location.pathname}${sp.toString() ? `?${sp.toString()}` : ""}`;
    history.replaceState(null, "", nextUrl);
  }

  return selected;
}

function syncCategoryToUrlAndStorage(selected){
  localStorage.setItem("selectedCategory", selected);

  const sp = new URLSearchParams(location.search);
  if(selected === "all") sp.delete("cat");
  else sp.set("cat", selected);

  const q = sp.toString();
  const nextUrl = `${location.pathname}${q ? `?${q}` : ""}`;
  history.replaceState(null, "", nextUrl);
}

function renderCards(posts){
  const list = document.getElementById("grid");
  if(!list) return;

  list.innerHTML = "";

  const frag = document.createDocumentFragment();

  for(const p of posts){
    const title = escapeHtml(p.title || "제목 없음");
    const url = escapeHtml(p.url || "#");
    const excerpt = escapeHtml(p.excerpt || "");

    const thumb = (typeof p.thumb === "string" && p.thumb.trim())
      ? p.thumb.trim()
      : ((typeof p.cover === "string" && p.cover.trim()) ? p.cover.trim() : "");

    const dateTag = formatKoreanDate(p.date);
    const category = escapeHtml(normalizeCategory(p));

    const card = document.createElement("article");
    card.className = "card";

    card.innerHTML = `
      <a href="${url}" aria-label="${title} 리포트 읽기">
        ${thumb
          ? `<img src="${escapeHtml(thumb)}" class="thumb" alt="${title}" loading="lazy" decoding="async">`
          : `<div class="thumb" aria-hidden="true"></div>`
        }
        <div class="content">
          <div class="sub">
            <span class="tag">${escapeHtml(dateTag || "-")}</span>
            <span class="tag" style="color:var(--accent)">${category}</span>
          </div>
          <h2 class="title">${title}</h2>
          <p class="excerpt">${excerpt || "요약 내용이 없습니다."}</p>
        </div>
      </a>
    `;

    frag.appendChild(card);
  }

  list.appendChild(frag);
}

(async ()=>{
  const qEl = document.getElementById("q");
  const sortBtn = document.getElementById("sortBtn");
  const loadMoreWrap = document.getElementById("loadMoreWrap");
  const loadMoreBtn  = document.getElementById("loadMoreBtn");

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  let sortDesc = true;         // 최신순
  let visibleCount = PAGE_SIZE; // 현재 화면에 보일 개수
  let selected = "all";        // 선택 카테고리

  let basePosts = [];          // 현재 선택에 대한 원본 데이터(전체/카테고리)
  let currentList = [];        // 검색/정렬/필터 적용된 최종 리스트

  function setLoadMoreVisibility(){
    if(!loadMoreWrap || !loadMoreBtn) return;
    const shouldShow = (currentList.length >= (PAGE_SIZE + 1)) && (visibleCount < currentList.length);
    loadMoreWrap.hidden = !shouldShow;
  }

  function sortPosts(list){
    const arr = [...list];
    arr.sort((a,b)=>{
      const da = parseDate(a.date);
      const db = parseDate(b.date);
      return sortDesc ? (db - da) : (da - db);
    });
    return arr;
  }

  async function ensureBaseForAllIfNeeded(){
    // 전체(all) 상태에서 더보기/검색이 발생하면 전체 posts.json을 늦게 로드
    if(selected !== "all") return;
    const q = normalizeText(qEl?.value);
    const needFull = (q.length > 0) || (visibleCount > (basePosts?.length || 0));
    const isLite = (basePosts === __postsLite);
    if(needFull && isLite){
      basePosts = await loadPostsFull();
    }
  }

  async function buildList({ resetVisible=false } = {}){
    if(resetVisible) visibleCount = PAGE_SIZE;

    await ensureBaseForAllIfNeeded();

    const q = normalizeText(qEl?.value);

    // 1) 검색(전체면 full 필요, 카테고리는 해당 파일 내에서 검색)
    let filtered = (basePosts || []);
    if(q){
      filtered = filtered.filter(p=>{
        const t = normalizeText(p.title);
        const e = normalizeText(p.excerpt);
        const c = normalizeText(p.category);
        const tags = Array.isArray(p.tags) ? p.tags.map(normalizeText).join(" ") : "";
        return (t.includes(q) || e.includes(q) || c.includes(q) || tags.includes(q));
      });
    }

    // 2) 정렬
    filtered = sortPosts(filtered);

    currentList = filtered;

    // 3) 렌더
    const slice = filtered.slice(0, Math.min(visibleCount, filtered.length));
    if(slice.length === 0){
      renderCards([]);
      showState(q ? "검색 결과가 없어요." : "표시할 글이 없어요.");
    }else{
      hideState();
      renderCards(slice);
    }

    setMeta({
      total: filtered.length,
      shown: slice.length,
      category: (selected === "all" ? "전체" : selected),
      sortDesc,
      q: qEl?.value?.trim() || ""
    });

    setLoadMoreVisibility();
  }

  async function selectCategory(cat){
    selected = cat || "all";

    // URL 반영 + 로컬 저장
    applyCategoryToUrlAndStorage(selected);

    // 데이터 소스 교체
    if(selected === "all"){
      basePosts = await loadPostsLite();
    }else{
      basePosts = await loadCategoryPosts(selected);
    }

    await buildList({ resetVisible:true });
  }

  // -------------------------
  // 초기 로드
  // -------------------------
  try{
    const categoriesIndex = await loadCategoriesIndex();
    const { map:counts, cats } = buildCategoryStatsFromIndex(categoriesIndex);

    // 카테고리바 렌더 (전체 카테고리 기준)
    selected = getInitialSelectedCategory(counts);

    renderCategoryBar({
      cats,
      counts,
      selected,
      onSelect: (cat)=>{ void selectCategory(cat); }
    });

    // 초기 데이터: 전체는 lite, 특정 카테고리는 해당 파일
    if(selected === "all") basePosts = await loadPostsLite();
    else basePosts = await loadCategoryPosts(selected);

    // 정렬 버튼
    if(sortBtn){
      sortBtn.addEventListener("click", ()=>{
        sortDesc = !sortDesc;
        void buildList({ resetVisible:true });
      });
    }

    // 검색 (입력 시 12개로 리셋)
    if(qEl){
      let t = null;
      qEl.addEventListener("input", ()=>{
        if(t) clearTimeout(t);
        t = setTimeout(()=>{ void buildList({ resetVisible:true }); }, 120);
      });
    }

    // 더보기 (12개씩)
    if(loadMoreBtn){
      loadMoreBtn.addEventListener("click", async ()=>{
        visibleCount += PAGE_SIZE;
        await buildList({ resetVisible:false });
      });
    }

    await buildList({ resetVisible:true });

  }catch(err){
    console.error(err);
    showState("목록을 불러오는 중 문제가 발생했어요.");
    setMeta({ total:0, shown:0, category:"전체", sortDesc:true, q:"" });
    if(loadMoreWrap) loadMoreWrap.hidden = true;
  }
})();;
