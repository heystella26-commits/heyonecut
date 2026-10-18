// 블로그 실시간 작성·사진 순차 채우기·샘플 갤러리 (app.js 다음에 로드되어 기존 함수를 대체)
$("goBtn").onclick = async () => {
  if (state.mode === "blog") return runBlog();
  return runIg();
};

// ---------- 인스타: 캡션이 써지는 대로 보여주고, 글이 끝나면 결과 화면 → 이미지 도착 시 채움 ----------
async function readNdjson(r, onEv) {
  const reader = r.body.getReader(), dec = new TextDecoder(); let buf = "";
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (line.trim()) onEv(JSON.parse(line)); }
  }
}
PLANS_T["ig-img"] = { secs: 8, steps: ["A·B 이미지 마무리"] };
async function runIg() {
  const btn = $("goBtn"); btn.disabled = true;
  const stop = startProgress($("msg"), "ig");
  const live = document.createElement("div"); live.className = "livecap"; live.innerHTML = '<b>✍️ 캡션 쓰는 중</b><pre id="liveCapTxt"></pre>';
  $("msg").appendChild(live);
  let pack = null, imgs = null, err = null, onRes = false;
  try {
    const r = await fetch("/api/generate", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "instagram", image: state.img, mediaType: "image/jpeg", ...info(), model: window.__model }) });
    readLeft(r);
    if (r.status === 402) { refreshQuota(); openPay(); throw new Error("이용 가능 횟수가 없어요."); }
    if (!r.ok || !r.body) { const j = await r.json().catch(() => ({})); throw new Error(j.error || "서버 오류"); }
    await readNdjson(r, ev => {
      if (ev.type === "partial") { const t = $("liveCapTxt"); if (t) t.textContent = ev.caption + (ev.first_comment ? "\n\n💬 " + ev.first_comment : ""); }
      if (ev.type === "text") {
        pack = ev.pack; pack.images = []; pack.image_labels = [];
        stop(); $("msg").textContent = ""; render(pack); go("res"); onRes = true;
        busy(true, "ig-img");
      }
      if (ev.type === "done") imgs = ev;
      if (ev.type === "error") { err = ev.error; if (ev.refund) fetch("/api/refund", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refund: ev.refund }) }).then(() => refreshQuota()); }
    });
    if (err) throw new Error(err + " (차감된 횟수는 돌려드렸어요)");
    if (!pack) throw new Error("연결이 끊겼어요. 다시 시도해 주세요.");
    state.p.timing = { text: pack.text_secs, total: imgs?.secs, model: pack.text_model };
    state.gen = [...(imgs?.images || [])]; state.lab = [...(imgs?.image_labels || [])];
    if (imgs?.image_error) state.p.image_error = imgs.image_error;
    busy(false, state.gen.length ? "✅ A·B 이미지가 도착했어요." : "⚠️ " + esc(imgs?.image_error || "이미지를 만들지 못했어요."));
    setSlides(0);
  } catch (e) {
    stop(); if (onRes) busy(false, "⚠️ " + esc(e.message)); else $("msg").textContent = "오류: " + e.message;
  }
  btn.disabled = false;
}

