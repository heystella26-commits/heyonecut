const $ = id => document.getElementById(id);
const state = { mode: "ig", img: null, url: null, i: 0, n: 0, gen: [], lab: [], p: null, blog: null };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function go(view) {
  ["form", "res", "bres"].forEach(v => $(v).classList.toggle("hidden", v !== view));
  $("backBtn").classList.toggle("hidden", view === "form");
  scrollTo(0, 0);
}
function setMode(mode) {
  state.mode = mode;
  $("tabIg").classList.toggle("on", mode === "ig");
  $("tabBlog").classList.toggle("on", mode === "blog");
  const blog = mode === "blog";
  $("formTitle").textContent = blog ? "네이버 블로그 글 만들기" : "인스타그램 게시물 만들기";
  $("handleWrap").classList.toggle("hidden", blog);
  $("locWrap").classList.toggle("hidden", !blog);
  $("goBtn").className = "cta" + (blog ? " blog" : "");
  $("goBtn").innerHTML = blog ? '블로그 글 + 사진 만들기 <span class="cost">2회 차감</span>' : '게시물 만들기 <span class="cost">1회 차감</span>';
  $("msg").textContent = "";
  if (blog && state.blog) return go("bres");
  if (!blog && state.p) return go("res");
  go("form");
}

const drop = $("drop"), file = $("file");
drop.onclick = () => file.click();
drop.ondragover = e => e.preventDefault();
drop.ondrop = e => { e.preventDefault(); load(e.dataTransfer.files[0]); };
file.onchange = () => load(file.files[0]);
function load(f) {
  if (!f) return;
  const r = new FileReader();
  r.onload = () => { const i = new Image(); i.onload = () => {
    const s = Math.min(1, 1568 / Math.max(i.width, i.height)), c = document.createElement("canvas");
    c.width = i.width * s; c.height = i.height * s; c.getContext("2d").drawImage(i, 0, 0, c.width, c.height);
    state.url = c.toDataURL("image/jpeg", .88); state.img = state.url.split(",")[1];
    drop.innerHTML = `<img src="${state.url}">`; drop.classList.add("has"); $("goBtn").disabled = false;
    state.p = null; state.blog = null;
  }; i.src = r.result; };
  r.readAsDataURL(f);
}
const val = id => $(id).value;
const info = () => ({ bizName: val("bizName"), bizDesc: val("bizDesc"), location: val("location"), product: val("product"),
  industry: val("industry"), tone: val("tone"), imageOrder: val("imageOrder") });

