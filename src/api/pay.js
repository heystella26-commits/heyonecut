// POST: 결제 요청 생성(페이앱) / GET ?oid=: 결제 확인 후 이용권 적립
import crypto from "node:crypto";
import { PLANS } from "./_plans.js";
import { track, srcCookie } from "./_track.js";
import { offerFor } from "./_coupon.js";
import { saveOrder, loadOrder } from "./_orders.js";
import { readQuota, writeQuota, cookieWalletId } from "./_quota.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const q = await readQuota(req);
  if (req.method === "POST") {
    const { plan, phone } = req.body || {};
    const p = PLANS[plan];
    const tel = String(phone || "").replace(/\D/g, "");
    if (!p) return res.status(400).json({ error: "플랜을 선택해 주세요." });
    if (!/^01\d{8,9}$/.test(tel)) return res.status(400).json({ error: "휴대폰 번호를 정확히 입력해 주세요." });
    if (!process.env.PAYAPP_USERID) return res.status(503).json({ error: "결제 준비 중이에요. (판매자 설정 전)" });
    const offer = await offerFor(q, PLANS);
    const disc = offer && offer.plan === plan ? offer : null;
    const price = disc ? disc.price : p.price;
    const goodname = disc ? `${p.name} (첫 구매 ${disc.rate}% 할인)` : p.name;
    const oid = Date.now().toString(36) + crypto.randomBytes(6).toString("hex");
    const base = `https://${req.headers.host}`;
    await saveOrder({ oid, uid: q.id, plan, price, list: p.price, coupon: disc ? disc.rate : 0, credits: p.credits, status: "pending", created: Date.now(), src: srcCookie(req) });
    const form = new URLSearchParams({
      cmd: "payrequest", userid: process.env.PAYAPP_USERID, goodname, price: String(price),
      recvphone: tel, smsuse: "n", var1: oid, feedbackurl: `${base}/api/payapp-feedback`,
      returnurl: `${base}/?paid=${oid}`, checkretry: "y",
    });
    const r = await fetch("https://api.payapp.kr/oapi/apiLoad.html", { method: "POST", body: form,
      headers: { "content-type": "application/x-www-form-urlencoded" } });
    const out = new URLSearchParams(await r.text());
    if (out.get("state") !== "1") return res.status(502).json({ error: "결제창 생성 실패: " + (out.get("errorMessage") || r.status) });
    if (!q.user) await writeQuota(res, q);
    await track("pay_open", { id: q.id, member: !!q.user, kind: disc ? plan + "_c" + disc.rate : plan, amount: price, src: srcCookie(req) });
    return res.status(200).json({ oid, payurl: out.get("payurl") });
  }
  // GET ?offer=1: 지금 받을 수 있는 첫 구매 할인
  if (req.query.offer) return res.status(200).json({ offer: await offerFor(q, PLANS), member: !!q.user });
  // GET: 결제 확인
  const oid = String(req.query.oid || "");
  const o = oid && await loadOrder(oid);
  if (!o) return res.status(404).json({ error: "주문을 찾을 수 없어요." });
  if (o.uid !== q.id && o.uid !== cookieWalletId(req)) return res.status(403).json({ error: "다른 브라우저에서 만든 주문이에요." });
  // 이 브라우저에서 이미 적립한 주문이면 다시 적립하지 않음 (저장소 지연으로 '결제완료'가 다시 읽혀도 안전)
  if (q.claimed.includes(o.oid)) return res.status(200).json({ status: "claimed", added: 0, credits: q.credits, already: true });
  if (o.status === "paid") {
    q.credits += o.credits; q.claimed.push(o.oid); o.status = "claimed"; o.claimed = Date.now();
    await writeQuota(res, q); await saveOrder(o);
    return res.status(200).json({ status: "claimed", added: o.credits, credits: q.credits });
  }
  return res.status(200).json({ status: o.status, credits: q.credits });
}
