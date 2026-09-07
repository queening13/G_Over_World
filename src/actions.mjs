/* =========================================================================
   G-Over World — 액션 계층

   구식 CGI 의 `index.cgi?mode=xxx` 자리에 해당한다. 클라이언트가 보내는 것은
   '무엇을 하겠다'는 의도뿐이고, 가능한지 판단하고 세이브를 고치는 일은
   전부 여기서 한다. 클라이언트가 보낸 값은 하나도 믿지 않는다.

   applyAction(g, a) → { msg?, res?, battle? }
     msg    상황 안내 박스에 띄울 내용
     res    훈련 결과처럼 화면에 따로 뜨는 판정 결과
     battle 전투가 벌어졌으면 재생용 이벤트 묶음

   모든 핸들러는 동기다. rules.mjs 의 상태 규약을 지키기 위한 것이므로
   여기서도 await 를 쓰지 말 것.
   ========================================================================= */
import * as R from './rules.mjs';

const { clamp, cm, esc } = R;

/* 액션이 거절될 때 던진다. 서버는 400 으로 돌려준다. */
class Reject extends Error {}
const no = m => { throw new Reject(m); };

/* ---- 공통 검증 ---------------------------------------------------------- */
const needAp = (g, n) => { if (g.ap < n) no('행동력이 부족합니다.'); };
const needCash = (g, n) => { if (g.cash < n) no('자금이 부족합니다.'); };
const unit = id => R.UMAP[id] || no('없는 기체입니다.');

/* 정수 맵을 안전하게 받는다 — 키는 화이트리스트, 값은 0 이상 정수 */
function intMap(src, keys) {
  const out = {}; let sum = 0;
  keys.forEach(k => {
    const v = Math.floor(Number((src && src[k]) || 0));
    if (!isFinite(v) || v < 0) no('잘못된 배분값입니다.');
    out[k] = v; sum += v;
  });
  return { map: out, sum: sum };
}

/* =========================================================================
   핸들러
   ========================================================================= */