// ---------- 진행 상황 바 (남은 시간 표시, 이탈 방지) ----------
const PLANS_T = {
  ig:     { secs: 32, steps: ["사진 분석", "캡션·해시태그 작성", "댓글·DM 작성", "이미지 2장 생성", "마무리"] },
  blog:   { secs: 55, steps: ["가게 정보 검색", "본문 작성", "사진 자리 추천", "사진 3~5장 생성", "마무리"] },
  refine: { secs: 14, steps: ["요청 해석", "2가지 버전 다듬는 중", "마무리"] },
  regen:  { secs: 14, steps: ["새 앵글 고르기", "다른 컷 2장 생성", "마무리"] },
};
const TIPS = ["창을 닫거나 새로고침하면 결과가 사라져요 🙏", "완료되면 바로 이 화면에 결과가 떠요", "평균 시간보다 조금 더 걸릴 수 있어요", "생성이 실패하면 횟수는 차감되지 않아요"];
let progTimer = null;
// 생성 중 개인정보 처리 안내 (로딩 화면에 고지)
function dataNotice() {
  const u = window.__user, train = !!u?.consent?.train;
  return `<div class="pnote">🔒 올린 사진과 입력 내용은 AI 처리를 위해 Anthropic·Vercel·이미지 생성사(미국 등)로 전송되고, 원본 사진은 저장하지 않아요.
    ${u ? `만든 결과는 <b>내 보관함에 3일</b> 보관 후 자동 삭제돼요. ${train ? "<b>학습 활용에 동의</b>하셔서 생성 이미지(사람 얼굴 사진 제외)는 품질 개선에 2년간 활용돼요." : "생성 이미지는 학습에 쓰지 않아요(동의 안 함)."} <a href="javascript:openConsent('동의 내용을 바꿀 수 있어요.')">설정 바꾸기</a>` : "로그인하지 않으면 결과는 저장되지 않아요."}
    <a href="/privacy.html" target="_blank">자세히</a></div>`;
}
function startProgress(el, kind, small) {
  const plan = PLANS_T[kind], t0 = Date.now();
  el.innerHTML = `<div class="prog ${kind === "blog" ? "blog" : ""} ${small ? "small" : ""}">
    <div class="row"><span class="stage" id="pStage">${plan.steps[0]} 중…</span><span class="eta" id="pEta">약 ${plan.secs}초 남음</span></div>
    <div class="bar"><i id="pBar"></i></div>
    ${small ? "" : `<div class="steps">${plan.steps.map((s, k) => `<span id="pS${k}">${s}</span>`).join("")}</div><div class="tip" id="pTip">${TIPS[0]}</div>${dataNotice()}`}
  </div>`;
  if (!small) el.scrollIntoView({ block: "center", behavior: "smooth" });
  window.onbeforeunload = () => "아직 만드는 중이에요. 나가면 결과가 사라져요.";
  clearInterval(progTimer);
  const tick = () => {
    const el2 = $("pBar"); if (!el2) return clearInterval(progTimer);
    const s = (Date.now() - t0) / 1000, r = s / plan.secs;
    const pct = r < 1 ? r * 90 : 90 + 9 * (1 - Math.exp(-(r - 1) * 2));
    el2.style.width = pct.toFixed(1) + "%";
    const left = Math.ceil(plan.secs - s);
    $("pEta").textContent = left > 0 ? `약 ${left}초 남음` : "거의 다 됐어요…";
    const k = Math.min(plan.steps.length - 1, Math.floor(Math.min(r, .999) * plan.steps.length));
    $("pStage").textContent = plan.steps[k] + " 중…";
    plan.steps.forEach((_, j) => { const n = $("pS" + j); if (n) n.className = j < k ? "done" : j === k ? "now" : ""; });
    const tip = $("pTip"); if (tip) tip.textContent = TIPS[Math.floor(s / 6) % TIPS.length];
  };
  tick(); progTimer = setInterval(tick, 250);
  return () => { clearInterval(progTimer); window.onbeforeunload = null; const b = $("pBar"); if (b) b.style.width = "100%"; };
}

