
/* =========================================================================
   렌더링
   ========================================================================= */
function gauge(cls, cur, max, label) {
  const r = max > 0 ? clamp(cur / max, 0, 1) : 0;
  const w = cls === 'hp' ? (r > .5 ? 'hp' : r > .25 ? 'hp w' : 'hp c') : cls;
  return '<div class="gg"><i class="' + w + '" style="width:' + (r * 100) + '%"></i><span>' + label + '</span></div>';
}

/* 표시 크기에 맞는 이미지를 고른다.
   썸네일은 128x128 이라 작은 칸에서만 쓰고, 큰 칸에는 936x803 초상화 원본을 쓴다. */
const picFor = (B, cls) => (cls === 'l' || cls === 'xl') ? B.img : (B.th || B.img);

/* 지형 적성 표시 — 기본기(B) 또는 보유기(v) 어느 쪽으로도 그린다 */
function terLine(src, owned) {
  return '<span class="ter">' + TER_ORDER.map(k => {
    const a = owned ? adaptOf(src, k) : adaptBase(src, k);
    return '<b class="a' + a + '">' + TERRAIN[k].n + ADAPT_MARK[a] + '</b>';
  }).join('') + '</span>';
}

/* 유닛 행 (이미지 + 제원) */
function uRow(B, sizeCls, extraLine) {
  return '<div class="urow">' +
    '<img class="ui ' + (sizeCls || 'm') + '" src="' + picFor(B, sizeCls) + '" alt="" loading="lazy" decoding="async">' +
    '<div class="meta">' +
      '<div class="t1"><span class="un">' + esc(B.nm) + '</span></div>' +
      '<div class="mdl">' + esc(B.mdl || '—') + ' · ' + esc(B.sr || '') + (B.lg ? ' · 대형' : '') + '</div>' +
      statLine(B) + terLine(B, false) +
      (extraLine ? '<div class="wl">' + extraLine + '</div>' : '') +
    '</div></div>';
}
/* 기체 능력치는 HP · EN · 공격 · 방어 · 기동 · 색적 여섯 항목만 쓴다 (#11) */
const statLine = s => '<div class="stats"><span>HP <b>' + cm(s.hp != null ? s.hp : s.hpMax) + '</b></span>' +
  '<span>EN <b>' + cm(s.en != null ? s.en : s.enMax) + '</b></span>' +
  '<span>공격 <b>' + cm(s.atk) + '</b></span><span>방어 <b>' + cm(s.def) + '</b></span>' +
  '<span>기동 <b>' + cm(s.mob) + '</b></span><span>색적 <b>' + cm(s.sct || 0) + '</b></span></div>';
const wepLine = B => B.w.map(w => w.n + '(' + cm(w.pw[w.pw.length - 1]) + ')').join(' · ') || '무장 없음';

/* 무장 한 줄 설명 — 거리축으로 환산한 사거리를 함께 보여준다 (#12) */
function wepDetail(w, pw, awk) {
  const mn = Math.max(1, (w.mn | 0) * RANGE_MUL - 1);
  let mx = Math.max(mn, (w.mx | 0) * RANGE_MUL);
  const aw = wIsAwk(w);
  if (aw) mx = Math.min(AWK_RANGE_CAP, mx + Math.floor((awk | 0) / 100));
  return '위력 ' + cm(pw) + ' · ' + (wIsMelee(w) ? '격투' : '사격') + ' · ' + esc(w.at || '-') +
    (aw ? ' <span class="pk">〔각성〕</span>' : '') +
    (w.en ? ' · EN ' + w.en : '') + (w.am ? ' · 탄 ' + w.am : '') +
    ' · 거리 <b class="cy">' + mn + '~' + mx + '</b>';
}

/* ---------------- 능력 분배 위젯 ---------------- */
/* 신규 등록(총합 120)과 레벨업 포인트 분배가 같은 위젯을 쓴다 (#4 · #6) */
function allocTable(vals, remain, tag) {
  let h = '<table class="tb"><caption>【 능력 분배 】<span class="dm" style="float:right">잔여 포인트 <b class="ye">' + remain + '</b></span></caption>';
  STK.forEach(k => {
    h += '<tr><th>' + STN[k] + '</th><td>' +
      '<span class="alv">' + vals[k] + '</span>' +
      '<button class="sbtn" data-al="' + tag + '" data-k="' + k + '" data-n="-10">−10</button>' +
      '<button class="sbtn" data-al="' + tag + '" data-k="' + k + '" data-n="-1">−1</button>' +
      '<button class="sbtn" data-al="' + tag + '" data-k="' + k + '" data-n="1">+1</button>' +
      '<button class="sbtn" data-al="' + tag + '" data-k="' + k + '" data-n="10">+10</button>' +
      '<span class="dm sd">' + STAT_DESC[k] + '</span></td></tr>';
  });
  return h + '</table>';
}
function bindAlloc(tag, get, set) {
  document.querySelectorAll('[data-al="' + tag + '"]').forEach(b => b.onclick = () => {
    const k = b.dataset.k, n = +b.dataset.n, st = get();
    const step = n > 0 ? Math.min(n, st.remain, STAT_MAX - st.vals[k]) : Math.max(n, -st.spent[k]);
    if (!step) return;
    set(k, step);
    renderMain();
  });
}

