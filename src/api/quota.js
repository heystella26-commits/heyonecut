// 남은 횟수 + 로그인 상태 조회
import { status } from "./_quota.js";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(await status(req));
}