$("goBtn").onclick = async () => {
  const btn = $("goBtn"); btn.disabled = true;
  const blog = state.mode === "blog";
  const stop = startProgress($("msg"), blog ? "blog" : "ig");
  try {
    const body = blog ? { image: state.img, mediaType: "image/jpeg", ...info() }
      : { mode: "instagram", image: state.img, mediaType: "image/jpeg", ...info() };
    const r = await fetch(blog ? "/api/blog" : "/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    readLeft(r);
    const p = await r.json().catch(() => ({ error: "서버 응답이 너무 늦어요. 잠시 후 다시 시도해 주세요." }));
    if (r.status === 402) { refreshQuota(); openPay(); throw new Error(blog ? "블로그 글은 2회가 필요해요. 이용권을 충전해 주세요." : "이용 가능 횟수가 없어요."); }
    if (!r.ok) throw new Error(p.error);
    if (blog) { state.blog = p; renderBlog(p); go("bres"); } else { render(p); go("res"); }
    stop(); $("msg").textContent = "";
  } catch (e) { stop(); reportErr?.("생성", e.message); $("msg").textContent = "오류: " + (window.netMsg ? netMsg(e) : e.message); }
  btn.disabled = false;
};

function box(title, text, extra = "") {
  const id = "b" + Math.random().toString(36).slice(2);
  return `<div class="card"><h3><span>${title}${extra}</span><button class="copy" onclick="copyEl('${id}',this)">복사</button></h3><pre id="${id}">${esc(text)}</pre></div>`;
}
function copyEl(id, btn) { navigator.clipboard.writeText($(id).innerText); btn.textContent = "복사됨"; }
const allImgs = () => [...state.gen, state.url];
const allLabs = () => [...state.lab, "원본"];
function slide(d) { state.i = (state.i + d + state.n) % state.n; paint(); renderThumbs(); }
function paint() {
  $("track").style.transform = `translateX(-${state.i * 100}%)`;
  $("count").textContent = `${state.i + 1}/${state.n}`;
  $("dots").innerHTML = Array.from({ length: state.n }, (_, k) => `<i class="${k === state.i ? "on" : ""}"></i>`).join("");
}
function setSlides(i) {
  const imgs = allImgs(), labs = allLabs();
  state.n = imgs.length; state.i = Math.max(0, Math.min(i, state.n - 1));
  $("track").innerHTML = imgs.map((u, k) => `<figure><img src="${u}">${labs[k] ? `<span class="lbl">${esc(labs[k])}</span>` : ""}</figure>`).join("");
  paint(); renderThumbs();
}
function renderThumbs() {
  const el = $("thumbs"); if (!el) return;
  const labs = allLabs();
  el.innerHTML = `<div class="thumbs">${allImgs().map((u, k) => `<div class="t">
      <button class="pick ${k === state.i ? "sel" : ""}" onclick="selectImg(${k})" title="이 사진 선택"><img src="${u}"></button>
      <small>${esc(labs[k] || "")}</small><a href="${u}" download="snappack-${k + 1}.jpg">저장</a></div>`).join("")}</div>
    ${state.gen.length ? "" : `<p class="note">${esc(state.p?.image_error || "")}</p>`}`;
  updateSel();
}
function selectImg(k) { state.i = k; paint(); renderThumbs(); }
function updateSel() {
  const box = $("selBox"); if (!box) return;
  box.innerHTML = `<img src="${allImgs()[state.i]}"><div><b style="font-size:13px">선택한 사진: ${esc(allLabs()[state.i] || "")}</b><br><span class="note">위 목록에서 다른 사진을 눌러 바꿀 수 있어요</span></div>`;
}
let stopImg = null;
function busy(on, text) {
  document.querySelectorAll("#editBox button").forEach(b => b.disabled = on);
  $("slides").classList.toggle("loading", on);
  if (on) { stopImg = startProgress($("imgMsg"), text, true); }
  else { if (stopImg) stopImg(); stopImg = null; $("imgMsg").innerHTML = text || ""; }
}
async function callImage(body) {
  const r = await fetch("/api/image", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  readLeft(r);
  const j = await r.json().catch(() => ({}));
  if (r.status === 402) { refreshQuota(); openPay(); throw new Error("이용 가능 횟수가 없어요. 이용권을 충전해 주세요."); }
  if (!r.ok) throw new Error(j.error || "이미지 생성 실패");
  return j;
}
async function regen() {
  busy(true, "regen");
  try {
    const ip = state.p?.image_prompts || {};
    const j = await callImage({ mode: "regen", image: state.img, mediaType: "image/jpeg",
      ctx: { kind: state.imgKind, bizName: val("bizName"), bizDesc: val("bizDesc"), industry: val("industry") || state.p?.analysis?.industry,
        tone: val("tone"), mood: state.p?.analysis?.mood, brand_mood: ip.brand_mood, instagrammable: ip.instagrammable, order: val("imageOrder") } });
    state.gen = [...j.images, ...state.gen].slice(0, 12);
    state.lab = [...(j.labels || j.images.map(() => "새 후보")), ...state.lab].slice(0, 12);
    setSlides(0); busy(false, "✅ 다른 앵글의 새 사진 2장이 나왔어요. (1회 차감)");
  } catch (e) { window.reportErr?.("이미지", e.message); busy(false, "⚠️ " + esc(window.netMsg ? netMsg(e) : e.message)); }
  updateGo();
}
const CHIPS = [["☀️ 더 밝게", "더 밝고 화사하게, 노출과 채도를 올려서"], ["⬜ 배경 심플하게", "배경을 깔끔한 밝은 단색으로 바꿔서 심플하게"],
  ["🕯️ 따뜻한 톤", "따뜻하고 아늑한 노란빛 조명과 색감으로"], ["💎 고급스럽게", "고급 레스토랑처럼 어두운 배경, 은은한 조명으로 고급스럽게"],
  ["🤤 더 먹음직스럽게", "음식이 더 먹음직스럽게, 윤기와 선명한 디테일, 김이 나는 느낌"], ["🌿 더 자연스럽게", "과한 보정을 줄이고 자연광의 실제 사진처럼"],
  ["🪵 나무 테이블", "배경을 따뜻한 원목 테이블로 바꾸기"], ["🌸 꽃·소품 추가", "주변에 작은 꽃과 어울리는 소품을 자연스럽게 추가"]];
function toggleChip(btn) { btn.classList.toggle("on"); updateGo(); }
function updateGo() {
  const g = $("goRefine"); if (!g) return;
  const n = document.querySelectorAll("#chips button.on").length + (val("refineTxt").trim() ? 1 : 0);
  g.disabled = n === 0;
  g.firstChild.textContent = n ? `✨ 선택한 사진 다듬기 (${n}개 요청) ` : "✨ 위에서 요청을 고르거나 적어 주세요 ";
}
async function refine() {
  const parts = [...document.querySelectorAll("#chips button.on")].map(b => b.dataset.v);
  const t = val("refineTxt").trim(); if (t) parts.push(t);
  if (!parts.length) return;
  const text = parts.join(", ");
  const k = state.i, source = allImgs()[k], baseLab = allLabs()[k] || "";
  busy(true, "refine");
  try {
    const j = await callImage({ mode: "refine", source, instruction: text, ctx: { kind: state.imgKind } });
    const name = (t || document.querySelector("#chips button.on")?.textContent.replace(/^\S+\s/, "") || "다듬음").slice(0, 12);
    const imgs = j.images || [], labs = imgs.map((_, n) => "✨ " + name + (imgs.length > 1 ? " " + (n + 1) : ""));
    if (k < state.gen.length) { state.gen.splice(k, 0, ...imgs); state.lab.splice(k, 0, ...labs); }
    else { state.gen.push(...imgs); state.lab.push(...labs); }
    state.gen = state.gen.slice(0, 12); state.lab = state.lab.slice(0, 12);
    setSlides(Math.min(k, state.gen.length - 1));
    document.querySelectorAll("#chips button.on").forEach(b => b.classList.remove("on")); $("refineTxt").value = "";
    busy(false, `✅ 다듬은 사진 ${imgs.length}장이 나왔어요! (1회 차감) 이전 사진(${esc(baseLab)})은 그 바로 뒤에 있어요.`);
  } catch (e) { window.reportErr?.("이미지", e.message); busy(false, "⚠️ " + esc(window.netMsg ? netMsg(e) : e.message)); }
  updateGo();
}
function expand() { $("capRest").classList.remove("hidden"); $("moreBtn").classList.add("hidden"); }
let sx = null;
$("track").addEventListener("touchstart", e => sx = e.touches[0].clientX, { passive: true });
$("track").addEventListener("touchend", e => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) slide(dx < 0 ? 1 : -1); sx = null; });