/* ---------------- 좌측 ---------------- */
function renderLeft() {
  const host = $('lft');
  if (!g) { host.innerHTML = '<table class="tb"><caption>【 STATUS 】</caption><tr><td>등록된 파일럿이 없습니다.</td></tr></table>'; return; }
  const v = cur(), s = uStat(v), B = s.B;

  let h = '<table class="tb"><caption>【 파일럿 】</caption>' +
    '<tr><th>이름</th><td class="cy">' + esc(g.name) + '</td></tr>' +
    '<tr><th>계급</th><td class="ye">' + rankOf(g.kills) + '</td></tr>' +
    '<tr><th>레벨</th><td>Lv ' + g.lv + ' <span class="dm">/ ' + LV_MAX + ' · 명성 ' + g.fame + '</span></td></tr>' +
    '<tr><th>EXP</th><td>' + (g.lv >= LV_MAX ? '<span class="ye">MAX</span>' : gauge('ex', g.exp, expNeed(g.lv), cm(g.exp) + ' / ' + cm(expNeed(g.lv)))) + '</td></tr>' +
    '<tr><th>자금</th><td class="ye">' + cm(g.cash) + ' C</td></tr>' +
    '<tr><th>행동력</th><td>' + gauge('ap', g.ap, g.apMax, g.ap + ' / ' + g.apMax) + '</td></tr>' +
    '<tr><th>전적</th><td>' + g.wins + '승 ' + g.losses + '패 <span class="dm">/ 격추 ' + g.kills + '</span></td></tr>' +
    '</table>';

  h += '<table class="tb grid"><caption>【 능력치 】' +
    (g.pt > 0 ? '<span class="ye" style="float:right">미배분 ' + g.pt + 'pt</span>' :
      '<span class="dm" style="float:right">합계 ' + cm(statTotal()) + '</span>') + '</caption><tr>';
  STK.slice(0, 3).forEach(k => h += '<th>' + STN[k] + '</th>'); h += '</tr><tr>';
  STK.slice(0, 3).forEach(k => h += '<td class="' + (g.st[k] >= 400 ? 'ye' : '') + '">' + g.st[k] + '</td>'); h += '</tr><tr>';
  STK.slice(3).forEach(k => h += '<th>' + STN[k] + '</th>'); h += '</tr><tr>';
  STK.slice(3).forEach(k => h += '<td class="' + (k === 'awk' && g.st.awk >= AWK_FORESEE ? 'pk' : g.st[k] >= 400 ? 'ye' : '') + '">' + g.st[k] + '</td>');
  h += '</tr></table>';
  if (g.st.awk >= AWK_FORESEE) h += '<div class="note pk2">※ <b>미래 예측</b> 가능 — 각성 ' + g.st.awk + '. 매 판정 5%로 절대 명중/절대 회피.</div>';
  else if (g.st.awk < 1) h += '<div class="note">※ 각성 0 — <b>각성 무장을 사용할 수 없습니다.</b></div>';

  h += '<table class="tb"><caption>【 탑승기 】' + (s.modSum ? '<span class="dm" style="float:right">개조 ' + s.modSum + '단</span>' : '') + '</caption>' +
    '<tr><td colspan="2" class="pic"><img class="ui l" src="' + B.img + '" alt="">' +
    '<div class="cy nmL">' + esc(B.nm) + '</div>' +
    '<div class="dm sm">' + esc(B.mdl || '') + '</div>' +
    '<div class="dm sm">' + esc(B.sr || '') + (B.lg ? ' · 대형' : '') + '</div></td></tr>' +
    '<tr><th>HP</th><td>' + gauge('hp', v.hp, s.hpMax, cm(v.hp) + ' / ' + cm(s.hpMax)) + '</td></tr>' +
    '<tr><th>EN</th><td>' + gauge('en', s.enMax, s.enMax, cm(s.enMax)) + '</td></tr>' +
    '<tr><th>공격</th><td>' + cm(s.atk) + '</td></tr>' +
    '<tr><th>방어</th><td>' + cm(s.def) + '</td></tr>' +
    '<tr><th>기동</th><td>' + cm(s.mob) + '</td></tr>' +
    '<tr><th>색적</th><td>' + cm(s.sct) + '</td></tr>' +
    '<tr><th>지형 적성</th><td>' + terLine(v, true) + '</td></tr>' +
    '</table>';

  h += '<table class="tb"><caption>【 병장 】</caption>';
  if (!B.w.length) h += '<tr><td class="dm">무장 없음</td></tr>';
  B.w.forEach((w, i) => {
    const lv = (v.wl && v.wl[i]) || 1;
    const lock = wIsAwk(w) && g.st.awk < 1;
    h += '<tr><td style="width:100%">' + esc(w.n) + ' <span class="ye">Lv' + lv + '</span>' +
      (lock ? ' <span class="rd">사용 불가</span>' : '') +
      '<div class="dm sm">' + wepDetail(w, wpowOf(v, i), g.st.awk) + '</div></td></tr>';
  });
  h += '</table>';

  if (B.ab && B.ab.length) {
    h += '<table class="tb"><caption>【 기체 특성 】</caption>';
    B.ab.forEach(a => h += '<tr><td style="width:100%"><span class="cy">' + esc(a.n) + '</span>' +
      (a.d ? '<div class="dm sm">' + esc(a.d) + '</div>' : '') + '</td></tr>');
    h += '</table>';
  }
  host.innerHTML = h;
}

/* ---------------- 커맨드 ---------------- */
const CMDS = [['main', '상황실'], ['train', '훈련'], ['sortie', '출격'], ['repair', '정비'],
['mod', '개조'], ['market', '암시장'], ['hangar', '격납고'], ['book', '도감'], ['log', '기록']];
function renderCmd() {
  const host = $('cmdbar');
  if (!g) { host.innerHTML = ''; return; }
  let h = '';
  CMDS.forEach(c => h += '<button class="cbtn' + (S.view === c[0] ? ' on' : '') + '" data-v="' + c[0] + '"' +
    (S.busy ? ' disabled' : '') + '>【' + c[1] + '】' + (c[0] === 'train' && g.pt > 0 ? '<small class="ye"> ' + g.pt + 'pt</small>' : '') + '</button>');
  h += '<span style="flex:1"></span><button class="cbtn" data-next="1"' + (S.busy ? ' disabled' : '') +
    '>【다음 날】<small> AP ' + g.ap + '/' + g.apMax + '</small></button>';
  host.innerHTML = h;
  host.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { S.view = b.dataset.v; S.msg = null; S.res = null; renderAll(); });
  const nb = host.querySelector('[data-next]'); if (nb) nb.onclick = nextDay;
}

/* ---------------- 메인 ---------------- */
function renderMain() {
  const host = $('mainf');
  if (!g) { host.innerHTML = viewNew(); bindNew(); return; }
  const map = { train: viewTrain, sortie: viewSortie, battle: viewBattle, repair: viewRepair, mod: viewMod, market: viewMarket, hangar: viewHangar, book: viewBook, log: viewLog };
  host.innerHTML = (map[S.view] || viewMain)();
  bindMain();
  const lg = $('blog'); if (lg) lg.scrollTop = lg.scrollHeight;
}
function renderAll() { renderLeft(); renderMain(); renderCmd(); }
const msgBox = () => S.msg ? '<div class="rbox"><div class="rt ye">' + S.msg.t + '</div><div>' + S.msg.b + '</div></div>' : '';

