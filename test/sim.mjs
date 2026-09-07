/* =========================================================================
   밸런스 시뮬레이터

   실행 : node test/sim.mjs
          TERS=sp,gr,ai,uw,se N=50 node test/sim.mjs

   서버를 띄우지 않는다. 규칙 모듈을 그대로 import 해서 전투만 대량으로 돌린다.
   (구버전에서는 engine.js 가 DOM 을 붙들고 있어 vm 컨텍스트에 스텁을 심어야
    했지만, 규칙이 분리된 뒤로는 그냥 import 하면 된다.)
   ========================================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as R from '../src/rules.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
R.initRules(JSON.parse(fs.readFileSync(path.join(ROOT, '../src/roster.json'), 'utf8')));

function setup(lv, uid, wl, mods) {
  const tot = R.START_PT + (lv - 1) * R.LVUP_PT, per = Math.floor(tot / 6), st = {};
  R.STK.forEach(k => st[k] = per); st.sho += tot - per * 6;
  R.newGame('t', st, uid);
  const g = R.getState(); g.lv = lv; g.pt = 0;
  const v = R.cur(); v.wl = v.wl.map(() => wl);
  if (mods) Object.keys(R.MOD).forEach(k => v.mod[k] = mods);
  v.hp = R.uStat(v).hpMax;
  return g;
}
const unitFor = (rar, ter) => {
  const p = R.UNITS.filter(u => u.rar === rar && u.w.length && R.adaptBase(u, ter) === 2);
  return p.sort((a, b) => R.uPow(a) - R.uPow(b))[Math.floor(p.length / 2)].id;
};
const PLAN = [['ptrl',1,'N',1,0],['swp',4,'R',2,0],['base',8,'SR',3,1],['itcp',14,'SSR',4,2],['final',20,'UR',5,3]];
const N = +(process.env.N || 40);
for (const ter of (process.env.TERS || 'sp,gr').split(',')) {
  console.log('■ ' + R.TERRAIN[ter].n);
  for (const [mid, lv, rar, wl, mods] of PLAN) {
    const uid = unitFor(rar, ter); let w=0,l=0,d=0,hp=0;
    for (let i = 0; i < N; i++) {
      setup(lv, uid, wl, mods);
      const out = R.resolveBattle(R.MISSION.find(m => m.id === mid), 'norm', ter);
      if (out.res.r === 'win') w++; else if (out.res.r === 'lose') l++; else d++;
      hp += Math.round(R.cur().hp / R.uStat(R.cur()).hpMax * 100);
    }
    console.log('  ' + R.MISSION.find(m => m.id === mid).n.padEnd(14) +
      ` 승${String(Math.round(w/N*100)).padStart(4)}% 패${String(Math.round(l/N*100)).padStart(4)}% 무${String(Math.round(d/N*100)).padStart(4)}%  잔여HP${String(Math.round(hp/N)).padStart(4)}%`);
  }
}
