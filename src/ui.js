
/* =========================================================================
   렌더링
   ========================================================================= */
function gauge(cls, cur, max, label) {
  const r = max > 0 ? clamp(cur / max, 0, 1) : 0;
  const w = cls === 'hp' ? (r > .5 ? 'hp' : r > .25 ? 'hp w' : 'hp c') : cls;
  return '<div class="gg"><i class="' + w + '" style="width:' + (r * 100) + '%"></i><span>' + label + '</span></div>';
}
/* 등급(N·SR·UR…) 표기는 게임에서 제거했다. 가격·해금·적 편성용 내부 키로만 남는다. */
const modCost = (rar, lv) => Math.round(PRICE[rar] * 0.045 * Math.pow(1.34, lv) / 100) * 100;
const wlCost = (rar, lv) => Math.round(PRICE[rar] * 0.05 * lv / 100) * 100;
const buyPrice = B => Math.round(PRICE[B.rar] * (B.lg ? 1.15 : 1));

/* 표시 크기에 맞는 이미지를 고른다.
   썸네일은 128x128 이라 44px(.s)·72px(.m) 까지만 쓰고,
   104px(.l)·132px(.xl) 에는 936x803 초상화 원본을 쓴다. */
const picFor = (B, cls) => (cls === 'l' || cls === 'xl') ? B.img : (B.th || B.img);

/* 유닛 행 (이미지 + 제원) */
function uRow(B, sizeCls, extraLine) {
  return '<div class="urow">' +
    '<img class="ui ' + (sizeCls || 'm') + '" src="' + picFor(B, sizeCls) + '" alt="" loading="lazy" decoding="async">' +
    '<div class="meta">' +
      '<div class="t1"><span class="un">' + esc(B.nm) + '</span></div>' +
      '<div class="mdl">' + esc(B.mdl || '—') + ' · ' + esc(B.sr || '') + ' · ' + roleN(B.role) + (B.lg ? ' · 대형' : '') + '</div>' +
      '<div class="stats"><span>HP <b>' + cm(B.hp) + '</b></span><span>공격력 <b>' + cm(B.atk) + '</b></span>' +
      '<span>방어력 <b>' + cm(B.def) + '</b></span><span>기동력 <b>' + cm(B.mob) + '</b></span>' +
      '<span>EN <b>' + B.en + '</b></span><span>이동력 <b>' + B.mov + '</b></span></div>' +
      (extraLine ? '<div class="wl">' + extraLine + '</div>' : '') +
    '</div></div>';
}
const wepLine = B => B.w.map(w => w.n + '(' + cm(w.pw[w.pw.length - 1]) + ')').join(' · ') || '무장 없음';

