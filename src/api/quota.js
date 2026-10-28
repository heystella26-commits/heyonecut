// 남은 횟수 + 로그인 상태 조회. 페이지를 처음 열 때(?v=1)만 방문으로 기록하고 유입 경로를 남김
import crypto from "node:crypto";
import { status, addCookie, sessionUid, isAdmin } from "./_quota.js";
import { track, sourceOf, srcCookie, hashId } from "./_track.js";
import { getJSON, putJSON } from "./_store.js";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const ck = req.headers.cookie || "";
  let v = ck.match(/(?:^|; )sp_v=([a-f0-9]{32})/)?.[1];
  if (!v) { v = crypto.randomBytes(16).toString("hex"); addCookie(res, `sp_v=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`); }
  const uid = sessionUid(req);
  // 운영자가 한 번이라도 로그인한 브라우저는 로그아웃해도 기록에서 제외
  // 제외: 운영자 기기, 테스트 요청(x-sp-test), 자동화·봇 브라우저(Claude 테스트용 헤드리스 브라우저 포함)
  const ua = req.headers["user-agent"] || "";
  const bot = /HeadlessChrome|Playwright|puppeteer|bot|crawl|spider|curl|wget|python|node-fetch|undici|axios|Claude/i.test(ua) || !!req.headers["x-sp-test"];
  const adminBrowser = isAdmin(uid) || /(?:^|; )sp_adm=1/.test(ck) || bot;
  if (isAdmin(uid) && !/(?:^|; )sp_adm=1/.test(ck)) {
    addCookie(res, "sp_adm=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000");
    // 이 브라우저의 예전 방문 기록도 통계에서 빼기 위해 해시를 기억
    const list = (await getJSON("sys/admin-visitors")) || []; const h = hashId("v." + v);
    if (!list.includes(h)) await putJSON("sys/admin-visitors", [...list, h].slice(-50));
  }
  if (req.query.v === "1" && !adminBrowser) {
    // 짧은 링크로 막 들어왔으면(sp_lnk) 그 링크의 경로를 그대로 씀
    const viaLink = /(?:^|; )sp_lnk=1/.test(ck) && srcCookie(req);
    const src = viaLink || sourceOf({ ref: req.query.r, utm: req.query.us, medium: req.query.um, ua: req.headers["user-agent"], host: req.headers.host });
    // 첫 유입 경로는 30일 동안 기억해서 가입·결제까지 이어 붙임 (외부에서 새로 들어오면 갱신)
    if (viaLink) addCookie(res, "sp_lnk=; Path=/; Max-Age=0");
    else if (!srcCookie(req) || src !== "direct") addCookie(res, `sp_src=${encodeURIComponent(src)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
    await track("visit", { id: "v." + v, member: !!uid, src });
  }
  res.status(200).json(await status(req));
}
