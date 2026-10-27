// 블로그: 사진 1장 + 가게 정보 → 본문 전체 작성 → 사진 들어갈 자리·종류 추천 → 그에 맞는 사진 3~5장 생성
import { checkQuota, useQuota, signTicket } from "./_quota.js";
import { logError } from "./_errlog.js";
import { track } from "./_track.js";

const BLOG_COST = 2;

const S = { type: "string" };
const TOOL = {
  name: "submit_blog",
  description: "완성된 블로그 글과 사진 계획을 제출합니다.",
  input_schema: {
    type: "object",
    properties: {
      title: S,
      body: S,
      tags: { type: "array", items: S },
      images: { type: "array", items: { type: "object", properties: {
        slot: { type: "integer" }, kind: S, why: S, prompt_en: S } } },
      sources: { type: "array", items: S },
    },
    required: ["title", "body", "tags", "images"],
  },
};

const PROMPT = ({ bizName, bizDesc, location, product, industry, tone, order }) => `당신은 네이버 블로그 상위노출 전문 작가입니다. 첨부 사진과 아래 정보로 바로 올릴 수 있는 블로그 글을 완성하세요.
상호명: ${bizName || "없음"} / 서비스·메뉴: ${bizDesc || "없음"} / 위치: ${location || "없음"}
업종: ${industry || "사진 보고 추정"} / 톤: ${tone || "친근하고 자연스럽게"}
상품 정보: ${product || "없음"}
${order ? `사진 주문서(이미지 분위기에 반영): ${order}` : ""}

[리서치] 상호명이나 위치가 있고 오프라인 매장이면 웹 검색으로 주소·영업시간·주차·대표 메뉴/가격·방문 후기 경향을 확인하세요. 확인 안 된 정보는 지어내지 말고 "(확인 필요)"로 표시하세요. 후기 문장은 베끼지 말고 요약하세요. 참고 URL은 sources에.

[본문 규칙]
- 1,500~2,200자, 네이버 블로그 말투(1인칭 방문/사용 후기 느낌, 너무 광고같지 않게).
- 소제목은 줄 맨 앞에 "## "로 표시. 4~6개 소제목(예: 첫인상, 대표 메뉴, 분위기, 방문 정보, 총평).
- 문단은 2~4줄로 짧게, 이모지는 소제목당 0~1개.
- 상호명·지역 키워드를 제목과 첫 문단, 마지막 문단에 자연스럽게 넣기.
- 마지막에 '방문 정보' 정리(주소/영업시간/주차/가격) — 모르는 건 (확인 필요).

[사진 배치 — 중요]
- 본문에서 사진이 들어가면 좋은 위치에 단독 줄로 [[사진1]], [[사진2]] … 를 넣으세요. 총 3~5개.
- [[사진1]]은 첫 문단 바로 뒤(대표 사진).
- images 배열에 같은 순서로 각 사진의 계획을 넣으세요:
  slot(번호), kind(사진 종류, 한국어 짧게: 예 "메뉴 클로즈업", "테이블 전체샷", "매장 분위기", "디테일 컷", "포장/테이크아웃"),
  why(왜 그 위치에 필요한지 한 문장), prompt_en(영어 이미지 생성 지시: 첨부 사진 속 주인공(음식/상품)을 바탕으로 그 장면을 구체적으로 — 구도, 앵글, 조명, 배경, 소품. 글자/로고 금지).
- 사진들끼리 구도·앵글이 서로 확실히 달라야 합니다(클로즈업, 탑뷰, 45도, 매장 분위기 등).

tags는 네이버 태그 10~15개(# 없이). 끝나면 반드시 submit_blog 도구로 제출하세요.`;

