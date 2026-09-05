
/* =========================================================================
   G-Over World — 2d6 대항판정 MS 파일럿 육성 시뮬레이션
   기체 제원 : GGen Eternal Database
   ========================================================================= */
const UMAP = {}; UNITS.forEach(u => UMAP[u.id] = u);
/* 작품(시리즈) 목록 — 암시장·도감 필터에 쓴다 */
const SERIES_LIST = [...new Set(UNITS.map(u => u.sr).filter(Boolean))].sort();
/* 등급은 화면에 전혀 나오지 않는다. 적 편성 풀을 나누는 내부 키로만 남는다. */
const RIDX = { N: 0, R: 1, SR: 2, SSR: 3, UR: 4 };

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

/* =========================================================================
   캐릭터 능력치
   사격 / 격투 / 수비 / 반응 / 각성 / 정신 — 각 999 상한.
   '방어'는 '수비'로 이름만 바꾼 같은 능력치, '기량'은 폐지하고 '각성'으로 대체한다.
   ========================================================================= */
const STN = { sho: '사격', mel: '격투', def: '수비', rea: '반응', awk: '각성', spi: '정신' };
const STK = ['sho', 'mel', 'def', 'rea', 'awk', 'spi'];
const STAT_MAX = 999;
const LV_MAX = 999;
const START_PT = 120;   /* 생성 시 자율 분배 총합 */
const LVUP_PT = 5;      /* 레벨업 1회당 분배 포인트.
                           2~999 레벨 = 998회 × 5 = 4,990 + 초기 120 = 5,110.
                           6능력치 만렙 합계 5,994 에 못 미치므로
                           레벨업만으로는 전 능력치 999 를 채울 수 없다. */
const AWK_FORESEE = 800;  /* 미래 예측 발동 하한 */
const AWK_FORESEE_P = 0.05;
const AWK_RANGE_CAP = 13; /* 각성 무장 사거리 상한 */

const STAT_DESC = {
  sho: '사격 병장의 명중과 화력.',
  mel: '격투 병장의 명중과 화력.',
  def: '피탄 시 장갑 환산치. 받는 피해를 줄인다.',
  rea: '회피 · 거리 싸움 · 적 발견에 관여한다.',
  awk: '각성 무장의 명중 · 회피 · 사거리. 800 이상이면 미래 예측이 발동한다.',
  spi: '전투 개시 기력과 기력 상승폭.'
};

/* 훈련 성공 확률 — 능력치 구간별 차등. 400 이상은 1% 고정, 상한은 없다. */
const TRAIN_TIER = [
  { lo: 0,   p: 0.90, up: 4 },
  { lo: 50,  p: 0.70, up: 3 },
  { lo: 100, p: 0.50, up: 3 },
  { lo: 150, p: 0.35, up: 2 },
  { lo: 200, p: 0.22, up: 2 },
  { lo: 250, p: 0.14, up: 1 },
  { lo: 300, p: 0.08, up: 1 },
  { lo: 350, p: 0.04, up: 1 },
  { lo: 400, p: 0.01, up: 1 }
];
const trainTier = v => { let t = TRAIN_TIER[0]; TRAIN_TIER.forEach(x => { if (v >= x.lo) t = x; }); return t; };
const TRAIN_AP = 1;

/* 캐릭터 스킬 — 훈련소에서 자금으로 구매한다.
   ※ 스킬 목록은 추후 추가 예정. 여기에 항목을 넣으면 그대로 상점에 뜬다.
      { k:'고유키', n:'표시명', c:비용, d:'설명', f:전투보정 } */
const CSKILL = [];
const CSKMAP = {}; CSKILL.forEach(s => CSKMAP[s.k] = s);

/* =========================================================================
   전장 · 지형 적성
   적성 2 = ○ (제원 100%) / 1 = △ (공격·기동 85%) / 0 = 출격 불가
   ========================================================================= */
const TER_ORDER = ['sp', 'ai', 'gr', 'se', 'uw'];
const TERRAIN = {
  sp: { n: '우주', d: '무중력 공역에서의 기동전.' },
  ai: { n: '공중', d: '대기권 내 공중전.' },
  gr: { n: '지상', d: '지표면에서의 진지전.' },
  se: { n: '수상', d: '해면상 전투.' },
  uw: { n: '수중', d: '수중 전투.' }
};
const ADAPT_MARK = ['×', '△', '○'];
const terMul = a => a >= 2 ? 1 : 0.85;   /* △ 는 공격·기동 85% */

/* 지형 적성 파츠 — 해당 지형 적성을 1단계 올린다(× → △ → ○).
   같은 파츠를 두 번 달면 × 에서 ○ 까지 끌어올릴 수 있다. */
const PART_SLOT = 2;
const PARTS = {};
TER_ORDER.forEach(k => PARTS[k] = { t: k, n: TERRAIN[k].n + ' 항행 유닛', d: TERRAIN[k].n + ' 적성 1단계 상승' });

