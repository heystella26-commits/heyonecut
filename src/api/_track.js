// 퍼널 기록: 개인정보 없이 숫자만 남김 (who = 회원/브라우저 식별값의 해시, src = 유입 경로)
// 운영자 계정·운영자 브라우저의 활동은 기록하지 않음
import crypto from "node:crypto";
import { env } from "cloudflare:workers";
const day = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // 한국 날짜
export const hashId = id => id ? crypto.createHash("sha256").update("hoc." + id).digest("hex").slice(0, 16) : null;
const admins = () => String(process.env.ADMIN_UIDS || "").split(",").map(s => s.trim()).filter(Boolean);
export async function track(ev, { id, member = false, kind = null, n = 0, amount = 0, free = 0, src = null } = {}) {
  try {
    if (id && admins().includes(id)) return;
    await env.DB.prepare("INSERT INTO events (ts, day, ev, who, member, kind, n, amount, free, src) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(Date.now(), day(), ev, hashId(id), member ? 1 : 0, kind, n, amount, free, src).run();
  } catch {}
}
// 유입 경로: utm_source 우선, 없으면 이전 페이지 주소, 없으면 앱 내 브라우저(UA), 그래도 없으면 direct
export function sourceOf({ ref = "", utm = "", medium = "", ua = "", host = "" } = {}) {
  const clean = s => String(s || "").toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 30);
  if (utm) return clean(utm) + (medium ? "/" + clean(medium) : "");
  let h = ""; try { h = new URL(ref).hostname.replace(/^www\.|^m\./, ""); } catch {}
  if (h && host && h.endsWith(host.replace(/^www\./, ""))) h = "";
  if (h) {
    if (/instagram/.test(h)) return "instagram";
    if (/threads/.test(h)) return "threads";
    if (/blog\.naver/.test(h)) return "naver_blog";
    if (/cafe\.naver/.test(h)) return "naver_cafe";
    if (/naver/.test(h)) return "naver_search";
    if (/google/.test(h)) return "google";
    if (/daum|kakao/.test(h)) return "kakao_daum";
    if (/facebook|fb\./.test(h)) return "facebook";
    if (/youtube|youtu\.be/.test(h)) return "youtube";
    if (/t\.co$|twitter|x\.com/.test(h)) return "x";
    if (/claude\.ai/.test(h)) return "portfolio";
    return "ref:" + clean(h);
  }
  if (/KAKAOTALK/i.test(ua)) return "kakaotalk";
  if (/Instagram/i.test(ua)) return "instagram";
  if (/NAVER\(inapp/i.test(ua)) return "naver_app";
  if (/FBAN|FBAV/i.test(ua)) return "facebook";
  return "direct";
}
export const srcCookie = req => decodeURIComponent((req.headers.cookie || "").match(/(?:^|; )sp_src=([^;]+)/)?.[1] || "") || null;