// ---------- 블로그: 글은 써지는 대로 보여주고, 사진은 한 장씩 채움 ----------
// 스트리밍 중인 JSON 조각에서 특정 문자열 값(아직 덜 끝난 것 포함)을 꺼냄
function partialStr(json, key) {
  const m = json.match(new RegExp(`"${key}"\\s*:\\s*"`)); if (!m) return null;
  let i = m.index + m[0].length, out = "";
  for (; i < json.length; i++) {
    const c = json[i];
    if (c === "\\") { if (i + 1 >= json.length) break; const n = json[i + 1];
      if (n === "u") { if (i + 6 > json.length) break; out += String.fromCharCode(parseInt(json.slice(i + 2, i + 6), 16)); i += 5; }
      else { out += ({ n: "\n", t: "\t", r: "", '"': '"', "\\": "\\", "/": "/" })[n] ?? n; i++; }
      continue; }
    if (c === '"') return { v: out, done: true };
    out += c;
  }
  return { v: out, done: false };
}
function liveBlog(title, body, done) {
  let h = `<div class="blogbar">N 블로그 미리보기 <span class="live">${done ? "" : "● 작성 중"}</span></div><h1>${esc(title || "제목 쓰는 중…")}</h1>`;
  let para = [], n = 0;
  const flush = () => { if (para.length) { h += `<p>${esc(para.join("\n"))}</p>`; para = []; } };
  body.split("\n").forEach(line => {
    const m = line.trim().match(/^\[\[\s*사진\s*(\d+)\s*\]\]$/);
    if (m) { flush(); h += `<figure><div class="miss wait">📷 사진 ${m[1]} 자리</div></figure>`; return; }
    if (/^##\s+/.test(line)) { flush(); h += `<h2>${esc(line.replace(/^##\s+/, ""))}</h2>`; return; }
    if (!line.trim()) return flush();
    para.push(line.replace(/\*\*(.+?)\*\*/g, "$1"));
  });
  flush();
  if (!done) h += `<span class="caret"></span>`;
  $("post").innerHTML = h;
}
async function runBlog() {
  const btn = $("goBtn"); btn.disabled = true;
  const stop = startProgress($("msg"), "blog");
  let json = "", shown = false, result = null, err = null;
  try {
    const r = await fetch("/api/blog", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ image: state.img, mediaType: "image/jpeg", ...info(), model: window.__model }) });
    readLeft(r);
    if (r.status === 402) { refreshQuota(); openPay(); throw new Error("블로그 글은 2회가 필요해요. 이용권을 충전해 주세요."); }
    if (!r.ok || !r.body) { const j = await r.json().catch(() => ({})); throw new Error(j.error || "서버 오류"); }
    const reader = r.body.getReader(), dec = new TextDecoder(); let buf = "";
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line.trim()) continue;
        const ev = JSON.parse(line);
        if (ev.t === "status" && ev.v === "search") $("pStage") && ($("pStage").textContent = "가게 정보 검색 중…");
        if (ev.t === "reset") json = "";
        if (ev.t === "d") {
          json += ev.v;
          const body = partialStr(json, "body");
          if (body && body.v.length > 20) {
            if (!shown) { shown = true; stop(); $("msg").textContent = ""; state.blog = null; $("bside").innerHTML = `<div class="card"><h3><span>글 쓰는 중…</span></h3><p class="note">본문이 다 써지면 사진 3~5장을 한 장씩 만들어 넣어요.</p></div>`; go("bres"); }
            liveBlog(partialStr(json, "title")?.v, body.v, false);
          }
        }
        if (ev.t === "done") result = ev;
        if (ev.t === "error") { err = ev.v; if (ev.refund) fetch("/api/refund", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refund: ev.refund }) }).then(() => refreshQuota()); }
      }
    }
    if (err) throw new Error(err + " (차감된 횟수는 돌려드렸어요)");
    if (!result) throw new Error("연결이 끊겼어요. 다시 시도해 주세요.");
    stop(); $("msg").textContent = "";
    state.blog = result.post; state.blog.secs = result.secs; state.blog.model = result.model;
    renderBlog(state.blog); go("bres");
    fillBlogImages();
  } catch (e) {
    stop(); if (!shown) $("msg").textContent = "오류: " + e.message;
    else { go("form"); $("msg").textContent = "오류: " + e.message; }
  }
  btn.disabled = false;
}
async function fillBlogImages() {
  const p = state.blog, imgs = p.images || [];
  imgs.forEach(im => { im.loading = true; });
  renderBlog(p);
  window.onbeforeunload = () => "사진을 아직 만드는 중이에요.";
  await Promise.all(imgs.map(async im => {
    try {
      const r = await fetch("/api/blog-image", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticket: im.ticket, image: state.img, mediaType: "image/jpeg" }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "실패");
      im.src = j.src;
    } catch (e) { im.error = e.message; }
    im.loading = false;
    if (state.blog === p) renderBlog(p);
  }));
  window.onbeforeunload = null;
}
async function retryBlogImage(slot) {
  const im = (state.blog?.images || []).find(i => +i.slot === +slot); if (!im) return;
  im.error = null; im.loading = true; renderBlog(state.blog);
  try {
    const r = await fetch("/api/blog-image", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ticket: im.ticket, image: state.img, mediaType: "image/jpeg" }) });
    const j = await r.json(); if (!r.ok) throw new Error(j.error); im.src = j.src;
  } catch (e) { im.error = e.message; }
  im.loading = false; renderBlog(state.blog);
}