/* 기체 개조 */
const MOD = {
  hp:  { n: '구조 강화',  u: '최대 HP +5%',  s: 'hp' },
  en:  { n: '제네레이터', u: '최대 EN +5%',  s: 'en' },
  def: { n: '장갑 증설',  u: '방어 +5%',     s: 'def' },
  mob: { n: '스러스터',   u: '기동 +5%',     s: 'mob' },
  atk: { n: '화력 관제',  u: '공격 +5%',     s: 'atk' },
  sct: { n: '색적 장치',  u: '색적 +5%',     s: 'sct' }
};
const MODMAX = 10;

/* 기체 제원 상한 (#20~#22) */
const UCAP = { hp: 999999, en: 999, atk: 9999, def: 9999, mob: 9999, sct: 9999 };

/* =========================================================================
   전투 밸런스 계수
   ========================================================================= */
const ROUND_CAP = 24;
const DMG_K = 3.0;
const FOE_HP  = { mob: 0.38, elite: 0.52, boss: 0.88 };
const FOE_DMG = 0.55;         /* 적 → 아군 피해 계수. 플레이어는 에이스이므로 한 방에 무너지지 않는다 */
const ATK_STAT_K = 0.00167;   /* 사격·격투 1점당 화력 상승률 (999 → ×2.67) */
const DEF_STAT_K = 0.0015;    /* 수비 1점당 장갑 상승률. 화력보다 낮게 두어 교착을 막는다 */
const HIT_CLAMP = 6;          /* 명중 우열 상한. 확정 명중·확정 회피를 만들지 않는다 */
/* 명중식의 항 간 비중. 능력치가 0~999 로 넓어졌으므로 나눗수로 눌러 준다.
   기체 기동(회피)이 파일럿 능력을 압도하지 않도록 MOB_EVA_K 를 크게 잡는다. */
const STAT_HIT_K = 6;
const MOB_EVA_K = 350;
const EN_REGEN = 0.10;        /* 매 라운드 최대 EN 의 10% 자동 회복 */

/* 거리 (#12) — 무장 사거리보다 넓은 개념. 1(밀착) ~ 20(초장거리) */
const DIST_MIN = 1, DIST_MAX = 20;
const RANGE_MUL = 2;          /* 원본 사거리 1~5 를 거리축 1~10 으로 편다 */

