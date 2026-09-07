/* =========================================================================
   클라이언트 번들 생성

   실행 : node build.mjs   →  docs/index.html · docs/app.js

   docs/index.html  화면 골격 + CSS (head.html 그대로)
   docs/app.js      UNITS(로스터) + rules.mjs + client.js

   rules.mjs 는 서버에서 import 하는 ES 모듈이지만, 브라우저에는 번들러 없이
   그대로 이어 붙인다. 그래서 맨 끝 `export { ... };` 블록만 떼어낸다.
   rules.mjs 와 client.js 가 같은 스코프를 공유해야 client.js 가 `g` 를
   그대로 읽을 수 있다 — 이어 붙이는 순서를 지킬 것.
   ========================================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const r = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const DOCS = path.join(ROOT, 'docs');

/* ---- rules.mjs 에서 export 블록 제거 ----
   마커는 반드시 한 줄짜리 주석이어야 한다. 여러 줄 주석 중간을 자르면
   열린 주석이 남아 뒤따르는 코드를 통째로 삼킨다. */
const rules = r('src/rules.mjs');
const MARK = '/* @@BROWSER_CUT@@';
const cut = rules.indexOf(MARK);
if (cut < 0) throw new Error('rules.mjs 에서 ' + MARK + ' 마커를 찾지 못했습니다.');
const rulesBrowser = rules.slice(0, cut);

/* ---- index.html ----
   head.html 은 인라인 <script> 를 여는 것으로 끝난다. 서버판에서는 코드를
   app.js 로 빼므로 그 여는 태그부터 잘라내고 외부 스크립트를 건다. */
const head = r('src/head.html');
const tagAt = head.lastIndexOf('<script>');
if (tagAt < 0) throw new Error('head.html 에서 <script> 를 찾지 못했습니다.');
const html = head.slice(0, tagAt)
  + '<script src="app.js" defer></script>\n</body>\n</html>\n';
fs.writeFileSync(path.join(DOCS, 'index.html'), html);

/* ---- app.js ----
   로스터 변수명은 ROSTER 다. rules.mjs 안의 `let UNITS` 와 겹치면 안 되므로
   initRules() 로 넘겨 주기만 한다. */
const app = '"use strict";\n'
  + 'const ROSTER = ' + r('src/roster.json') + ';\n'
  + rulesBrowser
  + '\ninitRules(ROSTER);\n'
  + r('src/client.js');
fs.writeFileSync(path.join(DOCS, 'app.js'), app);

/* ---- 요약 ---- */
const mb = f => (fs.statSync(path.join(DOCS, f)).size / 1048576).toFixed(2) + ' MB';
const dirMB = d => {
  const p = path.join(DOCS, d);
  if (!fs.existsSync(p)) return null;
  const fl = fs.readdirSync(p);
  return { n: fl.length, mb: fl.reduce((a, f) => a + fs.statSync(path.join(p, f)).size, 0) / 1048576 };
};
console.log('docs/index.html', mb('index.html'));
console.log('docs/app.js    ', mb('app.js'));
for (const d of ['img', 'th']) {
  const s = dirMB(d);
  if (s) console.log(('docs/' + d + '/').padEnd(15), s.n + ' 장 ' + s.mb.toFixed(1) + ' MB');
}
console.log('\n실행 → node server.mjs');