/* ---------------- 좌측 ---------------- */
function renderLeft() {
  const host = $('lft');
  if (!g) { host.innerHTML = '<table class="tb"><caption>【 STATUS 】</caption><tr><td>등록된 파일럿이 없습니다.</td></tr></table>'; return; }
  const v = cur(), s = uStat(v), B = s.B, F = FACTIONS[g.fac];

  let h = '<table class="tb"><caption>【 파일럿 】</caption>' +
    '<tr><th>이름</th><td class="cy">' + esc(g.name) + '</td></tr>' +
    '<tr><th>소속</th><td>' + F.n + '</td></tr>' +
    '<tr><th>계급</th><td class="ye">' + rankOf(g.kills) + '</td></tr>' +
    '<tr><th>레벨</th><td>Lv ' + g.lv + ' <span class="dm">/ 명성 ' + g.fame + '</span></td></tr>' +
    '<tr><th>EXP</th><td>' + gauge('ex', g.exp, expNeed(g.lv), cm(g.exp) + ' / ' + cm(expNeed(g.lv))) + '</td></tr>' +
    '<tr><th>자금</th><td class="ye">' + cm(g.cash) + ' C</td></tr>' +
    '<tr><th>행동력</th><td>' + gauge('ap', g.ap, g.apMax, g.ap + ' / ' + g.apMax) + '</td></tr>' +
    '<tr><th>전적</th><td>' + g.wins + '승 ' + g.losses + '패 <span class="dm">/ 격추 ' + g.kills + '</span></td></tr>' +
    '</table>';

  h += '<table class="tb grid"><caption>【 능력치 】</caption><tr>';
  ['sho', 'mel', 'rea'].forEach(k => h += '<th>' + STN[k] + '</th>'); h += '</tr><tr>';
  ['sho', 'mel', 'rea'].forEach(k => h += '<td class="' + (g.st[k] >= 15 ? 'ye' : '') + '">' + g.st[k] + '</td>'); h += '</tr><tr>';
  ['def', 'skl', 'spi'].forEach(k => h += '<th>' + STN[k] + '</th>'); h += '</tr><tr>';
  ['def', 'skl', 'spi'].forEach(k => h += '<td class="' + (g.st[k] >= 15 ? 'ye' : '') + '">' + g.st[k] + '</td>');
  h += '</tr></table>';

  h += '<table class="tb"><caption>【 탑승기 】' + (s.modSum ? '<span class="dm" style="float:right">개조 ' + s.modSum + '단</span>' : '') + '</caption>' +
    '<tr><td colspan="2" style="padding:5px"><div style="display:flex;gap:8px;align-items:flex-start">' +
    '<img class="ui l" src="' + B.img + '" alt="">' +
    '<div style="min-width:0"><div class="cy" style="font-size:12.5px;line-height:1.3">' + esc(B.nm) + '</div>' +
    '<div class="dm" style="font-size:10.5px">' + esc(B.mdl || '') + '</div>' +
    '<div class="dm" style="font-size:10.5px">' + esc(B.sr || '') + '</div>' +
    '<div class="dm" style="font-size:10.5px">' + roleN(B.role) + (B.lg ? ' · 대형' : '') + '</div></div>' +
    '</div></td></tr>' +
    '<tr><th>HP</th><td>' + gauge('hp', v.hp, s.hpMax, cm(v.hp) + ' / ' + cm(s.hpMax)) + '</td></tr>' +
    '<tr><th>EN</th><td>' + cm(s.enMax) + '</td></tr>' +
    '<tr><th>공격력</th><td>' + cm(s.atk) + '</td></tr>' +
    '<tr><th>방어력</th><td>' + cm(s.def) + '</td></tr>' +
    '<tr><th>기동력</th><td>' + cm(s.mob) + '</td></tr>' +
    '</table>';

  h += '<table class="tb"><caption>【 병장 】</caption>';
  if (!B.w.length) h += '<tr><td class="dm">무장 없음</td></tr>';
  B.w.forEach((w, i) => {
    const lv = (v.wl && v.wl[i]) || 1;
    h += '<tr><td style="width:100%">' + esc(w.n) + ' <span class="ye">Lv' + lv + '</span>' +
      '<div class="dm" style="font-size:10.5px">위력 ' + cm(wpowOf(v, i)) + ' · ' + (wIsMelee(w) ? '격투' : '사격') +
      ' · ' + esc(w.at || '-') + (w.en ? ' · EN ' + w.en : '') + (w.am ? ' · 탄 ' + w.am : '') +
      ' · 사거리 ' + w.mn + '~' + w.mx + '</div></td></tr>';
  });
  h += '</table>';

  if (B.ab && B.ab.length) {
    h += '<table class="tb"><caption>【 기체 특성 】</caption>';
    B.ab.forEach(a => h += '<tr><td style="width:100%"><span class="cy">' + esc(a.n) + '</span>' +
      (a.d ? '<div class="dm" style="font-size:10.5px">' + esc(a.d) + '</div>' : '') + '</td></tr>');
    h += '</table>';
  }
  host.innerHTML = h;
}

/* ---------------- 커맨드 ---------------- */
const CMDS = [['main', '상황실'], ['train', '훈련'], ['sortie', '출격'], ['repair', '정비'],
['mod', '개조'], ['shop', '개발'], ['hangar', '격납고'], ['book', '도감'], ['log', '기록']];
function renderCmd() {
  const host = $('cmdbar');
  if (!g) { host.innerHTML = ''; return; }
  let h = '';
  CMDS.forEach(c => h += '<button class="cbtn' + (S.view === c[0] ? ' on' : '') + '" data-v="' + c[0] + '"' +
    (S.busy ? ' disabled' : '') + '>【' + c[1] + '】</button>');
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
  const map = { train: viewTrain, sortie: viewSortie, battle: viewBattle, repair: viewRepair, mod: viewMod, shop: viewShop, hangar: viewHangar, book: viewBook, log: viewLog };
  host.innerHTML = (map[S.view] || viewMain)();
  bindMain();
  const lg = $('blog'); if (lg) lg.scrollTop = lg.scrollHeight;
}
function renderAll() { renderLeft(); renderMain(); renderCmd(); }
const msgBox = () => S.msg ? '<div class="rbox"><div class="rt ye">' + S.msg.t + '</div><div>' + S.msg.b + '</div></div>' : '';