/* ---------------- 신규 등록 ---------------- */
let newSt = null, startPool = null, startSel = 0;
function resetNewSt() { newSt = {}; STK.forEach(k => newSt[k] = 0); }
const newRemain = () => START_PT - STK.reduce((a, k) => a + newSt[k], 0);
function rollStart() {
  const p = UNITS.filter(u => u.rar === 'N' && u.w.length);
  startPool = []; const used = {};
  while (startPool.length < 3 && startPool.length < p.length) { const u = pick(p); if (used[u.id]) continue; used[u.id] = 1; startPool.push(u); }
  startSel = 0;
}
function viewNew() {
  if (!newSt) resetNewSt();
  if (!startPool) rollStart();
  const rem = newRemain();
  let h = '<h2 class="sec">【 신규 파일럿 등록 】<em>NEW RECORD</em></h2>' +
    '<p class="lead">G-Over World 에 오신 것을 환영합니다. 이름을 정하고 <b>' + START_PT + '포인트</b>를 여섯 능력치에 자유롭게 나눈 뒤, 배속받을 초기 기체를 고르십시오.</p>' +
    '<table class="tb"><caption>【 등록 】</caption>' +
    '<tr><th>이름</th><td><input type="text" id="nName" maxlength="12" placeholder="파일럿 이름" style="width:180px"></td></tr></table>';

  h += allocTable(newSt, rem, 'new');
  h += '<div class="note">※ <b>각성</b>이 0이면 각성 무장(특수 속성)을 아예 쓸 수 없습니다. ' +
    '각성 <b>' + AWK_FORESEE + '</b> 이상이면 매 판정 5%로 <b class="pk">미래 예측</b>이 발동합니다. ' +
    '레벨업 1회당 <b>' + LVUP_PT + '포인트</b>가 지급되며, 상한은 능력치당 ' + STAT_MAX + '입니다.</div>';

  h += '<h2 class="sec">【 초기 배속 기체 】<em>선택</em></h2><div class="pick">';
  startPool.forEach((B, i) => {
    h += '<button data-start="' + i + '" class="' + (i === startSel ? 'selrow' : '') + '">' +
      uRow(B, 'm', wepLine(B)) + '</button>';
  });
  h += '</div>';
  h += '<div class="row-btn"><button class="btn" id="bClear">【분배 초기화】</button>' +
    '<button class="btn" id="bRerollU">【기체 재추첨】</button>' +
    '<button class="btn p" id="bStart"' + (rem !== 0 ? ' disabled' : '') + '>【등록하고 배속】' +
    (rem !== 0 ? ' <span class="dm">잔여 ' + rem + '</span>' : '') + '</button></div>';
  return h;
}
function bindNew() {
  bindAlloc('new',
    () => ({ vals: newSt, remain: newRemain(), spent: newSt }),
    (k, n) => { newSt[k] += n; });
  $('bClear').onclick = () => { resetNewSt(); renderMain(); };
  $('bRerollU').onclick = () => { rollStart(); renderMain(); };
  document.querySelectorAll('[data-start]').forEach(b => b.onclick = () => { startSel = +b.dataset.start; renderMain(); });
  $('bStart').onclick = () => {
    if (newRemain() !== 0) return;
    const nm = ($('nName').value || '').trim() || '이름없는 파일럿';
    newGame(nm, Object.assign({}, newSt), startPool[startSel].id);
    S.view = 'main';
    S.msg = { t: '배속 완료', b: esc(nm) + ' — 탑승기 <b class="cy">' + esc(startPool[startSel].nm) + '</b>. 전선 기록을 개시합니다.' };
    renderAll();
  };
}

/* ---------------- 상황실 ---------------- */
function viewMain() {
  const v = cur(), s = uStat(v), hpr = v.hp / s.hpMax;
  let h = '<h2 class="sec">【 상황실 】<em>DAY ' + g.day + '</em></h2>' + msgBox();
  h += '<p class="lead">제 <b>' + g.day + '</b>일 · 행동력 <b>' + g.ap + '</b>/' + g.apMax + ' · 자금 <b>' + cm(g.cash) + 'C</b> · 보유 기체 <b>' + g.garage.length + '</b>기</p>';
  const w = [];
  if (g.pt > 0) w.push('미배분 능력 포인트 <b>' + g.pt + 'pt</b> — 【훈련】에서 배분하십시오.');
  if (hpr < 0.6) w.push('탑승기 손상률 <b>' + Math.round((1 - hpr) * 100) + '%</b> — 【정비】를 권장합니다.');
  if (g.ap <= 0) w.push('행동력이 없습니다. <b>【다음 날】</b>로 넘기십시오.');
  if (g.flags.bossDown) w.push('적 기함 격파 확인. <b>주요 목표를 달성</b>했습니다.');
  if (w.length) h += '<div class="note">' + w.map(x => '※ ' + x).join('<br>') + '</div>';

  h += '<table class="tb"><caption>【 임무 일람 】</caption>' +
    '<tr><th style="width:auto">임무</th><th style="width:40px">AP</th><th style="width:62px">조건</th><th style="width:52px">적</th><th style="width:88px">기본 보수</th></tr>';
  MISSION.forEach(m => {
    const ok = g.lv >= m.lv;
    h += '<tr><td style="text-align:left" class="' + (ok ? '' : 'dm') + '">' + m.n + '</td><td class="n">' + m.ap + '</td>' +
      '<td class="n ' + (ok ? 'li' : 'rd') + '">Lv' + m.lv + '</td><td class="n">' + m.cnt + '기</td>' +
      '<td class="n ye">' + cm(m.pay) + 'C</td></tr>';
  });
  h += '</table>';

  h += '<table class="tb"><caption>【 최근 전투 】</caption>';
  if (!g.records.length) h += '<tr><td class="dm">출격 기록이 없습니다.</td></tr>';
  g.records.slice(0, 5).forEach(r => h += '<tr><td style="width:100%"><span class="dm">DAY ' + r.day + '</span> ' + r.m +
    (r.t ? ' <span class="dm">(' + TERRAIN[r.t].n + ')</span>' : '') + ' — ' +
    '<span class="' + (r.r === 'win' ? 'li' : r.r === 'lose' ? 'rd' : 'dm') + '">' + (r.r === 'win' ? '완수' : r.r === 'lose' ? '대파' : '철수') +
    '</span> <span class="dm">격추 ' + r.kills + ' / ' + cm(r.pay) + 'C</span></td></tr>');
  h += '</table>';
  return h;
}

