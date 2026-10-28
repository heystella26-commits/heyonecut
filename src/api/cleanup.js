// 자동 정리 (매일 Cloudflare Cron + 운영자 수동 실행 /api/cleanup)
// ① 보관함 3일 ② 탈퇴 후 7일 계정 ③ 실제 결제된 주문 기록 5년 ④ 결제 안 된 주문 30일 ⑤ 학습 데이터 2년 ⑥ 통계 기록 3년
import { env } from "cloudflare:workers";
import { KEEP_DAYS } from "./history.js";
import { deleteTraining, expireTraining } from "./_train.js";
import { sessionUid, isAdmin } from "./_quota.js";
import { putJSON, getJSON } from "./_store.js";
const D = 864e5;
export async function purgeUser(uid) {
  const DB = env.DB;
  const hist = (await DB.prepare("DELETE FROM kv WHERE k LIKE ?").bind(`hist/${uid}/%`).run()).meta.changes;
  const train = await deleteTraining(uid);
  await DB.prepare("DELETE FROM kv WHERE k = ?").bind(`users/${uid}.json`).run();
  return { hist, train };
}
export async function cleanup() {
  const now = Date.now(), DB = env.DB, out = { at: now };
  out.hist = (await DB.prepare("DELETE FROM kv WHERE k LIKE 'hist/%' AND k NOT LIKE 'hist/%/index.json' AND updated < ?").bind(now - KEEP_DAYS * D).run()).meta.changes;
  const gone = (await DB.prepare("SELECT k FROM kv WHERE k LIKE 'users/%' AND json_extract(v,'$.deleteAt') IS NOT NULL AND json_extract(v,'$.deleteAt') < ?").bind(now).all()).results || [];
  for (const { k } of gone) await purgeUser(k.slice(6, -5));
  out.users = gone.length;
  // 실제 결제된 주문(결제·청약철회 기록 포함)은 5년, 결제까지 안 간 주문은 30일
  out.ordersPaid = (await DB.prepare("DELETE FROM kv WHERE k LIKE 'orders/%' AND (json_extract(v,'$.paid') IS NOT NULL OR json_extract(v,'$.status') IN ('paid','claimed')) AND json_extract(v,'$.created') < ?").bind(now - 5 * 365 * D).run()).meta.changes;
  out.ordersUnpaid = (await DB.prepare("DELETE FROM kv WHERE k LIKE 'orders/%' AND json_extract(v,'$.paid') IS NULL AND COALESCE(json_extract(v,'$.status'),'') NOT IN ('paid','claimed') AND json_extract(v,'$.created') < ?").bind(now - 30 * D).run()).meta.changes;
  out.train = await expireTraining();
  out.events = (await DB.prepare("DELETE FROM events WHERE ts < ?").bind(now - 3 * 365 * D).run()).meta.changes;
  await putJSON("sys/cleanup-last", out);
  return out;
}
// 운영자: GET 마지막 실행 결과 / POST {action:"run"} 지금 실행 / POST {action:"purge", uid} 요청받은 회원 즉시 완전 삭제
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!isAdmin(sessionUid(req))) return res.status(403).json({ error: "운영자만 쓸 수 있어요." });
  if (req.method === "GET") return res.status(200).json({ last: await getJSON("sys/cleanup-last"), payPaused: !!(await getJSON("sys/pay-paused"))?.on });
  const b = req.body || {};
  if (b.action === "pause") { await putJSON("sys/pay-paused", { on: !!b.on, at: Date.now() }); return res.status(200).json({ ok: true, payPaused: !!b.on }); }
  if (b.action === "run") return res.status(200).json(await cleanup());
  if (b.action === "purge" && /^[a-z]+_[\w-]+$/.test(b.uid || "")) return res.status(200).json({ ok: true, ...(await purgeUser(b.uid)) });
  res.status(400).json({ error: "알 수 없는 요청이에요." });
}
