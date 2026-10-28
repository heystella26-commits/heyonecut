// 운영자 전용 퍼널 통계 (ADMIN_UIDS에 등록된 계정으로 로그인해야 열림)
import { env } from "cloudflare:workers";
import { sessionUid, FREE_LIMIT, addCookie } from "./_quota.js";
import { hashId } from "./_track.js";
import { getJSON } from "./_store.js";
const kst = d => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const uid = sessionUid(req);
  const admins = String(process.env.ADMIN_UIDS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!uid || !admins.includes(uid)) return res.status(403).json({ error: "운영자 계정으로 로그인해야 볼 수 있어요." });
  // /admin을 연 기기는 앞으로 방문 통계에서 제외
  if (!/(?:^|; )sp_adm=1/.test(req.headers.cookie || "")) addCookie(res, "sp_adm=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000");
  const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || "") ? req.query.to : kst(new Date());
  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || "") ? req.query.from : kst(new Date(Date.now() - 29 * 864e5));
  // 운영자 계정·운영자 브라우저 기록 제외
  const ex = [...admins.map(hashId), ...((await getJSON("sys/admin-visitors")) || [])].filter(x => /^[a-f0-9]{16}$/.test(x));
  const NA = ex.length ? ` AND (who IS NULL OR who NOT IN (${ex.map(x => `'${x}'`).join(",")}))` : "";
  const q = (sql, ...a) => env.DB.prepare(sql).bind(from, to, ...a);
  const one = async (sql, ...a) => (await q(sql, ...a).first()) || {};
  const all = async (sql, ...a) => (await q(sql, ...a).all()).results || [];
  const R = "day BETWEEN ? AND ?" + NA; // 기간 + 운영자 제외
  const [vis, sign, login, act, wall, open, paid, rep, use, fail, plans, kinds, contents, sources, daily] = await Promise.all([
    one(`SELECT COUNT(*) c, COUNT(DISTINCT who) u FROM events WHERE ${R} AND ev='visit'`),
    one(`SELECT COUNT(*) c FROM events WHERE ${R} AND ev='signup'`),
    one(`SELECT COUNT(DISTINCT who) u FROM events WHERE ${R} AND ev='login'`),
    one(`SELECT COUNT(DISTINCT who) u FROM events WHERE ${R} AND ev='use' AND member=1`),
    one(`SELECT COUNT(DISTINCT who) u FROM events WHERE ${R} AND ev='paywall'`),
    one(`SELECT COUNT(DISTINCT who) u, COUNT(*) c FROM events WHERE ${R} AND ev='pay_open'`),
    one(`SELECT COUNT(DISTINCT who) u, COUNT(*) c, COALESCE(SUM(amount),0) a FROM events WHERE ${R} AND ev='paid'`),
    one(`SELECT COUNT(*) u FROM (SELECT who FROM events WHERE ${R} AND ev='paid' GROUP BY who HAVING COUNT(*) >= 2)`),
    one(`SELECT COUNT(*) c, COALESCE(SUM(n),0) n, COALESCE(SUM(free),0) f FROM events WHERE ${R} AND ev='use'`),
    one(`SELECT COUNT(*) c FROM events WHERE ${R} AND ev='fail'`),
    all(`SELECT kind, COUNT(*) c, SUM(amount) a FROM events WHERE ${R} AND ev='paid' GROUP BY kind ORDER BY a DESC`),
    all(`SELECT kind, COUNT(*) c, SUM(n) n, SUM(free) f FROM events WHERE ${R} AND ev='use' GROUP BY kind ORDER BY c DESC`),
    all(`SELECT src, SUM(ev='click') clicks, COUNT(DISTINCT CASE WHEN ev='visit' THEN who END) visitors, SUM(ev='signup') signups,
      COUNT(DISTINCT CASE WHEN ev='pay_open' THEN who END) payOpen, COUNT(DISTINCT CASE WHEN ev='paid' THEN who END) payers, SUM(CASE WHEN ev='paid' THEN amount ELSE 0 END) revenue
      FROM events WHERE ${R} AND src IS NOT NULL AND ev IN ('click','visit','signup','pay_open','paid') GROUP BY src ORDER BY clicks DESC, visitors DESC`),
    all(`SELECT COALESCE(CASE WHEN instr(src,'/')>0 THEN substr(src,1,instr(src,'/')-1) ELSE src END,'(기록 전)') src, SUM(ev='click') clicks, COUNT(DISTINCT CASE WHEN ev='visit' THEN who END) visitors, SUM(ev='visit') visits, SUM(ev='signup') signups,
      COUNT(DISTINCT CASE WHEN ev='pay_open' THEN who END) payOpen, COUNT(DISTINCT CASE WHEN ev='paid' THEN who END) payers, SUM(CASE WHEN ev='paid' THEN amount ELSE 0 END) revenue
      FROM events WHERE ${R} AND ev IN ('click','visit','signup','pay_open','paid') GROUP BY 1 ORDER BY visitors DESC, revenue DESC`),
    all(`SELECT day, COUNT(DISTINCT CASE WHEN ev='visit' THEN who END) users, SUM(ev='signup') signups, COUNT(DISTINCT CASE WHEN ev='paid' THEN who END) payers, SUM(CASE WHEN ev='paid' THEN amount ELSE 0 END) revenue, SUM(CASE WHEN ev='use' THEN n ELSE 0 END) credits FROM events WHERE ${R} GROUP BY day ORDER BY day DESC`),
  ]);
  res.status(200).json({ from, to, freeLimit: FREE_LIMIT,
    sessions: vis.c || 0, users: vis.u || 0, signups: sign.c || 0, returningLogins: login.u || 0,
    activated: act.u || 0, paywallUsers: wall.u || 0, payOpenUsers: open.u || 0,
    payers: paid.u || 0, orders: paid.c || 0, revenue: paid.a || 0, repeatPayers: rep.u || 0,
    uses: use.c || 0, creditsUsed: use.n || 0, freeCreditsUsed: use.f || 0, fails: fail.c || 0,
    plans, kinds, contents, sources, daily, excluded: ex.length });
}
