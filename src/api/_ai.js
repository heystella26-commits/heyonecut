// 공용: 한국어 지시 → 영어 변환, 이미지 편집 호출
// 이미지 모델은 한국어 지시를 거의 무시함 → Claude로 명확한 영어 편집 지시로 바꿈
export async function toEnglish(text) {
  text = String(text || "").trim().slice(0, 600);
  if (!text || !/[\u3131-\uD79D]/.test(text) || !process.env.ANTHROPIC_API_KEY) return text;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.CLAUDE_FAST_MODEL || "claude-haiku-5-5", max_tokens: 300,
        messages: [{ role: "user", content: `Rewrite this photo-editing request as ONE clear, concrete English instruction for an AI image editing model. Describe visible changes (lighting, colors, background, props, surface, mood). Output only the instruction.\n\nRequest: ${text}` }] }),
      signal: AbortSignal.timeout(15000),
    });
    const d = await r.json();
    const out = (d.content || []).filter(b => b.type === "text").map(b => b.text).join(" ").trim();
    return out || text;
  } catch { return text; }
}


export async function editImage(token, model, prompt, dataUrl) {
  const g = await fetch("https://ai-gateway.vercel.sh/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ model, prompt, images: [{ image_url: dataUrl }],
      ...(model.startsWith("openai/") ? { quality: "medium", size: "1024x1536", output_format: "jpeg" } : {}),
      ...(model.startsWith("bytedance/") ? { watermark: false } : {}),
      providerOptions: { blackForestLabs: { outputFormat: "jpeg" }, openai: { quality: "medium", size: "1024x1536", outputFormat: "jpeg" }, bytedance: { watermark: false } } }),
  });
  const gd = await g.json().catch(() => ({}));
  if (!g.ok) throw new Error(gd.error?.message || `이미지 생성 실패 (${g.status})`);
  const d = gd.data?.[0];
  if (!d) throw new Error("모델이 이미지를 반환하지 않았습니다");
  // 모델이 주소(URL)로 돌려주면 서버에서 받아 data URL로 바꿈 — 화면에서 저장·보관·다듬기가 막히지 않게(다른 사이트 이미지는 브라우저가 저장을 막음)
  if (d.url) {
    try { const r = await fetch(d.url); if (r.ok) { const t = r.headers.get("content-type") || "image/jpeg"; return `data:${t};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`; } } catch {}
    return d.url;
  }
  return `data:${d.b64_json.startsWith("/9j/") ? "image/jpeg" : "image/png"};base64,${d.b64_json}`;
}


// Claude 스트리밍 호출: 도구 입력(JSON)이 써지는 대로 onPartial(지금까지의 문자열)을 부름
export async function claudeStream({ messages, tools, model, max_tokens = 8000, toolName, onPartial }) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens, messages, tools, stream: true }),
  });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error?.message || `글 작성 실패 (${r.status})`); }
  const blocks = []; const raw = {}; let stop = null, buf = "";
  const dec = new TextDecoder(); const reader = r.body.getReader();
  let lastSent = 0;
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      const line = chunk.split("\n").find(l => l.startsWith("data:")); if (!line) continue;
      let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
      if (ev.type === "content_block_start") { blocks[ev.index] = { ...ev.content_block }; raw[ev.index] = ""; if (blocks[ev.index].type === "text") blocks[ev.index].text = ""; }
      else if (ev.type === "content_block_delta") {
        const b = blocks[ev.index];
        if (ev.delta.type === "input_json_delta") {
          raw[ev.index] += ev.delta.partial_json;
          if (b?.type === "tool_use" && b.name === toolName && onPartial && Date.now() - lastSent > 120) { lastSent = Date.now(); onPartial(raw[ev.index]); }
        } else if (ev.delta.type === "text_delta" && b) b.text += ev.delta.text;
      } else if (ev.type === "content_block_stop") {
        const b = blocks[ev.index];
        if (b && (b.type === "tool_use" || b.type === "server_tool_use")) { try { b.input = JSON.parse(raw[ev.index] || "{}"); } catch { b.input = {}; } }
        if (b?.type === "tool_use" && b.name === toolName && onPartial) onPartial(raw[ev.index]);
      } else if (ev.type === "message_delta") stop = ev.delta?.stop_reason || stop;
      else if (ev.type === "error") throw new Error(ev.error?.message || "글 작성 중 오류");
    }
  }
  return { content: blocks.filter(Boolean), stop_reason: stop };
}

