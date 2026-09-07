/* =========================================================================
   G-Over World — Node.js 서버

   실행 : node server.mjs            (기본 8788 포트)
          PORT=3000 node server.mjs
          MONGODB_URI=... node server.mjs      ← 세이브를 MongoDB 로

   /api/*  는 src/api.mjs 가 처리하고, 나머지는 docs/ 의 정적 파일을 준다.
   이미지 1244장(133MB)은 여기서 그대로 서빙된다.
   ========================================================================= */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi, boot } from './src/api.mjs';
import { openStore } from './src/store.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(ROOT, 'docs');
const PORT = Number(process.env.PORT || 8788);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon'
};
/* 이미지는 id 로 주소가 고정되어 내용이 바뀌지 않는다 — 1년 캐시.
   index.html · app.js 는 배포마다 바뀌므로 매번 검증하게 한다. */
const cacheFor = ext =>
  (ext === '.webp' || ext === '.png' || ext === '.jpg')
    ? 'public, max-age=31536000, immutable'
    : 'no-cache';

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  const file = path.join(PUB, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end('403'); }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('404 — ' + rel);
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': cacheFor(ext)
    });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
  if (pathname.startsWith('/api/')) return handleApi(req, res, pathname);
  serveStatic(req, res, pathname);
});

boot();
let store;
try {
  store = await openStore();
} catch (e) {
  console.error('\n세이브 저장소를 열지 못했습니다.\n  ' + e.message);
  console.error('\nMONGODB_URI 를 확인하거나, 빼고 실행하면 data/ 폴더에 저장합니다.\n');
  process.exit(1);
}
server.listen(PORT, () => {
  console.log('G-Over World — http://localhost:' + PORT);
  console.log('  세이브 저장소 :', store.kind, '(' + store.where + ')');
  if (store.kind === 'file') console.log('  ※ MONGODB_URI 를 주면 MongoDB 로 전환됩니다.');
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close(() => store.close().then(() => process.exit(0), () => process.exit(0)));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
