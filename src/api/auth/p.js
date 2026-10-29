// 소셜 로그인 (카카오·네이버·구글)
// /api/auth/kakao → 로그인 창으로 이동, 같은 주소로 돌아오면(code) 계정 연결 / /api/auth/logout → 로그아웃
import crypto from "node:crypto";
import { track } from "../_track.js";
import { addCookie, setSession, clearSession, loadUser, mergeIntoUser } from "../_quota.js";
import { makeConsent } from "../account.js";
import { srcCookie } from "../_track.js";

const E = process.env;
const P = {
  kakao: { id: () => E.KAKAO_CLIENT_ID, secret: () => E.KAKAO_CLIENT_SECRET,
    auth: "https://kauth.kakao.com/oauth/authorize", token: "https://kauth.kakao.com/oauth/token", me: "https://kapi.kakao.com/v2/user/me",
    pick: d => ({ id: d.id, name: d.kakao_account?.profile?.nickname || d.properties?.nickname, email: d.kakao_account?.email }) },
  naver: { id: () => E.NAVER_CLIENT_ID, secret: () => E.NAVER_CLIENT_SECRET || E.NAVER_CLIENT_SECRE,
    auth: "https://nid.naver.com/oauth2.0/authorize", token: "https://nid.naver.com/oauth2.0/token", me: "https://openapi.naver.com/v1/nid/me",
    pick: d => ({ id: d.response?.id, name: d.response?.nickname || d.response?.name, email: d.response?.email }) },
  google: { id: () => E.GOOGLE_CLIENT_ID, secret: () => E.GOOGLE_CLIENT_SECRET, scope: "openid email profile",
    auth: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token", me: "https://openidconnect.googleapis.com/v1/userinfo",
    pick: d => ({ id: d.sub, name: d.name, email: d.email }) },
};
const back = (res, q) => res.redirect(302, "/" + (q ? "?" + q : ""));

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const name = String(req.query.p || "");
  if (name === "logout") { clearSession(res); return back(res, "logout=1"); }
  const p = P[name];
  if (!p) return back(res, "login_err=" + encodeURIComponent("지원하지 않는 로그인이에요."));
  if (!p.id()) return back(res, "login_err=" + encodeURIComponent("이 로그인은 준비 중이에요."));
  const host = /(^|\.)heyonecut\.com$/.test(req.headers.host || "") ? "heyonecut.com" : req.headers.host;
  const redirect = `https://${host}/api/auth/${name}`;
  const { code, state, error } = req.query;

  if (!code && !error) { // 1) 로그인 창으로
    const st = crypto.randomBytes(16).toString("hex");
    addCookie(res, `sp_st=${st}; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
    const u = new URL(p.auth);
    Object.entries({ response_type: "code", client_id: p.id(), redirect_uri: redirect, state: st, ...(p.scope ? { scope: p.scope } : {}) })
      .forEach(([k, v]) => u.searchParams.set(k, v));
    return res.redirect(302, u.toString());
  }
  // 2) 돌아왔을 때
  const st = (req.headers.cookie || "").match(/(?:^|; )sp_st=([a-f0-9]+)/)?.[1];
  if (error || !st || st !== state) return back(res, "login_err=" + encodeURIComponent("로그인이 취소됐거나 만료됐어요. 다시 시도해 주세요."));
  try {
    const body = new URLSearchParams({ grant_type: "authorization_code", client_id: p.id(), redirect_uri: redirect, code, state });
    if (p.secret()) body.set("client_secret", p.secret());
    const t = await fetch(p.token, { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } }).then(r => r.json());
    if (!t.access_token) throw new Error(t.error_description || t.error || "토큰 실패");
    const me = p.pick(await fetch(p.me, { headers: { authorization: `Bearer ${t.access_token}` } }).then(r => r.json()));
    if (!me.id) throw new Error("사용자 정보 없음");
    const uid = `${name}_${me.id}`;
    const existing = await loadUser(uid);
    const u = existing || { uid, provider: name, credits: 0, used: 0, claimed: [], created: Date.now() };
    await track(existing ? "login" : "signup", { id: uid, member: true, kind: name, src: srcCookie(req) });
    const restored = !!u.deleteAt; delete u.deleteAt;
    // 로그인 창에서 고른 동의(필수 3 + 선택: 학습 활용): 쿠키 sp_cs = "1.<0|1>"
    const cs = /(?:^|;\s*)sp_cs=1\.([01])/.exec(req.headers.cookie || "");
    if (cs) u.consent = makeConsent(cs[1] === "1", u.consent || {});
    Object.assign(u, { name: me.name || u.name || "", email: me.email || u.email || "", lastLogin: Date.now() });
    await mergeIntoUser(req, res, u);
    setSession(res, uid);
    addCookie(res, `sp_st=; Path=/api/auth; Max-Age=0`);
    addCookie(res, `sp_cs=; Path=/; Max-Age=0`);
    return back(res, restored ? "login=1&restored=1" : "login=1");
  } catch (e) {
    return back(res, "login_err=" + encodeURIComponent("로그인 실패: " + e.message));
  }
}