/* ---------------- 훈련 ---------------- */
let trAlloc = null;
const trSpent = () => STK.reduce((a, k) => a + (trAlloc ? trAlloc[k] : 0), 0);
function resetTrAlloc() { trAlloc = {}; STK.forEach(k => trAlloc[k] = 0); }
function viewTrain() {
  if (!trAlloc) resetTrAlloc();
  let h = '<h2 class="sec">【 훈련 】<em>행동력 ' + TRAIN_AP + '</em></h2>';

  /* 레벨업 포인트 배분 (#6) */
  if (g.pt > 0 || trSpent() > 0) {
    const view = {}; STK.forEach(k => view[k] = g.st[k] + trAlloc[k]);
    h += '<h2 class="sec">【 능력 포인트 배분 】<em>' + LVUP_PT + 'pt / 레벨</em></h2>' +
      allocTable(view, g.pt - trSpent(), 'tr') +
      '<div class="row-btn"><button class="btn" id="bAlCancel">【되돌리기】</button>' +
      '<button class="btn p" id="bAlOK"' + (trSpent() <= 0 ? ' disabled' : '') + '>【배분 확정 ' + trSpent() + 'pt】</button></div><hr class="sep">';
  }

  if (S.res && S.res.kind === 'train') {
    const r = S.res;
    h += '<div class="rbox"><div class="rt ' + (r.up ? 'li' : 'dm') + '">' + r.title + '</div>' +
      '<div class="mn" style="font-size:11.5px">판정 ' + r.roll + ' / 100 · 성공률 ' + Math.round(r.p * 100) + '%</div>' +
      '<table><tr><td>' + STN[r.k] + '</td><td class="n">' + (r.up ? '+' + r.up + ' → ' + g.st[r.k] : '변화 없음') + '</td></tr>' +
      '<tr><td>경험치</td><td class="n">+' + r.exp + '</td></tr></table></div>';
  }
  h += '<p class="lead">항목을 골라 행동력 ' + TRAIN_AP + '을 소모합니다. <b>능력치 상한은 없습니다.</b> 다만 수치가 오를수록 성공률이 급격히 떨어지고, <b>400 이상은 1% 고정</b>입니다.</p>';
  if (g.ap <= 0) h += '<div class="note">※ <b>행동력이 부족합니다.</b></div>';
  h += '<div class="pick">';
  STK.forEach(k => {
    const t = trainTier(g.st[k]), dis = g.ap <= 0;
    h += (dis ? '<div class="dis">' : '<button data-tr="' + k + '">') +
      '<span class="l1"><span class="nm">' + STN[k] + ' 훈련</span>' +
      '<span class="cost">현재 ' + g.st[k] + ' / 성공률 ' + Math.round(t.p * 100) + '%</span></span>' +
      '<span class="l2">' + STAT_DESC[k] + ' <b>성공 시 +' + t.up + '</b></span>' + (dis ? '</div>' : '</button>');
  });
  h += '</div>';

  h += '<table class="tb grid"><caption>【 구간별 성공 확률 】</caption><tr>' +
    TRAIN_TIER.map(t => '<th>' + t.lo + '~</th>').join('') + '</tr><tr>' +
    TRAIN_TIER.map(t => '<td>' + Math.round(t.p * 100) + '%</td>').join('') + '</tr></table>';

  /* 캐릭터 스킬 상점 (#8) */
  h += '<h2 class="sec">【 스킬 습득 】<em>자금 소모</em></h2>';
  if (!CSKILL.length) {
    h += '<div class="note">※ 습득 가능한 스킬이 아직 등록되지 않았습니다. <b>추후 추가 예정</b>입니다.</div>';
  } else {
    h += '<div class="pick">';
    CSKILL.forEach(sk => {
      const own = g.sk.indexOf(sk.k) >= 0, poor = sk.c > g.cash, dis = own || poor;
      h += (dis ? '<div class="dis">' : '<button data-sk="' + sk.k + '">') +
        '<span class="l1"><span class="nm">' + esc(sk.n) + '</span><span class="cost">' +
        (own ? '<span class="li">습득함</span>' : (poor ? '<span class="rd">' : '') + cm(sk.c) + ' C' + (poor ? '</span>' : '')) +
        '</span></span><span class="l2">' + esc(sk.d) + '</span>' + (dis ? '</div>' : '</button>');
    });
    h += '</div>';
  }
  return h;
}
function doTrain(k) {
  if (g.ap <= 0) return;
  g.ap -= TRAIN_AP;
  const t = trainTier(g.st[k]);
  const roll = 1 + Math.floor(Math.random() * 100);
  const okv = roll <= Math.round(t.p * 100);
  const up = okv ? Math.min(t.up, STAT_MAX - g.st[k]) : 0;
  g.st[k] = Math.min(STAT_MAX, g.st[k] + up);
  const exp = 18 + up * 12;
  g.lvupNote = []; gainExp(exp);
  S.res = { kind: 'train', k: k, up: up, roll: roll, p: t.p, exp: exp,
    title: up ? '성공 — ' + STN[k] + ' +' + up : '성과 없음 — 몸이 따라주지 않는다' };
  save(); renderAll();
}

/* ---------------- 출격 ---------------- */
function viewSortie() {
  const v = cur(), s = uStat(v);
  const ad = adaptOf(v, S.ter);
  let h = '<h2 class="sec">【 출격 】<em>2d6 대항판정 자동 전투</em></h2>';
  h += '<p class="lead">전장과 전법을 정하고 임무를 선택하십시오. 최대 <b>' + ROUND_CAP + '라운드</b>까지 자동 진행되며, 교전 거리(<b>1~' + DIST_MAX + '</b>)는 조우할 때마다 무작위로 잡힙니다.</p>';

  /* 전장 선택 (#13 · #14) */
  h += '<table class="tb"><caption>【 전장 】</caption><tr>';
  TER_ORDER.forEach(k => {
    const a = adaptOf(v, k);
    h += '<td style="padding:0;text-align:center"><button class="cbtn' + (S.ter === k ? ' on' : '') + (a ? '' : ' bad') +
      '" data-ter="' + k + '" style="width:100%;text-align:center">【' + TERRAIN[k].n + '】<small class="a' + a + '"> ' + ADAPT_MARK[a] + '</small></button></td>';
  });
  h += '</tr><tr><td colspan="5" class="dm" style="font-family:var(--f-ui)">' + TERRAIN[S.ter].d +
    ' — 탑승기 적성 <b class="a' + ad + '">' + ADAPT_MARK[ad] + '</b>' +
    (ad === 0 ? ' <span class="rd">이 전장에는 출격할 수 없습니다. 【개조】에서 파츠를 장착하십시오.</span>'
      : ad === 1 ? ' <span class="ye">공격·기동이 85%로 제한됩니다.</span>'
      : ' <span class="li">제원을 100% 발휘합니다.</span>') + '</td></tr></table>';

  h += '<table class="tb"><caption>【 전법 】</caption><tr>';
  Object.keys(TACTIC).forEach(k => h += '<td style="padding:0;text-align:center"><button class="cbtn' + (S.tac === k ? ' on' : '') +
    '" data-tac="' + k + '" style="width:100%;text-align:center">【' + TACTIC[k].n + '】</button></td>');
  h += '</tr><tr><td colspan="4" class="dm" style="font-family:var(--f-ui)">' + TACTIC[S.tac].d + '</td></tr></table>';

  if (v.hp / s.hpMax < 0.35) h += '<div class="note">※ 기체 손상이 심각합니다(<b>' + Math.round(v.hp / s.hpMax * 100) + '%</b>). 정비 없이 출격하면 대파 위험이 큽니다.</div>';
  h += '<div class="pick">';
  MISSION.forEach(m => {
    const lvOK = g.lv >= m.lv, apOK = g.ap >= m.ap, terOK = ad > 0, dis = !lvOK || !apOK || !terOK;
    const why = !terOK ? '<span class="rd">지형 적성 없음</span>' : !lvOK ? '<span class="rd">Lv' + m.lv + ' 필요</span>' :
      !apOK ? '<span class="rd">AP ' + m.ap + ' 필요</span>' : 'AP ' + m.ap + ' / ' + cm(m.pay) + 'C';
    h += (dis ? '<div class="dis">' : '<button data-ms="' + m.id + '">') +
      '<span class="l1"><span class="nm">【' + m.n + '】</span><span class="cost">' + why + '</span></span>' +
      '<span class="l2">' + m.d + ' <b>적 ' + m.cnt + '기</b></span>' +
      (dis ? '</div>' : '</button>');
  });
  return h + '</div>';
}