function render(p) {
  const handle = (val("handle") || val("bizName") || "my_shop").replace(/^@/, "").replace(/\s+/g, "_");
  ["pHandle", "cHandle", "fHandle"].forEach(id => $(id).textContent = handle);
  $("avTxt").textContent = handle[0].toUpperCase();
  $("pLoc").textContent = val("bizName") || "";
  state.p = p;
  state.gen = [...(p.images || [])];
  state.lab = [...(p.image_labels || [])];
  const tags = (p.instagram?.hashtags || []).map(t => t.startsWith("#") ? t : "#" + t);
  const cap = p.instagram?.caption || "";
  const lines = cap.split("\n"), head = lines.slice(0, 2).join("\n"), rest = lines.slice(2).join("\n");
  $("capShort").textContent = head;
  $("capRest").innerHTML = esc(rest ? "\n" + rest : "") + "\n\n" + tags.map(t => `<span class="tag">${esc(t)}</span>`).join(" ");
  $("capRest").classList.add("hidden"); $("moreBtn").classList.remove("hidden");
  $("firstC").textContent = p.first_comment || "";
  const a = p.analysis || {};
  let h = `<h2>게시물 패키지</h2><p class="note" style="margin:0 0 14px">${esc(a.industry)} · ${esc(a.mood)}</p>`;
  h += `<div class="card"><h3><span>이미지 <span class="note">· 눌러서 선택 · 한 번 더 누르면 크게 보기</span>${window.__isIOS ? `<span class="ios-tip">📱 아이폰은 사진을 꾹 눌러 저장</span>` : ""}</span></h3><div id="thumbs"></div>
    <div class="edit" id="editBox">
      <h4>✨ 선택한 사진 다듬기</h4>
      <div class="selbox" id="selBox"></div>
      <div class="step">① 원하는 요청을 고르세요 (여러 개 가능 · 고르기만 해서는 차감 안 돼요)</div>
      <div class="chips" id="chips">${CHIPS.map(([l, v]) => `<button data-v="${esc(v)}" onclick="toggleChip(this)">${l}</button>`).join("")}</div>
      <div class="step">② 직접 적어도 돼요 (선택)</div>
      <input id="refineTxt" placeholder="예: 접시를 흰색으로, 배경에 창가 햇살" oninput="updateGo()" onkeydown="if(event.key==='Enter'&&!$('goRefine').disabled)refine()">
      <button class="go" id="goRefine" onclick="refine()" disabled>✨ 위에서 요청을 고르거나 적어 주세요 <span class="cost">1회 차감</span></button>
      <button class="regen" onclick="regen()">🔄 다른 앵글로 2장 더 만들기 <span class="cost">1회 차감</span></button>
      <div id="imgMsg" class="note"></div>
    </div></div>`;
  h += box("캡션 + 해시태그", cap + "\n\n" + tags.join(" "));
  h += box("첫 댓글", p.first_comment);
  h += box("답글 템플릿", (p.reply_templates || []).map(t => `Q. ${t.question}\nA. ${t.reply}`).join("\n\n"));
  h += box("추천 게시 시간", p.best_post_time);
  h += `<h2 style="margin-top:22px">DM 자동화 시나리오</h2><p class="note" style="margin:0 0 12px">고객이 먼저 댓글이나 DM을 남겼을 때 보내는 메시지예요. 판매페이지 URL을 넣으면 링크가 자동으로 들어가요.</p>`;
  (p.dm_templates || []).forEach((d, k) => { h += box(`DM ${k + 1}. ${esc(d.purpose)}`, d.message, `<br><span class="note">${esc(d.trigger)}</span>`); });
  $("side").innerHTML = h;
  setSlides(0);
}

