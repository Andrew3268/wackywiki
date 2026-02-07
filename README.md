# Cloudflare Pages 정적 블로그 예시

- 패키지 버전: v1.1.4
- 업데이트: data/posts.json 기본 예시 1개 포함(대파 보관 글)

## 포함 파일
- index.html: 글 목록(자동)
- data/posts.json: 글 목록 데이터(목차)
- posts/*.html: 글 상세(정적 HTML)
- assets/app.js: posts.json을 읽어 목록 렌더링
- assets/styles.css: 기본 스타일
- robots.txt / sitemap.xml: SEO 기본

## 새 글 추가 방법(가장 중요)
1) posts/ 에 새 글 HTML 파일을 추가 (예: posts/my-new-post.html)
2) data/posts.json 에 항목 1개 추가 (url이 /posts/my-new-post.html 로 맞는지 확인)
3) git add/commit/push
4) Cloudflare Pages가 자동 배포

## sitemap.xml 수정
sitemap.xml의 example.pages.dev를 본인 도메인(또는 pages.dev)으로 바꾸세요.

## v1.1.4 변경사항
- tags.html을 index.html과 동일한 UI 구조로 맞춤(메타/필터바/정렬 버튼/카드 UI)
- tags.js를 index.html과 동일한 카드 마크업으로 렌더링하도록 변경
- 태그 페이지에서도 검색/정렬이 정상 동작하도록 정리


## v1.1.5
- category.html 추가: 카테고리별 글 모아보기 (Breadcrumb 카테고리 링크용)
- assets/category.js 추가
- sitemap.xml에 category.html 포함


## 🔧 데이터 자동 분할(권장 운영 방식)

- **원본 데이터는 `data/posts.json`만 수정**하세요.
- 배포(Cloudflare Pages 빌드) 시 `npm run build`가 실행되면 아래 파일이 자동 생성됩니다.
  - `data/posts-lite.json` (최신 12개)
  - `data/categories-index.json`, `data/tags-index.json`
  - `data/category/<slug>.json`, `data/tag/<slug>.json`

### Cloudflare Pages 설정
- Build command: `npm run build`
- Build output directory: `/` (프로젝트 루트)

로컬에서 미리 생성하려면:
```bash
npm run build
```