/* ---------------- 전투 ---------------- */
function viewBattle() {
  let h = '<h2 class="sec">【 전투 기록 】<em>' + (S.busy ? '교전 중' : '교전 종료') + '</em></h2>';
  if (S.res && !S.busy) {
    const r = S.res;
    h += '<div class="rbox"><div class="rt ' + (r.r === 'win' ? 'li' : r.r === 'lose' ? 'rd' : 'dm') + '">' +
      (r.r === 'win' ? '임무 완수' : r.r === 'lose' ? '기체 대파' : '교전 이탈') + ' — ' + r.n +
      (r.t ? ' <span class="dm" style="font-size:12px">/ ' + TERRAIN[r.t].n + '</span>' : '') + '</div><table>' +
      '<tr><td>격추</td><td class="n">' + r.kills + ' 기</td></tr>' +
      '<tr><td>획득 자금</td><td class="n">' + cm(r.pay) + ' C</td></tr>' +
      '<tr><td>획득 경험치</td><td class="n">' + cm(r.exp) + '</td></tr></table>' +
      (r.lv.length ? '<div class="li mn" style="margin-top:4px;font-size:11.5px">★ ' + r.lv.join('<br>★ ') + '</div>' : '') + '</div>';
  }
  h += '<div class="dline" id="dist">' + (S.dist || '<span class="dm">교전 대기</span>') + '</div>' +
    '<div class="duel' + (S.duel ? '' : ' idle') + '" id="duel">' +
      (S.duel || '<div class="dm" style="grid-column:1/-1;text-align:center">교전 대기</div>') + '</div>' +
    '<div class="bboard" id="bboard">' + (S.board || '') + '</div>' +
    '<div id="blog">' + ((S.blog || []).join('')) + '</div><div class="row-btn">';
  h += S.busy ? '<button class="btn" id="bSkip">【연출 생략】</button>'
    : '<button class="btn p" id="bBack">【귀환 보고】</button><button class="btn" id="bAgain">【재출격】</button>';
  return h + '</div>';
}

/* ---------------- 정비 ---------------- */
const repairCost = () => { const v = cur(), s = uStat(v); return Math.ceil((s.hpMax - v.hp) * REPAIR_RATE / 10) * 10; };
function viewRepair() {
  const v = cur(), s = uStat(v), c = repairCost();
  let h = '<h2 class="sec">【 정비 】<em>행동력 1</em></h2>' + msgBox();
  h += '<p class="lead">손상된 기체를 완전 복구합니다. 비용은 손상량에 비례합니다.</p>';
  h += '<table class="tb"><caption>【 견적 】</caption>' +
    '<tr><th>기체</th><td>' + esc(s.B.nm) + '</td></tr>' +
    '<tr><th>현재 HP</th><td>' + cm(v.hp) + ' / ' + cm(s.hpMax) + ' <span class="dm">(손상 ' + cm(s.hpMax - v.hp) + ')</span></td></tr>' +
    '<tr><th>단가</th><td>손상 1당 ' + REPAIR_RATE.toFixed(2) + ' C</td></tr>' +
    '<tr><th>청구액</th><td class="' + (c > g.cash ? 'rd' : 'ye') + '">' + cm(c) + ' C</td></tr>' +
    '<tr><th>보유 자금</th><td>' + cm(g.cash) + ' C</td></tr></table>';
  const dis = c <= 0 || c > g.cash || g.ap <= 0;
  h += '<div class="row-btn"><button class="btn p" id="bFix"' + (dis ? ' disabled' : '') + '>【정비 실시】</button></div>';
  if (c <= 0) h += '<div class="note">※ 기체는 이미 <b>만전 상태</b>입니다.</div>';
  else if (c > g.cash) h += '<div class="note">※ <b>자금이 부족합니다.</b></div>';
  else if (g.ap <= 0) h += '<div class="note">※ <b>행동력이 부족합니다.</b></div>';
  return h;
}

/* ---------------- 개조 ---------------- */
function viewMod() {
  const v = cur(), s = uStat(v), B = s.B;
  let h = '<h2 class="sec">【 개조 】<em>행동력 소모 없음</em></h2>' + msgBox();
  h += '<p class="lead">탑승기 <b>' + esc(B.nm) + '</b>을(를) 강화합니다. 각 항목 최대 <b>' + MODMAX + '단</b>, 1단당 기본 제원의 <b>5%</b>가 가산됩니다. 개조 내역은 기체별로 관리됩니다.</p>';
  h += '<div class="pick">';
  Object.keys(MOD).forEach(k => {
    const M = MOD[k], lv = v.mod[k] | 0, c = modCost(B, lv), maxed = lv >= MODMAX, poor = c > g.cash, dis = maxed || poor;
    const base = B[M.s] || 0, now = k === 'hp' ? s.hpMax : k === 'en' ? s.enMax : s[k];
    h += (dis ? '<div class="dis">' : '<button data-mod="' + k + '">') +
      '<span class="l1"><span class="nm">' + M.n + ' <span class="dm">[' + lv + '/' + MODMAX + ']</span></span>' +
      '<span class="cost">' + (maxed ? '<span class="li">MAX</span>' : (poor ? '<span class="rd">' : '') + cm(c) + ' C' + (poor ? '</span>' : '')) + '</span></span>' +
      '<span class="l2">' + M.u + ' · 현재 <b>' + cm(now) + '</b> <span class="dm">(기본 ' + cm(base) + ')</span></span>' +
      (dis ? '</div>' : '</button>');
  });
  h += '</div>';

  /* 지형 적성 파츠 (#16) */
  const used = (v.pt || []).length, pc = partCost(B);
  h += '<h2 class="sec">【 지형 파츠 】<em>슬롯 ' + used + ' / ' + PART_SLOT + '</em></h2>';
  h += '<div class="note">※ 파츠 1개당 해당 지형 적성이 <b>1단계</b> 올라갑니다(× → △ → ○). 같은 파츠를 두 개 달면 ×에서 ○까지 끌어올릴 수 있습니다. 탈거는 무상이나 대금은 돌아오지 않습니다.</div>';
  h += '<div style="margin-bottom:6px">현재 적성 ' + terLine(v, true) + '</div>';
  h += '<div class="pick">';
  TER_ORDER.forEach(k => {
    const now = adaptOf(v, k), full = now >= 2, noSlot = used >= PART_SLOT, poor = pc > g.cash;
    const dis = full || noSlot || poor;
    const why = full ? '<span class="li">○ 달성</span>' : noSlot ? '<span class="rd">슬롯 없음</span>' :
      (poor ? '<span class="rd">' : '') + cm(pc) + ' C' + (poor ? '</span>' : '');
    h += (dis ? '<div class="dis">' : '<button data-part="' + k + '">') +
      '<span class="l1"><span class="nm">' + PARTS[k].n + '</span><span class="cost">' + why + '</span></span>' +
      '<span class="l2">' + TERRAIN[k].n + ' 적성 <b class="a' + now + '">' + ADAPT_MARK[now] + '</b> → <b class="a' + Math.min(2, now + 1) + '">' + ADAPT_MARK[Math.min(2, now + 1)] + '</b>' +
      ' <span class="dm">(기본 ' + ADAPT_MARK[adaptBase(B, k)] + ')</span></span>' + (dis ? '</div>' : '</button>');
  });
  h += '</div>';
  if (used) {
    h += '<div class="pick">';
    (v.pt || []).forEach((k, i) => h += '<button data-unpart="' + i + '"><span class="l1"><span class="nm">' + PARTS[k].n + ' 장착중</span>' +
      '<span class="cost"><span class="rd">탈거</span></span></span></button>');
    h += '</div>';
  }

  h += '<h2 class="sec">【 병장 강화 】<em>레벨업 시 위력 상승</em></h2><div class="pick">';
  if (!B.w.length) h += '<div class="dis">무장이 없습니다.</div>';
  B.w.forEach((w, i) => {
    const lv = (v.wl && v.wl[i]) || 1, mx = wpMax(v, i), c = wlCost(B, lv), maxed = lv >= mx, poor = c > g.cash, dis = maxed || poor;
    const nextPw = maxed ? null : w.pw[lv];
    h += (dis ? '<div class="dis">' : '<button data-wl="' + i + '">') +
      '<span class="l1"><span class="nm">' + esc(w.n) + ' <span class="ye">Lv' + lv + '</span><span class="dm">/' + mx + '</span></span>' +
      '<span class="cost">' + (maxed ? '<span class="li">MAX</span>' : (poor ? '<span class="rd">' : '') + cm(c) + ' C' + (poor ? '</span>' : '')) + '</span></span>' +
      '<span class="l2">' + wepDetail(w, wpowOf(v, i), g.st.awk) + (nextPw ? ' → 위력 <b class="ye">' + cm(nextPw) + '</b>' : '') + '</span>' +
      (dis ? '</div>' : '</button>');
  });
  return h + '</div>';
}

