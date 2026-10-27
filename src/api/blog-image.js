// 블로그 사진 1장 생성 (블로그 글을 만들 때 받은 서명 티켓으로만 가능, 추가 차감 없음)
import { verifyTicket, readQuota } from "./_quota.js";
import { editImage, classifyPhoto } from "./_ai.js";
import { saveTraining, wantsTraining } from "./_train.js";
import { claimOnce, releaseOnce } from "./_store.js";
const MODELS = ["openai/gpt-image-1", "bytedance/seedream-4.0", "bfl/flux-kontext-pro"];
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { ticket, image, mediaType = "image/jpeg" } = req.body || {};
  const t = verifyTicket(ticket);
  if (!t || t.k !== "bimg") return res.status(403).json({ error: "사진 생성 권한이 만료됐어요. 블로그 글을 다시 만들어 주세요." });
  const q = await readQuota(req);
  if (q.id !== t.uid) return res.status(403).json({ error: "다른 브라우저의 요청이에요." });
  if (!image) return res.status(400).json({ error: "원본 사진이 없습니다." });
  const once = "bimg/" + String(ticket).split(".").pop();
  if (!(await claimOnce(once))) return res.status(409).json({ error: "이 사진은 이미 만들었어요." });
  const token = process.env.AI_GATEWAY_API_KEY || req.headers["x-vercel-oidc-token"] || process.env.VERCEL_OIDC_TOKEN;
  const keep = "Keep the main food/product from the reference photo recognizable (same item, colors and details). Photorealistic, natural Korean blog photo style, no text, no logos, no watermarks.";
  let last;
  for (const m of MODELS) {
    try {
      const prompt = `Using this photo as the reference, create a new photo: ${t.prompt}. ${keep}`;
      const src = await editImage(token, m, prompt, `data:${mediaType};base64,${image}`);
      res.status(200).json({ src, model: m });
      // 학습 동의 회원: 사진 종류를 확인해 사람 얼굴 사진은 빼고 저장
      if (q.user && (await wantsTraining(q.user.uid))) await saveTraining(q.user.uid, { kind: (await classifyPhoto(image, mediaType)) || "unknown", mode: "blog", model: m, items: [{ src, label: "blog", prompt }] });
      return;
    }
    catch (e) { last = e; }
  }
  await releaseOnce(once).catch(() => {});
  res.status(500).json({ error: "사진 생성 실패: " + (last?.message || "알 수 없음") });
}
