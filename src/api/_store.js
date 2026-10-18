// 작은 저장소 (Cloudflare D1: kv 테이블). JSON과 이미지(base64)를 같은 표에 보관
import { env } from "cloudflare:workers";
const safe = k => String(k).replace(/[^a-zA-Z0-9_\/.-]/g, "");
const UPSERT = "INSERT INTO kv (k, v, type, updated) VALUES (?, ?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, type = excluded.type, updated = excluded.updated";
export async function putRaw(key, v, type) {
  await env.DB.prepare(UPSERT).bind(safe(key), v, type, Date.now()).run();
}
export async function getRaw(key) {
  return env.DB.prepare("SELECT v, type FROM kv WHERE k = ?").bind(safe(key)).first();
}
export const putJSON = (key, obj) => putRaw(safe(key) + ".json", JSON.stringify(obj), "application/json");
export async function getJSON(key) {
  try { const r = await getRaw(safe(key) + ".json"); return r ? JSON.parse(r.v) : null; } catch { return null; }
}
export const putBin = (key, buf, type) => putRaw(key, Buffer.from(buf).toString("base64"), type || "application/octet-stream");
export async function getBin(key) {
  const r = await getRaw(key); if (!r) return null;
  return { buf: Buffer.from(r.v, "base64"), type: r.type };
}
// 한 번만 쓸 수 있는 티켓(충전·환불·사진) 사용 기록. 처음이면 true
export async function claimOnce(key) {
  const r = await env.DB.prepare("INSERT INTO kv (k, v, type, updated) VALUES (?, '1', 'text/plain', ?) ON CONFLICT(k) DO NOTHING").bind(safe("used/" + key), Date.now()).run();
  return r.meta.changes === 1;
}
export const releaseOnce = key => env.DB.prepare("DELETE FROM kv WHERE k = ?").bind(safe("used/" + key)).run();
export const deleteKey = key => env.DB.prepare("DELETE FROM kv WHERE k = ?").bind(safe(key)).run();