// 덜 써진 JSON 문자열에서 "key": "값…" 을 지금까지 써진 만큼 꺼냄
export function grab(partial, key) {
  const m = partial.match(new RegExp(`"${key}"\\s*:\\s*"`)); if (!m) return null;
  let s = partial.slice(m.index + m[0].length), out = "";
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (c === "\\") { const n = s[k + 1]; if (n === undefined) break; out += n === "n" ? "\n" : n === "t" ? "\t" : n === "u" ? String.fromCharCode(parseInt(s.slice(k + 2, k + 6), 16) || 32) : n; k += n === "u" ? 5 : 1; continue; }
    if (c === '"') return { text: out, done: true };
    out += c;
  }
  return { text: out, done: false };
}

// 사진 종류 판별 (컷 규칙 고르기용): 빠른 모델로 한 단어만
export const PHOTO_KINDS = ["food", "cafe", "fashion_person", "fashion_item", "nail", "hair", "flower", "product", "space"];
export async function classifyPhoto(image, mediaType = "image/jpeg") {
  if (!process.env.ANTHROPIC_API_KEY || !image) return null;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.CLAUDE_FAST_MODEL || "claude-haiku-5-5", max_tokens: 10, messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
        { type: "text", text: `Classify the MAIN subject of this photo for a small-business Instagram post. Answer with exactly one word from this list:
food (meals, grilled meat, noodles, restaurant dishes)
cafe (coffee, drinks, desserts, bakery, cake)
fashion_person (a person wearing clothes/outfit is the subject)
fashion_item (clothes, bags, shoes shown without a person)
nail (nails, manicure, hands)
hair (hairstyle, salon result)
flower (flowers, bouquets, plants)
product (any other goods: cosmetics, crafts, accessories, gadgets, packaged items)
space (shop interior or exterior is the subject)` }] }] }),
      signal: AbortSignal.timeout(8000),
    });
    const d = await r.json();
    const w = (d.content || []).map(b => b.text || "").join(" ").toLowerCase().match(/[a-z_]+/g) || [];
    return w.find(x => PHOTO_KINDS.includes(x)) || null;
  } catch { return null; }
}

// 1순위 OpenAI GPT Image 2(중간 화질) — gpt-image-1은 AI Gateway에 없음. 실패하면 Flux → Seedream(워터마크 끔)
export const IMG_MODELS = ["openai/gpt-image-2", "bfl/flux-kontext-pro", "bytedance/seedream-4.0"];
// 한 장씩 모델을 바꿔 가며 시도 (한 장이 실패해도 다른 장은 그대로)
// 사람(얼굴)이 나오는 사진은 얼굴 유지가 더 좋은 모델을 먼저
export const PERSON_MODELS = IMG_MODELS;
export async function editWithFallback(token, prompt, src, models = IMG_MODELS) {
  let last;
  for (const m of models) {
    try { return { src: await editImage(token, m, prompt, src), model: m }; }
    catch (e) { last = e; if (m === models[0]) import("./_errlog.js").then(x => x.logError("이미지 1순위 실패 → 다음 모델", `${m}: ${e.message}`)).catch(() => {}); }
  }
  throw last || new Error("이미지 생성 실패");
}

// 블로그처럼: 사진을 보고 이 사진에 맞는 인스타 컷 2개를 구체적으로 설계 (영어 프롬프트)
export async function planShots(image, mediaType, { kind, menu, info = "", order = "" }) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.CLAUDE_PLAN_MODEL || "claude-sonnet-5-5", max_tokens: 900, messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
        { type: "text", text: `You are a professional Instagram photographer for a Korean small business (${kind}).${info ? ` Business: ${info}.` : ""}${order ? ` Owner's request (must follow): ${order}.` : ""}
Look at this photo and plan 2 NEW Instagram photos of the same subject that look like a real pro shoot. Pick the 2 shots from this menu that suit THIS photo best, and make them clearly different from each other AND from the original (different camera angle, distance, composition, lighting, background and props):
${menu.map(([l, p]) => `- ${l}: ${p}`).join("\n")}
For each, write prompt_en: one detailed English instruction for an image-editing model (camera angle and distance, framing, lens feel, lighting direction and time of day, background/setting, 2-3 props that fit this business, color mood). Describe the subject's look specifically so it stays identical. Never ask to change the subject itself. No text or logos.
If a person is in the photo: keep their exact face, hairstyle, body shape and outfit; change only camera angle, framing, background and a natural, calm pose. Never describe motion blur, movement trails, spinning, jumping or anything that could create duplicate or see-through figures. Exactly one person.
Answer ONLY with JSON: [{"label":"<menu label in Korean>","prompt_en":"..."},{"label":"...","prompt_en":"..."}]` }] }] }),
      signal: AbortSignal.timeout(20000),
    });
    const d = await r.json();
    const t = (d.content || []).map(b => b.text || "").join("");
    const arr = JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1));
    return Array.isArray(arr) && arr.length >= 2 && arr.every(x => x.prompt_en) ? arr.slice(0, 2) : null;
  } catch { return null; }
}
