import { checkQuota, useQuota } from "./_quota.js";
import { track } from "./_track.js";
import { toEnglish, editImage, claudeStream, grab } from "./_ai.js";
import { signTicket } from "./_quota.js";
import { pickShots, shotPrompt, kindFromText, menuFor, plannedPrompt } from "./_shots.js";
import { classifyPhoto, planShots, editWithFallback } from "./_ai.js";
// SnapPack MVP - 사진 1장 → 콘텐츠 패키지 생성 API
// 환경변수: ANTHROPIC_API_KEY (필수), AI_GATEWAY_API_KEY (이미지), FAL_KEY (선택)


const PROMPT = ({industry, tone, product, bizName, bizDesc, location}) => `당신은 인스타그램·네이버 블로그 마케팅 전문가입니다.
첨부된 사진을 분석해 바로 게시 가능한 콘텐츠 패키지를 만드세요.
업종: ${industry || "사진을 보고 추정"} / 톤: ${tone || "친근하고 자연스럽게"}
상호명: ${bizName || "없음"} / 서비스·메뉴 소개: ${bizDesc || "없음"} / 위치: ${location || "없음"}
상호명·서비스 소개가 있으면 캡션·블로그·DM 전체에 구체적으로 녹이세요(상호명 자연스럽게 노출, 대표 메뉴·특징 강조).

[블로그 리서치 규칙]
상호명이나 위치가 있고 맛집·카페·매장 등 오프라인 장소라면, 먼저 웹 검색으로 실제 정보를 확인하세요:
- 주소/찾아가는 길, 영업시간, 주차, 대표 메뉴와 가격
- 기존 방문 후기(네이버 블로그·지도 리뷰 등)에서 자주 언급되는 장점·분위기·웨이팅 팁
블로그 본문에는 이를 '방문 정보' 소제목과 '다른 방문자들의 평' 소제목으로 정리하되, 후기 문장을 그대로 베끼지 말고 요약·재서술하세요.
검색으로 확인되지 않은 정보는 지어내지 말고 "(확인 필요)"로 표시하세요. 참고한 출처 URL은 blog.sources 배열에 넣으세요.

모든 작업이 끝나면 결과를 반드시 submit_package 도구로 제출하세요. 필드 구성은 아래와 같습니다.
{
 "analysis": {"subject":"피사체","industry":"업종","mood":"분위기","target":"타깃 고객"},
 "image_prompt": "피사체 묘사(영어, 한 문장): 사진 속 주인공(음식/상품)의 생김새",
 "image_prompts": {"brand_mood":"A안 영어 프롬프트","instagrammable":"B안 영어 프롬프트"},
 "instagram": {"caption":"이모지 포함 3~6줄 캡션","hashtags":["#태그 20개"]},
 "blog": {"title":"검색 잘 되는 제목","body":"1000자 내외 본문, 소제목 포함","sources":["참고 URL"]},
 "first_comment": "게시 직후 내가 다는 첫 댓글(CTA 포함)",
 "reply_templates": [{"question":"예상 질문","reply":"답글"}],
 "best_post_time": "추천 게시 시간과 이유",
 "dm_templates": [{"trigger":"언제 보내는지(예: 댓글에 '정보' 키워드)","purpose":"목적","message":"DM 본문"}]
}
[이미지 재생성 규칙 — image_prompts, 영어로 작성]
A안 brand_mood: 상호명·업종·서비스 소개·톤·분석한 분위기를 반영해, 이 가게의 브랜드 무드가 느껴지는 이미지. 매장 인테리어 느낌, 조명, 색감, 그릇/테이블 소재를 구체적으로 지정.
B안 instagrammable: A안의 정보를 참고하되, 인스타그램에 올리고 싶어지도록 배경과 소품을 확실히 바꾼 이미지. 트렌디한 배경(예: 창가 햇살, 대리석, 린넨, 파스텔 단색, 야외 테라스 중 가게에 어울리는 것), 어울리는 소품 2~3개(꽃, 커피잔, 수저, 메뉴판, 식물 등), 4:5 세로 구도.
두 안은 배경·조명·소품이 서로 확연히 달라야 합니다. 피사체(음식/상품)의 모양·색·토핑은 절대 바꾸지 말 것. 글자·로고 넣지 말 것.
reply_templates는 4개 작성하세요.
dm_templates는 아래 5종을 순서대로 작성하세요. 상품 정보(${product || "사진 속 상품"})를 캡션·블로그·DM 전체에 자연스럽게 넣고, 링크 자리는 {링크}로 두세요.
1) 댓글 키워드 자동 DM(상품 소개+링크) 2) 가격·구매 문의 응답 3) 첫 구매 혜택/쿠폰 안내
4) 문의 후 미구매 고객 리마인드 5) 구매 고객 감사+후기 요청
각 DM은 3~6줄, 광고 티가 덜 나게 1:1 대화체로, 이모지는 1~2개만.`;

