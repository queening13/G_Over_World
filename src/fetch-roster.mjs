/* =========================================================================
   로스터 수집기 — GGen Eternal Database → src/roster.json + docs/img/

   실행 : node src/fetch-roster.mjs            (전 기체 · 원본 해상도)
   옵션 : --limit=<n>      등급별 n기씩만 (빠른 테스트용)
          --resize=<px>    초상화를 해당 폭으로 축소 (sharp 필요)
          --keep-cache     전체 목록을 src/_units_all.json 에 남긴다
          --from-cache     캐시가 있으면 목록 재요청을 건너뛴다
          --skip-images    이미 받은 이미지를 다시 받지 않는다

   이미지는 base64 로 내장하지 않고 docs/img/<id>.webp 로 따로 떨어뜨린다.
   - base64 팽창(×1.34)이 없어 그만큼 작다
   - <img loading="lazy"> 가 먹혀 화면에 보이는 것만 내려받는다
   - 브라우저가 파일 단위로 캐시한다
   - 단일 HTML 용량 상한에서 자유롭다
   ========================================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { trWeapon, trAbilityName, trAbilityDetail, trSeries, trAttr } from './i18n.mjs';

const BASE = 'https://ggendb.up.railway.app';
const LANG = 'EN';                       /* API 지원 : EN / TW / HK / JP (KO 없음) */
const NAME_PREFIX = '[SD] ';             /* 모든 기체명 앞에 붙는다 */

const SRC = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(SRC, '..');
const DOCS = path.join(ROOT, 'docs');
const IMGDIR = path.join(DOCS, 'img');
const THDIR = path.join(DOCS, 'th');
const OUT = path.join(SRC, 'roster.json');
const CACHE = path.join(SRC, '_units_all.json');

const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const arg = (k, d) => { const a = argv.find(v => v.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const LIMIT = parseInt(arg('limit', '0'), 10) || 0;
const RESIZE = parseInt(arg('resize', '0'), 10) || 0;

let sharp = null;
if (RESIZE) sharp = (await import('sharp')).default;   /* 원본 그대로면 sharp 자체가 필요 없다 */

const api = async u => {
  const r = await fetch(BASE + u, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(u + ' → HTTP ' + r.status);
  return r.json();
};

/* ---- 1. 전체 유닛 목록 ----------------------------------------------------
   per_page 는 서버에서 100 으로 잘린다. total_pages 를 보고 반드시 순회할 것. */
async function fetchAll() {
  if (has('--from-cache') && fs.existsSync(CACHE)) {
    console.log('cache 사용:', CACHE);
    return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  }
  let rows = [], page = 1, pages = 1;
  do {
    const r = await api(`/api/units?lang=${LANG}&page=${page}&per_page=100&grid_skills=1`);
    pages = r.total_pages;
    rows = rows.concat(r.rows);
    process.stdout.write('.');
    page++;
  } while (page <= pages);
  console.log('\n전체 유닛', rows.length, '기');
  if (has('--keep-cache')) fs.writeFileSync(CACHE, JSON.stringify(rows));
  return rows;
}

/* ---- 2. 로스터 선정 -------------------------------------------------------
   기본은 전 기체. --limit 을 주면 등급별 균등 간격으로 잘라낸다. */
function chooseRoster(rows) {
  const usable = rows.filter(r => r.id);
  if (!LIMIT) return usable;
  const byR = {};
  usable.forEach(r => { (byR[r.rarity] = byR[r.rarity] || []).push(r); });
  const out = [];
  for (const rar of Object.keys(byR)) {
    const pool = byR[rar];
    const need = Math.min(LIMIT, pool.length);
    const step = Math.max(1, Math.floor(pool.length / need));
    for (let i = 0, c = 0; i < pool.length && c < need; i += step, c++) out.push(pool[i]);
  }
  return out;
}

/* ---- 3. 상세 제원 ---------------------------------------------------------
   맵 병기와 SSP 전용 병기는 이 게임에 사거리/맵 개념이 없으므로 제외.
   무장은 최종 레벨 위력 기준 상위 6종만 남긴다. */
const TYPE = { melee: 'M', shooting: 'S' };
async function detail(r) {
  const d = await api(`/api/unit/${r.id}?lang=${LANG}`);
  const weps = (d.weapons || [])
    .filter(w => !w.is_map && !w.is_ssp_weapon)
    .map(w => ({
      n: w.name,
      pw: (w.levels && w.levels.length ? w.levels.map(l => l.power) : [w.power]),
      ac: w.accuracy, cr: w.critical,
      en: w.en_cost | 0, am: w.ammo | 0,
      mn: w.min_range | 0, mx: w.max_range | 0,
      at: w.attribute || '',
      tp: (w.attack_types || []).map(t => TYPE[t.key] || '').join('') || 'S',
      pre: !!w.is_preemptive
    }))
    .sort((a, b) => (b.pw[b.pw.length - 1] || 0) - (a.pw[a.pw.length - 1] || 0))
    .slice(0, 6)
    .map(w => Object.assign(w, { n: trWeapon(w.n), at: trAttr(w.at) }));
  /* 160자 — 90자로 자르면 "…by 30% when enemies attac" 처럼 문장이 끊겨
     한글화 규칙이 매칭되지 않는다. */
  const abs = (d.abilities || []).slice(0, 4).map(a => ({
    n: trAbilityName(a.display_name || a.name),
    d: trAbilityDetail(((a.details && a.details[0] && a.details[0].text) || '').slice(0, 160))
  }));
  return {
    id: r.id,
    nm: NAME_PREFIX + (d.name || r.name),
    mdl: d.model || '',
    sr: trSeries((d.series && d.series[0] && d.series[0].name) || ''),
    rar: r.rarity, role: r.role,
    hp: r.HP, atk: r.ATK, def: r.DEF, en: r.EN, mob: r.MOB, mov: r.MOV,
    lg: !!d.is_large, w: weps, ab: abs,
    /* 두 규격을 모두 받는다.
       pic  초상화 936x803 · 약 140KB — 전투·도시에·도감 상세용
       thum 썸네일 · 약 8.8KB         — 목록/그리드용
       경로 규칙 : Trait/thum/thum_<code>.webp → unit_portraits/ub_<code>.webp */
    pic: (d.portrait || String(r.thum || '').replace('/Trait/thum/thum_', '/unit_portraits/ub_')),
    thum: r.thum || ''
  };
}

/* 동시 요청 수를 묶어 상대 서버에 부담을 주지 않는다 */
async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0, done = 0;
  const tick = () => { if (++done % 50 === 0) process.stdout.write(' ' + done + ' '); else process.stdout.write('.'); };
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const k = i++;
      try { out[k] = await fn(items[k], k); } catch (e) { console.error('\n skip', items[k] && items[k].id, e.message); out[k] = null; }
      tick();
    }
  }));
  return out.filter(Boolean);
}

