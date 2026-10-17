// 블로그 생성 실패 시 미리 차감한 횟수 되돌리기 (서명된 환불권, 1회만)
import { verifyTicket, readQuota, writeQuota } from "./_quota.js";
export default async function handler(req, res) {
  const t = verifyTicket((req.body || {}).refund);
  const q = await readQuota(req);
  if (!t || t.k !== "refund" || t.uid !== q.id) return res.status(403).json({ error: "환불할 수 없어요." });
  if (q.claimed.includes(t.nonce)) return res.status(200).json({ ok: true, already: true });
  q.credits += t.n; q.claimed.push(t.nonce); await writeQuota(res, q);
  res.status(200).json({ ok: true, added: t.n });
}
