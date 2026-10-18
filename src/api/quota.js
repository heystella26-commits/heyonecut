// 남은 횟수 + 로그인 상태 조회 (페이지 열 때마다 호출 → 방문 기록)
import crypto from "node:crypto";
import { status, addCookie, sessionUid } from "./_quota.js";
import { track } from "./_track.js";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  let v = (req.headers.cookie || "").match(/(?:^|; )sp_v=([a-f0-9]{32})/)?.[1];
  if (!v) { v = crypto.randomBytes(16).toString("hex"); addCookie(res, `sp_v=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`); }
  await track("visit", { id: "v." + v, member: !!sessionUid(req) });
  res.status(200).json(await status(req));
}