/* ---------------- 신규 등록 ---------------- */
let rollTmp = null, rollN = 0, startPool = null, startSel = 0;
function rollStats() { rollTmp = {}; Object.keys(STN).forEach(k => rollTmp[k] = rint(2, 6)); rollN++; }
function rollStart() {
  const p = UNITS.filter(u => u.rar === 'N' && u.w.length);
  startPool = []; const used = {};
  while (startPool.length < 3 && startPool.length < p.length) { const u = pick(p); if (used[u.id]) continue; used[u.id] = 1; startPool.push(u); }
  startSel = 0;
}
function viewNew() {
  if (!rollTmp) rollStats();
  if (!startPool) rollStart();
  const tot = Object.keys(rollTmp).reduce((a, k) => a + rollTmp[k], 0);
  let h = '<h2 class="sec">【 신규 파일럿 등록 】<em>NEW RECORD</em></h2>' +
    '<p class="lead">G-Over World 에 오신 것을 환영합니다. 이름과 소속을 정하고 초기 적성을 굴린 뒤, 배속받을 초기 기체를 고르십시오.</p>' +
    '<table class="tb"><caption>【 등록 】</caption>' +
    '<tr><th>이름</th><td><input type="text" id="nName" maxlength="12" placeholder="파일럿 이름" style="width:160px"></td></tr>' +
    '<tr><th>소속</th><td><select id="nFac">';
  Object.keys(FACTIONS).forEach(k => h += '<option value="' + k + '">' + FACTIONS[k].n + '</option>');
  h += '</select> <span class="dm" id="facDesc">' + FACTIONS.fed.d + '</span></td></tr></table>';

  h += '<table class="tb grid"><caption>【 초기 적성 】<span class="dm" style="float:right">합계 ' + tot + ' / 시행 ' + rollN + '회</span></caption><tr>';
  Object.keys(STN).forEach(k => h += '<th>' + STN[k] + '</th>'); h += '</tr><tr>';
  Object.keys(STN).forEach(k => h += '<td class="' + (rollTmp[k] >= 6 ? 'ye' : rollTmp[k] <= 2 ? 'rd' : '') + '">' + rollTmp[k] + '</td>');
  h += '</tr></table>';

  h += '<h2 class="sec">【 초기 배속 기체 】<em>선택</em></h2><div class="pick">';
  startPool.forEach((B, i) => {
    h += '<button data-start="' + i + '" style="' + (i === startSel ? 'background:#151534;box-shadow:inset 3px 0 0 var(--yel)' : '') + '">' +
      uRow(B, 'm', wepLine(B)) + '</button>';
  });
  h += '</div>';
  h += '<div class="row-btn"><button class="btn" id="bReroll">【적성 재시행】</button>' +
    '<button class="btn" id="bRerollU">【기체 재추첨】</button>' +
    '<button class="btn p" id="bStart">【등록하고 배속】</button></div>';
  return h;
}
function bindNew() {
  const sel = $('nFac'); if (sel) sel.onchange = () => $('facDesc').textContent = FACTIONS[sel.value].d;
  $('bReroll').onclick = () => { rollStats(); renderMain(); };
  $('bRerollU').onclick = () => { rollStart(); renderMain(); };
  document.querySelectorAll('[data-start]').forEach(b => b.onclick = () => { startSel = +b.dataset.start; renderMain(); });
  $('bStart').onclick = () => {
    const nm = ($('nName').value || '').trim() || '이름없는 파일럿';
    const fac = $('nFac').value, F = FACTIONS[fac], st = Object.assign({}, rollTmp);
    for (const k in F.bonus) st[k] += F.bonus[k];
    newGame(nm, fac, st, startPool[startSel].id);
    S.view = 'main';
    S.msg = { t: '배속 완료', b: esc(nm) + ' — ' + F.n + ' 소속. 탑승기 <b class="cy">' + esc(startPool[startSel].nm) + '</b>. 전선 기록을 개시합니다.' };
    renderAll();
  };
}

/* ---------------- 상황실 ---------------- */
function viewMain() {
  const v = cur(), s = uStat(v), hpr = v.hp / s.hpMax;
  let h = '<h2 class="sec">【 상황실 】<em>DAY ' + g.day + '</em></h2>' + msgBox();
  h += '<p class="lead">제 <b>' + g.day + '</b>일 · 행동력 <b>' + g.ap + '</b>/' + g.apMax + ' · 자금 <b>' + cm(g.cash) + 'C</b> · 보유 기체 <b>' + g.garage.length + '</b>기</p>';
  const w = [];
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
  g.records.slice(0, 5).forEach(r => h += '<tr><td style="width:100%"><span class="dm">DAY ' + r.day + '</span> ' + r.m + ' — ' +
    '<span class="' + (r.r === 'win' ? 'li' : r.r === 'lose' ? 'rd' : 'dm') + '">' + (r.r === 'win' ? '완수' : r.r === 'lose' ? '대파' : '철수') +
    '</span> <span class="dm">격추 ' + r.kills + ' / ' + cm(r.pay) + 'C</span></td></tr>');
  h += '</table>';
  return h;
}

