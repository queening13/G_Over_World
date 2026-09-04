
/* =========================================================================
   G-Over World — 2d6 대항판정 MS 파일럿 육성 시뮬레이션
   기체 제원 : GGen Eternal Database
   ========================================================================= */
const UMAP = {}; UNITS.forEach(u => UMAP[u.id] = u);
/* 작품(시리즈) 목록 — 개발·도감 필터에 쓴다 */
const SERIES_LIST = [...new Set(UNITS.map(u => u.sr).filter(Boolean))].sort();
const RARS = ['N', 'R', 'SR', 'SSR', 'UR'];
const RIDX = { N: 0, R: 1, SR: 2, SSR: 3, UR: 4 };
const PRICE = { N: 38000, R: 96000, SR: 215000, SSR: 470000, UR: 990000 };
const LVREQ = { N: 1, R: 4, SR: 9, SSR: 15, UR: 23 };
const ROLES = {
  Attack:  { n: '공격형', d: '화력 +8%',            pw: 1.08, tak: 1.00, hit: 0, en: 1.00 },
  Defense: { n: '방어형', d: '받는 피해 −8%',        pw: 1.00, tak: 0.92, hit: 0, en: 1.00 },
  Support: { n: '지원형', d: '명중 +1 / EN 소모 −15%', pw: 1.00, tak: 1.00, hit: 1, en: 0.85 }
};
const roleN = r => (ROLES[r] || { n: r }).n;

const d6 = () => 1 + Math.floor(Math.random() * 6);
const r2 = () => { const a = d6(), b = d6(); return { a: a, b: b, t: a + b }; };
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const pick = a => a[Math.floor(Math.random() * a.length)];
const rint = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const cm = n => Math.round(n).toLocaleString('ko-KR');
const P2 = (() => { const p = {}; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) p[a + b] = (p[a + b] || 0) + 1 / 36; return p; })();
const OPP = (() => { const m = {}; for (let i = -14; i <= 14; i++) { let s = 0; for (const x in P2) for (const y in P2) if (+x + i >= +y) s += P2[x] * P2[y]; m[i] = s; } return m; })();
const oppP = a => OPP[clamp(Math.round(a), -14, 14)];

const RANKS = [{ k: 0, n: '훈련병' }, { k: 3, n: '소위' }, { k: 10, n: '중위' }, { k: 24, n: '대위' },
{ k: 45, n: '소령' }, { k: 75, n: '중령' }, { k: 115, n: '대령' }, { k: 170, n: '준장' }];
const rankOf = k => { let r = RANKS[0]; RANKS.forEach(v => { if (k >= v.k) r = v; }); return r.n; };

const FACTIONS = {
  fed: { n: '지구연방군', d: '보급이 두텁다. 임무 보수 +12%, 사격 +1', bonus: { sho: 1 }, pay: 1.12, fix: 1.0, cash: 62000 },
  duc: { n: '공국군',     d: '기체 조율이 뛰어나다. 격투 +1, 운동성 +6%', bonus: { mel: 1 }, mob: 0.06, pay: 1.0, fix: 1.0, cash: 62000 },
  mrc: { n: '의용병단',   d: '자재를 싸게 구한다. 정비비 −25%, 초기자금 +40,000', bonus: {}, pay: 1.0, fix: 0.75, cash: 102000 }
};

const STN = { sho: '사격', mel: '격투', rea: '반응', def: '방어', skl: '기량', spi: '정신' };
const TRAIN = [
  { k: 'sho', d: '표적 사격. 사격 병장의 명중과 화력에 영향.' },
  { k: 'mel', d: '근접 전투. 격투 병장의 명중과 화력에 영향.' },
  { k: 'rea', d: '회피 기동. 적 공격을 회피할 확률에 영향.' },
  { k: 'def', d: '피탄 관리. 기체 방어력을 끌어올린다.' },
  { k: 'skl', d: '조준 정밀도. 크리티컬률과 훈련 효율에 영향.' },
  { k: 'spi', d: '정신 단련. 전투 개시 기력과 기력 상승폭에 영향.' }
];

const MOD = {
  hp:  { n: '구조 강화',  u: '최대 HP +5%',  s: 'hp' },
  en:  { n: '제네레이터', u: '최대 EN +5%',  s: 'en' },
  def: { n: '장갑 증설',  u: '장갑 +5%',     s: 'def' },
  mob: { n: '스러스터',   u: '운동성 +5%',   s: 'mob' },
  atk: { n: '화력 관제',  u: '공격력 +5%',   s: 'atk' }
};
const MODMAX = 10;

