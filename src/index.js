// 헤이원컷 Cloudflare Worker: /api/* 는 아래 함수로, 나머지는 public/ 정적 파일
import { env } from "cloudflare:workers";
import { putRaw, getRaw } from "./api/_store.js";
import quota from "./api/quota.js";
import generate from "./api/generate.js";
import image from "./api/image.js";
import blog from "./api/blog.js";
import blogImage from "./api/blog-image.js";
import pay from "./api/pay.js";
import payappFeedback from "./api/payapp-feedback.js";
import refund from "./api/refund.js";
import grant from "./api/grant.js";
import samples from "./api/samples.js";
import adminGen from "./api/admin-gen.js";
import auth from "./api/auth/p.js";

const ROUTES = { quota, generate, image, blog, "blog-image": blogImage, pay, "payapp-feedback": payappFeedback, refund, grant, samples, "admin-gen": adminGen };

// Vercel식 (req, res) 핸들러를 Worker Request/Response로 연결
function makeRes(resolve) {
  const headers = new Map();
  let code = 200, stream = null, done = false;
  const build = body => {
    const h = new Headers();
    for (const [k, v] of headers) (Array.isArray(v) ? v : [v]).forEach(x => h.append(k, String(x)));
    return new Response(body, { status: code, headers: h });
  };
  const enc = new TextEncoder();
  const res = {
    get headersSent() { return done || !!stream; },
    get writableEnded() { return done; },
    status(c) { code = c; return res; },
    setHeader(k, v) { headers.set(k.toLowerCase(), v); return res; },
    getHeader(k) { return headers.get(k.toLowerCase()); },
    json(o) { if (!headers.has("content-type")) res.setHeader("content-type", "application/json; charset=utf-8"); return res.end(JSON.stringify(o)); },
    send(b) {
      if (b !== null && typeof b === "object" && !(b instanceof Uint8Array) && !(b instanceof ArrayBuffer)) return res.json(b);
      if (typeof b === "string" && !headers.has("content-type")) res.setHeader("content-type", "text/html; charset=utf-8");
      return res.end(b);
    },
    redirect(c, u) { if (typeof c === "string") { u = c; c = 302; } code = c; res.setHeader("location", u); return res.end(); },
    write(chunk) {
      if (!stream) { const ts = new TransformStream(); stream = ts.writable.getWriter(); resolve(build(ts.readable)); }
      stream.write(typeof chunk === "string" ? enc.encode(chunk) : chunk);
      return true;
    },
    end(chunk) {
      if (done) return res; done = true;
      if (stream) { if (chunk != null) res.write(chunk); stream.close(); }
      else resolve(build(code === 204 || code === 304 ? null : chunk ?? null));
      return res;
    },
  };
  return res;
}

async function readBody(request) {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const ct = request.headers.get("content-type") || "";
  const text = await request.text();
  if (ct.includes("application/json")) { try { return JSON.parse(text); } catch { return {}; } }
  if (ct.includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(text));
  return text;
}

// Vercel Blob에 있던 데이터(회원·주문·샘플)를 처음 한 번만 D1으로 복사
async function migrateOnce() {
  if (!process.env.MIGRATE_FROM || !process.env.MIGRATE_TICKET) return;
  if (await getRaw("meta/migrated")) return;
  await putRaw("meta/migrated", String(Date.now()), "text/plain");
  try {
    const r = await fetch(process.env.MIGRATE_FROM + "/api/export?t=" + encodeURIComponent(process.env.MIGRATE_TICKET));
    if (!r.ok) throw new Error("export " + r.status);
    const items = await r.json();
    let n = 0;
    for (const it of items) {
      if (await getRaw(it.path)) continue; // 이미 새로 생긴 데이터는 덮어쓰지 않음
      await putRaw(it.path, it.json ? Buffer.from(it.b64, "base64").toString("utf8") : it.b64, it.type);
      n++;
    }
    await putRaw("meta/migrated", JSON.stringify({ at: Date.now(), n, total: items.length }), "application/json");
  } catch (e) {
    await env.DB.prepare("DELETE FROM kv WHERE k = ?").bind("meta/migrated").run().catch(() => {});
    await putRaw("meta/migrate_error", String(e.message), "text/plain").catch(() => {});
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    ctx.waitUntil(migrateOnce().catch(() => {}));
    const parts = url.pathname.slice(5).replace(/\/+$/, "").split("/");
    const query = Object.fromEntries(url.searchParams);
    let handler = ROUTES[parts[0]];
    if (parts[0] === "auth" && parts[1]) { handler = auth; query.p = parts[1]; }
    if (!handler || parts.length > (parts[0] === "auth" ? 2 : 1)) return Response.json({ error: "not found" }, { status: 404 });
    const headers = {};
    request.headers.forEach((v, k) => { headers[k] = v; });
    headers.host = url.host;
    const req = { method: request.method, url: url.pathname + url.search, headers, query, body: await readBody(request) };
    return new Promise(resolve => {
      const res = makeRes(resolve);
      const run = Promise.resolve().then(() => handler(req, res)).then(() => { if (!res.writableEnded && !res.headersSent) res.end(); })
        .catch(e => { if (!res.headersSent) res.status(500).json({ error: e.message || "서버 오류" }); else res.end(); });
      ctx.waitUntil(run);
    });
  },
};
