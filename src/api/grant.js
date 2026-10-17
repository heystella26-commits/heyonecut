// 운영자 테스트용 횟수 지급: 서버 비밀키로 서명된 1회용 티켓(1시간 유효)으로만 동작
import { readQuota, writeQuota, verifyTicket } from "./_quota.js";
export default async function handler(req, res) {
  const t = verifyTicket(req.query.t);
  res.setHeader("Cache-Control", "no-store");
  if (!t || t.k !== "grant" || !(t.n > 0)) return res.status(403).send("유효하지 않거나 만료된 링크예요.");
  const q = await readQuota(req);
  if (q.claimed.includes(t.nonce)) return res.redirect(302, "/?granted=already");
  q.credits += t.n; q.claimed.push(t.nonce);
  await writeQuota(res, q);
  res.redirect(302, "/?granted=" + t.n);
}
