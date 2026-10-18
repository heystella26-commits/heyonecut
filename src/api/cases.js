// 첫 화면·/cases 사례: GET 목록 / GET ?f=<id>-<n> 이미지 / POST(운영자) 추가·삭제·순서 변경
import crypto from "node:crypto";
import { env } from "cloudflare:workers";
import { sessionUid, isAdmin } from "./_quota.js";
import { getJSON, putJSON, putBin, getBin, deleteKey } from "./_store.js";
const LIST = "cases/list";
async function toBuf(src) {
  if (String(src).startsWith("data:")) return { buf: Buffer.from(src.split(",")[1], "base64"), type: src.slice(5, src.indexOf(";")) || "image/jpeg" };
  const r = await fetch(src); if (!r.ok) throw new Error("이미지를 가져오지 못했어요");
  return { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type") || "image/jpeg" };
}
const clean = (s, n) => String(s || "").slice(0, n);
// 처음 한 번: 기본 사례(public/cases/seed.json)를 목록으로 저장
async function loadList() {
  let list = await getJSON(LIST);
  if (list) return list;
  try { list = await (await env.ASSETS.fetch(new Request("https://assets.local/cases/seed.json"))).json(); } catch { list = []; }
  await putJSON(LIST, list);
  return list;
}
export default async function handler(req, res) {
  if (req.method === "GET") {
    if (req.query.f) {
      const f = String(req.query.f).replace(/[^a-z0-9-]/gi, "");
      const b = await getBin(`cases/${f}.jpg`);
      if (!b) return res.status(404).json({ error: "not found" });
      res.setHeader("Content-Type", b.type || "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
      return res.status(200).send(b.buf);
    }
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(await loadList());
  }
  if (req.method !== "POST") return res.status(405).json({ error: "GET/POST only" });
  if (!isAdmin(sessionUid(req))) return res.status(403).json({ error: "운영자만 사례를 관리할 수 있어요." });
  const b = req.body || {};
  let list = await loadList();
  if (b.action === "add") {
    const c = b.case || {};
    if (!c.title || !c.orig || !Array.isArray(c.images) || !c.images.length) return res.status(400).json({ error: "제목·원본 사진·생성 사진이 필요해요." });
    const id = Date.now().toString(36) + crypto.randomBytes(2).toString("hex");
    const save = async (src, k) => { const { buf, type } = await toBuf(src); await putBin(`cases/${id}-${k}.jpg`, buf, type); return `/api/cases?f=${id}-${k}`; };
    const orig = await save(c.orig, 0);
    const images = [];
    for (const [k, im] of c.images.slice(0, 6).entries()) if (im.src) images.push({ slot: +im.slot || k + 1, kind: clean(im.kind, 40), src: await save(im.src, k + 1) });
    const item = { id, tag: clean(c.tag, 40) || "사례", title: clean(c.title, 120), body: clean(c.body, 8000), tags: (c.tags || []).slice(0, 30).map(t => clean(t, 30)), orig, images, created: Date.now() };
    list = [item, ...list];
    await putJSON(LIST, list);
    return res.status(200).json({ ok: true, id });
  }
  const i = list.findIndex(x => x.id === b.id);
  if (i < 0) return res.status(404).json({ error: "사례를 찾을 수 없어요." });
  if (b.action === "delete") {
    const [gone] = list.splice(i, 1);
    if (!String(gone.orig).startsWith("/cases/")) for (let k = 0; k <= 6; k++) await deleteKey(`cases/${gone.id}-${k}.jpg`).catch(() => {});
  } else if (b.action === "move") {
    const j = i + (b.dir === "up" ? -1 : 1);
    if (j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]];
  } else if (b.action === "edit") {
    for (const k of ["tag", "title"]) if (b[k] != null) list[i][k] = clean(b[k], k === "title" ? 120 : 40);
  } else return res.status(400).json({ error: "알 수 없는 요청이에요." });
  await putJSON(LIST, list);
  res.status(200).json({ ok: true });
}
