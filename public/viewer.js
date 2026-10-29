// 결과 사진 크게 보기(팝업) + 저장(아이폰은 공유 시트 → '이미지 저장', 안 되면 꾹 눌러 저장 안내)
(function () {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  window.__isIOS = isIOS;
  const css = document.createElement("style");
  css.textContent = `.lbx{position:fixed;inset:0;z-index:200;background:rgba(10,10,10,.94);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:calc(12px + env(safe-area-inset-top,0px)) 12px calc(16px + env(safe-area-inset-bottom,0px))}
.lbx[hidden]{display:none}.lbx img{max-width:100%;max-height:calc(100% - 120px);object-fit:contain;border-radius:8px;-webkit-touch-callout:default;user-select:auto}
.lbx .bar{display:flex;gap:8px;margin-top:12px;align-items:center;flex-wrap:wrap;justify-content:center}.lbx .bar button{border:0;border-radius:99px;padding:11px 18px;font:inherit;font-weight:700;font-size:15px;cursor:pointer}
.lbx .sv{background:#ff5a36;color:#fff}.lbx .cl{background:#333;color:#fff}.lbx .nv{background:#222;color:#fff;width:44px;padding:11px 0}
.lbx .cap{color:#ddd;font-size:13px;margin-top:8px;text-align:center}.lbx .tip{color:#aaa;font-size:12.5px;margin-top:6px;text-align:center}
.lbx .x{position:absolute;top:calc(10px + env(safe-area-inset-top,0px));right:12px;background:none;border:0;color:#fff;font-size:30px;cursor:pointer}
#track figure img,.post figure img,.pick.sel img{cursor:zoom-in}.ios-tip{font-size:11.5px;color:#ff5a36;font-weight:700;margin-left:6px;white-space:nowrap}`;
  document.head.appendChild(css);
  const box = document.createElement("div"); box.className = "lbx"; box.hidden = true;
  box.innerHTML = `<button class="x" aria-label="닫기">×</button><img alt=""><div class="cap"></div><div class="bar"><button class="nv" data-d="-1" aria-label="이전">‹</button><button class="sv">⬇️ 저장</button><button class="cl">닫기</button><button class="nv" data-d="1" aria-label="다음">›</button></div><div class="tip"></div>`;
  document.body.appendChild(box);
  const img = box.querySelector("img"); let list = [], at = 0;
  const show = () => { const it = list[at]; img.src = it.src; box.querySelector(".cap").textContent = it.label ? `${at + 1}/${list.length} · ${it.label}` : `${at + 1}/${list.length}`;
    box.querySelectorAll(".nv").forEach(b => b.style.visibility = list.length > 1 ? "" : "hidden");
    box.querySelector(".tip").textContent = isIOS ? "📱 저장이 안 되면 사진을 꾹 눌러 '사진 앱에 저장'을 누르세요" : ""; };
  window.openViewer = (items, k = 0) => { list = items.filter(x => x.src); if (!list.length) return; at = Math.max(0, Math.min(k, list.length - 1)); show(); box.hidden = false; document.body.style.overflow = "hidden"; };
  const close = () => { box.hidden = true; document.body.style.overflow = ""; };
  box.querySelector(".x").onclick = close; box.querySelector(".cl").onclick = close;
  box.onclick = e => { if (e.target === box) close(); };
  box.querySelectorAll(".nv").forEach(b => b.onclick = () => { at = (at + +b.dataset.d + list.length) % list.length; show(); });
  box.querySelector(".sv").onclick = () => saveImage(list[at].src, `heyonecut-${at + 1}.jpg`);
  let sx = null; img.addEventListener("touchstart", e => sx = e.touches[0].clientX, { passive: true });
  img.addEventListener("touchend", e => { if (sx === null || list.length < 2) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) { at = (at + (dx < 0 ? 1 : -1) + list.length) % list.length; show(); } sx = null; });
  addEventListener("keydown", e => { if (box.hidden) return; if (e.key === "Escape") close(); if (e.key === "ArrowRight") { at = (at + 1) % list.length; show(); } if (e.key === "ArrowLeft") { at = (at - 1 + list.length) % list.length; show(); } });
  async function toFile(src, name) {
    let r; try { r = await fetch(src); } catch { r = null; }
    if (!r || !r.ok) r = await fetch("/api/dl?u=" + encodeURIComponent(src)); // 다른 사이트 이미지는 서버를 거쳐 받기
    let b = await r.blob();
    // 카톡 등에서 사진으로 인식되도록 항상 진짜 JPEG(.jpg)로 맞춤 (PNG·WEBP·형식 불명이면 변환)
    if (b.type !== "image/jpeg") { try { const bm = await createImageBitmap(b); const c = document.createElement("canvas"); c.width = bm.width; c.height = bm.height; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(bm, 0, 0); b = await new Promise(ok => c.toBlob(ok, "image/jpeg", 0.92)) || b; } catch {} }
    return new File([b], name.replace(/\.(jfif|jpeg|png|webp)$/i, ".jpg"), { type: "image/jpeg" });
  }
  // 저장: 아이폰은 공유 시트(→ 이미지 저장), 그 밖은 바로 다운로드
  window.saveImage = async (src, name = "heyonecut.jpg", silentFallback) => {
    try {
      const f = await toFile(src, name);
      if (isIOS && navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f] }); return; }
      const u = URL.createObjectURL(f), a = document.createElement("a"); a.href = u; a.download = name; a.dataset.direct = "1"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
    } catch (e) {
      if (e?.name === "AbortError") return; // 사용자가 공유 시트를 닫음
      if (!silentFallback) openViewer([{ src, label: "꾹 눌러서 저장하세요" }]);
    }
  };
  window.saveImages = async (srcs) => {
    try {
      if (isIOS) { const fs = await Promise.all(srcs.map((s, k) => toFile(s, `heyonecut-${k + 1}.jpg`))); if (navigator.canShare?.({ files: fs })) { await navigator.share({ files: fs }); return; } }
    } catch (e) { if (e?.name === "AbortError") return; }
    for (const [k, s] of srcs.entries()) { await saveImage(s, `heyonecut-${k + 1}.jpg`, true); await new Promise(r => setTimeout(r, 400)); }
  };
  // 사진 누르면 크게 보기 / 저장 링크 가로채기
  document.addEventListener("click", e => {
    const a = e.target.closest("a[download]:not([data-direct])"); // 직접 만든 다운로드 링크는 그대로 통과 (예전엔 여기서 다시 가로채 저장이 멈췄음)
    if (a) { e.preventDefault(); saveImage(a.href, a.getAttribute("download") || "heyonecut.jpg"); return; }
    const t = e.target.closest("#track figure img, .post figure img, .pick.sel img");
    if (!t) return;
    e.preventDefault(); e.stopPropagation();
    if (t.closest(".post")) {
      const ims = (state.blog?.images || []).filter(i => i.src); const k = ims.findIndex(i => i.src === t.getAttribute("src"));
      return openViewer(ims.map(i => ({ src: i.src, label: `사진 ${i.slot} · ${i.kind || ""}` })), Math.max(0, k));
    }
    const imgs = allImgs(), labs = allLabs(); openViewer(imgs.map((s, k) => ({ src: s, label: labs[k] || "" })), state.i);
  }, true);
})();