/* 전투 밸런스 계수
   DMG_K : 동급 교전이 3~5히트로 끝나도록 맞춘 피해 계수
   FOE_*  : 플레이어는 에이스, 잡졸은 잡졸답게 — 일반 적기는 제원을 깎아 투입한다 */
const ROUND_CAP = 20;
const DMG_K = 3.0;
const FOE_HP  = { mob: 0.38, elite: 0.62, boss: 0.72 };
const FOE_DMG = 0.55;       /* 적 → 아군 피해 계수. 플레이어는 에이스이므로 한 방에 무너지지 않는다 */
const DEF_STAT_K = 0.018;   /* 방어 능력치 1점당 장갑 상승률 — 화력(0.02)보다 낮게 두어 교착을 막는다 */
const HIT_CLAMP = 6;        /* 명중 우열 상한. 어느 쪽도 확정 명중/확정 회피가 되지 않게 한다 */

const MISSION = [
  { id: 'ptrl',  n: '초계 임무',      ap: 1, lv: 1,  pool: ['N', 'N', 'R'],        cnt: 2, diff: 0.80, pay: 9000,   exp: 26,   d: '경계 공역을 순찰한다. 소규모 적과 조우.' },
  { id: 'swp',   n: '소탕전',         ap: 2, lv: 3,  pool: ['R', 'R', 'SR'],       cnt: 3, diff: 0.90, pay: 27000,  exp: 78,   d: '잔존 부대를 쓸어낸다. 정예가 섞인다.' },
  { id: 'base',  n: '거점 공략',      ap: 2, lv: 7,  pool: ['SR', 'SR', 'SSR'],    cnt: 4, diff: 1.00, pay: 64000,  exp: 190,  d: '방어선을 돌파한다. 화력 지원기가 다수.' },
  { id: 'itcp',  n: '에이스 요격',    ap: 3, lv: 12, pool: ['SSR', 'SSR'],         cnt: 3, ace: 'UR', diff: 1.05, pay: 155000, exp: 460, d: '적 에이스기를 요격한다. 운동성이 극도로 높다.' },
  { id: 'final', n: '결전 · 기함 요격', ap: 4, lv: 18, pool: ['SSR', 'UR', 'UR'], cnt: 4, ace: 'UR', boss: true, diff: 1.10, pay: 430000, exp: 1500, d: '적 기함급 지휘기를 격파한다. 전선의 향방이 걸려 있다.' }
];

const TACTIC = {
  norm: { n: '통상', d: '균형 잡힌 전법. 보정 없음.',                    hit: 0,  pw: 1.00, tak: 1.00 },
  rush: { n: '맹공', d: '명중 −2 / 화력 +22% / 받는 피해 +28%',          hit: -2, pw: 1.22, tak: 1.28 },
  calm: { n: '신중', d: '명중 +2 / 화력 −10% / 받는 피해 −18%',          hit: 2,  pw: 0.90, tak: 0.82 },
  evad: { n: '회피', d: '회피 +4 / 화력 −18% / 받는 피해 −12%',          hit: 0,  pw: 0.82, tak: 0.88, eva: 4 }
};

const EVENTS = [
  { p: 17, f: g => { const v = rint(4000, 16000); g.cash += v; return '보급 창고에서 <b class="ye">여분의 부품</b>을 매각했다. 자금 +' + cm(v) + 'C'; } },
  { p: 13, f: g => { const s = uStat(cur()); const d = Math.round(s.hpMax * 0.08); cur().hp = Math.max(1, cur().hp - d); return '야간 정비 중 <b class="rd">냉각계 이상</b>이 발생했다. HP −' + cm(d); } },
  { p: 12, f: g => { const k = pick(Object.keys(STN)); g.st[k] = Math.min(20, g.st[k] + 1); return '교관의 지도로 <b class="li">' + STN[k] + '</b>이(가) 1 상승했다.'; } },
  { p: 11, f: g => { g.ap = g.apMax; return '컨디션이 좋다. 행동력이 <b class="ye">완전 회복</b>되었다.'; } },
  { p: 10, f: g => { const v = rint(3000, 12000); g.cash = Math.max(0, g.cash - v); return '사고 처리 비용이 청구되었다. 자금 −' + cm(v) + 'C'; } },
  { p: 10, f: g => { g.mor0 = Math.min(118, g.mor0 + 3); return '전공이 인정되어 사기가 올랐다. <b class="ye">초기 기력 +3</b> (현재 ' + g.mor0 + ')'; } },
  { p: 9,  f: g => { cur().hp = uStat(cur()).hpMax; return '정비반이 밤새 작업했다. 탑승기가 <b class="li">완전 정비</b>되었다.'; } },
  { p: 9,  f: g => { g.fame += 3; return '전선 신문에 이름이 실렸다. <b class="ye">명성 +3</b>'; } },
  { p: 9,  f: g => '조용한 하루였다. 특별한 일은 없었다.' }
];

