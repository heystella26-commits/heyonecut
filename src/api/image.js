import { checkQuota, useQuota } from "./_quota.js";
import { toEnglish, editImage, classifyPhoto, planShots, editWithFallback } from "./_ai.js";
import { pickShots, shotPrompt, kindFromText, KINDS, menuFor, plannedPrompt } from "./_shots.js";
// 이미지만 다시 만들기
// mode "regen": 원본 사진으로 새 버전 2장 / mode "refine": 선택한 이미지를 요청대로 다듬어 1장

const MODELS = ["bfl/flux-kontext-pro", "bytedance/seedream-4.0", "openai/gpt-image-1-mini"];
// 한 번 더 생성할 때마다 다른 결과가 나오도록 고르는 변주 후보
const MOOD_VARIANTS = [
  "warm evening light with soft shadows", "bright clean morning light", "cozy interior with wooden textures",
  "modern minimal interior with neutral tones", "vintage retro mood with film-like color", "elegant fine-dining mood with dark tones",
];
const IG_VARIANTS = [
  "on a white marble table by a sunny window, with a small vase of flowers and a linen napkin",
  "top-down flat lay on a pastel solid-color background with a coffee cup and cutlery",
  "on a rustic wooden table on an outdoor terrace with soft sunlight and green plants",
  "on a textured stone surface with dramatic side light and a ceramic plate set",
  "on a checkered tablecloth picnic style with fresh ingredients scattered around",
  "on a glossy colored acrylic background with playful geometric props, trendy pop style",
];
const pick = a => a[Math.floor(Math.random() * a.length)];

const A_SCENES = [
  "a warm wooden table inside a cozy shop interior with soft blurred lights in the background and warm evening lighting",
  "a clean light-grey stone counter in a bright minimal modern shop with soft daylight and a blurred interior behind",
  "a dark walnut table in an elegant dimly lit interior with a soft warm spotlight on the subject",
  "a white tiled counter in a fresh, airy shop with plants and bright natural window light",
  "a vintage-style table with a linen runner in a charming retro interior with film-like warm colors",
];
const pickA = () => A_SCENES[Math.floor(Math.random() * A_SCENES.length)];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const quota = await checkQuota(req, res); if (!quota) return;
  const { mode = "regen", image, mediaType = "image/jpeg", source, basePrompt = "", instruction = "", ctx = {} } = req.body || {};
  const token = process.env.AI_GATEWAY_API_KEY || req.headers["x-vercel-oidc-token"] || process.env.VERCEL_OIDC_TOKEN;
  if (!token) return res.status(500).json({ error: "이미지 키가 설정되지 않았습니다." });

  const keep = "Keep the main subject exactly as it is (the same food, product, flowers, or hands and nails — same shape, colors and details). Do not add text or logos.";
  let jobs;
  if (mode === "refine") {
    // source: 다듬을 이미지(data URL 또는 https URL)
    const src = source || (image && `data:${mediaType};base64,${image}`);
    if (!src) return res.status(400).json({ error: "다듬을 이미지가 없습니다." });
    if (!instruction.trim()) return res.status(400).json({ error: "어떻게 다듬을지 적어 주세요." });
    const en = await toEnglish(instruction);
    const base = `Edit this photo: ${en}. Make these changes clearly visible while keeping the result photorealistic and high quality. Keep the main subject itself (its shape and details) recognizable. Do not add text or logos.`;
    // 다듬기는 2가지 버전: 원래 구도 유지 / 같은 요청 + 살짝 다른 구도
    jobs = [{ label: "다듬음 1", src, prompt: base + " Keep the original composition and camera angle." },
      { label: "다듬음 2", src, prompt: base + " Also try a slightly different framing and camera angle (a bit closer or from a different side) so it feels like a second take." }];
  } else {
    if (!image) return res.status(400).json({ error: "원본 사진이 없습니다." });
    const src = `data:${mediaType};base64,${image}`;
    const info = [ctx.bizName && `Shop: ${ctx.bizName}`, ctx.industry && `Industry: ${ctx.industry}`, ctx.bizDesc && `Service: ${ctx.bizDesc}`,
      ctx.tone && `Tone: ${ctx.tone}`, ctx.mood && `Mood: ${ctx.mood}`].filter(Boolean).join(". ");
    const custom = ctx.order ? ` Customer's own request (must follow): ${await toEnglish(ctx.order)}.` : "";
    const kind = KINDS.includes(ctx.kind) ? ctx.kind : (await classifyPhoto(image, mediaType)) || kindFromText(ctx.industry, ctx.bizDesc);
    const plan = await planShots(image, mediaType, { kind, menu: menuFor(kind), info, order: ctx.order || "" });
    jobs = plan ? plan.map(x => ({ label: x.label || "새 컷", src, prompt: plannedPrompt(kind, x.prompt_en, custom) }))
      : pickShots(2, kind).map(sh => ({ label: sh.label, src, prompt: shotPrompt(sh, { info, custom }) }));
  }

  // 2장 각각 모델을 바꿔 가며 시도 → 기본 2장
  const out = await Promise.allSettled(jobs.map(j => editWithFallback(token, j.prompt, j.src)));
  const ok = out.map((x, k) => x.status === "fulfilled" ? { ...x.value, label: jobs[k].label } : null).filter(Boolean);
  if (ok.length) {
    await useQuota(res, quota, 1, mode === "refine" ? "refine" : "regen");
    return res.status(200).json({ images: ok.map(o => o.src), labels: ok.map(o => o.label), model: ok[0].model });
  }
  const lastErr = out[0].reason;
  return res.status(500).json({ error: "이미지 재생성 오류: " + (lastErr?.message || "알 수 없음") });
}