/* ---------------- 암시장 (#18) ---------------- */
function viewMarket() {
  const stock = marketOf(g.day);
  let h = '<h2 class="sec">【 암시장 】<em>보유 ' + cm(g.cash) + ' C</em></h2>' + msgBox();
  h += '<p class="lead">출처를 묻지 않는 거래소입니다. 매물은 <b>매일 초기화</b>되며 오늘은 <b class="ye">' + stock.length + '기</b>가 들어왔습니다. 값은 기체 제원 총합으로 정해집니다.</p>';
  h += '<div class="note">※ 오늘 놓친 매물은 다시 나오지 않습니다. 요구 레벨은 기체 성능에 따라 붙습니다.</div>';
  h += '<div class="pick">';
  stock.forEach(it => {
    const B = UMAP[it.id];
    if (!B) return;
    const owned = g.garage.some(v => v.id === B.id), req = lvReqOf(B), lvOK = g.lv >= req, poor = it.price > g.cash;
    const dis = owned || !lvOK || poor;
    const why = owned ? '<span class="li">보유중</span>' : !lvOK ? '<span class="rd">Lv' + req + ' 필요</span>' :
      (poor ? '<span class="rd">' + cm(it.price) + ' C</span>' : cm(it.price) + ' C');
    h += (dis ? '<div class="dis">' : '<button data-buy="' + B.id + '" data-price="' + it.price + '">') +
      '<div class="urow"><img class="ui m" src="' + picFor(B, 'm') + '" alt="" loading="lazy" decoding="async"><div class="meta">' +
      '<div class="t1"><span class="un">' + esc(B.nm) + '</span><span class="cost">' + why + '</span></div>' +
      '<div class="mdl">' + esc(B.mdl || '—') + ' · ' + esc(B.sr || '') + (B.lg ? ' · 대형' : '') + '</div>' +
      statLine(B) + terLine(B, false) +
      '<div class="wl">' + esc(wepLine(B)) + '</div></div></div>' + (dis ? '</div>' : '</button>');
  });
  return h + '</div>';
}

/* ---------------- 격납고 ---------------- */
function viewHangar() {
  let h = '<h2 class="sec">【 격납고 】<em>보유 ' + g.garage.length + '기</em></h2>' + msgBox();
  h += '<p class="lead">탑승기를 변경하거나 불필요한 기체를 매각합니다. <span class="dm">매각가는 시세의 55%이며 개조·파츠 투자분은 환불되지 않습니다.</span></p>';
  h += '<div class="pick">';
  g.garage.forEach((v, i) => {
    const s = uStat(v), B = s.B, on = i === g.cur;
    h += '<div class="grow' + (on ? ' selrow' : '') + '">' +
      '<div class="urow"><img class="ui m" src="' + picFor(B, 'm') + '" alt="" loading="lazy" decoding="async"><div class="meta">' +
      '<div class="t1"><span class="un" style="color:' + (on ? 'var(--yel)' : 'var(--lnk)') + '">' + (on ? '▶ ' : '') + esc(B.nm) + '</span>' +
      '<span class="cost">' + (on ? '<span class="ye">탑승중</span>' : '') + '</span></div>' +
      '<div class="mdl">' + esc(B.mdl || '—') + ' · 개조 ' + s.modSum + '단 · 파츠 ' + (v.pt || []).length + '/' + PART_SLOT + '</div>' +
      '<div class="stats"><span>HP <b>' + cm(v.hp) + '/' + cm(s.hpMax) + '</b></span><span>EN <b>' + cm(s.enMax) + '</b></span>' +
      '<span>공격 <b>' + cm(s.atk) + '</b></span><span>방어 <b>' + cm(s.def) + '</b></span>' +
      '<span>기동 <b>' + cm(s.mob) + '</b></span><span>색적 <b>' + cm(s.sct) + '</b></span></div>' +
      terLine(v, true) +
      '<div class="row-btn" style="margin-top:4px">' +
      (on ? '' : '<button class="btn" data-ride="' + i + '">【탑승】</button>') +
      (g.garage.length > 1 && !on ? '<button class="btn" data-sell="' + i + '">【매각 ' + cm(Math.round(buyPrice(B) * 0.55)) + 'C】</button>' : '') +
      '</div></div></div></div>';
  });
  return h + '</div>';
}

