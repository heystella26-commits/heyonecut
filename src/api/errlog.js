// POST: 화면에서 난 오류 보고 / GET: 운영자가 최근 오류 보기
import { sessionUid, isAdmin, readQuota } from "./_quota.js";
import { logError } from "./_errlog.js";
import { getJSON } from "./_store.js";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") {
    if (!isAdmin(sessionUid(req))) return res.status(403).json({ error: "운영자만 볼 수 있어요." });
    return res.status(200).json({ errors: (await getJSON("sys/errors")) || [] });
  }
  const b = req.body || {}; const q = await readQuota(req).catch(() => ({}));
  await logError((isAdmin(q.id) ? "[운영자] " : "") + "화면:" + (b.where || "?"), b.msg, { id: q.id, ua: req.headers["user-agent"], extra: b.extra });
  res.status(200).json({ ok: true });
}
