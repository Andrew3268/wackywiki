// index.html 에 있던 inline 스크립트를 파일로 분리한 버전입니다.
// (원본 로직/동작 유지) + ✅ 더보기(12개 단위) 추가

(function () {
  // =========================
  // 설정
  // =========================
  const POSTS_URL = "/data/posts.json";
  const PAGE_SIZE = 12;

  const gridEl  = document.getElementById("grid");
  const stateEl = document.getElementById("state");
  const qEl     = document.getElementById("q");
  const countEl = document.getElementById("count");
  const hintEl  = document.getElementById("hint");
  const sortBtn = document.getElementById("sortBtn");

  const loadMoreWrap = document.getElementById("loadMoreWrap");
  const loadMoreBtn  = document.getElementById("loadMoreBtn");

  document.getElementById("year").textContent = new Date().getFullYear();

  let allPosts = [];
  let sortDesc = true;

  // 현재 필터/정렬 결과
  let currentList = [];
  let visibleCount = PAGE_SIZE;

  // =========================
  // 유틸리티
  // =========================
  function safeText(v) { return String(v ?? "").trim(); }

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

  function normalize(str) { return safeText(str).toLowerCase(); }

  function setLoadMoreVisibility() {
    if (!loadMoreWrap || !loadMoreBtn) return;
    const shouldShow = currentList.length >= (PAGE_SIZE + 1) && visibleCount < currentList.length;
    loadMoreWrap.hidden = !shouldShow;
  }

  // =========================
  // 렌더링 (카드 UI)
  // =========================
  function render(postsToShow) {
    gridEl.innerHTML = "";
    stateEl.hidden = true;

    // count는 "전체 결과 수" 기준
    countEl.textContent = String(currentList.length);

    if (!currentList.length) {
      stateEl.hidden = false;
      stateEl.innerHTML = `
        <div style="font-weight:700; font-size:18px; color:#fff; margin-bottom:8px;">표시할 결과가 없습니다.</div>
        <div>검색어를 확인하거나 전체 목록을 확인해보세요.</div>
      `;
      hintEl.textContent = "0개 결과";
      if (loadMoreWrap) loadMoreWrap.hidden = true;
      return;
    }

    const frag = document.createDocumentFragment();

    postsToShow.forEach((p) => {
      const title   = safeText(p.title);
      const url     = safeText(p.url);
      const excerpt = safeText(p.excerpt);
      // ✅ posts.json의 cover/ thumb 모두 지원 + 카드 썸네일 영역은 항상 유지(디자인 통일)
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

    hintEl.textContent = sortDesc ? "최신순 정렬 중" : "오래된순 정렬 중";
    setLoadMoreVisibility();
  }

  function renderCurrentPage() {
    const slice = currentList.slice(0, visibleCount);
    render(slice);
  }

  function applyFilterAndSort(resetPage = true) {
    const q = normalize(qEl.value);

    let filtered = allPosts.filter(p => {
      if (!q) return true;
      const hay = normalize([p.title, p.excerpt, p.category].join(" "));
      return hay.includes(q);
    });

    filtered.sort((a, b) => {
      const da = parseDate(a.date)?.getTime() ?? 0;
      const db = parseDate(b.date)?.getTime() ?? 0;
      return sortDesc ? (db - da) : (da - db);
    });

    currentList = filtered;

    // ✅ 검색/정렬 변경 시 페이지 리셋
    if (resetPage) visibleCount = PAGE_SIZE;

    renderCurrentPage();
  }

  async function loadPosts() {
    hintEl.textContent = "로딩 중...";
    try {
      const res = await fetch(POSTS_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      allPosts = Array.isArray(data) ? data : [];
      applyFilterAndSort(true);
    } catch (err) {
      stateEl.hidden = false;
      stateEl.innerHTML = `<strong>데이터 로드 실패:</strong> ${err.message}`;
      hintEl.textContent = "에러 발생";
      if (loadMoreWrap) loadMoreWrap.hidden = true;
    }
  }

  // =========================
  // 이벤트 바인딩
  // =========================
  qEl.addEventListener("input", () => applyFilterAndSort(true));

  sortBtn.addEventListener("click", () => {
    sortDesc = !sortDesc;
    sortBtn.textContent = sortDesc ? "최신순" : "오래된순";
    sortBtn.setAttribute("aria-pressed", String(sortDesc));
    applyFilterAndSort(true);
  });

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      // 다음 12개 추가
      visibleCount = Math.min(visibleCount + PAGE_SIZE, currentList.length);
      renderCurrentPage();
    });
  }

  loadPosts();
})();
