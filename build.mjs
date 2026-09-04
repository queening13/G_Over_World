/* src/ 의 조각들을 docs/index.html 하나로 합친다.
   초상화는 docs/img/ 에 개별 파일로 있고 HTML 에는 상대경로만 들어간다.
   로스터를 갱신하려면 node src/fetch-roster.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const r = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const out = r('src/head.html')
  + '\nconst UNITS = ' + r('src/roster.json') + ';\n'
  + r('src/engine.js') + r('src/ui.js')
  + '\n</script>\n</body>\n</html>\n';

fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs/index.html'), out);

const imgDir = path.join(ROOT, 'docs/img');
let n = 0, bytes = 0;
if (fs.existsSync(imgDir)) {
  for (const f of fs.readdirSync(imgDir)) { n++; bytes += fs.statSync(path.join(imgDir, f)).size; }
}
console.log('docs/index.html', (out.length / 1048576).toFixed(2), 'MB');
console.log('docs/img/      ', n, '장', (bytes / 1048576).toFixed(1), 'MB');
console.log('배포 합계      ', ((out.length + bytes) / 1048576).toFixed(1), 'MB');
