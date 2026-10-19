// 첫 구매 할인: 회원의 첫 결제에서 베이직만 할인
// COUPON_LAUNCH_UNTIL(YYYY-MM-DD, 한국 날짜, 그날까지 포함) 이전이면 COUPON_LAUNCH_RATE(기본 50), 이후엔 COUPON_RATE(기본 30)
// COUPON_OFF=1 이면 할인 끔
import { env } from "cloudflare:workers";
import { hashId } from "./_track.js";
const E = process.env;
export const COUPON_PLAN = "basic";
const kstDay = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
export function currentRate() {
  if (E.COUPON_OFF === "1") return 0;
  const until = E.COUPON_LAUNCH_UNTIL || "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(until) && kstDay() <= until) return Number(E.COUPON_LAUNCH_RATE || 50);
  return Number(E.COUPON_RATE || 30);
}
export async function isFirstPurchase(q) {
  if (!q.user) return false; // 회원만
  try {
    const r = await env.DB.prepare("SELECT COUNT(*) c FROM events WHERE ev = 'paid' AND who = ?").bind(hashId(q.id)).first();
    return !(r && r.c > 0);
  } catch { return false; }
}
// 이 사람이 지금 받을 수 있는 혜택 (없으면 null)
export async function offerFor(q, plans) {
  const rate = currentRate();
  if (!rate || !(await isFirstPurchase(q))) return null;
  const base = plans[COUPON_PLAN].price;
  const price = Math.round(base * (1 - rate / 100) / 10) * 10;
  return { plan: COUPON_PLAN, rate, base, price, launch: rate === Number(E.COUPON_LAUNCH_RATE || 50) && !!E.COUPON_LAUNCH_UNTIL, until: E.COUPON_LAUNCH_UNTIL || null };
}