function renderBlog(p) {
  const parts = blogParts(p);
  let h = `<div class="blogbar">N 블로그 미리보기</div><h1>${esc(p.title)}</h1>`;
  let para = [];
  const flush = () => { if (para.length) { h += `<p>${esc(para.join("\n"))}</p>`; para = []; } };
  parts.forEach(x => {
    if (x.t === "p") return para.push(x.v);
    flush();
    if (x.t === "h") h += `<h2>${esc(x.v)}</h2>`;
    if (x.t === "img") h += `<figure>${x.im.src ? `<img src="${x.im.src}" alt="${esc(x.im.kind)}">` : x.im.loading ? `<div class="miss wait"><span class="spin"></span>사진 ${x.n} · ${esc(x.im.kind)} 만드는 중…</div>` : `<div class="miss">사진 ${x.n} 생성 실패 <button class="copy" onclick="retryBlogImage(${x.n})">다시 시도 (무료)</button></div>`}
      <figcaption>📷 사진 ${x.n} · ${esc(x.im.kind)}${x.im.src ? ` <a href="${x.im.src}" download="blog-${x.n}.jpg">저장</a>` : ""}</figcaption></figure>`;
  });
  flush();
  h += `<div class="tags">${(p.tags || []).map(t => "#" + esc(String(t).replace(/^#/, ""))).join(" ")}</div>`;
  $("post").innerHTML = h;

  const ok = (p.images || []).filter(i => i.src).length, total = (p.images || []).length, pend = (p.images || []).filter(i => i.loading).length;
  $("bside").innerHTML = `<div class="card">
    <h3><span>블로그 패키지</span></h3>
    <p class="note" style="margin:0 0 10px">본문 ${(p.body || "").replace(/\[\[[^\]]+\]\]/g, "").replace(/\s/g, "").length.toLocaleString()}자 · 사진 ${ok}/${total}장${pend ? ` (만드는 중 ${pend}장)` : ""}</p>
    <div class="row">
      <button class="b pri" onclick="copyBlog(this)">📋 본문 복사 (사진 자리 표시 포함)</button>
      <button class="b" onclick="copyText(document.getElementById('post').querySelector('h1').innerText,this)">제목 복사</button>
      <button class="b" onclick="copyText(${esc(JSON.stringify((p.tags || []).map(t => '#' + String(t).replace(/^#/, '')).join(' ')))},this)">태그 복사</button>
      <button class="b" onclick="saveAll()">⬇️ 사진 전체 저장</button>
    </div>
    <h3 style="margin-top:16px"><span>추천 사진 구성</span></h3>
    <ol class="plan-list">${(p.images || []).map((im, k) => `<li><b>${esc(im.kind)}</b> — ${esc(im.why)}</li>`).join("")}</ol>
    ${(p.sources || []).length ? `<h3 style="margin-top:16px"><span>참고한 자료</span></h3><ol class="plan-list">${p.sources.slice(0, 6).map(u => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\//, "").slice(0, 40))}</a></li>`).join("")}</ol>` : ""}
    <p class="note" style="margin-top:12px">네이버 에디터에 본문을 붙여넣고, [사진 N] 자리에 저장한 사진을 순서대로 넣으면 돼요.</p>
  </div>`;
}

// ---------- 첫 화면 사례 (사진 1장 → 블로그 사진 + 글) ----------
{ const CASES = [
    { id: "y2k", tag: "패션 · Y2K 스트릿", title: "연남 세시 패션 Y2K 룩 후기 | 연남동 데일리룩·스트릿 코디 추천", stats: "본문 1,042자 · 사진 4장", labels: ["디테일 클로즈업", "로우앵글 하의·신발", "탑뷰 플랫레이"] },
    { id: "yeonnam", tag: "패션 · 데일리룩", title: "연남 세시 패션 | 연남동 데일리룩, 차콜 가디건 + 와이드 데님 코디 후기", stats: "본문 993자 · 사진 4장", labels: ["상의 디테일 클로즈업", "하의·신발 로우앵글", "소품 플랫레이 탑뷰"] } ];
  const g = $("gallery"); g.classList.remove("hidden");
  g.innerHTML = `<h3>📸 사진 한 장이 이렇게 바뀌어요</h3><p class="note">왼쪽이 올린 사진 1장, 오른쪽이 헤이원컷이 만든 블로그 사진이에요. 글 제목을 누르면 함께 만들어진 블로그 원문 전체를 볼 수 있어요. (예시 인물은 AI로 만든 가상 인물이에요)</p>
    ${CASES.map(c => `<div class="case-row">
      <div class="case-imgs"><figure class="co"><img loading="lazy" src="/cases/${c.id}-0.jpg" alt="올린 사진"><figcaption>올린 사진</figcaption></figure><span class="case-arrow">→</span>
      ${c.labels.map((l, k) => `<figure><img loading="lazy" src="/cases/${c.id}-${k + 1}.jpg" alt="${esc(l)}"><figcaption>${esc(l)}</figcaption></figure>`).join("")}</div>
      <a class="case-title" href="/cases.html#full-${c.id}"><small>${esc(c.tag)} · ${esc(c.stats)}</small>${esc(c.title)} <span>원문 전체 보기 →</span></a></div>`).join("")}
    <p style="text-align:center;margin:14px 0 0"><a href="/cases.html" style="font-weight:700;color:#ff5a36">사례 전체 보기 →</a></p>`;
  const st = document.createElement("style");
  st.textContent = `.case-row{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px;margin:12px 0}.case-imgs{display:grid;grid-template-columns:1fr auto 1fr 1fr 1fr;gap:8px;align-items:center}.case-imgs figure{margin:0}.case-imgs img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:8px;display:block}.case-imgs figcaption{font-size:11px;color:var(--mut);margin-top:4px;text-align:center}.case-imgs .co img{outline:2px solid #191716;outline-offset:-2px}.case-arrow{color:#ff5a36;font-weight:800}.case-title{display:block;margin-top:10px;text-decoration:none;color:var(--fg);font-weight:700;font-size:14px;line-height:1.45}.case-title small{display:block;color:#03a94e;font-weight:600;font-size:11.5px}.case-title span{color:#ff5a36;font-size:12.5px;white-space:nowrap}.case-title:hover{text-decoration:underline}@media(max-width:600px){.case-imgs{grid-template-columns:1fr 1fr;}.case-arrow{display:none}}`;
  document.head.appendChild(st); }

// ---------- 결제 전 약관 동의 확인 ----------
{ const _sub = subscribe;
  window.subscribe = subscribe = function (plan) {
    const a = $("payAgree");
    if (a && !a.checked) { payMsg("이용약관·환불 규정·개인정보처리방침에 동의해 주세요."); a.parentElement.style.color = "#e5484d"; return; }
    if (a) a.parentElement.style.color = "";
    return _sub(plan);
  };
}
