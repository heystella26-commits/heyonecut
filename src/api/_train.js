// 품질 개선(AI 학습)용 데이터: '학습 활용'에 동의한 회원의 생성 결과만 저장, 2년 뒤 자동 삭제
// 저장소: R2(env.TRAIN)가 연결되면 R2, 아니면 D1(kv 표, train/ 접두사)
// 원본 사진은 저장하지 않고, 사람 얼굴이 주인공인 사진(패션 착용컷·헤어)은 제외
import crypto from "node:crypto";
import { env } from "cloudflare:workers";
import { loadUser } from "./_quota.js";
import { hashId } from "./_track.js";
export const TRAIN_DAYS = 730;
const SKIP = ["fashion_person", "hair"];
async function toBuf(src) {
  if (String(src).startsWith("data:")) return { buf: Buffer.from(src.split(",")[1], "base64"), type: src.slice(5, src.indexOf(";")) || "image/jpeg" };
  const r = await fetch(src); if (!r.ok) throw new Error("fetch fail");
  return { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type") || "image/jpeg" };
}
async function put(key, buf, type) {
  if (env.TRAIN) return env.TRAIN.put(key, buf, { httpMetadata: { contentType: type } });
  await env.DB.prepare("INSERT INTO kv (k, v, type, updated) VALUES (?, ?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated = excluded.updated")
    .bind(key, type.startsWith("application/json") ? buf.toString() : buf.toString("base64"), type, Date.now()).run();
}
export async function wantsTraining(uid) {
  if (!uid) return false; const u = await loadUser(uid);
  return !!(u && !u.deleteAt && u.consent?.train);
}
// items: [{ src, label, prompt }]
export async function saveTraining(uid, { kind, mode, model, items = [], ctx = {} }) {
  try {
    if (!items.length || !kind || SKIP.includes(kind) || !(await wantsTraining(uid))) return 0;
    const who = hashId(uid), day = new Date().toISOString().slice(0, 10), id = Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
    const base = `train/${who}/${day}/${id}`, files = [];
    for (const [k, it] of items.entries()) {
      if (!it?.src) continue;
      try { const { buf, type } = await toBuf(it.src); await put(`${base}-${k}.jpg`, buf, type); files.push({ file: `${id}-${k}.jpg`, label: it.label || "", prompt: String(it.prompt || "").slice(0, 2000) }); } catch {}
    }
    if (!files.length) return 0;
    const meta = { id, who, created: Date.now(), kind: kind || null, mode, model: model || null, industry: String(ctx.industry || "").slice(0, 40), tone: String(ctx.tone || "").slice(0, 40), files };
    await put(`${base}.json`, Buffer.from(JSON.stringify(meta)), "application/json");
    return files.length;
  } catch { return 0; }
}
// 한 회원의 학습 데이터 전부 삭제 (동의 철회·탈퇴)
export async function deleteTraining(uid) {
  const prefix = `train/${hashId(uid)}/`; let n = 0;
  if (env.TRAIN) {
    let cursor; do { const l = await env.TRAIN.list({ prefix, cursor }); const keys = l.objects.map(o => o.key); if (keys.length) { await env.TRAIN.delete(keys); n += keys.length; } cursor = l.truncated ? l.cursor : null; } while (cursor);
  }
  n += (await env.DB.prepare("DELETE FROM kv WHERE k LIKE ?").bind(prefix + "%").run()).meta.changes;
  return n;
}
// 2년 지난 학습 데이터 삭제
export async function expireTraining() {
  const cut = Date.now() - TRAIN_DAYS * 864e5; let n = 0;
  if (env.TRAIN) {
    let cursor; do { const l = await env.TRAIN.list({ prefix: "train/", cursor }); const old = l.objects.filter(o => o.uploaded.getTime() < cut).map(o => o.key); if (old.length) { await env.TRAIN.delete(old); n += old.length; } cursor = l.truncated ? l.cursor : null; } while (cursor);
  }
  n += (await env.DB.prepare("DELETE FROM kv WHERE k LIKE 'train/%' AND updated < ?").bind(cut).run()).meta.changes;
  return n;
}
