// 짧은 추적 링크: heyonecut.com/<채널>/<콘텐츠>  예) /ig, /ig/cafe-reel1, /rv/revu-1
// 누르면 유입 경로를 30일 기억(sp_src)하고 클릭을 기록한 뒤 목적지로 이동. 운영자가 /admin에서 링크를 등록·관리
import { getJSON, putJSON } from "./_store.js";
import { sessionUid, isAdmin } from "./_quota.js";
import { track } from "./_track.js";
export const CHANNELS = {
  ig: "인스타그램(게시물·프로필)", ia: "인스타그램 광고", bl: "내 네이버 블로그", rv: "체험단 리뷰",
  cm: "커뮤니티 글", kt: "카카오톡", th: "스레드", yt: "유튜브", na: "네이버 광고", ex: "기타",
};
const LIST = "links/list";
const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;
const DESTS = ["/", "/portfolio", "/cases"];
// Worker 앞단에서 호출: 짧은 링크면 Response, 아니면 null
export async function handleShort(request, url) {
  const m = url.pathname.match(/^\/([a-z]{2})(?:\/([a-z0-9-]{1,40}))?\/?$/);
  if (!m || !CHANNELS[m[1]]) return null;
  const ch = m[1], content = m[2] || "";
  const src = content ? `${ch}/${content}` : ch;
  const list = (await getJSON(LIST)) || [];
  const reg = list.find(l => l.src === src);
  const dest = reg?.dest && DESTS.includes(reg.dest) ? reg.dest : "/";
  const ck = request.headers.get("cookie") || "", ua = request.headers.get("user-agent") || "";
  const skip = /(?:^|; )sp_adm=1/.test(ck) || /HeadlessChrome|Playwright|bot|crawl|spider|curl|wget|python|Claude|facebookexternalhit|kakaotalk-scrap|Yeti/i.test(ua);
  if (!skip) await track("click", { id: "c." + Date.now() + Math.random(), src });
  const h = new Headers({ Location: dest, "Cache-Control": "no-store" });
  if (!skip) h.append("Set-Cookie", `sp_src=${encodeURIComponent(src)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
  h.append("Set-Cookie", `sp_lnk=1; Path=/; Secure; SameSite=Lax; Max-Age=60`);
  return new Response(null, { status: 302, headers: h });
}
// 운영자 API: GET 목록 / POST {action:'add', ch, content, label, dest} / {action:'delete', src}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!isAdmin(sessionUid(req))) return res.status(403).json({ error: "운영자만 쓸 수 있어요." });
  let list = (await getJSON(LIST)) || [];
  if (req.method === "GET") return res.status(200).json({ channels: CHANNELS, dests: DESTS, links: list });
  const b = req.body || {};
  if (b.action === "add") {
    if (!CHANNELS[b.ch]) return res.status(400).json({ error: "채널을 골라 주세요." });
    const content = String(b.content || "").toLowerCase().trim();
    if (content && !SLUG.test(content)) return res.status(400).json({ error: "콘텐츠 이름은 영문 소문자·숫자·하이픈(-)만, 40자 이내로 써 주세요." });
    const src = content ? `${b.ch}/${content}` : b.ch;
    if (list.some(l => l.src === src)) return res.status(409).json({ error: "이미 있는 링크예요." });
    list = [{ src, ch: b.ch, content, label: String(b.label || "").slice(0, 60), dest: DESTS.includes(b.dest) ? b.dest : "/", created: Date.now() }, ...list];
  } else if (b.action === "delete") list = list.filter(l => l.src !== b.src);
  else return res.status(400).json({ error: "알 수 없는 요청이에요." });
  await putJSON(LIST, list.slice(0, 500));
  res.status(200).json({ ok: true, links: list });
}