const MISSION = [
  { id: 'ptrl',  n: '초계 임무',      ap: 1, lv: 1,  pool: ['N', 'N', 'R'],        cnt: 2, diff: 0.80, pay: 9000,   exp: 26,   d: '경계 공역을 순찰한다. 소규모 적과 조우.' },
  { id: 'swp',   n: '소탕전',         ap: 2, lv: 3,  pool: ['R', 'R', 'SR'],       cnt: 3, diff: 0.85, pay: 27000,  exp: 78,   d: '잔존 부대를 쓸어낸다. 정예가 섞인다.' },
  { id: 'base',  n: '거점 공략',      ap: 2, lv: 7,  pool: ['SR', 'SR', 'SSR'],    cnt: 4, diff: 0.95, pay: 64000,  exp: 190,  d: '방어선을 돌파한다. 화력 지원기가 다수.' },
  { id: 'itcp',  n: '에이스 요격',    ap: 3, lv: 12, pool: ['SSR', 'SSR'],         cnt: 3, ace: 'UR', diff: 1.00, pay: 155000, exp: 460, d: '적 에이스기를 요격한다. 기동이 극도로 높다.' },
  { id: 'final', n: '결전 · 기함 요격', ap: 4, lv: 18, pool: ['SSR', 'UR', 'UR'], cnt: 4, ace: 'UR', boss: true, diff: 1.20, pay: 430000, exp: 1500, d: '적 기함급 지휘기를 격파한다. 전선의 향방이 걸려 있다.' }
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
  { p: 12, f: g => { const k = pick(STK); g.st[k] = Math.min(STAT_MAX, g.st[k] + 1); return '교관의 지도로 <b class="li">' + STN[k] + '</b>이(가) 1 상승했다.'; } },
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
const SAVEKEY = 'gover.world.v4';
const AP_BASE = 10;              /* 일일 행동력 기본값 */
const START_CASH = 80000;
const REPAIR_RATE = 0.16;
let g = null;
const S = {
  view: 'main', busy: false, skip: false, msg: null, res: null,
  tac: 'norm', ter: 'sp', bookSr: '', bookSel: '', bookQ: ''
};
const $ = id => document.getElementById(id);
const cur = () => g.garage[g.cur];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---- 가격 체계 — 등급이 아니라 제원 총합으로 정한다 (#18) ---- */
const uPow = B => Math.round(B.hp * 0.55 + (B.atk * 3 + B.def * 2.2 + B.mob * 2.2 + (B.sct || 0) * 1.6) * 22 + B.en * 140);
const buyPrice = B => Math.round(Math.pow(uPow(B) / 1000, 1.6) * 90 * (B.lg ? 1.1 : 1) / 100) * 100;
const lvReqOf = B => clamp(Math.round((uPow(B) - 100000) / 12000), 1, 40);
const modCost = (B, lv) => Math.round(buyPrice(B) * 0.045 * Math.pow(1.34, lv) / 100) * 100;
const wlCost = (B, lv) => Math.round(buyPrice(B) * 0.05 * lv / 100) * 100;
const partCost = B => Math.round(buyPrice(B) * 0.10 / 1000) * 1000;

function mkOwned(id) {
  const B = UMAP[id];
  return { id: id, hp: B.hp, mod: { hp: 0, en: 0, def: 0, mob: 0, atk: 0, sct: 0 }, wl: B.w.map(() => 1), pt: [] };
}
function newGame(nm, st, unitId) {
  g = {
    name: nm, lv: 1, exp: 0, pt: 0, cash: START_CASH, ap: AP_BASE, apMax: AP_BASE, day: 1,
    mor0: 100 + Math.floor((st.spi || 0) / 25),
    st: st, sk: [], kills: 0, sorties: 0, wins: 0, losses: 0, downs: 0, fame: 0,
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
    if (!g.sk) g.sk = [];
    g.pt = g.pt | 0;
    g.garage = g.garage.filter(v => UMAP[v.id]);
    g.garage.forEach(v => { if (!v.pt) v.pt = []; if (!v.mod.sct) v.mod.sct = 0; });
    g.cur = clamp(g.cur | 0, 0, g.garage.length - 1);
    return true;
  } catch (e) { return false; }
}
function stamp(t) { const e = $('saveInfo'); if (e) e.textContent = t; }

/* =========================================================================
   파생 수치
   ========================================================================= */
/* 파츠를 포함한 실제 지형 적성 */
function adaptOf(v, k) {
  const B = UMAP[v.id];
  const add = (v.pt || []).filter(x => x === k).length;
  return clamp((B.tr ? B.tr[k] : 0) + add, 0, 2);
}
const adaptBase = (B, k) => (B.tr ? B.tr[k] : 0);
const canSortie = (v, k) => adaptOf(v, k) > 0;

function uStat(v) {
  const B = UMAP[v.id], m = v.mod;
  const cap = (x, k) => Math.min(UCAP[k], Math.round(x));
  return {
    B: B,
    hpMax: cap(B.hp * (1 + m.hp * 0.05), 'hp'),
    enMax: cap(B.en * (1 + m.en * 0.05), 'en'),
    def: cap(B.def * (1 + m.def * 0.05), 'def'),
    mob: cap(B.mob * (1 + m.mob * 0.05), 'mob'),
    atk: cap(B.atk * (1 + m.atk * 0.05), 'atk'),
    sct: cap((B.sct || 0) * (1 + (m.sct || 0) * 0.05), 'sct'),
    modSum: Object.keys(MOD).reduce((a, k) => a + (m[k] | 0), 0)
  };
}
const wpowOf = (v, i) => { const w = UMAP[v.id].w[i]; const lv = clamp((v.wl && v.wl[i]) || 1, 1, w.pw.length); return w.pw[lv - 1]; };
const wpMax = (v, i) => UMAP[v.id].w[i].pw.length;
const morB = u => clamp(Math.floor((u.mor - 100) / 10), -4, 5);
const morP = u => 1 + (u.mor - 100) * 0.005;
const expNeed = lv => Math.round(100 * Math.pow(lv, 1.45));
const wIsMelee = w => (w.tp || 'S').indexOf('M') >= 0;
/* 각성 무장 — '특수' 속성을 가진 병장. 각성 능력치가 0 이면 아예 쓸 수 없다. */
const wIsAwk = w => (w.at || '').indexOf('특수') >= 0;
const statTotal = () => STK.reduce((a, k) => a + (g.st[k] | 0), 0);

function gainExp(n) {
  g.exp += n; g.lvupNote = g.lvupNote || [];
  while (g.lv < LV_MAX && g.exp >= expNeed(g.lv)) {
    g.exp -= expNeed(g.lv); g.lv++;
    g.pt += LVUP_PT;
    g.cash += 4000;
    if (g.lv % 4 === 0) g.apMax++;
    g.lvupNote.push('LEVEL ' + g.lv + ' — 능력 포인트 +' + LVUP_PT + ' / 자금 +4,000' + (g.lv % 4 === 0 ? ' / 행동력 상한 +1' : ''));
  }
  if (g.lv >= LV_MAX) g.exp = 0;
}

/* =========================================================================
   전투 유닛 구성
   ========================================================================= */
/* 각성 능력치는 전투 중 일시 보정(장비·스킬·효과)까지 합산해 본다.
   그 합이 800 을 넘긴 턴에는 미래 예측이 발동할 수 있다. (#1) */
const awkOf = u => clamp((u.st.awk | 0) + (u.awkTmp | 0), 0, STAT_MAX);

function wRange(u, w) {
  const mn = Math.max(1, (w.mn | 0) * RANGE_MUL - 1);
  let mx = Math.max(mn, (w.mx | 0) * RANGE_MUL);
  if (wIsAwk(w)) mx = Math.min(AWK_RANGE_CAP, mx + Math.floor(awkOf(u) / 100));
  return { mn: mn, mx: mx };
}
const inRange = (u, w, d) => { const r = wRange(u, w); return d >= r.mn && d <= r.mx; };

function mkPlayer(tac, ter) {
  const v = cur(), s = uStat(v), B = s.B, T = TACTIC[tac];
  const ad = adaptOf(v, ter), tm = terMul(ad);
  return {
    side: 'p', id: B.id, nm: B.nm, mdl: B.mdl, img: B.img, th: B.th, large: B.lg,
    hp: v.hp, hpMax: s.hpMax, en: s.enMax, enMax: s.enMax,
    atk: Math.round(s.atk * tm), def: s.def, mob: Math.round(s.mob * tm), sct: s.sct,
    adapt: ad,
    st: Object.assign({}, g.st), awkTmp: 0, mor: g.mor0,
    pwMul: T.pw, takMul: T.tak, hitMod: T.hit, evaMod: T.eva || 0,
    hidden: false, exposed: false,
    weps: B.w.map((w, i) => ({ i: i, n: w.n, pw: wpowOf(v, i), ac: w.ac, cr: w.cr, en: w.en | 0, am: w.am, ammo: w.am || 0, tp: w.tp, at: w.at, pre: w.pre, mn: w.mn, mx: w.mx }))
  };
}
function mkFoe(B, elite, boss, idx, diff, ter) {
  /* 적 파일럿 능력치는 플레이어의 실제 능력 총합에 맞춰 잡는다.
     공격 능력과 회피 능력을 분리해야 한다. 한 값으로 둘 다 올리면 정예기가
     '절대 안 맞고 절대 안 빗나가는' 무적이 되어 전투가 성립하지 않는다. */
  const base = Math.max(4, Math.round(statTotal() / STK.length * 0.92));
  const off = Math.round(base * (boss ? 1.45 : elite ? 1.10 : 1.00));
  const eva = Math.round(base * (boss ? 1.05 : elite ? 1.00 : 0.86));
  const wl = clamp(1 + Math.floor(g.lv / 5), 1, 5);
  const hpm = boss ? FOE_HP.boss : elite ? FOE_HP.elite : FOE_HP.mob;
  const atm = diff || 1;
  const ad = adaptBase(B, ter), tm = terMul(ad);
  return {
    side: 'e', id: B.id, nm: B.nm, mdl: B.mdl, rar: B.rar, img: B.img, th: B.th, large: B.lg, idx: idx,
    tag: boss ? '지휘기' : elite ? '에이스' : '',
    hp: Math.round(B.hp * hpm), hpMax: Math.round(B.hp * hpm),
    en: B.en, enMax: B.en,
    /* 지휘기·에이스는 HP 로 버티게 하는 대신 화력을 올린다.
       HP 를 키우면 24라운드 안에 결판이 안 나 무승부만 늘어난다. */
    atk: Math.round(B.atk * atm * tm * (boss ? 1.45 : 1)),
    def: Math.round(B.def * (boss ? 1.15 : 1)), mob: Math.round(B.mob * tm), sct: B.sct || 0,
    adapt: ad,
    st: { sho: off, mel: off, def: Math.round(base * 0.9), rea: eva, awk: Math.round(base * (boss ? 1.1 : elite ? 0.8 : 0.4)), spi: Math.round(base * 0.5) },
    awkTmp: 0,
    mor: elite || boss ? 110 : 100,
    pwMul: 1, takMul: 1, hitMod: 0, evaMod: 0,
    hidden: false, exposed: false,
    weps: B.w.map((w, i) => ({ i: i, n: w.n, pw: w.pw[clamp(wl, 1, w.pw.length) - 1], ac: w.ac, cr: w.cr, en: w.en | 0, am: w.am, ammo: (w.am || 0) * 3, tp: w.tp, at: w.at, pre: w.pre, mn: w.mn, mx: w.mx })),
    pay: Math.round(buyPrice(B) * 0.05 * (boss ? 4 : elite ? 2 : 1)),
    exp: Math.round((10 + RIDX[B.rar] * 26) * (boss ? 5 : elite ? 2.5 : 1)),
    boss: !!boss
  };
}
const uname = u => u.nm + (u.tag ? ' 〈' + u.tag + '〉' : '') + (u.idx > 0 ? ' #' + (u.idx + 1) : '');

/* ---- 판정 ---- */
/* EN 이 0 이면 어떤 병장도 쓸 수 없다 (#23). 각성이 0 이면 각성 무장을 쓸 수 없다 (#1). */
function usable(u, w) {
  if (u.en <= 0) return false;
  if (w.en && u.en < w.en) return false;
  if (w.am && w.ammo <= 0) return false;
  if (wIsAwk(w) && awkOf(u) < 1) return false;
  return true;
}
const armed = (u, d) => u.weps.some(w => usable(u, w) && inRange(u, w, d));

function calcDmg(A, D, w) {
  const stat = wIsMelee(w) ? A.st.mel : A.st.sho;
  const atkv = A.atk * (1 + stat * ATK_STAT_K) * morP(A) * A.pwMul;
  const defv = D.def * (1 + D.st.def * DEF_STAT_K) * (1 + (D.mor - 100) * 0.002);
  let d = w.pw * (atkv / Math.max(1, defv)) * DMG_K * D.takMul * (D.desperate ? 1.12 : 1);
  if (A.side === 'e') d *= FOE_DMG;
  if (D.large) d *= 1.06;
  return Math.max(200, Math.round(d / 10) * 10);
}
/* 명중 우열. 색적 차이가 최종 명중률에 보정되고(#11), 각성 무장은 각성 수치가
   공격 측 명중과 방어 측 회피 양쪽에 붙는다(#1).
   양극단에서 전투가 교착되지 않도록 최종 우열은 ±HIT_CLAMP 로 묶는다. */
function hitAdv(A, D, w) {
  const stat = wIsMelee(w) ? A.st.mel : A.st.sho;
  const acc = Math.round(((w.ac || 100) - 100) / 8);
  const aw = wIsAwk(w) ? 1 : 0;
  const sct = clamp(Math.floor((A.sct - D.sct) / 250), -3, 3);
  const off = Math.floor(stat / STAT_HIT_K) + morB(A) + A.hitMod + acc + sct + (aw ? Math.floor(awkOf(A) / 100) : 0);
  const dfn = Math.floor(D.st.rea / STAT_HIT_K) + morB(D) + Math.floor(D.mob / MOB_EVA_K) + (D.evaMod || 0)
    + (aw ? Math.floor(awkOf(D) / 100) : 0) + (D.large ? -1 : 0) + (D.desperate ? -2 : 0);
  return clamp(off - dfn, -HIT_CLAMP, HIT_CLAMP);
}
const critNeed = (A, D, w) => clamp(9 - Math.floor((wIsMelee(w) ? A.st.mel : A.st.sho) / 60) + Math.floor(D.st.rea / 90) - Math.round((w.cr || 0) / 5), 3, 12);

/* 미래 예측 (#1) — 각성 800 이상일 때 5% */
const foresee = u => awkOf(u) >= AWK_FORESEE && Math.random() < AWK_FORESEE_P;

function chooseWep(A, D, dist) {
  let best = null;
  A.weps.forEach(w => {
    if (!usable(A, w) || !inRange(A, w, dist)) return;
    const sc = oppP(hitAdv(A, D, w)) * calcDmg(A, D, w);
    if (!best || sc > best.sc) best = { w: w, sc: sc };
  });
  return best && best.w;
}

/* =========================================================================
   거리 · 색적
   ========================================================================= */
/* 거리 조정 속도 — 기체 기동과 파일럿 반응에서 나온다 (#12) */
const mvSpd = u => clamp(2 + Math.floor(u.mob / 300) + Math.floor(u.st.rea / 120), 2, 9);

/* 자기 병장이 닿는 구간 중 현재 거리에서 가장 가까운 지점 */
function wantBand(u) {
  let lo = null, hi = null;
  u.weps.forEach(w => {
    if (!usable(u, w)) return;
    const r = wRange(u, w);
    if (lo === null || r.mn < lo) lo = r.mn;
    if (hi === null || r.mx > hi) hi = r.mx;
  });
  return lo === null ? null : { lo: lo, hi: hi };
}
/* -1 접근 / 0 유지 / +1 이탈 */
function wantDir(u, dist, iCan, foeCan) {
  if (iCan && !foeCan) return 0;              /* 우위 — 이 사거리를 최대한 유지한다 */
  const b = wantBand(u);
  if (!b) return foeCan ? 1 : 0;              /* 쓸 병장이 없다 — 일단 벌린다 */
  if (dist < b.lo) return 1;
  if (dist > b.hi) return -1;
  return 0;
}

/* 적 발견 판정 — 색적이 높을수록, 상대 기동·반응이 낮을수록 먼저 본다 */
const spotBon = u => Math.floor(u.sct / 100) + Math.floor(u.st.rea / 40);
const hideBon = u => Math.floor(u.mob / 220) + Math.floor(u.st.rea / 40);

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
  const er = u.enMax > 0 ? clamp(u.en / u.enMax, 0, 1) : 0;
  return '<div class="bu' + (u.hp <= 0 ? ' dead' : '') + (u.hidden ? ' hid' : '') + (sameUnit(u, actor) ? ' act' : '') + '">' +
    '<img class="ui s" src="' + (u.th || u.img) + '" alt="" decoding="async">' +
    '<div class="bm"><div class="bn">' + esc(uname(u)) + (u.hidden ? ' <span class="dm">[로스트]</span>' : '') + '</div>' +
    '<div class="gg bg"><i class="' + w + '" style="width:' + (r * 100) + '%"></i>' +
    '<span>HP ' + cm(u.hp) + ' / ' + cm(u.hpMax) + '</span></div>' +
    '<div class="gg bg"><i class="en" style="width:' + (er * 100) + '%"></i>' +
    '<span>EN ' + cm(u.en) + ' / ' + cm(u.enMax) + '</span></div></div></div>';
}
function paintBoard(P, foes, actor, dist, ter) {
  S.board =
    '<div class="bcol"><h4>OWN FORCE</h4>' + buCard(P, actor) + '</div>' +
    '<div class="bcol"><h4>HOSTILE — ' + foes.filter(f => f.hp > 0).length + ' / ' + foes.length + '</h4>' +
    foes.map(f => buCard(f, actor)).join('') + '</div>';
  const b = $('bboard'); if (b) b.innerHTML = S.board;
  if (dist != null) {
    S.dist = '<span class="dm">전장</span> <b class="cy">' + TERRAIN[ter].n + '</b>' +
      ' <span class="dm">│ 교전 거리</span> <b class="ye">' + dist + '</b> <span class="dm">/ ' + DIST_MAX + '</span>' +
      '<div class="dbar"><i style="left:' + ((dist - 1) / (DIST_MAX - 1) * 100) + '%"></i></div>';
    const d = $('dist'); if (d) d.innerHTML = S.dist;
  }
}

/* 교전 표시부 — 공격기와 피격기의 초상화를 나란히 띄운다.
   kind : 'aim' 조준 / 'miss' 회피 / 'hit' 명중 / 'crit' 크리티컬 / 'fore' 미래 예측 */
function paintDuel(A, D, w, dmg, kind, note) {
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
          (right ? 'HP ' + cm(u.hp) + ' / ' + cm(u.hpMax) : esc(w.n)) + '</div>' +
        '<div class="dw dm">EN ' + cm(u.en) + ' / ' + cm(u.enMax) + '</div>' +
      '</div></div>';
  S.duel = side(A, false) + '<div class="mid">' + mid +
    (note ? '<div class="fore">' + note + '</div>' : '') + '</div>' + side(D, true);
  const el = $('duel'); if (el) el.innerHTML = S.duel;
}

async function runBattle(ms, tac, ter) {
  S.view = 'battle'; S.busy = true; S.skip = false; S.res = null;
  S.blog = []; S.board = ''; S.duel = ''; S.dist = '';
  renderAll();

  const P = mkPlayer(tac, ter);
  const foes = buildFoes(ms, ter);
  const nameCount = {};
  foes.forEach(f => nameCount[f.nm] = (nameCount[f.nm] || 0) + 1);
  const seen = {};
  foes.forEach(f => { f.idx = nameCount[f.nm] > 1 ? (seen[f.nm] = (seen[f.nm] || 0) + 1) - 1 : 0; });

  let dist = rint(DIST_MIN, DIST_MAX);
  paintBoard(P, foes, null, dist, ter);

  bl('━━ <b>' + ms.n + '</b> ━━ <span class="dm">전장 ' + TERRAIN[ter].n + '</span>', 'sys');
  bl('전법 ' + TACTIC[tac].n + ' / 탑승기 ' + P.nm + ' <span class="dm">(' + P.mdl + ')</span>' +
    ' <span class="' + (P.adapt >= 2 ? 'li' : 'ye') + '">지형 적성 ' + ADAPT_MARK[P.adapt] + (P.adapt < 2 ? ' — 공격·기동 85%' : '') + '</span>', 'sys');
  bl('적 편성 ' + foes.map(f => uname(f)).join(' , '), 'sys');
  bl('조우 거리 <b class="ye">' + dist + '</b> — ' + (armed(P, dist) ? '사거리 내' : '<span class="rd">사거리 밖</span>'), 'sys');

  /* 선제 발견 — 이긴 쪽이 선공권을 잡는다 (#12) */
  const lead = foes.slice().sort((a, b) => spotBon(b) - spotBon(a))[0] || foes[0];
  const pr = r2().t + spotBon(P), er = r2().t + spotBon(lead);
  let pFirst = pr >= er;
  bl('색적 판정 — 아군 ' + pr + ' vs 적 ' + er + ' → <b class="' + (pFirst ? 'cy' : 'mg') + '">' +
    (pFirst ? '아군이 먼저 포착. 선공권 획득' : '적이 먼저 포착. 선공권을 내주었다') + '</b>', 'sys');
  await sleep(420);

  let round = 1, result = 'draw';
  while (round <= ROUND_CAP) {
    if (P.hp <= 0 || foes.every(f => f.hp <= 0)) break;
    const live = () => foes.filter(f => f.hp > 0);
    bl('── ROUND ' + round + ' ──', 'rnd');

    /* 1) EN 자동 회복 (#23) */
    [P].concat(live()).forEach(u => { u.en = Math.min(u.enMax, u.en + Math.ceil(u.enMax * EN_REGEN)); });

    /* 2) 거리 싸움 — 공격 수단이 없는 쪽은 수비를 희생해서라도 사거리를 잡으러 간다 */
    const pCan = armed(P, dist);
    const eCan = live().some(f => armed(f, dist));
    P.desperate = !pCan && eCan;
    live().forEach(f => f.desperate = !armed(f, dist) && pCan);
    const pDir = wantDir(P, dist, pCan, eCan);
    const fLead = live().slice().sort((a, b) => mvSpd(b) - mvSpd(a))[0];
    const eDir = fLead ? wantDir(fLead, dist, eCan, pCan) : 0;
    if (fLead && (pDir || eDir)) {
      let step, who;
      if (pDir === eDir) {
        /* 양쪽 다 같은 방향을 원한다 — 서로 달려드는 셈이라 거리가 빠르게 줄어든다 */
        step = pDir * (1 + Math.floor((mvSpd(P) + mvSpd(fLead)) / 4));
        who = '<span class="dm">양측</span>';
      } else {
        const pRoll = r2().t + mvSpd(P) + (P.desperate ? 2 : 0);
        const eRoll = r2().t + mvSpd(fLead) + (fLead.desperate ? 2 : 0);
        const win = pRoll >= eRoll;
        step = (win ? pDir : eDir) * (1 + Math.floor(Math.abs(pRoll - eRoll) / 4));
        who = (win ? '<span class="cy">아군</span>' : '<span class="mg">적</span>') +
          ' <span class="dm">[' + pRoll + ' vs ' + eRoll + ']</span>';
      }
      const nd = clamp(dist + step, DIST_MIN, DIST_MAX);
      if (nd !== dist) {
        bl('거리 조정 — ' + who + '이(가) 주도. ' + dist + ' → <b class="ye">' + nd + '</b>', 'dst');
        dist = nd;
      }
    }
    if (P.desperate) bl('사거리 밖 — 아군기가 <b class="rd">수비를 버리고</b> 거리를 좁힌다. (회피 −2 / 받는 피해 +12%)', 'dst');

    /* 3) 색적 — 시야에서 사라지거나, 다시 잡아낸다 (#11) */
    live().forEach(f => {
      if (f.hidden) {
        const a = r2().t + spotBon(P), b = r2().t + hideBon(f);
        if (a >= b) { f.hidden = false; bl('<span class="cy">재포착</span> — ' + esc(uname(f)) + '을(를) 다시 잡았다.', 'sct'); }
      } else if (!f.exposed && Math.random() < clamp(0.08 + (hideBon(f) - spotBon(P)) * 0.03, 0.02, 0.38)) {
        f.hidden = true; bl('<span class="dm">로스트</span> — ' + esc(uname(f)) + '이(가) 사각으로 빠졌다.', 'sct');
      }
      f.exposed = false;
    });
    if (P.hidden) {
      const sk = live().slice().sort((a, b) => spotBon(b) - spotBon(a))[0];
      if (sk) { const a = r2().t + spotBon(sk), b = r2().t + hideBon(P); if (a >= b) { P.hidden = false; bl('<span class="mg">적에게 재포착되었다.</span>', 'sct'); } }
    } else if (!P.exposed && live().length && Math.random() < clamp(0.08 + (hideBon(P) - spotBon(live().slice().sort((a, b) => spotBon(b) - spotBon(a))[0])) * 0.03, 0.02, 0.38)) {
      P.hidden = true; bl('<span class="li">아군기가 적의 사각으로 빠져나갔다.</span>', 'sct');
    }
    P.exposed = false;
    paintBoard(P, foes, null, dist, ter);
    await sleep(220);

    /* 4) 행동 순서 — 1라운드는 선제 발견한 쪽이 먼저 */
    let order = [P].concat(live())
      .map(u => ({ u: u, i: u.mob + u.sct * 0.6 + (u.weps.some(w => w.pre) ? 900 : 0) + d6() * 320 }))
      .sort((a, b) => b.i - a.i).map(o => o.u);
    if (round === 1) {
      order = order.slice().sort((a, b) => {
        const ka = (a.side === 'p') === pFirst ? 0 : 1, kb = (b.side === 'p') === pFirst ? 0 : 1;
        return ka - kb;
      });
    }

    for (const A of order) {
      if (A.hp <= 0 || P.hp <= 0 || foes.every(f => f.hp <= 0)) continue;
      /* 숨은 상대는 때릴 수 없다 */
      const cand = (A.side === 'p' ? live().filter(f => !f.hidden) : (P.hidden ? [] : [P]));
      if (!cand.length) {
        bl(esc(uname(A)) + ' — 표적을 잡지 못했다. <span class="dm">색적에 전념.</span>', 'mis');
        await sleep(140); continue;
      }
      const D = A.side === 'p'
        ? cand.slice().sort((x, y) => (x.hp / x.hpMax) - (y.hp / y.hpMax) + (Math.random() - .5) * .45)[0]
        : P;
      const w = chooseWep(A, D, dist);
      if (!w) {
        bl(esc(uname(A)) + ' — 거리 ' + dist + '에서 <span class="dm">쓸 수 있는 병장이 없다.</span>' +
          (A.en <= 0 ? ' <span class="rd">EN 고갈</span>' : ''), 'mis');
        await sleep(140); continue;
      }
      if (w.en) A.en = Math.max(0, A.en - w.en);
      if (w.am) w.ammo--;
      A.hidden = false; A.exposed = true;      /* 쏘면 위치가 드러난다 */

      paintBoard(P, foes, A, dist, ter);
      paintDuel(A, D, w, 0, 'aim');
      await sleep(240);

      /* 미래 예측 — 공격 측 "거기냣!" 절대 명중 / 방어 측 "보인다!" 절대 회피 */
      const foreA = foresee(A), foreD = !foreA && foresee(D);
      const adv = hitAdv(A, D, w), cn = critNeed(A, D, w);
      const ra = r2(), rd = r2(), mg = (ra.t + adv) - rd.t;
      let hit = mg >= 0;
      if (foreA) hit = true;
      if (foreD) hit = false;
      const crit = hit && (mg >= cn || (foreA && mg >= cn));
      const head = '<span class="' + (A.side === 'p' ? 'cy' : 'mg') + '">' + esc(uname(A)) + '</span> ' + esc(w.n) +
        (wIsAwk(w) ? ' <span class="pk">〔각성〕</span>' : '') +
        ' <span class="dm">[' + ra.a + '+' + ra.b + (adv >= 0 ? '+' : '') + adv + '=' + (ra.t + adv) + ' vs ' + rd.a + '+' + rd.b + '=' + rd.t + ']</span>';

      if (foreA) bl('<b class="pk">「거기냣!」</b> — ' + esc(uname(A)) + ' 미래 예측 발동. <b>절대 명중</b>', 'fore');
      if (foreD) bl('<b class="pk">「보인다!」</b> — ' + esc(uname(D)) + ' 미래 예측 발동. <b>절대 회피</b>', 'fore');

      if (!hit) {
        bl(head + ' → <span class="dm">' + esc(uname(D)) + ' 회피!</span>', 'mis');
        D.mor = clamp(D.mor + 1, 50, 150);
        paintDuel(A, D, w, 0, 'miss', foreD ? '보인다!' : '');
        await sleep(250); continue;
      }
      const dmg = Math.round(calcDmg(A, D, w) * (crit ? 1.45 : 1));
      D.hp = Math.max(0, D.hp - dmg);
      A.mor = clamp(A.mor + 1 + Math.floor(A.st.spi / 100), 50, 150);
      D.mor = clamp(D.mor + 2, 50, 150);
      bl(head + ' → ' + (crit ? '<b>CRITICAL!</b> ' : '') + esc(uname(D)) + '에게 <b>' + cm(dmg) +
        '</b> 데미지 <span class="dm">(잔여 ' + cm(D.hp) + ' / EN ' + cm(A.en) + ')</span>', crit ? 'crt' : 'hit');
      paintDuel(A, D, w, dmg, crit ? 'crit' : 'hit', foreA ? '거기냣!' : '');
      paintBoard(P, foes, A, dist, ter);
      await sleep(crit ? 380 : 280);

      if (D.hp <= 0) {
        bl('▶ ' + esc(uname(D)) + ' <b>격추!</b>', 'dwn');
        A.mor = clamp(A.mor + 3, 50, 150);
        if (D.side === 'e') foes.filter(f => f.hp > 0).forEach(f => f.mor = clamp(f.mor + 5, 50, 150));
        paintBoard(P, foes, A, dist, ter);
        await sleep(360);
      }
    }
    round++;
    await sleep(130);
  }

  if (P.hp <= 0) result = 'lose';
  else if (foes.every(f => f.hp <= 0)) result = 'win';
  cur().hp = Math.max(1, P.hp);

  const downed = foes.filter(f => f.hp <= 0);
  let pay = 0, exp = 0;
  downed.forEach(f => { pay += f.pay; exp += f.exp; });
  g.kills += downed.length; g.sorties++;
  await sleep(260);

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
  g.cash += pay;
  g.lvupNote = [];
  gainExp(exp);
  g.records.unshift({ day: g.day, m: ms.n, t: ter, r: result, kills: downed.length, pay: pay, exp: exp, hp: Math.round(cur().hp / uStat(cur()).hpMax * 100) });
  g.records = g.records.slice(0, 40);
  save();

  bl('　');
  bl('획득 자금 <b class="ye">' + cm(pay) + 'C</b> / 경험치 <b class="ye">' + cm(exp) + '</b> / 격추 <b class="ye">' + downed.length + '</b>', 'sys');
  (g.lvupNote || []).forEach(t => bl('★ ' + t, 'win'));

  S.busy = false;
  S.res = { r: result, pay: pay, exp: exp, kills: downed.length, n: ms.n, t: ter, lv: (g.lvupNote || []).slice() };
  renderAll();
}

/* 전장에 적성이 있는 기체만 편성된다 (#15) */
function buildFoes(ms, ter) {
  const out = [], df = ms.diff || 1;
  const poolOf = rar => UNITS.filter(u => u.rar === rar && u.w.length && adaptBase(u, ter) > 0);
  const any = UNITS.filter(u => u.w.length && adaptBase(u, ter) > 0);
  for (let i = 0; i < ms.cnt - (ms.ace ? 1 : 0); i++) {
    const p = poolOf(pick(ms.pool));
    const src = p.length ? p : any;
    if (src.length) out.push(mkFoe(pick(src), false, false, 0, df, ter));
  }
  if (ms.ace) {
    const p = poolOf(ms.ace), src = p.length ? p : any;
    if (src.length) {
      const b = ms.boss ? src.slice().sort((a, c) => (c.hp + c.atk * 40) - (a.hp + a.atk * 40))[rint(0, Math.min(4, src.length - 1))] : pick(src);
      out.push(mkFoe(b, true, !!ms.boss, 0, df, ter));
    }
  }
  return out.length ? out : [mkFoe(pick(any.length ? any : UNITS), false, false, 0, df, ter)];
}

/* =========================================================================
   암시장 (#18) — 날짜를 시드로 매일 1~10기가 새로 깔린다
   ========================================================================= */
function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function marketOf(day) {
  const rnd = mulberry(day * 2654435761 + 917);
  const n = 1 + Math.floor(rnd() * 10);
  const out = [], used = {};
  let guard = 0;
  while (out.length < n && guard++ < 400) {
    const u = UNITS[Math.floor(rnd() * UNITS.length)];
    if (!u || used[u.id] || !u.w.length) continue;
    used[u.id] = 1;
    /* 암시장가 — 제원 총합에 따라 차등. 날마다 ±12% 흥정폭이 붙는다 */
    out.push({ id: u.id, price: Math.round(buyPrice(u) * (0.88 + rnd() * 0.24) / 100) * 100 });
  }
  return out;
}