/* =========================================================================
   상태 / 세이브
   ========================================================================= */
const SAVEKEY = 'gover.world.v3';
const AP_BASE = 10;              /* 일일 행동력 기본값 */
let g = null;
const S = { view: 'main', busy: false, skip: false, msg: null, res: null, tac: 'norm', shopS: 'ALL', shopSel: '', bookSel: '', bookQ: '' };
const $ = id => document.getElementById(id);
const cur = () => g.garage[g.cur];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function mkOwned(id) {
  const B = UMAP[id];
  return { id: id, hp: B.hp, mod: { hp: 0, en: 0, def: 0, mob: 0, atk: 0 }, wl: B.w.map(() => 1) };
}
function newGame(nm, fac, st, unitId) {
  const F = FACTIONS[fac];
  g = {
    name: nm, fac: fac, lv: 1, exp: 0, cash: F.cash, ap: AP_BASE, apMax: AP_BASE, day: 1, mor0: 100,
    st: st, kills: 0, sorties: 0, wins: 0, losses: 0, downs: 0, fame: 0,
    garage: [mkOwned(unitId)], cur: 0, records: [], flags: { bossDown: false }
  };
  save();
}
function save() {
  try { localStorage.setItem(SAVEKEY, JSON.stringify(g)); stamp('저장됨 ' + new Date().toLocaleTimeString('ko-KR')); }
  catch (e) { stamp('저장 실패'); }
}
function load() {
  try {
    const o = JSON.parse(localStorage.getItem(SAVEKEY) || 'null');
    if (!o || !o.garage || !o.garage.length || !UMAP[o.garage[0].id]) return false;
    g = o; if (!g.flags) g.flags = { bossDown: false };
    g.garage = g.garage.filter(v => UMAP[v.id]);
    g.cur = clamp(g.cur | 0, 0, g.garage.length - 1);
    return true;
  } catch (e) { return false; }
}
function stamp(t) { $('saveInfo').textContent = t; }

/* =========================================================================
   파생 수치
   ========================================================================= */
function uStat(v) {
  const B = UMAP[v.id], F = FACTIONS[g.fac];
  const m = v.mod;
  return {
    B: B,
    hpMax: Math.round(B.hp * (1 + m.hp * 0.05)),
    enMax: Math.round(B.en * (1 + m.en * 0.05)),
    def: Math.round(B.def * (1 + m.def * 0.05)),
    mob: Math.round(B.mob * (1 + m.mob * 0.05) * (1 + (F.mob || 0))),
    atk: Math.round(B.atk * (1 + m.atk * 0.05)),
    modSum: Object.keys(MOD).reduce((a, k) => a + m[k], 0)
  };
}
const wpowOf = (v, i) => { const w = UMAP[v.id].w[i]; const lv = clamp((v.wl && v.wl[i]) || 1, 1, w.pw.length); return w.pw[lv - 1]; };
const wpMax = (v, i) => UMAP[v.id].w[i].pw.length;
const morB = u => clamp(Math.floor((u.mor - 100) / 10), -4, 5);
const morP = u => 1 + (u.mor - 100) * 0.005;
const expNeed = lv => Math.round(100 * Math.pow(lv, 1.45));
const wIsMelee = w => (w.tp || 'S').indexOf('M') >= 0;

