/* =========================================================================
   G-Over World — 세이브 저장소

   백엔드 두 가지가 같은 인터페이스를 쓴다.

     mongo   MONGODB_URI 가 있으면 이쪽. MongoDB Atlas 무료 티어(M0, 512MB)면
             세이브가 개당 1KB 안팎이라 사실상 무제한이다.
     file    없으면 data/<pid>.json. 개발·단독 실행용.

   서버리스(Vercel)에서는 함수 인스턴스가 재사용되므로 클라이언트를
   모듈 전역에 캐시해야 한다. 요청마다 새로 연결하면 커넥션이 폭발한다.

   인터페이스
     get(pid)        → g | null
     put(pid, g)     → void
     del(pid)        → void
     touch(pid)      → 마지막 접속 시각만 갱신
   ========================================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.SAVE_DIR || path.join(ROOT, 'data');
const DB_NAME = process.env.MONGODB_DB || 'gover';
const COL_NAME = process.env.MONGODB_COLLECTION || 'saves';

/* ---- 파일 백엔드 --------------------------------------------------------- */
function fileStore() {
  fs.mkdirSync(DATA, { recursive: true });
  const f = pid => path.join(DATA, pid + '.json');
  return {
    kind: 'file',
    where: DATA,
    async get(pid) {
      try { return JSON.parse(fs.readFileSync(f(pid), 'utf8')).g; }
      catch (e) { return null; }
    },
    async put(pid, g) {
      /* 임시 파일에 쓰고 rename — 쓰다 죽어도 세이브가 반쯤 남지 않는다 */
      const tmp = f(pid) + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify({ pid: pid, g: g, updated: Date.now() }));
      fs.renameSync(tmp, f(pid));
    },
    async del(pid) { try { fs.unlinkSync(f(pid)); } catch (e) {} },
    async touch() {},
    async close() {}
  };
}

/* ---- MongoDB 백엔드 ------------------------------------------------------ */
let mongoClient = null;      /* 서버리스 재사용을 위해 모듈 전역에 둔다 */
let mongoCol = null;

async function mongoStore(uri) {
  if (!mongoCol) {
    let mod;
    try { mod = await import('mongodb'); }
    catch (e) {
      throw new Error("MONGODB_URI 가 설정됐는데 mongodb 드라이버가 없습니다. 'npm i mongodb' 후 다시 실행하십시오.");
    }
    const c = new mod.MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000
    });
    try {
      await c.connect();
    } catch (e) {
      /* 실패한 클라이언트를 전역에 남기면 다음 호출이 죽은 연결을 재사용한다 */
      await c.close().catch(() => {});
      throw new Error('MongoDB 에 연결하지 못했습니다 — ' + e.message);
    }
    mongoClient = c;
    mongoCol = mongoClient.db(DB_NAME).collection(COL_NAME);
    await mongoCol.createIndex({ updated: -1 }).catch(() => {});
  }
  return {
    kind: 'mongo',
    where: DB_NAME + '.' + COL_NAME,
    async get(pid) {
      const d = await mongoCol.findOne({ _id: pid });
      return d ? d.g : null;
    },
    async put(pid, g) {
      await mongoCol.updateOne(
        { _id: pid },
        { $set: { g: g, updated: Date.now() }, $setOnInsert: { created: Date.now() } },
        { upsert: true });
    },
    async del(pid) { await mongoCol.deleteOne({ _id: pid }); },
    async touch(pid) { await mongoCol.updateOne({ _id: pid }, { $set: { seen: Date.now() } }); },
    async close() { if (mongoClient) { await mongoClient.close(); mongoClient = null; mongoCol = null; } }
  };
}

/* ---- 선택 -------------------------------------------------------------- */
let cached = null;
async function openStore() {
  if (cached) return cached;
  const uri = process.env.MONGODB_URI;
  /* 실패했으면 cached 를 채우지 않는다 — 다음 요청에서 다시 시도할 수 있게 */
  const st = uri ? await mongoStore(uri) : fileStore();
  cached = st;
  return cached;
}

export { openStore };
