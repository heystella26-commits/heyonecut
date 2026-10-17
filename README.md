# 헤이원컷 (HEY 1/CUT)

사진 한 장으로 AI 이미지 + 인스타그램·블로그 콘텐츠를 만드는 서비스.

- `public/` 화면 (정적 파일)
- `src/index.js` Cloudflare Worker 진입점 (`/api/*` 라우팅)
- `src/api/` 서버 기능 (생성, 결제, 로그인 등)
- 저장소: Cloudflare D1 `heyonecut-db` (`kv` 테이블)

배포: main 브랜치에 push하면 Cloudflare Workers Builds가 `npx wrangler deploy` 실행.
비밀값(API 키 등)은 Cloudflare 대시보드 → Worker → Settings → Variables and Secrets 에 저장.