function gainExp(n) {
  g.exp += n; g.lvupNote = g.lvupNote || [];
  while (g.exp >= expNeed(g.lv)) {
    g.exp -= expNeed(g.lv); g.lv++;
    const k = pick(Object.keys(STN)); g.st[k] = Math.min(20, g.st[k] + 1);
    g.cash += 4000;
    if (g.lv % 4 === 0) g.apMax++;
    g.lvupNote.push('LEVEL ' + g.lv + ' — ' + STN[k] + ' +1 / 자금 +4,000' + (g.lv % 4 === 0 ? ' / 행동력 상한 +1' : ''));
  }
}

/* =========================================================================
   전투 유닛 구성
   ========================================================================= */
function mkPlayer(tac) {
  const v = cur(), s = uStat(v), B = s.B, T = TACTIC[tac], R = ROLES[B.role] || ROLES.Attack;
  return {
    side: 'p', id: B.id, nm: B.nm, mdl: B.mdl, rar: B.rar, role: B.role, img: B.img, th: B.th, large: B.lg,
    hp: v.hp, hpMax: s.hpMax, en: s.enMax, enMax: s.enMax,
    atk: s.atk, def: s.def, mob: s.mob, mov: B.mov,
    st: Object.assign({}, g.st), mor: g.mor0,
    pwMul: R.pw * T.pw, takMul: R.tak * T.tak, hitMod: R.hit + T.hit, evaMod: T.eva || 0, enMul: R.en,
    weps: B.w.map((w, i) => ({ i: i, n: w.n, pw: wpowOf(v, i), ac: w.ac, cr: w.cr, en: Math.round((w.en || 0) * R.en), am: w.am, ammo: w.am || 0, tp: w.tp, at: w.at, pre: w.pre, mx: w.mx }))
  };
}
function mkFoe(B, plv, elite, boss, idx, diff) {
  const R = ROLES[B.role] || ROLES.Attack;
  /* 공격 능력과 회피 능력을 분리한다. 한 값으로 둘 다 올리면 정예기가
     '절대 안 맞고 절대 안 빗나가는' 무적이 되어 전투가 성립하지 않는다. */
  const ps = 2 + Math.round(plv * 0.7);
  const off = ps + (boss ? 3 : elite ? 2 : 0);
  const eva = ps + (boss ? 1 : elite ? 1 : 0);
  const wl = clamp(1 + Math.floor(plv / 5), 1, 5);
  const hpm = boss ? FOE_HP.boss : elite ? FOE_HP.elite : FOE_HP.mob;
  const atm = diff || 1;
  return {
    side: 'e', id: B.id, nm: B.nm, mdl: B.mdl, rar: B.rar, role: B.role, img: B.img, th: B.th, large: B.lg, idx: idx,
    tag: boss ? '지휘기' : elite ? '에이스' : '',
    hp: Math.round(B.hp * hpm), hpMax: Math.round(B.hp * hpm),
    en: B.en * 3, enMax: B.en * 3,
    atk: Math.round(B.atk * atm), def: B.def, mob: B.mob, mov: B.mov,
    st: { sho: off, mel: off, rea: eva, def: ps, skl: Math.round(ps * 0.7), spi: 3 },
    mor: elite || boss ? 110 : 100,
    pwMul: R.pw, takMul: R.tak, hitMod: R.hit, evaMod: 0, enMul: R.en,
    weps: B.w.map((w, i) => ({ i: i, n: w.n, pw: w.pw[clamp(wl, 1, w.pw.length) - 1], ac: w.ac, cr: w.cr, en: w.en || 0, am: w.am, ammo: (w.am || 0) * 3, tp: w.tp, at: w.at, pre: w.pre, mx: w.mx })),
    pay: Math.round(PRICE[B.rar] * 0.035 * (boss ? 4 : elite ? 2 : 1)),
    exp: Math.round((10 + RIDX[B.rar] * 26) * (boss ? 5 : elite ? 2.5 : 1)),
    boss: !!boss
  };
}
const uname = u => u.nm + (u.tag ? ' 〈' + u.tag + '〉' : '') + (u.idx > 0 ? ' #' + (u.idx + 1) : '');

