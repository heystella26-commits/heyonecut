(function () {
  const css = document.createElement("style");
  css.textContent = `.lgbtn{border:1px solid #ddd;background:#fff;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:700;cursor:pointer;margin-left:8px}.lgsheet{max-width:360px!important;text-align:center}.lgsheet h2{margin:4px 0 6px}.lgsheet p{color:#777;font-size:13px;margin:0 0 16px}.sso{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;border:0;border-radius:12px;padding:13px;font-size:15px;font-weight:700;margin:8px 0;cursor:pointer;text-decoration:none}.sso.k{background:#FEE500;color:#191919}.sso.n{background:#03C75A;color:#fff}.sso.g{background:#fff;color:#222;border:1px solid #ddd}.lgname{font-size:13px;font-weight:700;margin-left:8px;color:#333}.lgname a{color:#999;font-weight:400;margin-left:6px;font-size:12px}.freebadge{display:inline-block;background:#ff5a36;color:#fff;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;margin-bottom:8px}`;
  document.head.appendChild(css);
  const m = document.createElement("div");
  m.id = "loginModal"; m.className = "modal hidden";
  m.onclick = e => { if (e.target === m) m.classList.add("hidden"); };
  m.innerHTML = `<div class="sheet lgsheet"><button class="x" onclick="document.getElementById('loginModal').classList.add('hidden')">×</button><span class="freebadge">로그인하면 무료 3회</span><h2>로그인</h2><p>처음 로그인하면 <b>무료로 3회</b> 써볼 수 있고, <b>첫 구매는 베이직 할인</b>을 받아요.<br>이용권은 계정에 저장돼서 휴대폰·PC 어디서든 이어서 쓸 수 있어요.</p><a class="sso k" href="/api/auth/kakao">카카오로 시작하기</a><a class="sso n" href="/api/auth/naver">네이버로 시작하기</a><a class="sso g" href="/api/auth/google">Google로 시작하기</a><p style="margin-top:14px;font-size:12px">이 브라우저에 있던 이용권은 로그인하면 계정으로 옮겨져요.<br>올린 원본 사진은 저장하지 않아요. 만든 결과는 보관함에 3일 보관돼요.<br><a href="/terms.html" target="_blank">이용약관</a> · <a href="/privacy.html" target="_blank">개인정보처리방침</a></p></div>`;
  document.body.appendChild(m);
  let slot = document.getElementById("lgSlot");
  if (!slot) { slot = document.createElement("span"); slot.id = "lgSlot"; document.querySelector(".topr")?.appendChild(slot); }
  window.openLogin = () => m.classList.remove("hidden");
  window.deleteAccount = async () => {
    if (!confirm("탈퇴하면 바로 로그아웃되고, 7일 뒤 계정 정보·남은 이용권·보관함 결과물이 모두 삭제돼요.\n7일 안에 같은 계정으로 다시 로그인하면 탈퇴가 취소돼요. 탈퇴할까요?")) return;
    const r = await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete" }) });
    alert(r.ok ? "탈퇴 신청이 완료됐어요. 7일 뒤 모든 정보가 삭제돼요. 그동안 이용해 주셔서 감사합니다." : "탈퇴 처리 중 문제가 생겼어요. heystella26@gmail.com 으로 알려 주세요.");
    location.href = "/";
  };
  // 로그인 안 한 사람이 횟수가 없으면 결제창 대신 로그인(무료 3회)부터
  const _openPay = window.openPay;
  window.openPay = openPay = function () { if (!window.__user && !window.__payDirect) { openLogin(); return; } return _openPay(); };
  const LN = { kakao: "카카오", naver: "네이버", google: "구글" };
  let firstQ = true;
  const visitQS = () => { if (!firstQ) return ""; firstQ = false; const u = new URLSearchParams(location.search); return "?" + new URLSearchParams({ v: "1", r: document.referrer || "", us: u.get("utm_source") || "", um: u.get("utm_medium") || "" }); };
  window.refreshUser = () => fetch("/api/quota" + visitQS(), { cache: "no-store" }).then(r => r.json()).then(q => {
    showQuota(q.left);
    slot.innerHTML = q.user ? `<span class="lgname">${esc(q.user.name || LN[q.user.provider] + " 사용자")}님<a href="/api/auth/logout">로그아웃</a><a href="javascript:void(0)" onclick="deleteAccount()">탈퇴</a></span>` : `<button class="lgbtn" onclick="openLogin()">로그인<span class="lg-sub"> · 무료 3회</span></button>`;
    window.__user = q.user;
    const pm = document.getElementById("payLoginHint"); if (pm) pm.style.display = q.user ? "none" : "";
  }).catch(() => {});
  const pw = document.querySelector("#paywall .sheet h2");
  if (pw) pw.insertAdjacentHTML("afterend", `<p id="payLoginHint" style="background:#f6f6f6;border-radius:10px;padding:8px 12px;font-size:13px">💡 <a href="javascript:openLogin()">로그인</a>하면 무료 3회를 먼저 써볼 수 있고, 이용권도 계정에 저장돼요.</p>`);
  const lm = m.querySelector(".lgsheet");
  lm.insertAdjacentHTML("beforeend", `<p style="margin:6px 0 0;font-size:12px"><a href="javascript:void(0)" id="payDirect">로그인 없이 바로 구매하기</a></p>`);
  document.getElementById("payDirect").onclick = () => { m.classList.add("hidden"); window.__payDirect = true; openPay(); window.__payDirect = false; };
  const qs = new URLSearchParams(location.search);
  if (qs.has("login") || qs.has("login_err") || qs.has("logout") || qs.has("granted")) {
    const err = qs.get("login_err");
    const msg = err ? "⚠️ " + err : qs.has("restored") ? "✅ 다시 오셨네요! 탈퇴 신청이 취소됐어요." : qs.has("login") ? "✅ 로그인했어요. 이용권이 계정에 저장돼요." : qs.has("logout") ? "로그아웃했어요." : "✅ 이용권 " + qs.get("granted") + "회가 충전됐어요.";
    const t = document.createElement("div");
    t.style.cssText = "position:fixed;left:50%;top:70px;transform:translateX(-50%);background:#111;color:#fff;padding:10px 16px;border-radius:10px;font-size:14px;z-index:99";
    t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
    history.replaceState(null, "", location.pathname);
  }
  refreshUser();
})();
