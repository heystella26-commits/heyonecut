import crypto from "node:crypto";
import { getJSON, putJSON } from "./_store.js";
import { track } from "./_track.js";

// 무료 체험은 로그인한 계정에만 제공
export const FREE_LIMIT = Number(process.env.FREE_LIMIT ?? 0);
const SECRET = process.env.QUOTA_SECRET || "dev-secret-change-me";
const NAME = "sp_q", SESS = "sp_u";
const sign = v => crypto.createHmac("sha256", SECRET).update(v).digest("base64url").slice(0, 22);
const cookie = (req, n) => { const m = (req.headers.cookie || "").match(new RegExp(`(?:^|; )${n}=([^;]+)`)); return m ? decodeURIComponent(m[1]) : null; };
export function addCookie(res, c) {
  const prev = res.getHeader("Set-Cookie");
  res.setHeader("Set-Cookie", [...(Array.isArray(prev) ? prev : prev ? [prev] : []).filter(x => !x.startsWith(c.split("=")[0] + "=")), c]);
}
function readCookieQ(req) {
  const v = cookie(req, NAME);
  if (!v) return { id: crypto.randomUUID(), used: 0, credits: 0, claimed: [] };
  const parts = v.split("."); const sig = parts.pop();
  if (sign(parts.join(".")) !== sig) return { id: crypto.randomUUID(), used: 999, credits: 0, claimed: [] };
  const [id, used, cr, cl = ""] = parts;
  return { id, used: Number(used) || 0, credits: Number(cr) || 0, claimed: cl ? cl.split("-") : [] };
}
function writeCookieQ(res, q) {
  const v = `${q.id}.${q.used}.${q.credits}.${(q.claimed || []).slice(-8).join("-")}`;
  addCookie(res, `${NAME}=${encodeURIComponent(v + "." + sign(v))}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`);
}
export function sessionUid(req) {
  const v = cookie(req, SESS); if (!v) return null;
  const i = v.lastIndexOf("."); const uid = v.slice(0, i);
  return uid && sign("u." + uid) === v.slice(i + 1) ? uid : null;
}
export function setSession(res, uid) { addCookie(res, `${SESS}=${encodeURIComponent(uid + "." + sign("u." + uid))}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`); }
export function clearSession(res) { addCookie(res, `${SESS}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`); }
export const loadUser = uid => getJSON("users/" + uid);
export const saveUser = u => putJSON("users/" + u.uid, u);
export async function readQuota(req) {
  const uid = sessionUid(req);
  if (uid) { const u = await loadUser(uid); if (u && !u.deleteAt) return { id: u.uid, used: u.used || 0, credits: u.credits || 0, claimed: u.claimed || [], user: u }; }
  return readCookieQ(req);
}
export async function writeQuota(res, q) {
  if (q.user) { Object.assign(q.user, { used: q.used, credits: q.credits, claimed: (q.claimed || []).slice(-50), updated: Date.now() }); await saveUser(q.user); }
  else writeCookieQ(res, q);
}
export async function mergeIntoUser(req, res, u) {
  const c = readCookieQ(req);
  if (c.credits > 0) { u.credits = (u.credits || 0) + c.credits; c.credits = 0; }
  u.claimed = [...new Set([...(u.claimed || []), ...c.claimed])].slice(-50);
  writeCookieQ(res, c);
  await saveUser(u);
}
const freeLeft = q => q.user ? Math.max(0, FREE_LIMIT - q.used) : 0;
const left = q => freeLeft(q) + q.credits;
export async function checkQuota(req, res, n = 1) {
  const q = await readQuota(req);
  if (process.env.QUOTA_SECRET && req.headers["x-sp-test"] === process.env.QUOTA_SECRET) { q.test = true; return q; }
  if (left(q) < n) {
    if (!q.user) writeCookieQ(res, q);
    const msg = q.user ? "이용 가능 횟수가 없어요. 이용권을 구매해 주세요." : "로그인하면 무료로 " + FREE_LIMIT + "회 써볼 수 있어요.";
    await track("paywall", { id: q.id, member: !!q.user, n });
    res.status(402).json({ error: msg, paywall: true, needLogin: !q.user });
    return null;
  }
  return q;
}
export async function useQuota(res, q, n = 1, kind = null) {
  if (q.test) return;
  let free = 0;
  for (let k = 0; k < n; k++) { if (q.user && q.used < FREE_LIMIT) { q.used += 1; free++; } else q.credits = Math.max(0, q.credits - 1); }
  await track("use", { id: q.id, member: !!q.user, kind, n, free });
  await writeQuota(res, q);
  res.setHeader("X-Free-Left", String(left(q)));
}
export async function status(req) {
  const q = await readQuota(req);
  return { left: left(q), free: freeLeft(q), credits: q.credits, limit: FREE_LIMIT, user: q.user ? { name: q.user.name || "", provider: q.user.provider, admin: isAdmin(q.user.uid) || undefined, consent: q.user.consent ? { ver: q.user.consent.ver, train: !!q.user.consent.train } : null } : null };
}
export function signTicket(obj) {
  const b = Buffer.from(JSON.stringify(obj)).toString("base64url");
  return b + "." + crypto.createHmac("sha256", SECRET).update("t." + b).digest("base64url").slice(0, 32);
}
export function verifyTicket(t) {
  const [b, s] = String(t || "").split(".");
  if (!b || !s || crypto.createHmac("sha256", SECRET).update("t." + b).digest("base64url").slice(0, 32) !== s) return null;
  try { const o = JSON.parse(Buffer.from(b, "base64url").toString()); return o.exp && o.exp < Date.now() ? null : o; } catch { return null; }
}
export const isAdmin = uid => !!uid && String(process.env.ADMIN_UIDS || "").split(",").map(s => s.trim()).includes(uid);
export const isTest = (req, q) => !!q.test;
export const cookieWalletId = req => readCookieQ(req).id;
// 로그인 없이 산 이용권 지갑(서명된 쿠키)이 있을 때만 그 id, 없으면 null
export const walletIdIfAny = req => { const v = cookie(req, NAME); if (!v) return null; const q = readCookieQ(req); return q.used === 999 ? null : q.id; };