/* ---- 판정 ---- */
function usable(u, w) { return !(w.en && u.en < w.en) && !(w.am && w.ammo <= 0); }
function calcDmg(A, D, w) {
  const stat = wIsMelee(w) ? A.st.mel : A.st.sho;
  const atkv = A.atk * (1 + stat * 0.02) * morP(A) * A.pwMul;
  const defv = D.def * (1 + D.st.def * DEF_STAT_K) * (1 + (D.mor - 100) * 0.002);
  let d = w.pw * (atkv / defv) * DMG_K * D.takMul;
  if (A.side === 'e') d *= FOE_DMG;
  if (D.large) d *= 1.06;
  return Math.max(200, Math.round(d / 10) * 10);
}
/* 명중 우열. 기량은 조준 보정으로도 작용하고, 양극단에서 전투가 교착되지 않도록
   최종 우열은 ±HIT_CLAMP 로 묶는다(기본 ±6 = 명중률 11%~89% 구간). */
function hitAdv(A, D, w) {
  const stat = wIsMelee(w) ? A.st.mel : A.st.sho;
  const acc = Math.round(((w.ac || 100) - 100) / 8);
  const atk = stat + acc + morB(A) + A.hitMod + Math.floor(A.st.skl / 4);
  const dfn = D.st.rea + morB(D) + Math.floor(D.mob / 2200) + (D.evaMod || 0) + (D.large ? -1 : 0);
  return clamp(atk - dfn, -HIT_CLAMP, HIT_CLAMP);
}
const critNeed = (A, D, w) => clamp(10 - Math.floor(A.st.skl / 2) + Math.floor(D.st.skl / 3) - Math.round((w.cr || 0) / 5), 3, 12);
function chooseWep(A, D) {
  let best = null;
  A.weps.forEach(w => {
    if (!usable(A, w)) return;
    const sc = oppP(hitAdv(A, D, w)) * calcDmg(A, D, w);
    if (!best || sc > best.sc) best = { w: w, sc: sc };
  });
  return best && best.w;
}

/* =========================================================================
   전투 진행
   ========================================================================= */
/* 로그와 상황판은 S 에 보관한다. 전투 종료 후 결과 화면을 다시 그릴 때
   방금 본 전투 기록이 지워지지 않도록 하기 위함. */
function bl(html, cls) {
  const line = '<div class="l ' + (cls || '') + '">' + html + '</div>';
  (S.blog = S.blog || []).push(line);
  const el = $('blog'); if (!el) return;
  el.insertAdjacentHTML('beforeend', line);
  el.scrollTop = el.scrollHeight;
}
const sleep = ms => new Promise(r => setTimeout(r, S.skip ? 0 : ms));

const sameUnit = (a, b) => !!a && !!b && a.side === b.side && (a.idx || 0) === (b.idx || 0) && a.id === b.id;

function buCard(u, actor) {
  const r = u.hp / u.hpMax, w = r > .5 ? 'hp' : r > .25 ? 'hp w' : 'hp c';
  return '<div class="bu' + (u.hp <= 0 ? ' dead' : '') + (sameUnit(u, actor) ? ' act' : '') + '">' +
    '<img class="ui s" src="' + (u.th || u.img) + '" alt="" decoding="async">' +
    '<div class="bm"><div class="bn">' + esc(uname(u)) + '</div>' +
    '<div class="gg bg"><i class="' + w + '" style="width:' + (r * 100) + '%"></i>' +
    '<span>' + cm(u.hp) + ' / ' + cm(u.hpMax) + '</span></div></div></div>';
}
function paintBoard(P, foes, actor) {
  S.board =
    '<div class="bcol"><h4>OWN FORCE</h4>' + buCard(P, actor) + '</div>' +
    '<div class="bcol"><h4>HOSTILE — ' + foes.filter(f => f.hp > 0).length + ' / ' + foes.length + '</h4>' +
    foes.map(f => buCard(f, actor)).join('') + '</div>';
  const b = $('bboard'); if (b) b.innerHTML = S.board;
}

/* 교전 표시부 — 공격기와 피격기의 초상화를 나란히 띄운다.
   kind : 'aim' 조준 / 'miss' 회피 / 'hit' 명중 / 'crit' 크리티컬 */
