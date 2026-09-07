/* =========================================================================
   Vercel 서버리스 진입점 — 파일명이 곧 라우트다

   파일명 [...path] 가 Vercel 의 catch-all 규칙이라 /api/ 아래 모든 경로가
   이 함수로 들어온다. rewrites 를 따로 걸지 않는 이유다 — 설정으로 우회하면
   경로 규칙이 하나 더 늘고 그만큼 어긋날 자리가 생긴다.

   정적 파일(index.html · app.js · 이미지)은 Vercel 이 docs/ 에서 직접
   서빙하므로 여기서는 API 만 다룬다.

   ※ Vercel 의 파일 시스템은 읽기 전용이라 파일 백엔드가 동작하지 않는다.
      환경변수 MONGODB_URI 를 반드시 넣을 것. 없으면 아래에서 바로 알려 준다.
   ========================================================================= */
import { handleApi } from '../src/api.mjs';

export default function handler(req, res) {
  if (!process.env.MONGODB_URI) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({
      err: '서버에 MONGODB_URI 가 설정되지 않았습니다. Vercel 프로젝트 설정 → Environment Variables 에 추가하십시오.'
    }));
  }
  const pathname = (req.url || '/').split('?')[0];
  return handleApi(req, res, pathname);
}
