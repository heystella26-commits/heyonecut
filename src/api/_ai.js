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
      providerOptions: { blackForestLabs: { outputFormat: "jpeg" } } }),
  });
  const gd = await g.json().catch(() => ({}));
  if (!g.ok) throw new Error(gd.error?.message || `이미지 생성 실패 (${g.status})`);
  const d = gd.data?.[0];
  if (!d) throw new Error("모델이 이미지를 반환하지 않았습니다");
  if (d.url) return d.url;
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
