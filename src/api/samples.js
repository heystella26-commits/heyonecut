// 첫 화면 샘플 갤러리: GET 목록 / GET ?f= 이미지 / POST(운영자 전용) 저장
import { putBin, getBin, putJSON, getJSON } from "./_store.js";
async function toBuf(src) {
  if (src.startsWith("data:")) return { buf: Buffer.from(src.split(",")[1], "base64"), type: src.slice(5, src.indexOf(";")) };
  const r = await fetch(src); return { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type") || "image/jpeg" };
}
export default async function handler(req, res) {
  try {
    if (req.method === "POST") {
      const isAdmin = process.env.QUOTA_SECRET && req.headers["x-sp-test"] === process.env.QUOTA_SECRET;
      if (!isAdmin) return res.status(403).json({ error: "forbidden" });
      const { list, item } = req.body || {};
      let cur = (await getJSON("samples/list")) || [];
      const items = item ? [item] : (list || []);
      if (list) cur = [];
      for (const s of items) {
        const id = String(s.id).replace(/[^a-z0-9-]/gi, "");
        for (const k of ["before", "after"]) {
          const { buf, type } = await toBuf(s[k]);
          await putBin(`samples/${id}-${k}.jpg`, buf, type);
        }
        cur = cur.filter(x => x.id !== id).concat([{ id, label: s.label, note: s.note || "" }]);
      }
      await putJSON("samples/list", cur);
      return res.status(200).json({ ok: true, n: cur.length });
    }
    if (req.query.f) {
      const f = String(req.query.f).replace(/[^a-z0-9-]/gi, "");
      const b = await getBin(`samples/${f}.jpg`);
      if (!b) throw new Error("not found");
      res.setHeader("Content-Type", b.type || "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
      return res.status(200).send(b.buf);
    }
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
    return res.status(200).json((await getJSON("samples/list")) || []);
  } catch (e) {
    if (req.method === "GET" && !req.query.f) return res.status(200).json([]);
    return res.status(404).json({ error: e.message });
  }
}
