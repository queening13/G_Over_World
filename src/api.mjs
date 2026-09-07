/* =========================================================================
   G-Over World — API 핸들러

   구식 CGI 의 index.cgi 자리. Node 표준 http 요청/응답만 다루므로
   단독 서버(server.mjs)와 서버리스 함수(api/index.mjs)가 그대로 공유한다.

     GET  /api/state          현재 세이브 (+ 플레이어 코드)
     POST /api/act   {a}      액션 실행 → { g, out }
     POST /api/login {pid}    다른 기기에서 이어하기
     POST /api/reset          기록 말소

   세이브는 서버가 소유한다. 클라이언트는 화면을 그릴 뿐이고,
   무엇이 가능한지는 actions.mjs 가 판단한다.
   ========================================================================= */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as R from './rules.mjs';
import { applyAction, Reject } from './actions.mjs';
import { openStore } from './store.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/* 저장소에서 꺼낸 세이브는 항상 마이그레이션을 거친다.
   스키마가 자란 뒤에도 옛 기록이 그대로 열리게 하기 위함. */
const load = async (store, pid) => R.migrate(await store.get(pid));

/* 로스터는 프로세스당 한 번만 읽는다 (0.95MB) */
let ready = false;
function boot() {
  if (ready) return;
  const units = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/roster.json'), 'utf8'));
  R.initRules(units);
  ready = true;
}

/* ---- 플레이어 코드 ------------------------------------------------------
   쿠키에 담기는 24자리 16진수. 이 값이 곧 세이브 키이므로 추측 가능하면
   남의 세이브를 열 수 있다 — 반드시 CSPRNG 로 만든다. */
const PID_RE = /^[0-9a-f]{24}$/;
const newPid = () => crypto.randomBytes(12).toString('hex');
const COOKIE = 'gow_pid';

function readPid(req) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, v] = part.trim().split('=');
    if (k === COOKIE && PID_RE.test(v || '')) return v;
  }
  return null;
}
const setCookie = pid =>
  COOKIE + '=' + pid + '; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly';

/* ---- 요청 본문 ---------------------------------------------------------- */
const BODY_MAX = 64 * 1024;
function readBody(req) {
  return new Promise((res, rej) => {
    let n = 0; const chunks = [];
    req.on('data', c => {
      n += c.length;
      if (n > BODY_MAX) { rej(new Reject('요청이 너무 큽니다.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return res({});
      try { res(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { rej(new Reject('요청 형식이 올바르지 않습니다.')); }
    });
    req.on('error', rej);
  });
}

const send = (res, code, obj, cookie) => {
  const h = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  if (cookie) h['set-cookie'] = cookie;
  res.writeHead(code, h);
  res.end(JSON.stringify(obj));
};

/* =========================================================================
   라우팅
   ========================================================================= */
async function handleApi(req, res, pathname) {
  boot();
  const store = await openStore();

  let pid = readPid(req), cookie = null;
  if (!pid) { pid = newPid(); cookie = setCookie(pid); }

  try {
    if (pathname === '/api/state' && req.method === 'GET') {
      const g = await load(store, pid);
      return send(res, 200, { pid: pid, g: g, store: store.kind }, cookie);
    }

    if (pathname === '/api/login' && req.method === 'POST') {
      const b = await readBody(req);
      const want = String(b.pid || '').trim().toLowerCase();
      if (!PID_RE.test(want)) throw new Reject('플레이어 코드 형식이 올바르지 않습니다.');
      const g = await load(store, want);
      if (!g) throw new Reject('그 코드로 저장된 기록이 없습니다.');
      return send(res, 200, { pid: want, g: g, store: store.kind }, setCookie(want));
    }

    if (pathname === '/api/act' && req.method === 'POST') {
      const b = await readBody(req);
      const g0 = await load(store, pid);
      const { out, g } = applyAction(g0, b.a || {});
      await store.put(pid, g);
      return send(res, 200, { pid: pid, g: g, out: out }, cookie);
    }

    if (pathname === '/api/reset' && req.method === 'POST') {
      await store.del(pid);
      return send(res, 200, { pid: pid, g: null }, cookie);
    }

    return send(res, 404, { err: '없는 경로입니다.' }, cookie);
  } catch (e) {
    if (e instanceof Reject) return send(res, 400, { err: e.message }, cookie);
    console.error('[api]', pathname, e);
    return send(res, 500, { err: '서버 오류가 발생했습니다.' }, cookie);
  }
}

export { handleApi, boot, ROOT };