/* ---------------- 훈련 ---------------- */
function viewTrain() {
  let h = '<h2 class="sec">【 훈련 】<em>행동력 1</em></h2>';
  if (S.res && S.res.kind === 'train') {
    const r = S.res;
    h += '<div class="rbox"><div class="rt ' + (r.up >= 3 ? 'ye' : r.up ? 'li' : 'dm') + '">' + r.title + '</div>' +
      '<div class="mn" style="font-size:11.5px">2d6 = ' + r.roll + ' + 기량보정 ' + r.bon + ' vs 목표치 ' + r.tgt + '</div>' +
      '<table><tr><td>' + STN[r.k] + '</td><td class="n">' + (r.up ? '+' + r.up + ' → ' + g.st[r.k] : '변화 없음') + '</td></tr>' +
      '<tr><td>경험치</td><td class="n">+' + r.exp + '</td></tr></table></div>';
  }
  h += '<p class="lead">항목을 골라 하루의 절반을 소모합니다. <b>기량</b>이 높을수록 성공률이 오르고, 능력치가 높아질수록 목표치도 올라갑니다.</p>';
  if (g.ap <= 0) h += '<div class="note">※ <b>행동력이 부족합니다.</b></div>';
  h += '<div class="pick">';
  TRAIN.forEach(t => {
    const tgt = 6 + Math.floor(g.st[t.k] / 2), bon = Math.floor(g.st.skl / 2);
    let p = 0; for (const x in P2) if (+x + bon >= tgt) p += P2[x];
    const dis = g.ap <= 0 || g.st[t.k] >= 20;
    h += (dis ? '<div class="dis">' : '<button data-tr="' + t.k + '">') +
      '<span class="l1"><span class="nm">' + STN[t.k] + ' 훈련</span><span class="cost">현재 ' + g.st[t.k] + ' / 성공률 ' + Math.round(p * 100) + '%</span></span>' +
      '<span class="l2">' + t.d + ' <b>목표치 ' + tgt + '</b></span>' + (dis ? '</div>' : '</button>');
  });
  return h + '</div>';
}
function doTrain(k) {
  if (g.ap <= 0 || g.st[k] >= 20) return;
  g.ap--;
  const roll = r2(), bon = Math.floor(g.st.skl / 2), tgt = 6 + Math.floor(g.st[k] / 2), mg = roll.t + bon - tgt;
  let up = 0, title = '성과 없음 — 몸이 따라주지 않는다';
  if (roll.t === 12) { up = 3; title = '대성공! 한계를 돌파했다'; }
  else if (mg >= 5) { up = 2; title = '성공 — 확실히 감이 잡혔다'; }
  else if (mg >= 0) { up = 1; title = '성공 — 착실한 진전'; }
  g.st[k] = Math.min(20, g.st[k] + up);
  const exp = 18 + up * 12;
  g.lvupNote = []; gainExp(exp);
  S.res = { kind: 'train', k: k, up: up, roll: roll.t, bon: bon, tgt: tgt, exp: exp, title: title };
  save(); renderAll();
}

