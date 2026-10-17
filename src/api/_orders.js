// 주문 저장
import { putJSON, getJSON } from "./_store.js";
const key = oid => `orders/${String(oid).replace(/[^a-zA-Z0-9_-]/g, "")}`;
export const saveOrder = o => putJSON(key(o.oid), o);
export const loadOrder = oid => getJSON(key(oid));
