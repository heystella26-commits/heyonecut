// 퍼널 기록: 개인정보 없이 숫자만 남김 (who = 회원/브라우저 식별값의 해시)
import crypto from "node:crypto";
import { env } from "cloudflare:workers";
const day = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // 한국 날짜
const hash = id => id ? crypto.createHash("sha256").update("hoc." + id).digest("hex").slice(0, 16) : null;
export async function track(ev, { id, member = false, kind = null, n = 0, amount = 0, free = 0 } = {}) {
  try {
    await env.DB.prepare("INSERT INTO events (ts, day, ev, who, member, kind, n, amount, free) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(Date.now(), day(), ev, hash(id), member ? 1 : 0, kind, n, amount, free).run();
  } catch {}
}
