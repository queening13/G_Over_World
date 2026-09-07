/* =========================================================================
   API 종단 점검

   실행 : node server.mjs        (다른 터미널에서)
          node test/e2e.mjs
          BASE=https://내주소 node test/e2e.mjs

   브라우저 없이 HTTP 만으로 한 판을 돌린다. 정상 동작뿐 아니라
   '클라이언트가 거짓말을 해도 서버가 막는가' 를 함께 본다.
   ========================================================================= */
const BASE = process.env.BASE || 'http://127.0.0.1:8788';
let cookie = '';

async function call(path, method, body) {
  const r = await fetch(BASE + path, {
    method: method || 'GET',
    headers: Object.assign({ 'content-type': 'application/json' }, cookie ? { cookie } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  const sc = r.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  const j = await r.json();
  return { ok: r.ok, status: r.status, j };
}
const act = a => call('/api/act', 'POST', { a });
const ok = (label, cond, extra) =>
  console.log((cond ? '  OK  ' : '  !!  ') + label + (extra !== undefined ? '  ' + extra : ''));


/* ---- 1. 상태 · 등록 ---- */
let r = await call('/api/state');
ok('state (빈 세이브)', r.ok && r.j.g === null, 'pid=' + r.j.pid + ' store=' + r.j.store);
const pid = r.j.pid;

/* 초기 배속 후보를 알아내려고 등급 N 기체 하나를 고른다 */
const units = JSON.parse(await (await fetch(BASE + '/app.js')).text().then(t => {
  const a = t.indexOf('const ROSTER = ') + 'const ROSTER = '.length;
  const b = t.indexOf(';\n', a);
  return t.slice(a, b);
}));
const startUnit = units.find(u => u.rar === 'N' && u.w.length);

r = await act({ k: 'new', name: '서버검수', st: { sho: 20, mel: 20, def: 20, rea: 20, awk: 20, spi: 20 }, unitId: startUnit.id });
ok('new', r.ok && r.j.g && r.j.g.name === '서버검수', '자금 ' + (r.j.g && r.j.g.cash));

/* ---- 2. 서버가 검증을 실제로 하는가 ---- */
r = await act({ k: 'new', name: 'x', st: { sho: 999, mel: 0, def: 0, rea: 0, awk: 0, spi: 0 }, unitId: startUnit.id });
ok('합계 틀린 new 거절', !r.ok && r.status === 400, r.j.err);

r = await act({ k: 'order', id: units.sort((a, b) => b.hp - a.hp)[0].id });
ok('계급/자금 부족 발주 거절', !r.ok, r.j.err);

r = await act({ k: 'mktbuy', id: startUnit.id });
ok('오늘 매물 아닌 것 거절', !r.ok, r.j.err);

r = await act({ k: 'alloc', map: { sho: 99999, mel: 0, def: 0, rea: 0, awk: 0, spi: 0 } });
ok('보유 초과 배분 거절', !r.ok, r.j.err);

/* ---- 3. 정상 동작 ---- */
r = await act({ k: 'train', stat: 'sho' });
ok('train', r.ok && r.j.out.res, 'AP ' + r.j.g.ap + ' / 사격 ' + r.j.g.st.sho);

r = await act({ k: 'sortie', m: 'ptrl', tac: 'norm', ter: 'sp' });
const b = r.ok && r.j.out.battle;
ok('sortie', !!b, b ? (b.res.r + ' · 이벤트 ' + b.ev.length + ' · 캐스트 ' + b.cast.length) : r.j.err);
ok('전투 후 세이브 반영', r.ok && r.j.g.sorties === 1, 'kills=' + (r.ok && r.j.g.kills));

r = await act({ k: 'nextday' });
ok('nextday', r.ok && r.j.g.day === 2, 'AP ' + r.j.g.ap);

/* ---- 4. 스킬 · 강화 ---- */
await act({ k: 'nextday' });
r = await call('/api/state');
const cash0 = r.j.g.cash;
r = await act({ k: 'skbuy', sk: 'nt' });
ok('skbuy', r.ok && r.j.g.sk.nt === 1, '자금 ' + cash0 + ' → ' + (r.ok ? r.j.g.cash : '?'));
r = await act({ k: 'skeq', sk: 'nt' });
ok('skeq', r.ok && r.j.g.eq.includes('nt'));
r = await act({ k: 'skbuy', sk: 'coord' });
if (r.ok) { r = await act({ k: 'skeq', sk: 'coord' }); ok('출신 중복 거절', !r.ok, r.j.err); }
r = await act({ k: 'skuneq', sk: 'nt' });
ok('skuneq', r.ok && !r.j.g.eq.includes('nt'));

/* ---- 5. 이어하기 코드 ---- */
const saved = cookie;
cookie = '';                                  /* 다른 기기인 척 */
r = await call('/api/state');
ok('새 기기 = 빈 세이브', r.ok && r.j.g === null, 'pid=' + r.j.pid);
r = await call('/api/login', 'POST', { pid: pid });
ok('코드로 이어하기', r.ok && r.j.g && r.j.g.name === '서버검수', 'DAY ' + (r.ok && r.j.g.day));
r = await call('/api/login', 'POST', { pid: 'ffffffffffffffffffffffff' });
ok('없는 코드 거절', !r.ok, r.j.err);
r = await call('/api/login', 'POST', { pid: '너무짧음' });
ok('형식 틀린 코드 거절', !r.ok, r.j.err);

/* ---- 6. 정적 파일 ---- */
for (const f of ['/', '/app.js', '/img/' + startUnit.id + '.webp']) {
  const res = await fetch(BASE + f);
  ok('GET ' + f, res.ok, res.status + ' ' + (res.headers.get('content-type') || '') +
     ' cache=' + (res.headers.get('cache-control') || ''));
}

/* ---- 7. 말소 ---- */
cookie = saved;
r = await call('/api/reset', 'POST', {});
ok('reset', r.ok && r.j.g === null);