const H = {

  /* ---- 신규 등록 ---- */
  new(g, a) {
    const { map, sum } = intMap(a.st, R.STK);
    if (sum !== R.START_PT) no('초기 능력치 합계는 ' + R.START_PT + ' 이어야 합니다.');
    R.STK.forEach(k => { if (map[k] > R.STAT_MAX) no('능력치 상한을 넘었습니다.'); });
    const B = unit(a.unitId);
    /* 초기 배속은 최하급기 중에서만 고를 수 있다 */
    if (B.rar !== 'N' || !B.w.length) no('초기 배속 대상이 아닌 기체입니다.');
    const nm = String(a.name || '').trim().slice(0, 12) || '이름없는 파일럿';
    R.newGame(nm, map, B.id);
    return { msg: { t: '배속 완료', b: esc(nm) + ' — 탑승기 <b class="cy">' + esc(B.nm) + '</b>. 전선 기록을 개시합니다.' } };
  },

  /* ---- 훈련 ---- */
  train(g, a) {
    const k = R.STK.indexOf(a.stat) >= 0 ? a.stat : no('없는 능력치입니다.');
    if (k === 'awk' && R.awkLocked()) no('올드타입 장착 중에는 각성을 올릴 수 없습니다.');
    needAp(g, R.TRAIN_AP);
    g.ap -= R.TRAIN_AP;
    const t = R.trainTier(g.st[k]);
    const roll = 1 + Math.floor(Math.random() * 100);
    const up = roll <= Math.round(t.p * 100) ? Math.min(t.up, R.STAT_MAX - g.st[k]) : 0;
    g.st[k] = Math.min(R.STAT_MAX, g.st[k] + up);
    const exp = 18 + up * 12;
    g.lvupNote = []; R.gainExp(exp);
    return { res: { kind: 'train', k: k, up: up, roll: roll, p: t.p, exp: exp,
      title: up ? '성공 — ' + R.STN[k] + ' +' + up : '성과 없음 — 몸이 따라주지 않는다' } };
  },

  /* ---- 파일럿 능력 포인트 배분 ---- */
  alloc(g, a) {
    const { map, sum } = intMap(a.map, R.STK);
    if (sum <= 0) no('배분할 포인트가 없습니다.');
    if (sum > g.pt) no('보유 포인트를 넘었습니다.');
    if (map.awk > 0 && R.awkLocked()) no('올드타입 장착 중에는 각성을 올릴 수 없습니다.');
    R.STK.forEach(k => { if (g.st[k] + map[k] > R.STAT_MAX) no(R.STN[k] + ' 상한을 넘었습니다.'); });
    R.STK.forEach(k => g.st[k] += map[k]);
    g.pt -= sum;
    return { msg: { t: '능력 배분 완료', b: sum + '포인트를 배분했습니다.' } };
  },

  /* ---- 기체 강화 포인트 배분 ---- */
  ualloc(g, a) {
    const v = R.cur();
    const { map, sum } = intMap(a.map, R.UIK);
    if (sum <= 0) no('배분할 포인트가 없습니다.');
    if (sum > v.upt) no('보유 강화 포인트를 넘었습니다.');
    R.UIK.forEach(k => {
      if (R.uBase(v, k) + map[k] * R.UINV_STEP[k] > R.UCAP[k]) no(R.UIN[k] + ' 상한을 넘었습니다.');
    });
    const before = R.uStat(v).hpMax;
    R.UIK.forEach(k => v.inv[k] = (v.inv[k] | 0) + map[k]);
    v.upt -= sum;
    v.hp += R.uStat(v).hpMax - before;      /* HP 를 올렸으면 실HP도 같이 늘려 준다 */
    v.hp = clamp(v.hp, 1, R.uStat(v).hpMax);
    return { msg: { t: '기체 강화 완료', b: sum + '포인트를 투입했습니다.' } };
  },

  /* ---- 파일럿 스킬 ---- */
  skbuy(g, a) {
    const K = R.PSKMAP[a.sk] || no('없는 스킬입니다.');
    const lv = R.pskLv(K.k), max = K.nolv ? 1 : R.PSK_MAXLV;
    if (lv >= max) no('이미 최대 레벨입니다.');
    const c = R.pskCost(lv);
    needCash(g, c);
    g.cash -= c; g.sk[K.k] = lv + 1;
    return { msg: { t: K.n + (lv ? ' Lv' + (lv + 1) : ' 습득'), b: cm(c) + 'C 지불 — ' + esc(K.d) } };
  },
  skeq(g, a) {
    const K = R.PSKMAP[a.sk] || no('없는 스킬입니다.');
    if (R.pskLv(K.k) <= 0) no('아직 습득하지 않은 스킬입니다.');
    if (R.pskEquipped(K.k)) no('이미 장착되어 있습니다.');
    if (g.eq.length >= R.PSK_SLOT) no('장착 슬롯이 가득 찼습니다.');
    if (K.g && g.eq.some(x => R.PSKMAP[x] && R.PSKMAP[x].g === K.g)) no('같은 출신 계통 스킬은 함께 장착할 수 없습니다.');
    g.eq.push(K.k);
    return { msg: K.k === 'ot'
      ? { t: '올드타입 장착', b: '각성이 <b class="rd">0으로 고정</b>됩니다. 각성 무장은 사용할 수 없습니다.' }
      : { t: K.n + ' 장착', b: esc(K.d) } };
  },
  skuneq(g, a) {
    const i = g.eq.indexOf(a.sk);
    if (i < 0) no('장착하지 않은 스킬입니다.');
    g.eq.splice(i, 1);
    return { msg: { t: '장착 해제', b: R.PSKMAP[a.sk].n + ' 을(를) 내렸습니다.' } };
  },

  /* ---- 출격 ---- */
  sortie(g, a) {
    const m = R.MISSION.find(x => x.id === a.m) || no('없는 임무입니다.');
    const tac = R.TACTIC[a.tac] ? a.tac : 'norm';
    const ter = R.TERRAIN[a.ter] ? a.ter : no('없는 전장입니다.');
    if (g.lv < m.lv) no('레벨이 부족합니다.');
    needAp(g, m.ap);
    if (!R.canSortie(R.cur(), ter)) no('탑승기에 이 전장의 지형 적성이 없습니다.');
    g.ap -= m.ap;
    return { battle: R.resolveBattle(m, tac, ter) };
  },

  /* ---- 정비 ---- */
  repair(g) {
    const v = R.cur(), s = R.uStat(v);
    const c = Math.ceil((s.hpMax - v.hp) * R.REPAIR_RATE / 10) * 10;
    if (c <= 0) no('이미 만전 상태입니다.');
    needCash(g, c); needAp(g, 1);
    g.cash -= c; g.ap--; v.hp = s.hpMax;
    return { msg: { t: '정비 완료', b: cm(c) + 'C를 지불하고 기체를 완전 복구했습니다.' } };
  },

  /* ---- 개조 ---- */
  mod(g, a) {
    const k = R.MOD[a.mk] ? a.mk : no('없는 개조 항목입니다.');
    const v = R.cur(), B = R.UMAP[v.id];
    if ((v.mod[k] | 0) >= R.MODMAX) no('이미 최대 단수입니다.');
    const c = R.modCost(B, v.mod[k] | 0);
    needCash(g, c);
    const before = R.uStat(v).hpMax;
    g.cash -= c; v.mod[k] = (v.mod[k] | 0) + 1;
    if (k === 'hp') v.hp += R.uStat(v).hpMax - before;
    v.hp = Math.min(v.hp, R.uStat(v).hpMax);
    return { msg: { t: R.MOD[k].n + ' ' + v.mod[k] + '단', b: cm(c) + 'C 투입 — ' + R.MOD[k].u + ' 적용되었습니다.' } };
  },
  wl(g, a) {
    const v = R.cur(), B = R.UMAP[v.id], i = a.i | 0;
    if (!B.w[i]) no('없는 무장입니다.');
    const lv = v.wl[i] || 1;
    if (lv >= R.wpMax(v, i)) no('이미 최대 레벨입니다.');
    const c = R.wlCost(B, lv);
    needCash(g, c);
    g.cash -= c; v.wl[i] = lv + 1;
    return { msg: { t: B.w[i].n + ' Lv' + v.wl[i], b: cm(c) + 'C 투입 — 위력 ' + cm(R.wpowOf(v, i)) + '로 상승했습니다.' } };
  },

  /* ---- 파츠 ---- */
  partbuy(g, a) {
    const k = R.TER_ORDER.indexOf(a.ter) >= 0 ? a.ter : no('없는 파츠입니다.');
    needCash(g, R.PART_PRICE);
    g.cash -= R.PART_PRICE; g.parts[k] = (g.parts[k] | 0) + 1;
    return { msg: { t: R.PARTS[k].n + ' 구입', b: cm(R.PART_PRICE) + 'C 지불 — 창고 보유 ' + g.parts[k] + '개. 【개조】에서 장착하십시오.' } };
  },
  partfit(g, a) {
    const k = R.TER_ORDER.indexOf(a.ter) >= 0 ? a.ter : no('없는 파츠입니다.');
    const v = R.cur();
    if ((v.pt || []).length >= R.PART_SLOT) no('파츠 슬롯이 가득 찼습니다.');
    if (R.adaptOf(v, k) >= 2) no('이미 최고 적성입니다.');
    if ((g.parts[k] | 0) <= 0) no('창고에 재고가 없습니다.');
    g.parts[k]--; v.pt.push(k);
    return { msg: { t: R.PARTS[k].n + ' 장착', b: R.TERRAIN[k].n + ' 적성이 <b class="li">' + R.ADAPT_MARK[R.adaptOf(v, k)] + '</b> 로 올랐습니다.' } };
  },
  partoff(g, a) {
    const v = R.cur(), i = a.i | 0;
    if (!v.pt || i < 0 || i >= v.pt.length) no('장착된 파츠가 아닙니다.');
    const k = v.pt[i];
    v.pt.splice(i, 1); g.parts[k] = (g.parts[k] | 0) + 1;
    return { msg: { t: '파츠 탈거', b: R.PARTS[k].n + ' 을(를) 창고로 되돌렸습니다. (보유 ' + g.parts[k] + '개)' } };
  },

  /* ---- 암시장 ---- */
  mktbuy(g, a) {
    const B = unit(a.id);
    /* 오늘 실제로 깔린 매물인지 서버가 직접 확인한다 */
    const it = R.marketOf(g.day).find(x => x.id === B.id) || no('오늘 매물이 아닙니다.');
    if (g.garage.some(v => v.id === B.id)) no('이미 보유한 기체입니다.');
    if (g.lv < R.lvReqOf(B)) no('레벨이 부족합니다.');
    needCash(g, it.price);
    g.cash -= it.price; g.garage.push(R.mkOwned(B.id));
    return { msg: { t: esc(B.nm) + ' 인수', b: cm(it.price) + 'C 지불. 【격납고】에서 탑승기를 변경할 수 있습니다.' } };
  },

  /* ---- 상점 발주 ---- */
  order(g, a) {
    const B = unit(a.id);
    if (g.garage.some(v => v.id === B.id)) no('이미 보유한 기체입니다.');
    if (g.orders.some(o => o.id === B.id)) no('이미 발주 중입니다.');
    if (R.rankIdx() < R.rankReqOf(B)) no('계급이 부족합니다.');
    const price = R.orderPrice(B), days = R.orderDays(B);
    needCash(g, price);
    g.cash -= price;
    g.orders.push({ id: B.id, due: g.day + days, price: price });
    return { msg: { t: '발주 접수', b: esc(B.nm) + ' — ' + cm(price) + 'C 선불. <b class="ye">DAY ' + (g.day + days) + '</b> 인도 예정입니다.' } };
  },
  ordercancel(g, a) {
    const i = a.i | 0, o = g.orders[i] || no('없는 발주입니다.');
    const back = Math.round(o.price * 0.5);
    g.orders.splice(i, 1); g.cash += back;
    return { msg: { t: '발주 취소', b: cm(back) + 'C 환불되었습니다.' } };
  },

  /* ---- 격납고 ---- */
  ride(g, a) {
    const i = a.i | 0;
    if (!g.garage[i]) no('없는 기체입니다.');
    g.cur = i;
    return { msg: { t: '탑승기 변경', b: esc(R.UMAP[R.cur().id].nm) + '에 탑승했습니다.' } };
  },
  sell(g, a) {
    const i = a.i | 0;
    if (g.garage.length <= 1) no('마지막 기체는 매각할 수 없습니다.');
    if (i === g.cur) no('탑승 중인 기체는 매각할 수 없습니다.');
    if (!g.garage[i]) no('없는 기체입니다.');
    const B = R.UMAP[g.garage[i].id], val = Math.round(R.buyPrice(B) * 0.55);
    g.garage.splice(i, 1); if (g.cur > i) g.cur--;
    g.cash += val;
    return { msg: { t: '매각 완료', b: esc(B.nm) + ' → ' + cm(val) + 'C' } };
  },

  /* ---- 다음 날 ---- */
  nextday(g) {
    g.day++;
    const up = 1500 + g.lv * 400;
    g.cash = Math.max(0, g.cash - up);
    g.ap = g.apMax;
    const tot = R.EVENTS.reduce((a, e) => a + e.p, 0);
    let r = Math.random() * tot, ev = R.EVENTS[R.EVENTS.length - 1];
    for (const e of R.EVENTS) { r -= e.p; if (r <= 0) { ev = e; break; } }
    const txt = ev.f(g);
    R.cur().hp = Math.min(R.cur().hp, R.uStat(R.cur()).hpMax);

    /* 상점 발주 인도 (#5) */
    const done = [];
    g.orders = (g.orders || []).filter(o => {
      if (g.day < o.due) return true;
      if (g.garage.some(v => v.id === o.id)) {
        g.cash += Math.round(o.price * 0.5);
        done.push(R.UMAP[o.id].nm + ' <span class="dm">(중복 보유 — 50% 환불)</span>');
      } else {
        g.garage.push(R.mkOwned(o.id));
        done.push(R.UMAP[o.id].nm);
      }
      return false;
    });

    return { msg: { t: 'DAY ' + g.day + ' — 아침 점호',
      b: '부대 유지비 <b class="rd">−' + cm(up) + 'C</b> 청구. 행동력 ' + g.apMax + ' 회복.<br>' + txt +
         (done.length ? '<br><b class="li">발주 인도</b> — ' + done.map(esc).join(', ') + ' 이(가) 격납고에 들어왔습니다.' : '') +
         '<br><span class="dm">암시장 매물이 새로 들어왔습니다.</span>' } };
  }
};

/* =========================================================================
   진입점
   ========================================================================= */
/* g 가 null 이면 'new' 만 받는다. 그 외에는 세이브가 있어야 한다.
   finally 로 모듈 상태를 반드시 비운다 — 다음 요청에 남으면 안 된다. */
function applyAction(g, a) {
  const k = a && a.k;
  const fn = H[k];
  if (!fn) no('알 수 없는 동작입니다: ' + k);
  if (k !== 'new' && !g) no('세이브가 없습니다. 먼저 파일럿을 등록하십시오.');
  R.setState(k === 'new' ? null : g);
  try {
    const out = fn(g, a) || {};
    return { out: out, g: R.getState() };   /* return 값은 finally 前에 평가된다 */
  } finally {
    R.setState(null);
  }
}

export { applyAction, Reject };