function blogParts(p) {
  const imgs = {}; (p.images || []).forEach((im, k) => imgs[im.slot || k + 1] = im);
  const used = new Set(); const out = [];
  (p.body || "").split(/\n/).forEach(line => {
    const m = line.trim().match(/^\[\[\s*사진\s*(\d+)\s*\]\]$/);
    if (m) { const n = +m[1]; if (imgs[n]) { out.push({ t: "img", im: imgs[n], n }); used.add(n); } return; }
    if (/^##\s+/.test(line)) return out.push({ t: "h", v: line.replace(/^##\s+/, "") });
    if (!line.trim()) return out.push({ t: "br" });
    out.push({ t: "p", v: line.replace(/\*\*(.+?)\*\*/g, "$1") });
  });
  Object.keys(imgs).forEach(n => { if (!used.has(+n)) out.push({ t: "img", im: imgs[n], n: +n }); });
  return out;
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
    if (x.t === "img") h += `<figure>${x.im.src ? `<img src="${x.im.src}" alt="${esc(x.im.kind)}">` : `<div class="miss">사진 ${x.n} 생성 실패</div>`}
      <figcaption>📷 사진 ${x.n} · ${esc(x.im.kind)}${x.im.src ? ` <a href="${x.im.src}" download="blog-${x.n}.jpg">저장</a>` : ""}</figcaption></figure>`;
  });
  flush();
  h += `<div class="tags">${(p.tags || []).map(t => "#" + esc(String(t).replace(/^#/, ""))).join(" ")}</div>`;
  $("post").innerHTML = h;

  const ok = (p.images || []).filter(i => i.src).length;
  $("bside").innerHTML = `<div class="card">
    <h3><span>블로그 패키지</span></h3>
    <p class="note" style="margin:0 0 10px">본문 ${(p.body || "").replace(/\[\[[^\]]+\]\]/g, "").replace(/\s/g, "").length.toLocaleString()}자 · 사진 ${ok}장</p>
    <div class="row">
      <button class="b pri" onclick="copyBlog(this)">📋 본문 복사 (사진 자리 표시 포함)</button>
      <button class="b" onclick="copyText(state.blog.title,this)">제목 복사</button>
      <button class="b" onclick="copyText((state.blog.tags||[]).map(t=>'#'+String(t).replace(/^#/,'')).join(' '),this)">태그 복사</button>
      <button class="b" onclick="saveAll()">⬇️ 사진 전체 저장</button>
    </div>
    <h3 style="margin-top:16px"><span>추천 사진 구성</span></h3>
    <ol class="plan-list">${(p.images || []).map(im => `<li><b>${esc(im.kind)}</b> — ${esc(im.why)}</li>`).join("")}</ol>
    ${(p.sources || []).length ? `<h3 style="margin-top:16px"><span>참고한 자료</span></h3><ol class="plan-list">${p.sources.slice(0, 6).map(u => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(String(u).replace(/^https?:\/\//, "").slice(0, 40))}</a></li>`).join("")}</ol>` : ""}
    <p class="note" style="margin-top:12px">네이버 에디터에 본문을 붙여넣고, [사진 N] 자리에 저장한 사진을 순서대로 넣으면 돼요.</p>
  </div>`;
}
function copyText(t, btn) { navigator.clipboard.writeText(t); btn.textContent = "✅ 복사됨"; }
function copyBlog(btn) {
  const p = state.blog;
  const text = (p.body || "").replace(/^##\s+/gm, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\[\[\s*사진\s*(\d+)\s*\]\]/g, (_, n) => {
    const im = (p.images || []).find(i => +i.slot === +n); return `[사진 ${n}${im ? " · " + im.kind : ""}]`; });
  copyText(p.title + "\n\n" + text, btn);
}
function saveAll() {
  if (window.saveImages) return saveImages((state.blog?.images || []).filter(i => i.src).map(i => i.src));
  (state.blog?.images || []).filter(i => i.src).forEach((im, k) => setTimeout(() => {
    const a = document.createElement("a"); a.href = im.src; a.download = `blog-${im.slot || k + 1}.jpg`; document.body.appendChild(a); a.click(); a.remove();
  }, k * 400));
}

function showQuota(left) {
  if (left === null || left === undefined || left < 0) { $("quota").classList.add("hidden"); return; }
  const el = $("quota"); el.classList.remove("hidden");
  el.textContent = left > 0 ? `${left}회 남음` : "이용권 구매";
  el.onclick = openPay; el.style.cursor = "pointer";
  el.classList.toggle("low", left <= 1);
}
function refreshQuota() { fetch("/api/quota", { cache: "no-store" }).then(r => r.json()).then(q => showQuota(q.left)).catch(() => {}); }
function readLeft(r) { const v = r.headers.get("X-Free-Left"); if (v !== null) showQuota(Number(v)); }
function payMsg(html, ok) { const m = $("payMsg"); m.innerHTML = html; m.classList.toggle("ok", !!ok); }
function openPay() { payMsg(""); $("paywall").classList.remove("hidden"); try { const p = localStorage.getItem("sp_phone"); if (p && !$("payPhone").value) $("payPhone").value = p; } catch {} }
function closePay() { $("paywall").classList.add("hidden"); }
async function subscribe(plan) {
  const ph = $("payPhone"), tel = ph.value.replace(/\D/g, "");
  if (!/^01\d{8,9}$/.test(tel)) { ph.classList.add("err"); ph.focus(); payMsg("☝️ 휴대폰 번호를 먼저 입력해 주세요 (예: 01012345678)"); return; }
  try { localStorage.setItem("sp_phone", tel); } catch {}
  document.querySelectorAll(".plan button").forEach(b => b.disabled = true);
  payMsg('<span class="spin"></span>결제창으로 이동 중…', true);
  try {
    const r = await fetch("/api/pay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan, phone: tel }) });
    const d = await r.json();
    if (!r.ok || !d.payurl) throw new Error(d.error || "결제창을 만들지 못했어요.");
    location.href = d.payurl;
  } catch (e) {
    payMsg("오류: " + esc(e.message));
    document.querySelectorAll(".plan button").forEach(b => b.disabled = false);
  }
}
async function pollPay(oid, tries = 40) {
  openPay(); payMsg('<span class="spin"></span>결제 확인 중…', true);
  for (let k = 0; k < tries; k++) {
    const d = await fetch("/api/pay?oid=" + encodeURIComponent(oid), { cache: "no-store" }).then(r => r.json()).catch(() => ({}));
    if (d.status === "claimed") {
      payMsg(d.already ? "✅ 이미 충전된 결제예요." : `✅ 결제 완료! ${d.added}회가 충전됐어요.`, true);
      refreshQuota(); setTimeout(closePay, 2500); return;
    }
    if (d.status === "cancelled" || d.status === undefined) { payMsg(d.error || "결제가 취소됐어요."); return; }
    await new Promise(r => setTimeout(r, 3000));
  }
  payMsg("아직 결제가 확인되지 않았어요. 결제를 끝내셨다면 잠시 후 새로고침 해 주세요.");
}
(() => { const q = new URLSearchParams(location.search).get("paid");
  if (q) { history.replaceState(null, "", "/"); pollPay(q); } })();
refreshQuota();
