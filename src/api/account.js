// 계정: 동의 저장(consent) / 탈퇴(delete): 기본은 7일 뒤 삭제(그 안에 다시 로그인하면 복구), now:true면 즉시 완전 삭제
import { sessionUid, clearSession, loadUser, saveUser } from "./_quota.js";
import { track } from "./_track.js";
import { deleteTraining } from "./_train.js";
import { purgeUser } from "./cleanup.js";
export const GRACE_DAYS = 7;
export const CONSENT_VER = "2026-10-25";
export const makeConsent = (train, prev = {}) => ({ ver: CONSENT_VER, terms: prev.terms || Date.now(), privacy: prev.privacy || Date.now(), overseas: prev.overseas || Date.now(), train: !!train, trainAt: Date.now() });
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const b = req.body || {};
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const uid = sessionUid(req);
  if (!uid) return res.status(401).json({ error: "로그인이 필요해요." });
  const u = await loadUser(uid);
  if (!u || u.deleteAt) return res.status(401).json({ error: "로그인이 필요해요." });
  if (b.action === "consent") {
    if (b.required === false) return res.status(400).json({ error: "필수 항목에 동의해야 서비스를 쓸 수 있어요." });
    const was = !!u.consent?.train;
    u.consent = makeConsent(b.train, u.consent || {}); await saveUser(u);
    let removed = 0; if (was && !u.consent.train) removed = await deleteTraining(uid);
    return res.status(200).json({ ok: true, consent: u.consent, removed });
  }
  if (b.action !== "delete") return res.status(400).json({ error: "알 수 없는 요청이에요." });
  await track("withdraw", { id: uid, member: true }).catch(() => {});
  clearSession(res);
  if (b.now) { await purgeUser(uid); return res.status(200).json({ ok: true, now: true }); }
  u.deleteAt = Date.now() + GRACE_DAYS * 864e5; await saveUser(u);
  res.status(200).json({ ok: true, deleteAt: u.deleteAt, days: GRACE_DAYS });
}
