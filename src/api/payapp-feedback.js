// 페이앱 결제 통보(feedbackurl). 판매자 키로 검증 후 주문을 '결제완료'로 표시
import { loadOrder, saveOrder } from "./_orders.js";
import { track } from "./_track.js";
export default async function handler(req, res) {
  const b = typeof req.body === "string" ? Object.fromEntries(new URLSearchParams(req.body)) : (req.body || {});
  const E = process.env;
  if (b.userid !== E.PAYAPP_USERID || b.linkkey !== E.PAYAPP_LINKKEY || b.linkval !== E.PAYAPP_LINKVAL)
    return res.status(403).send("FAIL");
  const o = await loadOrder(b.var1 || "");
  if (!o) return res.status(200).send("SUCCESS"); // 모르는 주문은 무시
  if (String(b.pay_state) === "4" && Number(b.price) === o.price && o.status === "pending") {
    o.status = "paid"; o.mul_no = b.mul_no; o.paid = Date.now(); await saveOrder(o);
    await track("paid", { id: o.uid, member: String(o.uid).includes("_"), kind: o.plan, amount: o.price, n: o.credits, src: o.src || null });
  } else if (["9", "64", "70", "71"].includes(String(b.pay_state)) && o.status !== "claimed") {
    o.status = "cancelled"; await saveOrder(o);
  }
  res.status(200).send("SUCCESS");
}