const S = { type: "string" };
const SUBMIT_TOOL = {
  name: "submit_package",
  description: "완성된 콘텐츠 패키지를 제출합니다.",
  input_schema: {
    type: "object",
    properties: {
      analysis: { type: "object", properties: { subject: S, industry: S, mood: S, target: S } },
      instagram: { type: "object", properties: { caption: S, hashtags: { type: "array", items: S } } },
      first_comment: S,
      image_prompt: S,
      image_prompts: { type: "object", properties: { brand_mood: S, instagrammable: S } },
      blog: { type: "object", properties: { title: S, body: S, sources: { type: "array", items: S } } },
      reply_templates: { type: "array", items: { type: "object", properties: { question: S, reply: S } } },
      best_post_time: S,
      dm_templates: { type: "array", items: { type: "object", properties: { trigger: S, purpose: S, message: S } } },
    },
    required: ["analysis", "image_prompt", "instagram", "blog", "first_comment", "reply_templates", "best_post_time", "dm_templates"],
  },
};

const A_SCENES = [
  "a warm wooden table inside a cozy shop interior with soft blurred lights in the background and warm evening lighting",
  "a clean light-grey stone counter in a bright minimal modern shop with soft daylight and a blurred interior behind",
  "a dark walnut table in an elegant dimly lit interior with a soft warm spotlight on the subject",
  "a white tiled counter in a fresh, airy shop with plants and bright natural window light",
  "a vintage-style table with a linen runner in a charming retro interior with film-like warm colors",
];
const B_SCENES = [
  "on a white marble table by a sunny window with a linen napkin",
  "in a top-down flat lay on a pastel solid-color background",
  "on a rustic wooden table on an outdoor terrace with soft sunlight and green plants",
  "on a textured stone surface with dramatic side light",
  "on a checkered tablecloth in a bright picnic style",
];
const pickB = () => B_SCENES[Math.floor(Math.random() * B_SCENES.length)];
const pickA = () => A_SCENES[Math.floor(Math.random() * A_SCENES.length)];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const quota = await checkQuota(req, res); if (!quota) return;
  const { image, mediaType = "image/jpeg", industry, tone, product, bizName, bizDesc, location, mode = "all", imageOrder = "" } = req.body || {};
  const t0 = Date.now();
  const order = String(imageOrder || "").trim().slice(0, 500);
  const igOnly = mode === "instagram";
  const productUrl = product && /^https?:\/\//i.test(product.trim()) ? product.trim() : "";
  const useSearch = Boolean(productUrl || (!igOnly && (bizName || location)));
  if (!image) return res.status(400).json({ error: "이미지가 없습니다." });
  if (!process.env.ANTHROPIC_API_KEY)
    return res.status(500).json({ error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." });

  // 속도 개선: 글 작성(Claude)과 이미지 2장 생성을 동시에 시작
  const imagesPromise = (async () => {
    const token = process.env.AI_GATEWAY_API_KEY || req.headers["x-vercel-oidc-token"] || process.env.VERCEL_OIDC_TOKEN;
    if (!token) return { error: "이미지 키 없음" };
    const info = [bizName && `Shop: ${bizName}`, industry && `Industry: ${industry}`, bizDesc && `Service: ${bizDesc}`, tone && `Tone: ${tone}`].filter(Boolean).join(". ");
    const custom = order ? ` Customer's own request (must follow): ${await toEnglish(order)}.` : "";
    // 사진을 먼저 읽어 종류(음식·카페·패션·네일…)를 정하고, 그 종류에 맞는 컷 2개
    const kind = (await classifyPhoto(image, mediaType)) || kindFromText(industry, bizDesc);
    // 블로그처럼 사진을 보고 컷 2개를 구체적으로 설계 → 실패하면 기본 컷 규칙
    const plan = await planShots(image, mediaType, { kind, menu: menuFor(kind), info, order });
    const jobs = plan ? plan.map(x => ({ label: x.label || "새 컷", prompt: plannedPrompt(kind, x.prompt_en, custom) }))
      : pickShots(2, kind).map(sh => ({ label: sh.label, prompt: shotPrompt(sh, { info, custom }) }));
    const src = `data:${mediaType};base64,${image}`;
    const out = await Promise.allSettled(jobs.map(j => editWithFallback(token, j.prompt, src)));
    const ok = out.map((x, k) => x.status === "fulfilled" ? { ...x.value, label: jobs[k].label } : null).filter(Boolean);
    if (ok.length) return { images: ok.map(o => o.src), labels: ok.map(o => o.label), model: ok[0].model, kind };
    const lastErr = out[0].reason;
    return { error: "이미지 재생성 오류: " + (lastErr?.message || "알 수 없음") };
  })().catch(e => ({ error: "이미지 재생성 오류: " + e.message }));

  // 상품 칸에 URL이 오면 판매페이지를 읽어서 텍스트로 변환
  let productInfo = product;
  if (product && /^https?:\/\//i.test(product.trim())) {
    try {
      const pr = await fetch(product.trim(), { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36", "accept-language": "ko-KR,ko;q=0.9" }, signal: AbortSignal.timeout(10000) });
      const html = await pr.text();
      if (!pr.ok || html.length < 2000) throw new Error("blocked");
      const meta = [...html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:title|og:description|description|product:price:amount)["'][^>]*content=["']([^"']+)["']/gi)].map(m => m[1]).join(" / ");
      const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&amp;|&#\d+;/g, " ").replace(/\s+/g, " ").slice(0, 6000);
      productInfo = `판매페이지(${product.trim()}) 내용 — 메타: ${meta}\n본문: ${body}\n위 내용에서 상품명·가격·핵심 특징·혜택을 뽑아 활용하고, {링크}에는 이 URL을 그대로 넣으세요.`;
    } catch (e) { productInfo = `판매페이지 URL: ${product.trim()} (페이지를 직접 읽지 못함 — 웹 검색으로 이 상품의 이름·가격·특징을 찾아 활용하세요. 그래도 모르면 '(확인 필요)'로 표시)`; }
  }

  // 스트리밍 시작: 차감을 먼저 쿠키에 쓰고(실패 시 환불 티켓), 글이 써지는 대로 보냄
  await useQuota(res, quota, 1, "instagram");
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Accel-Buffering", "no");
  const send = o => res.write(JSON.stringify(o) + "\n");
  send({ type: "start" });
  const model = (quota.test && req.body?.model) || process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
  try {
    const messages = [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
      { type: "text", text: PROMPT({ industry, tone, product: productInfo, bizName, bizDesc, location }) + (order ? `\n\n[사용자 이미지 주문서 — 최우선 반영] ${order}\nimage_prompts의 A안·B안 모두에 이 주문서 내용을 구체적으로 녹이세요(단, 피사체는 그대로).` : "") + (igOnly ? "\n\n[이번 요청은 인스타그램 전용] 블로그 리서치 규칙은 무시하고 blog 필드는 title·body를 빈 문자열로 두세요. 캡션은 첫 줄에 시선을 끄는 한 문장을 넣고, 인스타 피드에서 '더 보기' 전에 핵심이 보이게 쓰세요. 도구 입력은 analysis → instagram → first_comment 순서로 먼저 작성하세요." : "") },
    ]}];
    const tools = useSearch
      ? [{ type: "web_search_20250305", name: "web_search", max_uses: 4, user_location: { type: "approximate", country: "KR" } }, SUBMIT_TOOL]
      : [SUBMIT_TOOL];
    const onPartial = raw => {
      const cap = grab(raw, "caption"), fc = grab(raw, "first_comment");
      send({ type: "partial", caption: cap?.text || "", first_comment: fc?.text || "" });
    };
    let data;
    for (let turn = 0; turn < 4; turn++) {
      data = await claudeStream({ messages, tools, model, max_tokens: 8000, toolName: "submit_package", onPartial });
      if (data.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: data.content }); continue; }
      if (!(data.content || []).some(b => b.type === "tool_use" && b.name === "submit_package") && turn < 3) {
        messages.push({ role: "assistant", content: data.content });
        messages.push({ role: "user", content: "좋아요. 이제 위 내용을 submit_package 도구로 제출해 주세요." });
        continue;
      }
      break;
    }
    const sub = (data.content || []).find(b => b.type === "tool_use" && b.name === "submit_package");
    if (!sub) throw new Error("결과 형식 오류 — 다시 시도해 주세요");
    const pack = sub.input;
    pack.text_secs = Math.round((Date.now() - t0) / 100) / 10; pack.text_model = model;
    if (productUrl && Array.isArray(pack.dm_templates))
      pack.dm_templates.forEach(d => { if (d.message) d.message = d.message.split("{링크}").join(productUrl); });
    send({ type: "text", pack });
    const im = await imagesPromise;
    const imgs = im.images || [];
    send({ type: "done", images: imgs, image_labels: im.labels || [], image_model: im.model, image_kind: im.kind, image_error: im.error, secs: Math.round((Date.now() - t0) / 100) / 10 });
  } catch (e) {
    await track("fail", { id: quota.id, member: !!quota.user, kind: "instagram" });
    send({ type: "error", error: e.message, refund: quota.test ? null : signTicket({ k: "refund", uid: quota.id, n: 1, nonce: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), exp: Date.now() + 864e5 }) });
  }
  res.end();
}