/* ---------------- 출격 ---------------- */
function viewSortie() {
  const v = cur(), s = uStat(v);
  let h = '<h2 class="sec">【 출격 】<em>2d6 대항판정 자동 전투</em></h2>';
  h += '<p class="lead">전법을 정하고 임무를 선택하십시오. 최대 <b>20라운드</b>까지 자동 진행되며 남은 HP는 그대로 유지됩니다. 적 편성은 <b>출격할 때마다 무작위</b>로 편성됩니다.</p>';
  h += '<table class="tb"><caption>【 전법 】</caption><tr>';
  Object.keys(TACTIC).forEach(k => h += '<td style="padding:0;text-align:center"><button class="cbtn' + (S.tac === k ? ' on' : '') +
    '" data-tac="' + k + '" style="width:100%;text-align:center">【' + TACTIC[k].n + '】</button></td>');
  h += '</tr><tr><td colspan="4" class="dm" style="font-family:var(--f-ui)">' + TACTIC[S.tac].d + '</td></tr></table>';
  if (v.hp / s.hpMax < 0.35) h += '<div class="note">※ 기체 손상이 심각합니다(<b>' + Math.round(v.hp / s.hpMax * 100) + '%</b>). 정비 없이 출격하면 대파 위험이 큽니다.</div>';
  h += '<div class="pick">';
  MISSION.forEach(m => {
    const lvOK = g.lv >= m.lv, apOK = g.ap >= m.ap, dis = !lvOK || !apOK;
    const why = !lvOK ? '<span class="rd">Lv' + m.lv + ' 필요</span>' : !apOK ? '<span class="rd">AP ' + m.ap + ' 필요</span>' : 'AP ' + m.ap + ' / ' + cm(m.pay) + 'C';
    h += (dis ? '<div class="dis">' : '<button data-ms="' + m.id + '">') +
      '<span class="l1"><span class="nm">【' + m.n + '】</span><span class="cost">' + why + '</span></span>' +
      '<span class="l2">' + m.d + ' <b>적 ' + m.cnt + '기 / ' + m.pool.join('·') + (m.ace ? ' + ' + m.ace + ' 에이스' : '') + '</b></span>' +
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
      (r.r === 'win' ? '임무 완수' : r.r === 'lose' ? '기체 대파' : '교전 이탈') + ' — ' + r.n + '</div><table>' +
      '<tr><td>격추</td><td class="n">' + r.kills + ' 기</td></tr>' +
      '<tr><td>획득 자금</td><td class="n">' + cm(r.pay) + ' C</td></tr>' +
      '<tr><td>획득 경험치</td><td class="n">' + cm(r.exp) + '</td></tr></table>' +
      (r.lv.length ? '<div class="li mn" style="margin-top:4px;font-size:11.5px">★ ' + r.lv.join('<br>★ ') + '</div>' : '') + '</div>';
  }
  h += '<div class="duel' + (S.duel ? '' : ' idle') + '" id="duel">' +
      (S.duel || '<div class="dm" style="grid-column:1/-1;text-align:center">교전 대기</div>') + '</div>' +
    '<div class="bboard" id="bboard">' + (S.board || '') + '</div>' +
    '<div id="blog">' + ((S.blog || []).join('')) + '</div><div class="row-btn">';
  h += S.busy ? '<button class="btn" id="bSkip">【연출 생략】</button>'
    : '<button class="btn p" id="bBack">【귀환 보고】</button><button class="btn" id="bAgain">【재출격】</button>';
  return h + '</div>';
}

/* ---------------- 정비 ---------------- */
const repairCost = () => { const v = cur(), s = uStat(v); return Math.ceil((s.hpMax - v.hp) * 0.16 * FACTIONS[g.fac].fix / 10) * 10; };
function viewRepair() {
  const v = cur(), s = uStat(v), c = repairCost();
  let h = '<h2 class="sec">【 정비 】<em>행동력 1</em></h2>' + msgBox();
  h += '<p class="lead">손상된 기체를 완전 복구합니다. 비용은 손상량에 비례하며 소속에 따라 할인됩니다.</p>';
  h += '<table class="tb"><caption>【 견적 】</caption>' +
    '<tr><th>기체</th><td>' + esc(s.B.nm) + '</td></tr>' +
    '<tr><th>현재 HP</th><td>' + cm(v.hp) + ' / ' + cm(s.hpMax) + ' <span class="dm">(손상 ' + cm(s.hpMax - v.hp) + ')</span></td></tr>' +
    '<tr><th>단가</th><td>손상 1당 ' + (0.16 * FACTIONS[g.fac].fix).toFixed(2) + ' C</td></tr>' +
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
    const M = MOD[k], lv = v.mod[k], c = modCost(B.rar, lv), maxed = lv >= MODMAX, poor = c > g.cash, dis = maxed || poor;
    const base = B[M.s], now = k === 'hp' ? s.hpMax : k === 'en' ? s.enMax : s[k];
    h += (dis ? '<div class="dis">' : '<button data-mod="' + k + '">') +
      '<span class="l1"><span class="nm">' + M.n + ' <span class="dm">[' + lv + '/' + MODMAX + ']</span></span>' +
      '<span class="cost">' + (maxed ? '<span class="li">MAX</span>' : (poor ? '<span class="rd">' : '') + cm(c) + ' C' + (poor ? '</span>' : '')) + '</span></span>' +
      '<span class="l2">' + M.u + ' · 현재 <b>' + cm(now) + '</b> <span class="dm">(기본 ' + cm(base) + ')</span></span>' +
      (dis ? '</div>' : '</button>');
  });
  h += '</div>';

  h += '<h2 class="sec">【 병장 강화 】<em>레벨업 시 위력 상승</em></h2><div class="pick">';
  if (!B.w.length) h += '<div class="dis">무장이 없습니다.</div>';
  B.w.forEach((w, i) => {
    const lv = (v.wl && v.wl[i]) || 1, mx = wpMax(v, i), c = wlCost(B.rar, lv), maxed = lv >= mx, poor = c > g.cash, dis = maxed || poor;
    const nextPw = maxed ? null : w.pw[lv];
    h += (dis ? '<div class="dis">' : '<button data-wl="' + i + '">') +
      '<span class="l1"><span class="nm">' + esc(w.n) + ' <span class="ye">Lv' + lv + '</span><span class="dm">/' + mx + '</span></span>' +
      '<span class="cost">' + (maxed ? '<span class="li">MAX</span>' : (poor ? '<span class="rd">' : '') + cm(c) + ' C' + (poor ? '</span>' : '')) + '</span></span>' +
      '<span class="l2">위력 <b>' + cm(wpowOf(v, i)) + '</b>' + (nextPw ? ' → <b class="ye">' + cm(nextPw) + '</b>' : '') +
      ' · ' + (wIsMelee(w) ? '격투' : '사격') + ' · ' + esc(w.at || '-') +
      (w.en ? ' · EN ' + w.en : '') + (w.am ? ' · 탄 ' + w.am : '') + '</span>' + (dis ? '</div>' : '</button>');
  });
  return h + '</div>';
}