function paintDuel(A, D, w, dmg, kind) {
  const mid =
    kind === 'aim' ? '<div class="arrow">▶▶▶</div><div class="lbl dm">교전</div>' :
    kind === 'miss' ? '<div class="lbl dm">MISS</div><div class="num dm">회피</div>' :
    '<div class="lbl ' + (kind === 'crit' ? 'og' : 'ye') + '">' + (kind === 'crit' ? 'CRITICAL' : 'HIT') + '</div>' +
    '<div class="num ' + (kind === 'crit' ? 'og' : 'ye') + '">' + cm(dmg) + '</div>';
  const side = (u, right) =>
    '<div class="side' + (right ? ' r' : '') + '">' +
      '<img class="ui xl" src="' + u.img + '" alt="">' +
      '<div class="info">' +
        '<div class="dn ' + (u.side === 'p' ? 'cy' : 'mg') + '">' + esc(uname(u)) + '</div>' +
        '<div class="dm2">' + esc(u.mdl || '') + '</div>' +
        '<div class="dw ' + (right ? '' : 'ye') + '">' +
          (right ? cm(u.hp) + ' / ' + cm(u.hpMax) : esc(w.n)) + '</div>' +
      '</div></div>';
  S.duel = side(A, false) + '<div class="mid">' + mid + '</div>' + side(D, true);
  const el = $('duel'); if (el) el.innerHTML = S.duel;
}

