// 내 결과물 보관함: 로그인한 사용자의 생성 결과(글+사진)를 3일 동안 저장. 3일이 지나면 자동 삭제(cleanup.js)
import crypto from "node:crypto";
import { env } from "cloudflare:workers";
import { sessionUid, loadUser, walletIdIfAny } from "./_quota.js";
import { getJSON, putJSON, putBin, getBin, getRaw, deleteKey } from "./_store.js";
export const KEEP_DAYS = 3;
const KEEP = KEEP_DAYS * 864e5, MAX = 30;
const idx = uid => `hist/${uid}/index`;
const clean = (s, n) => String(s || "").slice(0, n);
// 회원은 계정 기준, 로그인 없이 이용권을 산 사람은 이 브라우저의 이용권 지갑 기준(anon_…)
async function liveUid(req) {
  const uid = sessionUid(req);
  if (uid) { const u = await loadUser(uid); return u && !u.deleteAt ? uid : null; }
  const w = walletIdIfAny(req); return w ? "anon_" + w.replace(/[^a-zA-Z0-9-]/g, "") : null;
}
// data: URL 사진은 따로 저장하고 주소로 바꿔서 글 JSON을 작게 유지
async function stash(uid, v) {
  if (typeof v === "string" && v.startsWith("data:image/")) {
    const type = v.slice(5, v.indexOf(";")), b64 = v.slice(v.indexOf(",") + 1);
    const h = crypto.createHash("sha1").update(b64).digest("hex").slice(0, 16);
    const key = `hist/${uid}/img-${h}`;
    if (!(await env.DB.prepare("SELECT 1 FROM kv WHERE k = ?").bind(key).first())) await putBin(key, Buffer.from(b64, "base64"), type);
    else await env.DB.prepare("UPDATE kv SET updated = ? WHERE k = ?").bind(Date.now(), key).run();
    return `/api/history?f=${h}`;
  }
  if (Array.isArray(v)) return Promise.all(v.map(x => stash(uid, x)));
  if (v && typeof v === "object") { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = await stash(uid, x); return o; }
  return v;
}
// 서버에서 바로 보관 (모바일에서 연결이 끊겨도 보관함에서 다시 볼 수 있게)
export async function saveItem(uid, { id, mode, title, thumb, data }) {
  const now = Date.now();
  let list = ((await getJSON(idx(uid))) || []).filter(x => now - x.created < KEEP);
  id = /^[a-z0-9]{6,20}$/.test(id || "") ? id : now.toString(36) + crypto.randomBytes(3).toString("hex");
  await putJSON(`hist/${uid}/item-${id}`, await stash(uid, data));
  const old = list.find(x => x.id === id);
  const meta = { id, mode: mode === "blog" ? "blog" : "ig", title: clean(title, 120), thumb: await stash(uid, thumb || null), created: old?.created || now };
  await putJSON(idx(uid), [meta, ...list.filter(x => x.id !== id)].slice(0, MAX));
  return id;
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const uid = await liveUid(req);
  if (!uid) return res.status(401).json({ error: "만든 결과물은 3일 동안 보관돼요. 아직 보관된 결과가 없어요." });
  const now = Date.now();
  if (req.method === "GET") {
    if (req.query.f) {
      const b = await getBin(`hist/${uid}/img-${String(req.query.f).replace(/[^a-f0-9]/g, "")}`);
      if (!b) return res.status(404).json({ error: "보관 기간(3일)이 지나 삭제됐어요." });
      res.setHeader("Content-Type", b.type || "image/jpeg"); res.setHeader("Cache-Control", "private, max-age=86400");
      return res.status(200).send(b.buf);
    }
    const list = ((await getJSON(idx(uid))) || []).filter(x => now - x.created < KEEP);
    if (req.query.id) {
      const it = list.find(x => x.id === req.query.id);
      const d = it && (await getJSON(`hist/${uid}/item-${it.id}`));
      if (!d) return res.status(404).json({ error: "보관 기간(3일)이 지나 삭제됐어요." });
      return res.status(200).json({ ...it, data: d });
    }
    return res.status(200).json({ keepDays: KEEP_DAYS, items: list.map(x => ({ ...x, expires: x.created + KEEP })) });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "GET/POST only" });
  const b = req.body || {};
  let list = ((await getJSON(idx(uid))) || []).filter(x => now - x.created < KEEP);
  if (b.action === "delete") {
    list = list.filter(x => x.id !== b.id); await deleteKey(`hist/${uid}/item-${String(b.id).replace(/[^a-z0-9]/g, "")}.json`);
    await putJSON(idx(uid), list); return res.status(200).json({ ok: true });
  }
  if (b.action !== "save" || !b.data) return res.status(400).json({ error: "알 수 없는 요청이에요." });
  if (JSON.stringify(b.data).length > 25e6) return res.status(413).json({ error: "너무 커서 저장하지 못했어요." });
  const id = /^[a-z0-9]{6,20}$/.test(b.id || "") ? b.id : now.toString(36) + crypto.randomBytes(3).toString("hex");
  const data = await stash(uid, b.data);
  await putJSON(`hist/${uid}/item-${id}`, data);
  const old = list.find(x => x.id === id);
  const meta = { id, mode: b.mode === "blog" ? "blog" : "ig", title: clean(b.title, 120), thumb: await stash(uid, b.thumb || null), created: old?.created || now };
  list = [meta, ...list.filter(x => x.id !== id)].slice(0, MAX);
  await putJSON(idx(uid), list);
  res.status(200).json({ ok: true, id, expires: meta.created + KEEP });
}
