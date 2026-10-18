// 회원 탈퇴: 로그인한 계정 정보(닉네임·이메일·이용권)를 즉시 삭제하고 로그아웃
import { sessionUid, clearSession } from "./_quota.js";
import { deleteKey } from "./_store.js";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST" || (req.body || {}).action !== "delete") return res.status(405).json({ error: "POST only" });
  const uid = sessionUid(req);
  if (!uid) return res.status(401).json({ error: "로그인이 필요해요." });
  await deleteKey("users/" + uid + ".json");
  clearSession(res);
  res.status(200).json({ ok: true });
}