async function runBattle(ms, tac) {
  S.view = 'battle'; S.busy = true; S.skip = false; S.res = null;
  S.blog = []; S.board = ''; S.duel = '';
  renderAll();

  const P = mkPlayer(tac);
  const foes = buildFoes(ms);
  const nameCount = {};
  foes.forEach(f => nameCount[f.nm] = (nameCount[f.nm] || 0) + 1);
  const seen = {};
  foes.forEach(f => { f.idx = nameCount[f.nm] > 1 ? (seen[f.nm] = (seen[f.nm] || 0) + 1) - 1 : 0; });
  paintBoard(P, foes);

  bl('━━ <b>' + ms.n + '</b> ━━', 'sys');
  bl('전법 ' + TACTIC[tac].n + ' / 탑승기 ' + P.nm + ' <span class="dm">(' + P.mdl + ')</span>', 'sys');
  bl('적 편성 ' + foes.map(f => uname(f)).join(' , '), 'sys');
  await sleep(400);

  let round = 1, result = 'draw';
  while (round <= ROUND_CAP) {
    if (P.hp <= 0 || foes.every(f => f.hp <= 0)) break;
    bl('── ROUND ' + round + ' ──', 'rnd');
    await sleep(200);

    const order = [P].concat(foes.filter(f => f.hp > 0))
      .map(u => ({ u: u, i: u.mob + u.mov * 260 + (u.weps.some(w => w.pre) ? 900 : 0) + d6() * 320 }))
      .sort((a, b) => b.i - a.i).map(o => o.u);

    for (const A of order) {
      if (A.hp <= 0 || P.hp <= 0 || foes.every(f => f.hp <= 0)) continue;
      const live = A.side === 'p' ? foes.filter(f => f.hp > 0) : [P];
      if (!live.length) break;
      const D = A.side === 'p'
        ? live.slice().sort((x, y) => (x.hp / x.hpMax) - (y.hp / y.hpMax) + (Math.random() - .5) * .45)[0]
        : P;
      const w = chooseWep(A, D);
      if (!w) { bl(esc(uname(A)) + ' — 사용 가능한 병장이 없다. 회피에 전념.', 'mis'); await sleep(150); continue; }
      if (w.en) A.en -= w.en;
      if (w.am) w.ammo--;

      paintBoard(P, foes, A);
      paintDuel(A, D, w, 0, 'aim');
      await sleep(260);

      const adv = hitAdv(A, D, w), cn = critNeed(A, D, w);
      const ra = r2(), rd = r2(), mg = (ra.t + adv) - rd.t;
      const hit = mg >= 0, crit = hit && mg >= cn;
      const head = '<span class="' + (A.side === 'p' ? 'cy' : 'mg') + '">' + esc(uname(A)) + '</span> ' + esc(w.n) +
        ' <span class="dm">[' + ra.a + '+' + ra.b + (adv >= 0 ? '+' : '') + adv + '=' + (ra.t + adv) + ' vs ' + rd.a + '+' + rd.b + '=' + rd.t + ']</span>';

      if (!hit) {
        bl(head + ' → <span class="dm">' + esc(uname(D)) + ' 회피!</span>', 'mis');
        D.mor = clamp(D.mor + 1, 50, 150);
        paintDuel(A, D, w, 0, 'miss');
        await sleep(260); continue;
      }
      const dmg = Math.round(calcDmg(A, D, w) * (crit ? 1.45 : 1));
      D.hp = Math.max(0, D.hp - dmg);
      A.mor = clamp(A.mor + 1 + Math.floor(A.st.spi / 8), 50, 150);
      D.mor = clamp(D.mor + 2, 50, 150);
      bl(head + ' → ' + (crit ? '<b>CRITICAL!</b> ' : '') + esc(uname(D)) + '에게 <b>' + cm(dmg) +
        '</b> 데미지 <span class="dm">(잔여 ' + cm(D.hp) + ')</span>', crit ? 'crt' : 'hit');
      paintDuel(A, D, w, dmg, crit ? 'crit' : 'hit');
      paintBoard(P, foes, A);
      await sleep(crit ? 400 : 290);

      if (D.hp <= 0) {
        bl('▶ ' + esc(uname(D)) + ' <b>격추!</b>', 'dwn');
        A.mor = clamp(A.mor + 3, 50, 150);
        if (D.side === 'e') foes.filter(f => f.hp > 0).forEach(f => f.mor = clamp(f.mor + 5, 50, 150));
        paintBoard(P, foes, A);
        await sleep(380);
      }
    }
    round++;
    await sleep(140);
  }

  if (P.hp <= 0) result = 'lose';
  else if (foes.every(f => f.hp <= 0)) result = 'win';
  cur().hp = Math.max(1, P.hp);

  const downed = foes.filter(f => f.hp <= 0);
  let pay = 0, exp = 0;
  downed.forEach(f => { pay += f.pay; exp += f.exp; });
  g.kills += downed.length; g.sorties++;
  await sleep(280);

  if (result === 'win') {
    pay += ms.pay; exp += ms.exp; g.wins++; g.fame += 2 + RIDX[ms.pool[ms.pool.length - 1]] * 2;
    if (ms.boss && !g.flags.bossDown) { g.flags.bossDown = true; g.fame += 30; }
    bl('■ 임무 완수 — 전 목표 격파', 'win');
  } else if (result === 'lose') {
    g.losses++; g.downs++;
    const pen = Math.round(g.cash * 0.1);
    g.cash = Math.max(0, g.cash - pen); pay = Math.round(pay * 0.4);
    bl('■ 기체 대파 — 긴급 사출. 수복 부담금 ' + cm(pen) + 'C 청구', 'lose');
  } else {
    pay = Math.round(pay * 0.7);
    bl('■ 교전 시간 초과 — 양측 철수', 'sys');
  }
  pay = Math.round(pay * FACTIONS[g.fac].pay);
  g.cash += pay;
  g.lvupNote = [];
  gainExp(exp);
  g.records.unshift({ day: g.day, m: ms.n, r: result, kills: downed.length, pay: pay, exp: exp, hp: Math.round(cur().hp / uStat(cur()).hpMax * 100) });
  g.records = g.records.slice(0, 40);
  save();

  bl('　');
  bl('획득 자금 <b class="ye">' + cm(pay) + 'C</b> / 경험치 <b class="ye">' + cm(exp) + '</b> / 격추 <b class="ye">' + downed.length + '</b>', 'sys');
  (g.lvupNote || []).forEach(t => bl('★ ' + t, 'win'));

  S.busy = false;
  S.res = { r: result, pay: pay, exp: exp, kills: downed.length, n: ms.n, lv: (g.lvupNote || []).slice() };
  renderAll();
}

function buildFoes(ms) {
  const out = [], df = ms.diff || 1;
  const poolOf = rar => UNITS.filter(u => u.rar === rar && u.w.length);
  for (let i = 0; i < ms.cnt - (ms.ace ? 1 : 0); i++) {
    const rar = pick(ms.pool);
    const p = poolOf(rar); if (!p.length) continue;
    out.push(mkFoe(pick(p), g.lv, false, false, 0, df));
  }
  if (ms.ace) {
    const p = poolOf(ms.ace);
    if (p.length) {
      const b = ms.boss ? p.slice().sort((a, c) => (c.hp + c.atk * 4) - (a.hp + a.atk * 4))[rint(0, Math.min(4, p.length - 1))] : pick(p);
      out.push(mkFoe(b, g.lv, true, !!ms.boss, 0, df));
    }
  }
  return out.length ? out : [mkFoe(pick(UNITS), g.lv, false, false, 0, df)];
}
