// 헤이원컷 Cloudflare Worker: /api/* 는 아래 함수로, 나머지는 public/ 정적 파일
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
import account from "./api/account.js";
import stats from "./api/stats.js";
import cases from "./api/cases.js";

const ROUTES = { quota, generate, image, blog, "blog-image": blogImage, pay, "payapp-feedback": payappFeedback, refund, grant, samples, "admin-gen": adminGen, account, stats, cases };

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

// 모든 응답에 붙이는 보안 헤더
const SEC = {
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};
function secure(r) {
  const out = new Response(r.body, r);
  for (const [k, v] of Object.entries(SEC)) out.headers.set(k, v);
  return out;
}

export default {
  async fetch(request, env, ctx) { return secure(await route(request, env, ctx)); },
};

async function route(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
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
}
