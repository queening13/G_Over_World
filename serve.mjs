/* docs/ 를 정적 서버로 띄운다 — GitHub Pages 와 같은 조건으로 확인하기 위한 것.
   실행 : node serve.mjs   →  http://localhost:8788/            */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'docs');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript'
};
const PORT = process.env.PORT || 8788;

http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url.endsWith('/')) url += 'index.html';
  const file = path.join(ROOT, path.normalize(url).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('403'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('404 ' + url); }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
      'cache-control': 'no-cache'
    });
    res.end(buf);
  });
}).listen(PORT, () => console.log('http://localhost:' + PORT + '/'));
