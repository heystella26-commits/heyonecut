// 동의 화면: 로그인 창 안의 필수/선택 동의, 기존 회원 동의 받기, 설정 변경, 탈퇴 방식 선택
(function () {
  const css = document.createElement("style");
  css.textContent = `.cs{text-align:left;border:1px solid #eee;border-radius:12px;padding:10px 12px;margin:0 0 12px;font-size:13px;background:#fafafa}
.cs label{display:flex;gap:8px;align-items:flex-start;padding:5px 0;cursor:pointer;line-height:1.45}.cs label input{width:auto;margin:2px 0 0;flex:none;accent-color:#ff5a36}
.cs .all{font-weight:800;border-bottom:1px solid #eee;padding-bottom:8px;margin-bottom:4px}.cs .req{color:#ff5a36;font-weight:700}.cs .opt{color:#2f6ad8;font-weight:700}
.cs details{margin:0 0 2px 24px;color:#777;font-size:12px}.cs details summary{cursor:pointer}.cs details p{margin:4px 0 6px}
.sso.off{opacity:.4;pointer-events:none}.cs-warn{color:#c2410c;font-size:12px;margin:-6px 0 8px;text-align:left}
.dsheet{max-width:400px!important}.dsheet button.opt2{display:block;width:100%;text-align:left;border:1px solid #e5e5e5;background:#fff;border-radius:12px;padding:12px 14px;margin:8px 0;font:inherit;cursor:pointer}.dsheet button.opt2 b{display:block}.dsheet button.opt2 small{color:#777}`;
  document.head.appendChild(css);
  const TRAIN_TXT = `헤이원컷이 만든 <b>생성 이미지와 이미지 지시문</b>을 더 나은 사진을 만드는 데(컷 규칙 개선·AI 학습) 활용해요. 올린 원본 사진과 사람 얼굴이 주인공인 사진(패션 착용컷·헤어)은 저장하지 않아요. 보관 2년, 동의를 끄면 바로 삭제돼요. 동의하지 않아도 모든 기능을 똑같이 쓸 수 있어요.`;
  const box = id => `<div class="cs" id="${id}">
    <label class="all"><input type="checkbox" data-all> 전체 동의</label>
    <label><input type="checkbox" data-req> <span><span class="req">[필수]</span> <a href="/terms.html" target="_blank">이용약관</a> 동의</span></label>
    <label><input type="checkbox" data-req> <span><span class="req">[필수]</span> 개인정보 수집·이용 동의</span></label>
    <details><summary>내용 보기</summary><p>소셜 로그인 ID·닉네임·이메일, 이용권 기록을 회원 관리에 써요. 탈퇴 후 7일 뒤 삭제, 결제 기록은 법에 따라 5년 보관. 만든 결과물은 내 보관함에 3일 보관 후 자동 삭제. <a href="/privacy.html" target="_blank">개인정보처리방침</a></p></details>
    <label><input type="checkbox" data-req> <span><span class="req">[필수]</span> 개인정보 국외 이전·처리 위탁 동의</span></label>
    <details><summary>내용 보기</summary><p>사진과 입력 내용은 만들기를 누를 때 AI 처리를 위해 Anthropic(미국), Vercel(미국), Black Forest Labs·ByteDance·OpenAI(이미지 생성)로 전송되고, 서버·데이터는 Cloudflare(미국 등)에 보관돼요. 결제는 (주)유디아이디(PayApp)가 처리해요.</p></details>
    <label><input type="checkbox" data-train> <span><span class="opt">[선택]</span> 생성 이미지 품질 개선·AI 학습 활용 동의</span></label>
    <details><summary>내용 보기</summary><p>${TRAIN_TXT}</p></details></div>`;
  function wire(el, onChange) {
    const all = el.querySelector("[data-all]"), boxes = [...el.querySelectorAll("[data-req],[data-train]")];
    all.onchange = () => { boxes.forEach(b => b.checked = all.checked); onChange(); };
    boxes.forEach(b => b.onchange = () => { all.checked = boxes.every(x => x.checked); onChange(); });
    return { ok: () => [...el.querySelectorAll("[data-req]")].every(b => b.checked), train: () => el.querySelector("[data-train]").checked };
  }
  // 1) 로그인 창
  const sheet = document.querySelector("#loginModal .lgsheet");
  const first = sheet?.querySelector(".sso");
  if (first) {
    first.insertAdjacentHTML("beforebegin", box("csLogin") + `<p class="cs-warn" id="csWarn" hidden>필수 항목에 동의하면 로그인할 수 있어요.</p>`);
    const ssos = [...sheet.querySelectorAll(".sso")];
    const c = wire(document.getElementById("csLogin"), () => { const ok = c.ok(); ssos.forEach(a => a.classList.toggle("off", !ok)); document.getElementById("csWarn").hidden = ok; });
    ssos.forEach(a => { a.classList.add("off"); a.addEventListener("click", e => {
      if (!c.ok()) { e.preventDefault(); document.getElementById("csWarn").hidden = false; return; }
      document.cookie = `sp_cs=1.${c.train() ? 1 : 0}; Path=/; Max-Age=900; SameSite=Lax; Secure`;
    }); });
  }
  // 2) 동의 기록이 없는 기존 회원 / 설정 변경용 창
  const cm = document.createElement("div"); cm.id = "consentModal"; cm.className = "modal hidden";
  cm.innerHTML = `<div class="sheet lgsheet"><h2>약관 동의</h2><p id="cmLead">서비스를 계속 쓰려면 아래 내용을 확인해 주세요.</p>${box("csAgain")}<button class="cta" id="cmGo" style="width:100%" disabled>동의하고 계속하기</button></div>`;
  document.body.appendChild(cm);
  const c2 = wire(document.getElementById("csAgain"), () => { document.getElementById("cmGo").disabled = !c2.ok(); });
  document.getElementById("cmGo").onclick = async () => {
    const r = await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "consent", train: c2.train() }) });
    const d = await r.json().catch(() => ({}));
    cm.classList.add("hidden"); if (window.__user) window.__user.consent = d.consent;
    toast(d.removed ? `학습 활용 동의를 껐어요. 저장된 데이터 ${d.removed}건을 삭제했어요.` : "동의 내용을 저장했어요.");
  };
  window.openConsent = (lead) => {
    const u = window.__user; document.getElementById("cmLead").textContent = lead || "서비스를 계속 쓰려면 아래 내용을 확인해 주세요.";
    const el = document.getElementById("csAgain"); el.querySelectorAll("[data-req]").forEach(b => b.checked = !!u?.consent);
    el.querySelector("[data-train]").checked = !!u?.consent?.train; el.querySelector("[data-all]").checked = !!u?.consent?.train && !!u?.consent;
    document.getElementById("cmGo").disabled = !c2.ok(); cm.classList.remove("hidden");
  };
  function toast(t) { const d = document.createElement("div"); d.style.cssText = "position:fixed;left:50%;top:70px;transform:translateX(-50%);background:#111;color:#fff;padding:10px 16px;border-radius:10px;font-size:14px;z-index:120"; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 3500); }
  let asked = false;
  setInterval(() => { const u = window.__user; if (u && !u.consent && !asked) { asked = true; openConsent("약관이 바뀌어 동의를 다시 받고 있어요. 필수 항목에 동의해 주세요."); } }, 1500);
  // 3) 탈퇴 방식 선택
  const dm = document.createElement("div"); dm.id = "delModal"; dm.className = "modal hidden"; dm.onclick = e => { if (e.target === dm) dm.classList.add("hidden"); };
  dm.innerHTML = `<div class="sheet dsheet"><button class="x" onclick="document.getElementById('delModal').classList.add('hidden')">×</button><h2>탈퇴하기</h2><p class="note">남은 이용권은 함께 사라지고 되돌릴 수 없어요. 결제 기록은 법에 따라 5년 보관돼요.</p>
    <button class="opt2" data-now="0"><b>7일 뒤 삭제 (추천)</b><small>바로 로그아웃되고 7일 뒤 계정·이용권·보관함·학습 데이터가 삭제돼요. 그 안에 다시 로그인하면 취소돼요.</small></button>
    <button class="opt2" data-now="1"><b>지금 바로 완전 삭제</b><small>계정·이용권·보관함·학습 데이터를 즉시 지워요. 복구할 수 없어요.</small></button>
    <p class="note" id="delMsg"></p></div>`;
  document.body.appendChild(dm);
  dm.querySelectorAll("[data-now]").forEach(b => b.onclick = async () => {
    const now = b.dataset.now === "1";
    if (b.dataset.sure !== "1") { dm.querySelectorAll("[data-now]").forEach(x => { x.dataset.sure = ""; x.style.borderColor = ""; }); b.dataset.sure = "1"; b.style.borderColor = "#c2410c"; document.getElementById("delMsg").textContent = "한 번 더 누르면 탈퇴가 진행돼요."; return; }
    const r = await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete", now }) });
    document.getElementById("delMsg").textContent = r.ok ? (now ? "모든 정보를 삭제했어요. 그동안 이용해 주셔서 감사합니다." : "탈퇴 신청이 완료됐어요. 7일 뒤 모든 정보가 삭제돼요.") : "탈퇴 처리 중 문제가 생겼어요. heystella26@gmail.com 으로 알려 주세요.";
    if (r.ok) setTimeout(() => location.href = "/", 1800);
  });
  window.deleteAccount = () => { document.getElementById("delMsg").textContent = ""; dm.classList.remove("hidden"); };
})();