/* ---- 실행 ---------------------------------------------------------------- */
const rows = await fetchAll();
const roster = chooseRoster(rows);
console.log('로스터', roster.length, '기',
  JSON.stringify(roster.reduce((a, r) => (a[r.rarity] = (a[r.rarity] || 0) + 1, a), {})));

console.log('상세 제원 수집…');
const full = await pool(roster, 8, async r => detail(r));
console.log('\n상세', full.length, '기');

/* ---- 4. 이미지를 docs/img · docs/th 에 개별 파일로 저장 --------------------
   목록 그리드는 44px 칸이라 140KB 초상화를 쓰면 스크롤할 때마다 낭비가 크다.
   호스트가 주는 8.8KB 썸네일을 함께 받아 목록에는 그쪽을 쓴다. */
fs.mkdirSync(IMGDIR, { recursive: true });
fs.mkdirSync(THDIR, { recursive: true });

async function grab(url, file, resize) {
  if (has('--skip-images') && fs.existsSync(file)) return { size: fs.statSync(file).size, reused: true };
  if (!url) return { size: 0 };
  const res = await fetch(url);
  if (!res.ok) return { size: 0 };
  let buf = Buffer.from(await res.arrayBuffer());
  if (resize) buf = await sharp(buf).resize({ width: resize, withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toBuffer();
  fs.writeFileSync(file, buf);
  return { size: buf.length };
}

console.log('이미지 저장 중…' + (RESIZE ? ' (초상화 ' + RESIZE + 'px 축소)' : ' (초상화 원본 해상도)'));
const stat = { pic: 0, th: 0, reused: 0 };
await pool(full, 10, async u => {
  const a = await grab(u.pic, path.join(IMGDIR, u.id + '.webp'), RESIZE);
  const b = await grab(u.thum, path.join(THDIR, u.id + '.webp'), 0);
  stat.pic += a.size; stat.th += b.size;
  if (a.reused) stat.reused++;
  return u;
});
console.log('\n초상화', (stat.pic / 1048576).toFixed(1), 'MB · 평균', Math.round(stat.pic / full.length / 1024), 'KB');
console.log('썸네일', (stat.th / 1048576).toFixed(1), 'MB · 평균', Math.round(stat.th / full.length / 1024), 'KB');

/* HTML 에는 base64 대신 상대경로만 들어간다 */
full.forEach(u => { u.img = 'img/' + u.id + '.webp'; u.th = 'th/' + u.id + '.webp'; delete u.pic; delete u.thum; });

/* ---- 5. 밸런스 참고치 (DMG_K 재조정할 때 이 표를 본다) -------------------- */
console.log('\n등급별 중앙값 —');
['N', 'R', 'SR', 'SSR', 'UR'].forEach(rar => {
  const a = full.filter(u => u.rar === rar);
  if (!a.length) return;
  const med = f => { const v = a.map(f).filter(x => x != null).sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
  console.log(' ', rar.padEnd(4), 'n=' + String(a.length).padEnd(5),
    'HP', String(med(u => u.hp)).padStart(7),
    'ATK', String(med(u => u.atk)).padStart(6),
    'DEF', String(med(u => u.def)).padStart(6),
    'MOB', String(med(u => u.mob)).padStart(6),
    'EN', String(med(u => u.en)).padStart(4),
    'topPW', String(med(u => u.w[0] ? u.w[0].pw[u.w[0].pw.length - 1] : 0)).padStart(6),
    '무장', med(u => u.w.length));
});

fs.writeFileSync(OUT, JSON.stringify(full));
console.log('\n저장:', OUT, (fs.statSync(OUT).size / 1048576).toFixed(2), 'MB');
console.log('이어서 실행 → node build.mjs');
