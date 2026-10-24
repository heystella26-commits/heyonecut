// 내 보관함: 로그인한 사용자의 결과물을 서버에 3일 보관 (자동 저장 + 다시 열기)
(function () {
  const $ = id => document.getElementById(id);
  const E = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const css = document.createElement("style");
  css.textContent = `.hbtn{border:1px solid #ddd;background:#fff;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}
.hsheet{max-width:520px!important}.hlist{display:grid;gap:8px;margin-top:12px;max-height:60vh;overflow:auto}
.hit{display:flex;gap:10px;align-items:center;border:1px solid #eee;border-radius:12px;padding:8px;cursor:pointer;background:#fff;text-align:left;font:inherit;width:100%}
.hit img,.hit .ni{width:56px;height:70px;object-fit:cover;border-radius:8px;background:#f2f2f2;flex:none}
.hit b{display:block;font-size:14px;line-height:1.35}.hit small{color:#888;font-size:12px}.hit .del{margin-left:auto;flex:none;border:0;background:none;color:#c2410c;font-size:12px;cursor:pointer}
.hsaved{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:#111;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;z-index:99}
@media (max-width:420px){.hbtn{padding:6px 9px;font-size:12px}.hb-t{display:none}}`;
  document.head.appendChild(css);
  const m = document.createElement("div"); m.id = "histModal"; m.className = "modal hidden";
  m.onclick = e => { if (e.target === m) m.classList.add("hidden"); };
  m.innerHTML = `<div class="sheet hsheet"><button class="x" onclick="document.getElementById('histModal').classList.add('hidden')">×</button><h2>📁 내 보관함</h2><p class="note">만든 결과물은 <b>3일 동안</b> 여기에 보관돼요. 3일이 지나면 자동으로 삭제되니 필요한 사진·글은 미리 저장해 두세요.</p><p class="note" id="hTrain"></p><div class="hlist" id="hList"></div></div>`;
  document.body.appendChild(m);
  const btn = document.createElement("button"); btn.className = "hbtn hidden"; btn.id = "histBtn"; btn.innerHTML = "📁<span class=\"hb-t\"> 보관함</span>"; btn.onclick = openHist;
  const topr = document.querySelector(".topr"); topr?.insertBefore(btn, document.getElementById("lgSlot") || null);
  const left = t => { const h = Math.max(0, Math.round((t - Date.now()) / 36e5)); return h >= 24 ? `${Math.floor(h / 24)}일 ${h % 24}시간 뒤 삭제` : `${h}시간 뒤 삭제`; };
  async function openHist() {
    m.classList.remove("hidden"); const L = $("hList");
    const tr = !!window.__user?.consent?.train;
    $("hTrain").innerHTML = `생성 이미지 학습 활용: <b>${tr ? "동의함" : "동의 안 함"}</b> · <a href="javascript:openConsent('동의 내용을 바꿀 수 있어요. 학습 활용을 끄면 저장된 학습 데이터가 바로 삭제돼요.')">바꾸기</a>`; L.innerHTML = '<p class="note">불러오는 중…</p>';
    const j = await fetch("/api/history", { cache: "no-store" }).then(r => r.json()).catch(() => ({}));
    const items = j.items || [];
    L.innerHTML = items.length ? items.map(x => `<div class="hit" data-id="${E(x.id)}">${x.thumb ? `<img src="${E(x.thumb)}" alt="">` : '<span class="ni"></span>'}<span><b>${x.mode === "blog" ? "📝" : "📸"} ${E(x.title || "제목 없음")}</b><small>${new Date(x.created).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} · ${left(x.expires)}</small></span><button class="del" data-del="${E(x.id)}">삭제</button></div>`).join("")
      : `<p class="note">${j.error ? E(j.error) : "아직 보관된 결과물이 없어요. 만들면 자동으로 저장돼요."}</p>`;
    L.querySelectorAll(".hit").forEach(el => el.onclick = e => { if (e.target.dataset.del) return; restore(el.dataset.id); });
    L.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => { if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "한 번 더"; return; } await fetch("/api/history", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete", id: b.dataset.del }) }); openHist(); });
  }
  // 보관된 사진 주소 → 다시 다듬기 등에 쓸 수 있게 data URL로
  async function inflate(v) {
    if (typeof v === "string" && v.startsWith("/api/history?f=")) {
      const b = await fetch(v).then(r => r.blob()); return await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); });
    }
    if (Array.isArray(v)) return Promise.all(v.map(inflate));
    if (v && typeof v === "object") { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = await inflate(x); return o; }
    return v;
  }
  async function restore(id) {
    $("hList").innerHTML = '<p class="note">여는 중…</p>';
    const j = await fetch("/api/history?id=" + encodeURIComponent(id), { cache: "no-store" }).then(r => r.json());
    if (!j.data) { $("hList").innerHTML = `<p class="note">${E(j.error || "열지 못했어요.")}</p>`; return; }
    const d = await inflate(j.data);
    if (d.bizName != null && $("bizName")) $("bizName").value = d.bizName;
    if (d.handle != null && $("handle")) $("handle").value = d.handle;
    if (j.mode === "blog") { setMode("blog"); state.blog = d.blog; renderBlog(d.blog); go("bres"); }
    else { setMode("ig"); render(d.p); state.gen = d.gen || state.gen; state.lab = d.lab || state.lab; state.i = 0; try { paint(); renderThumbs(); } catch {} go("res"); }
    cur = { id, key: sig(), obj: j.mode === "blog" ? state.blog : state.p }; m.classList.add("hidden");
  }
  // 자동 저장: 결과 화면에서 내용이 바뀌면(사진 추가·다듬기 등) 몇 초 뒤 저장
  let cur = { id: null, key: null, obj: null }, timer = null, toldOnce = false;
  const onRes = () => !$("res").classList.contains("hidden") ? "ig" : !$("bres").classList.contains("hidden") ? "blog" : null;
  function snapshot(mode) {
    const base = { bizName: $("bizName")?.value || "", handle: $("handle")?.value || "" };
    if (mode === "blog") { const b = state.blog; if (!b || !b.title) return null; if ((b.images || []).some(i => i.loading)) return null;
      return { obj: b, mode, title: b.title, thumb: (b.images || []).find(i => i.src)?.src, data: { ...base, blog: b } }; }
    const p = state.p; if (!p) return null;
    return { obj: p, mode, title: (p.instagram?.caption || "").split("\n")[0].slice(0, 80) || "인스타그램 게시물", thumb: state.gen[0], data: { ...base, p, gen: state.gen, lab: state.lab } };
  }
  const sig = () => { const mode = onRes(); const s = mode && snapshot(mode); return s ? mode + ":" + JSON.stringify(s.data).length + ":" + (s.data.gen || []).length : null; };
  async function tick() {
    if (!window.__user) return;
    const mode = onRes(); if (!mode) return;
    const s = snapshot(mode); if (!s) return;
    if (cur.obj !== s.obj) cur = { id: null, key: null, obj: s.obj };
    const key = sig(); if (key === cur.key) return;
    cur.key = key;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const r = await fetch("/api/history", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save", id: cur.id, mode: s.mode, title: s.title, thumb: s.thumb, data: s.data }) }).then(r => r.json()).catch(() => ({}));
      if (r.id) { cur.id = r.id; if (!toldOnce) { toldOnce = true; const t = document.createElement("div"); t.className = "hsaved"; t.textContent = "📁 보관함에 3일 동안 저장했어요"; document.body.appendChild(t); setTimeout(() => t.remove(), 3000); } }
    }, 2500);
  }
  setInterval(tick, 3000);
  setInterval(() => btn.classList.toggle("hidden", !window.__user), 1000);
})();
