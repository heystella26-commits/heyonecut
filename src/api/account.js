// 회원 탈퇴: 바로 로그아웃하고 7일 뒤 계정 정보·이용권·저장된 결과물을 완전히 삭제 (7일 안에 다시 로그인하면 복구)
import { sessionUid, clearSession, loadUser, saveUser } from "./_quota.js";
import { track } from "./_track.js";
export const GRACE_DAYS = 7;
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST" || (req.body || {}).action !== "delete") return res.status(405).json({ error: "POST only" });
  const uid = sessionUid(req);
  if (!uid) return res.status(401).json({ error: "로그인이 필요해요." });
  const u = await loadUser(uid);
  if (u) { u.deleteAt = Date.now() + GRACE_DAYS * 864e5; await saveUser(u); }
  await track("withdraw", { id: uid, member: true }).catch(() => {});
  clearSession(res);
  res.status(200).json({ ok: true, deleteAt: u?.deleteAt, days: GRACE_DAYS });
}