/* ---------------- 개발(상점) ---------------- */
function viewShop() {
  let h = '<h2 class="sec">【 개발 】<em>보유 ' + cm(g.cash) + ' C</em></h2>' + msgBox();
  h += '<div style="margin-bottom:8px">' +
    '<button class="cbtn' + (S.shopS === 'ALL' ? ' on' : '') + '" data-sr="ALL">【전체】</button>' +
    '<button class="cbtn' + (S.shopS === 'BUY' ? ' on' : '') + '" data-sr="BUY">【구입 가능】</button>' +
    ' <select id="shopSeries" style="max-width:230px"><option value="">— 작품 전체 —</option>' +
    SERIES_LIST.map(s => '<option value="' + esc(s) + '"' + (S.shopSel === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('') +
    '</select></div>';
  h += '<div class="note">※ 고성능기일수록 요구 레벨과 가격이 높습니다. 값은 기체 제원으로 정해집니다.</div>';
  let list = UNITS.slice();
  if (S.shopSel) list = list.filter(u => u.sr === S.shopSel);
  if (S.shopS === 'BUY') list = list.filter(u => g.lv >= LVREQ[u.rar] && buyPrice(u) <= g.cash && !g.garage.some(v => v.id === u.id));
  list.sort((a, b) => (a.hp + a.atk * 6) - (b.hp + b.atk * 6));
  h += '<div class="pick">';
  list.forEach(B => {
    const owned = g.garage.some(v => v.id === B.id), lvOK = g.lv >= LVREQ[B.rar], p = buyPrice(B), poor = p > g.cash;
    const dis = owned || !lvOK || poor;
    const why = owned ? '<span class="li">보유중</span>' : !lvOK ? '<span class="rd">Lv' + LVREQ[B.rar] + ' 필요</span>' :
      (poor ? '<span class="rd">' + cm(p) + ' C</span>' : cm(p) + ' C');
    h += (dis ? '<div class="dis">' : '<button data-buy="' + B.id + '">') +
      '<div class="urow"><img class="ui m" src="' + picFor(B, 'm') + '" alt="" loading="lazy" decoding="async"><div class="meta">' +
      '<div class="t1"><span class="un">' + esc(B.nm) + '</span><span class="cost">' + why + '</span></div>' +
      '<div class="mdl">' + esc(B.mdl || '—') + ' · ' + esc(B.sr || '') + ' · ' + roleN(B.role) + (B.lg ? ' · 대형' : '') + '</div>' +
      '<div class="stats"><span>HP <b>' + cm(B.hp) + '</b></span><span>공격력 <b>' + cm(B.atk) + '</b></span>' +
      '<span>방어력 <b>' + cm(B.def) + '</b></span><span>기동력 <b>' + cm(B.mob) + '</b></span><span>EN <b>' + B.en + '</b></span></div>' +
      '<div class="wl">' + esc(wepLine(B)) + '</div></div></div>' + (dis ? '</div>' : '</button>');
  });
  return h + '</div>';
}

/* ---------------- 격납고 ---------------- */
function viewHangar() {
  let h = '<h2 class="sec">【 격납고 】<em>보유 ' + g.garage.length + '기</em></h2>' + msgBox();
  h += '<p class="lead">탑승기를 변경하거나 불필요한 기체를 매각합니다. <span class="dm">매각가는 구입가의 55%이며 개조 투자분은 환불되지 않습니다.</span></p>';
  h += '<div class="pick">';
  g.garage.forEach((v, i) => {
    const s = uStat(v), B = s.B, on = i === g.cur;
    h += '<div style="display:block;padding:5px 8px;border-bottom:1px solid var(--bd2);background:' + (on ? '#151534' : 'var(--row2)') + '">' +
      '<div class="urow"><img class="ui m" src="' + picFor(B, 'm') + '" alt="" loading="lazy" decoding="async"><div class="meta">' +
      '<div class="t1"><span class="un" style="color:' + (on ? 'var(--yel)' : 'var(--lnk)') + '">' + (on ? '▶ ' : '') + esc(B.nm) + '</span>' +
      '<span class="cost">' + (on ? '<span class="ye">탑승중</span>' : '') + '</span></div>' +
      '<div class="mdl">' + esc(B.mdl || '—') + ' · ' + roleN(B.role) + ' · 개조 ' + s.modSum + '단</div>' +
      '<div class="stats"><span>HP <b>' + cm(v.hp) + '/' + cm(s.hpMax) + '</b></span><span>공격력 <b>' + cm(s.atk) + '</b></span>' +
      '<span>방어력 <b>' + cm(s.def) + '</b></span><span>기동력 <b>' + cm(s.mob) + '</b></span></div>' +
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
    SERIES_LIST.map(s => '<option value="' + esc(s) + '"' + (S.bookSel === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('') +
    '</select> <input type="text" id="bookQ" placeholder="기체명 / 형식번호" value="' + esc(S.bookQ) + '" style="width:190px"></div>';
  const q = S.bookQ.trim().toLowerCase();
  const list = UNITS.filter(u => (!S.bookSel || u.sr === S.bookSel) &&
    (!q || (u.nm + ' ' + u.mdl + ' ' + u.sr).toLowerCase().indexOf(q) >= 0))
    .sort((a, b) => (b.hp + b.atk * 6) - (a.hp + a.atk * 6));
  h += '<div class="dm mn" style="margin-bottom:6px">검색 결과 ' + list.length + '기</div>';
  if (S.bookSel && UMAP[S.bookSel]) {
    const B = UMAP[S.bookSel];
    h += '<div class="rbox"><div class="urow"><img class="ui l" src="' + B.img + '" alt="">' +
      '<div class="meta"><div class="rt" style="font-size:15px">' + esc(B.nm) + '</div>' +
      '<div class="mdl">' + esc(B.mdl || '—') + ' · ' + esc(B.sr || '') + ' · ' + roleN(B.role) + (B.lg ? ' · 대형' : '') + '</div>' +
      '<div class="stats"><span>HP <b>' + cm(B.hp) + '</b></span><span>공격력 <b>' + cm(B.atk) + '</b></span>' +
      '<span>방어력 <b>' + cm(B.def) + '</b></span><span>기동력 <b>' + cm(B.mob) + '</b></span>' +
      '<span>EN <b>' + B.en + '</b></span><span>이동력 <b>' + B.mov + '</b></span></div></div></div>' +
      '<table class="tb" style="margin:6px 0 0"><caption>【 병장 】</caption>';
    B.w.forEach(w => h += '<tr><td style="width:100%">' + esc(w.n) +
      '<div class="dm" style="font-size:10.5px">Lv1 ' + cm(w.pw[0]) + ' → Lv' + w.pw.length + ' ' + cm(w.pw[w.pw.length - 1]) +
      ' · ' + (wIsMelee(w) ? '격투' : '사격') + ' · ' + esc(w.at || '-') + ' · 명중 ' + w.ac +
      (w.cr ? ' · 크리 ' + w.cr : '') + (w.en ? ' · EN ' + w.en : '') + (w.am ? ' · 탄 ' + w.am : '') +
      ' · 사거리 ' + w.mn + '~' + w.mx + '</div></td></tr>');
    h += '</table>';
    if (B.ab && B.ab.length) {
      h += '<table class="tb" style="margin:6px 0 0"><caption>【 특성 】</caption>';
      B.ab.forEach(a => h += '<tr><td style="width:100%"><span class="cy">' + esc(a.n) + '</span>' +
        (a.d ? '<div class="dm" style="font-size:10.5px">' + esc(a.d) + '</div>' : '') + '</td></tr>');
      h += '</table>';
    }
    h += '<div class="row-btn"><button class="btn" data-bkclose="1">【닫기】</button></div></div>';
  }
  h += '<div class="ugrid">';
  list.forEach(B => h += '<button class="ucard" data-bk="' + B.id + '">' +
    '<img class="ui s" src="' + picFor(B, 's') + '" alt="" loading="lazy" decoding="async">' +
    '<div style="min-width:0"><div class="cn">' + esc(B.nm) + '</div>' +
    '<div class="cs">' + esc(B.mdl || '') + '</div></div></button>');
  return h + '</div>';
}

/* ---------------- 기록 ---------------- */
function viewLog() {
  let h = '<h2 class="sec">【 전투 기록 】<em>DAY ' + g.day + '</em></h2>';
  h += '<table class="tb"><caption>【 통계 】</caption>' +
    '<tr><th>총 출격</th><td>' + g.sorties + ' 회</td><th>격추</th><td>' + g.kills + ' 기</td></tr>' +
    '<tr><th>완수/실패</th><td>' + g.wins + ' / ' + g.losses + '</td><th>피격추</th><td>' + g.downs + ' 회</td></tr>' +
    '<tr><th>계급</th><td class="ye">' + rankOf(g.kills) + '</td><th>명성</th><td>' + g.fame + '</td></tr>' +
    '<tr><th>능력 합계</th><td>' + Object.keys(STN).reduce((a, k) => a + g.st[k], 0) + '</td><th>초기 기력</th><td>' + g.mor0 + '</td></tr>' +
    '<tr><th>보유 기체</th><td>' + g.garage.length + ' 기</td><th>기함 격파</th><td class="' + (g.flags.bossDown ? 'li' : 'dm') + '">' + (g.flags.bossDown ? '달성' : '미달성') + '</td></tr>' +
    '</table>';
  h += '<table class="tb grid"><caption>【 출격 이력 】</caption>' +
    '<tr><th style="width:52px">DAY</th><th>임무</th><th style="width:56px">결과</th><th style="width:44px">격추</th><th style="width:86px">보수</th><th style="width:52px">잔여</th></tr>';
  if (!g.records.length) h += '<tr><td colspan="6" class="dm">기록 없음</td></tr>';
  g.records.forEach(r => h += '<tr><td>' + r.day + '</td><td style="text-align:left">' + r.m + '</td>' +
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
  host.querySelectorAll('[data-tr]').forEach(b => b.onclick = () => doTrain(b.dataset.tr));
  host.querySelectorAll('[data-tac]').forEach(b => b.onclick = () => { S.tac = b.dataset.tac; renderMain(); });
  host.querySelectorAll('[data-ms]').forEach(b => b.onclick = () => {
    const m = MISSION.find(v => v.id === b.dataset.ms);
    if (!m || g.ap < m.ap || g.lv < m.lv) return;
    g.ap -= m.ap; S.msg = null; runBattle(m, S.tac);
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
    const k = b.dataset.mod, v = cur(), B = UMAP[v.id], c = modCost(B.rar, v.mod[k]);
    if (v.mod[k] >= MODMAX || c > g.cash) return;
    const before = uStat(v).hpMax;
    g.cash -= c; v.mod[k]++;
    if (k === 'hp') v.hp += uStat(v).hpMax - before;
    v.hp = Math.min(v.hp, uStat(v).hpMax);
    S.msg = { t: MOD[k].n + ' ' + v.mod[k] + '단', b: cm(c) + 'C 투입 — ' + MOD[k].u + ' 적용되었습니다.' };
    save(); renderAll();
  });
  host.querySelectorAll('[data-wl]').forEach(b => b.onclick = () => {
    const i = +b.dataset.wl, v = cur(), B = UMAP[v.id], lv = v.wl[i] || 1, c = wlCost(B.rar, lv);
    if (lv >= wpMax(v, i) || c > g.cash) return;
    g.cash -= c; v.wl[i] = lv + 1;
    S.msg = { t: B.w[i].n + ' Lv' + v.wl[i], b: cm(c) + 'C 투입 — 위력 ' + cm(wpowOf(v, i)) + '로 상승했습니다.' };
    save(); renderAll();
  });

  host.querySelectorAll('[data-sr]').forEach(b => b.onclick = () => { S.shopS = b.dataset.sr; S.msg = null; renderMain(); });
  const ss = $('shopSeries'); if (ss) ss.onchange = () => { S.shopSel = ss.value; S.msg = null; renderMain(); };
  host.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
    const B = UMAP[b.dataset.buy], p = buyPrice(B);
    if (!B || g.garage.some(v => v.id === B.id) || g.lv < LVREQ[B.rar] || p > g.cash) return;
    g.cash -= p; g.garage.push(mkOwned(B.id));
    S.msg = { t: esc(B.nm) + ' 인수', b: '【격납고】에서 탑승기를 변경할 수 있습니다.' };
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
    const B = UMAP[g.garage[i].id], v = Math.round(buyPrice(B) * 0.55);
    if (!confirm(B.nm + ' 을(를) ' + cm(v) + 'C에 매각합니다. 개조 투자분은 환불되지 않습니다.')) return;
    g.garage.splice(i, 1); if (g.cur > i) g.cur--;
    g.cash += v;
    S.msg = { t: '매각 완료', b: esc(B.nm) + ' → ' + cm(v) + 'C' };
    save(); renderAll();
  });

  const bs = $('bookSeries'); if (bs) bs.onchange = () => { S.bookSel = bs.value; renderMain(); };
  host.querySelectorAll('[data-bk]').forEach(b => b.onclick = () => { S.bookSel = b.dataset.bk; renderMain(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  host.querySelectorAll('[data-bkclose]').forEach(b => b.onclick = () => { S.bookSel = null; renderMain(); });
  const bq = $('bookQ');
  if (bq) {
    bq.oninput = () => { S.bookQ = bq.value; const p = bq.selectionStart; renderMain(); const n = $('bookQ'); if (n) { n.focus(); n.setSelectionRange(p, p); } };
  }

  host.querySelectorAll('[data-start]').forEach(b => b.onclick = () => { startSel = +b.dataset.start; renderMain(); });
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
  S.msg = { t: 'DAY ' + g.day + ' — 아침 점호', b: '부대 유지비 <b class="rd">−' + cm(up) + 'C</b> 청구. 행동력 ' + g.apMax + ' 회복.<br>' + txt };
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
  g = null; rollTmp = null; startPool = null; rollN = 0; S.view = 'main'; S.msg = null;
  stamp('기록 말소됨'); renderAll();
};

if (load()) { stamp('기록 복원 — DAY ' + g.day); S.msg = { t: '귀환을 환영합니다', b: 'DAY ' + g.day + ' 시점부터 재개합니다.' }; }
else stamp('신규 등록 필요');
renderAll();