// Claude 응답을 스트리밍으로 받아 블록을 재구성하고, 본문 조각은 바로 화면으로 전달
async function claudeStream(model, messages, tools, onDelta, onStatus) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 10000, messages, tools, stream: true }),
  });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error?.message || `글 작성 실패 (${r.status})`); }
  const blocks = []; let stop = null, buf = "";
  const dec = new TextDecoder();
  for await (const chunk of r.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const ev = buf.slice(0, i); buf = buf.slice(i + 2);
      const line = ev.split("\n").find(l => l.startsWith("data:")); if (!line) continue;
      let d; try { d = JSON.parse(line.slice(5)); } catch { continue; }
      if (d.type === "content_block_start") {
        const b = { ...d.content_block }; if (b.type === "tool_use" || b.type === "server_tool_use") { b._json = ""; }
        blocks[d.index] = b;
        if (b.type === "server_tool_use") onStatus("search");
        if (b.type === "tool_use" && b.name === "submit_blog") onStatus("write");
      } else if (d.type === "content_block_delta") {
        const b = blocks[d.index]; if (!b) continue;
        if (d.delta.type === "text_delta") b.text = (b.text || "") + d.delta.text;
        else if (d.delta.type === "input_json_delta") { b._json += d.delta.partial_json; if (b.type === "tool_use" && b.name === "submit_blog") onDelta(d.delta.partial_json); }
      } else if (d.type === "content_block_stop") {
        const b = blocks[d.index];
        if (b && "_json" in b) { try { b.input = b._json ? JSON.parse(b._json) : {}; } catch { b.input = {}; } delete b._json; }
      } else if (d.type === "message_delta") { stop = d.delta.stop_reason; }
      else if (d.type === "error") throw new Error(d.error?.message || "글 작성 오류");
    }
  }
  return { content: blocks.filter(Boolean), stop_reason: stop };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const quota = await checkQuota(req, res, BLOG_COST); if (!quota) return;
  const { image, mediaType = "image/jpeg", bizName, bizDesc, location, product, industry, tone, imageOrder = "", model: wantModel } = req.body || {};
  if (!image) return res.status(400).json({ error: "사진이 없습니다." });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." });
  const order = String(imageOrder || "").trim().slice(0, 500);
  const model = (quota.test && wantModel) || process.env.BLOG_MODEL || process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

  // 스트리밍 시작 전에 미리 차감(쿠키는 첫 응답 전에만 보낼 수 있음). 실패하면 환불권을 줌
  await useQuota(res, quota, BLOG_COST, "blog");
  const refund = quota.test ? null : signTicket({ k: "refund", uid: quota.id, n: BLOG_COST, nonce: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), exp: Date.now() + 864e5 });
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Accel-Buffering", "no");
  res.status(200);
  const send = o => res.write(JSON.stringify(o) + "\n");
  const t0 = Date.now();
  send({ t: "status", v: "start" });

  try {
    const useSearch = Boolean(bizName || location || /^https?:\/\//i.test(product || ""));
    const tools = useSearch
      ? [{ type: "web_search_20250305", name: "web_search", max_uses: 3, user_location: { type: "approximate", country: "KR" } }, TOOL]
      : [TOOL];
    const messages = [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
      { type: "text", text: PROMPT({ bizName, bizDesc, location, product, industry, tone, order }) },
    ] }];
    let data;
    for (let turn = 0; turn < 5; turn++) {
      data = await claudeStream(model, messages, tools, v => send({ t: "d", v }), v => send({ t: "status", v }));
      if (data.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: data.content }); continue; }
      if (!data.content.some(b => b.type === "tool_use" && b.name === "submit_blog") && turn < 4) {
        messages.push({ role: "assistant", content: data.content });
        messages.push({ role: "user", content: "좋아요. 이제 완성본을 submit_blog 도구로 제출해 주세요." });
        send({ t: "reset" });
        continue;
      }
      break;
    }
    const sub = data.content.find(b => b.type === "tool_use" && b.name === "submit_blog");
    if (!sub || !sub.input?.body) throw new Error("글 형식 오류 — 다시 시도해 주세요");
    const post = sub.input;
    const plan = (post.images || []).filter(p => p && p.prompt_en).slice(0, 5);
    if (plan.length < 3) throw new Error("사진 계획이 부족해요 — 다시 시도해 주세요");
    const exp = Date.now() + 30 * 60e3;
    const images = plan.map((p, k) => ({ slot: p.slot || k + 1, kind: p.kind || `사진 ${k + 1}`, why: p.why || "",
      ticket: signTicket({ k: "bimg", uid: quota.id, slot: p.slot || k + 1, prompt: p.prompt_en, exp }) }));
    send({ t: "done", model, secs: (Date.now() - t0) / 1000, post: { title: post.title, body: post.body, tags: post.tags || [], sources: post.sources || [], images } });
  } catch (e) {
    await track("fail", { id: quota.id, member: !!quota.user, kind: "blog" });
    await logError("블로그 글", e.message, { id: quota.id, ua: req.headers["user-agent"] });
    send({ t: "error", v: e.message, refund });
  }
  res.end();
}