/* ---------------- 도감 ---------------- */
function viewBook() {
  let h = '<h2 class="sec">【 기체 도감 】<em>' + UNITS.length + '기 수록</em></h2>';
  h += '<div style="margin-bottom:6px">' +
    '<select id="bookSeries" style="max-width:230px"><option value="">— 작품 전체 —</option>' +
    SERIES_LIST.map(s => '<option value="' + esc(s) + '"' + (S.bookSr === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('') +
    '</select> <input type="text" id="bookQ" placeholder="기체명 / 형식번호" value="' + esc(S.bookQ) + '" style="width:190px"></div>';
  const q = S.bookQ.trim().toLowerCase();
  const list = UNITS.filter(u => (!S.bookSr || u.sr === S.bookSr) &&
    (!q || (u.nm + ' ' + u.mdl + ' ' + u.sr).toLowerCase().indexOf(q) >= 0))
    .sort((a, b) => uPow(b) - uPow(a));
  h += '<div class="dm mn" style="margin-bottom:6px">검색 결과 ' + list.length + '기</div>';
  if (S.bookSel && UMAP[S.bookSel]) {
    const B = UMAP[S.bookSel];
    h += '<div class="rbox"><div class="urow"><img class="ui xl" src="' + B.img + '" alt="">' +
      '<div class="meta"><div class="rt" style="font-size:16px">' + esc(B.nm) + '</div>' +
      '<div class="mdl">' + esc(B.mdl || '—') + ' · ' + esc(B.sr || '') + (B.lg ? ' · 대형' : '') + '</div>' +
      statLine(B) + terLine(B, false) +
      '<div class="dm mn" style="font-size:10.5px;margin-top:3px">시세 ' + cm(buyPrice(B)) + ' C · 요구 Lv' + lvReqOf(B) + '</div>' +
      '</div></div>' +
      '<table class="tb" style="margin:6px 0 0"><caption>【 병장 】</caption>';
    B.w.forEach(w => h += '<tr><td style="width:100%">' + esc(w.n) +
      '<div class="dm sm">Lv1 ' + cm(w.pw[0]) + ' → Lv' + w.pw.length + ' ' + cm(w.pw[w.pw.length - 1]) +
      ' · ' + (wIsMelee(w) ? '격투' : '사격') + ' · ' + esc(w.at || '-') + (wIsAwk(w) ? ' <span class="pk">〔각성〕</span>' : '') +
      ' · 명중 ' + w.ac + (w.cr ? ' · 크리 ' + w.cr : '') + (w.en ? ' · EN ' + w.en : '') + (w.am ? ' · 탄 ' + w.am : '') +
      ' · 거리 ' + Math.max(1, w.mn * RANGE_MUL - 1) + '~' + Math.max(1, w.mx * RANGE_MUL) + '</div></td></tr>');
    h += '</table>';
    if (B.ab && B.ab.length) {
      h += '<table class="tb" style="margin:6px 0 0"><caption>【 특성 】</caption>';
      B.ab.forEach(a => h += '<tr><td style="width:100%"><span class="cy">' + esc(a.n) + '</span>' +
        (a.d ? '<div class="dm sm">' + esc(a.d) + '</div>' : '') + '</td></tr>');
      h += '</table>';
    }
    h += '<div class="row-btn"><button class="btn" data-bkclose="1">【닫기】</button></div></div>';
  }
  h += '<div class="ugrid">';
  list.forEach(B => h += '<button class="ucard" data-bk="' + B.id + '">' +
    '<img class="ui m" src="' + picFor(B, 'm') + '" alt="" loading="lazy" decoding="async">' +
    '<div style="min-width:0"><div class="cn">' + esc(B.nm) + '</div>' +
    '<div class="cs">' + esc(B.mdl || '') + '</div>' +
    '<div class="cs">' + TER_ORDER.map(k => '<b class="a' + adaptBase(B, k) + '">' + ADAPT_MARK[adaptBase(B, k)] + '</b>').join('') + '</div></div></button>');
  return h + '</div>';
}

/* ---------------- 기록 ---------------- */
function viewLog() {
  let h = '<h2 class="sec">【 전투 기록 】<em>DAY ' + g.day + '</em></h2>';
  h += '<table class="tb"><caption>【 통계 】</caption>' +
    '<tr><th>총 출격</th><td>' + g.sorties + ' 회</td><th>격추</th><td>' + g.kills + ' 기</td></tr>' +
    '<tr><th>완수/실패</th><td>' + g.wins + ' / ' + g.losses + '</td><th>피격추</th><td>' + g.downs + ' 회</td></tr>' +
    '<tr><th>계급</th><td class="ye">' + rankOf(g.kills) + '</td><th>명성</th><td>' + g.fame + '</td></tr>' +
    '<tr><th>능력 합계</th><td>' + cm(statTotal()) + '</td><th>초기 기력</th><td>' + g.mor0 + '</td></tr>' +
    '<tr><th>보유 기체</th><td>' + g.garage.length + ' 기</td><th>기함 격파</th><td class="' + (g.flags.bossDown ? 'li' : 'dm') + '">' + (g.flags.bossDown ? '달성' : '미달성') + '</td></tr>' +
    '</table>';
  h += '<table class="tb grid"><caption>【 출격 이력 】</caption>' +
    '<tr><th style="width:52px">DAY</th><th>임무</th><th style="width:52px">전장</th><th style="width:56px">결과</th><th style="width:44px">격추</th><th style="width:86px">보수</th><th style="width:52px">잔여</th></tr>';
  if (!g.records.length) h += '<tr><td colspan="7" class="dm">기록 없음</td></tr>';
  g.records.forEach(r => h += '<tr><td>' + r.day + '</td><td style="text-align:left">' + r.m + '</td>' +
    '<td>' + (r.t ? TERRAIN[r.t].n : '—') + '</td>' +
    '<td class="' + (r.r === 'win' ? 'li' : r.r === 'lose' ? 'rd' : 'dm') + '">' + (r.r === 'win' ? '완수' : r.r === 'lose' ? '대파' : '철수') + '</td>' +
    '<td>' + r.kills + '</td><td class="ye">' + cm(r.pay) + '</td><td>' + r.hp + '%</td></tr>');
  return h + '</table>';
}

/* =========================================================================
   바인딩
   ========================================================================= */
function bindMain() {
  const host = $('mainf');
  if (!g) return;

  /* 레벨업 포인트 배분 */
  bindAlloc('tr',
    () => ({ vals: (() => { const o = {}; STK.forEach(k => o[k] = g.st[k] + trAlloc[k]); return o; })(), remain: g.pt - trSpent(), spent: trAlloc }),
    (k, n) => { trAlloc[k] += n; });
  const ac = $('bAlCancel'); if (ac) ac.onclick = () => { resetTrAlloc(); renderMain(); };
  const ao = $('bAlOK'); if (ao) ao.onclick = () => {
    const n = trSpent();
    if (n <= 0 || n > g.pt) return;
    STK.forEach(k => g.st[k] = Math.min(STAT_MAX, g.st[k] + trAlloc[k]));
    g.pt -= n; resetTrAlloc();
    S.msg = { t: '능력 배분 완료', b: n + '포인트를 배분했습니다.' };
    save(); renderAll();
  };

  host.querySelectorAll('[data-tr]').forEach(b => b.onclick = () => doTrain(b.dataset.tr));
  host.querySelectorAll('[data-sk]').forEach(b => b.onclick = () => {
    const sk = CSKMAP[b.dataset.sk];
    if (!sk || g.sk.indexOf(sk.k) >= 0 || sk.c > g.cash) return;
    g.cash -= sk.c; g.sk.push(sk.k);
    S.msg = { t: sk.n + ' 습득', b: cm(sk.c) + 'C 지불.' };
    save(); renderAll();
  });

  host.querySelectorAll('[data-ter]').forEach(b => b.onclick = () => { S.ter = b.dataset.ter; renderMain(); });
  host.querySelectorAll('[data-tac]').forEach(b => b.onclick = () => { S.tac = b.dataset.tac; renderMain(); });
  host.querySelectorAll('[data-ms]').forEach(b => b.onclick = () => {
    const m = MISSION.find(v => v.id === b.dataset.ms);
    if (!m || g.ap < m.ap || g.lv < m.lv || !canSortie(cur(), S.ter)) return;
    g.ap -= m.ap; S.msg = null; runBattle(m, S.tac, S.ter);
  });
  const sk = $('bSkip'); if (sk) sk.onclick = () => { S.skip = true; sk.disabled = true; sk.textContent = '【생략 중…】'; };
  const bk = $('bBack'); if (bk) bk.onclick = () => { S.view = 'main'; S.res = null; renderAll(); };
  const ag = $('bAgain'); if (ag) ag.onclick = () => { S.view = 'sortie'; S.res = null; renderAll(); };

  const fx = $('bFix'); if (fx) fx.onclick = () => {
    const c = repairCost();
    if (c <= 0 || c > g.cash || g.ap <= 0) return;
    g.cash -= c; g.ap--; cur().hp = uStat(cur()).hpMax;
    S.msg = { t: '정비 완료', b: cm(c) + 'C를 지불하고 기체를 완전 복구했습니다.' };
    save(); renderAll();
  };

  host.querySelectorAll('[data-mod]').forEach(b => b.onclick = () => {
    const k = b.dataset.mod, v = cur(), B = UMAP[v.id], c = modCost(B, v.mod[k] | 0);
    if ((v.mod[k] | 0) >= MODMAX || c > g.cash) return;
    const before = uStat(v).hpMax;
    g.cash -= c; v.mod[k] = (v.mod[k] | 0) + 1;
    if (k === 'hp') v.hp += uStat(v).hpMax - before;
    v.hp = Math.min(v.hp, uStat(v).hpMax);
    S.msg = { t: MOD[k].n + ' ' + v.mod[k] + '단', b: cm(c) + 'C 투입 — ' + MOD[k].u + ' 적용되었습니다.' };
    save(); renderAll();
  });
  host.querySelectorAll('[data-part]').forEach(b => b.onclick = () => {
    const k = b.dataset.part, v = cur(), B = UMAP[v.id], c = partCost(B);
    if ((v.pt || []).length >= PART_SLOT || adaptOf(v, k) >= 2 || c > g.cash) return;
    g.cash -= c; v.pt.push(k);
    S.msg = { t: PARTS[k].n + ' 장착', b: cm(c) + 'C 투입 — ' + TERRAIN[k].n + ' 적성 ' + ADAPT_MARK[adaptOf(v, k)] + ' 로 상승했습니다.' };
    save(); renderAll();
  });
  host.querySelectorAll('[data-unpart]').forEach(b => b.onclick = () => {
    const i = +b.dataset.unpart, v = cur();
    if (!v.pt || i < 0 || i >= v.pt.length) return;
    const k = v.pt[i];
    if (!confirm(PARTS[k].n + ' 을(를) 탈거합니다. 대금은 환불되지 않습니다.')) return;
    v.pt.splice(i, 1);
    S.msg = { t: '파츠 탈거', b: PARTS[k].n + ' 을(를) 떼어냈습니다.' };
    save(); renderAll();
  });
  host.querySelectorAll('[data-wl]').forEach(b => b.onclick = () => {
    const i = +b.dataset.wl, v = cur(), B = UMAP[v.id], lv = v.wl[i] || 1, c = wlCost(B, lv);
    if (lv >= wpMax(v, i) || c > g.cash) return;
    g.cash -= c; v.wl[i] = lv + 1;
    S.msg = { t: B.w[i].n + ' Lv' + v.wl[i], b: cm(c) + 'C 투입 — 위력 ' + cm(wpowOf(v, i)) + '로 상승했습니다.' };
    save(); renderAll();
  });

  host.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
    const B = UMAP[b.dataset.buy], p = +b.dataset.price;
    if (!B || g.garage.some(v => v.id === B.id) || g.lv < lvReqOf(B) || p > g.cash) return;
    g.cash -= p; g.garage.push(mkOwned(B.id));
    S.msg = { t: esc(B.nm) + ' 인수', b: cm(p) + 'C 지불. 【격납고】에서 탑승기를 변경할 수 있습니다.' };
    save(); renderAll();
  });

  host.querySelectorAll('[data-ride]').forEach(b => b.onclick = () => {
    g.cur = +b.dataset.ride;
    S.msg = { t: '탑승기 변경', b: esc(UMAP[cur().id].nm) + '에 탑승했습니다.' };
    save(); renderAll();
  });
  host.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => {
    const i = +b.dataset.sell;
    if (g.garage.length <= 1 || i === g.cur) return;
    const B = UMAP[g.garage[i].id], val = Math.round(buyPrice(B) * 0.55);
    if (!confirm(B.nm + ' 을(를) ' + cm(val) + 'C에 매각합니다. 개조·파츠 투자분은 환불되지 않습니다.')) return;
    g.garage.splice(i, 1); if (g.cur > i) g.cur--;
    g.cash += val;
    S.msg = { t: '매각 완료', b: esc(B.nm) + ' → ' + cm(val) + 'C' };
    save(); renderAll();
  });

  const bs = $('bookSeries'); if (bs) bs.onchange = () => { S.bookSr = bs.value; renderMain(); };
  host.querySelectorAll('[data-bk]').forEach(b => b.onclick = () => { S.bookSel = b.dataset.bk; renderMain(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  host.querySelectorAll('[data-bkclose]').forEach(b => b.onclick = () => { S.bookSel = null; renderMain(); });
  const bq = $('bookQ');
  if (bq) {
    bq.oninput = () => { S.bookQ = bq.value; const p = bq.selectionStart; renderMain(); const n = $('bookQ'); if (n) { n.focus(); n.setSelectionRange(p, p); } };
  }
}

/* ---------------- 다음 날 ---------------- */
function nextDay() {
  if (S.busy) return;
  g.day++;
  const up = 1500 + g.lv * 400;
  g.cash = Math.max(0, g.cash - up);
  g.ap = g.apMax;
  const tot = EVENTS.reduce((a, e) => a + e.p, 0);
  let r = Math.random() * tot, ev = EVENTS[EVENTS.length - 1];
  for (const e of EVENTS) { r -= e.p; if (r <= 0) { ev = e; break; } }
  const txt = ev.f(g);
  cur().hp = Math.min(cur().hp, uStat(cur()).hpMax);
  S.view = 'main'; S.res = null;
  S.msg = { t: 'DAY ' + g.day + ' — 아침 점호', b: '부대 유지비 <b class="rd">−' + cm(up) + 'C</b> 청구. 행동력 ' + g.apMax + ' 회복.<br>' + txt +
    '<br><span class="dm">암시장 매물이 새로 들어왔습니다.</span>' };
  save(); renderAll();
}

/* ---------------- 기동 ---------------- */
$('aSave').onclick = () => { if (g) { save(); S.msg = { t: '저장 완료', b: '현재 진행 상황을 브라우저에 기록했습니다.' }; S.view = 'main'; renderAll(); } };
$('aLoad').onclick = () => {
  if (load()) { S.view = 'main'; S.msg = { t: '불러오기 완료', b: 'DAY ' + g.day + ' 시점의 기록을 복원했습니다.' }; renderAll(); }
  else stamp('저장된 기록 없음');
};
$('aReset').onclick = () => {
  if (!confirm('기록을 완전히 말소하고 새 파일럿을 등록합니다.\n되돌릴 수 없습니다. 진행하시겠습니까?')) return;
  try { localStorage.removeItem(SAVEKEY); } catch (e) {}
  g = null; newSt = null; startPool = null; trAlloc = null; S.view = 'main'; S.msg = null;
  stamp('기록 말소됨'); renderAll();
};

if (load()) { stamp('기록 복원 — DAY ' + g.day); S.msg = { t: '귀환을 환영합니다', b: 'DAY ' + g.day + ' 시점부터 재개합니다.' }; }
else stamp('신규 등록 필요');
renderAll();
