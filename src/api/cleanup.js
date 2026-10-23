// 매일 자동 정리 (Cloudflare Cron): ① 3일 지난 결과물 삭제 ② 탈퇴 신청 후 7일 지난 계정과 그 계정의 결과물 삭제
import { env } from "cloudflare:workers";
import { KEEP_DAYS } from "./history.js";
export async function cleanup() {
  const now = Date.now(), DB = env.DB, out = {};
  out.hist = (await DB.prepare("DELETE FROM kv WHERE k LIKE 'hist/%' AND k NOT LIKE 'hist/%/index.json' AND updated < ?").bind(now - KEEP_DAYS * 864e5).run()).meta.changes;
  const gone = (await DB.prepare("SELECT k FROM kv WHERE k LIKE 'users/%' AND json_extract(v,'$.deleteAt') IS NOT NULL AND json_extract(v,'$.deleteAt') < ?").bind(now).all()).results || [];
  for (const { k } of gone) {
    const uid = k.slice(6, -5);
    await DB.prepare("DELETE FROM kv WHERE k LIKE ?").bind(`hist/${uid}/%`).run();
    await DB.prepare("DELETE FROM kv WHERE k = ?").bind(k).run();
  }
  out.users = gone.length;
  return out;
}
