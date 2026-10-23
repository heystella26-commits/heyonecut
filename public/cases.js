// 사례 표시 공용 스크립트: 첫 화면 카드(#gallery) / 사례 페이지(#caseList + 원문 보기) / 운영자 관리
(function () {
  const E = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const chars = c => (c.body || "").replace(/\[\[[^\]]+\]\]/g, "").replace(/^##\s+/gm, "").replace(/\s/g, "").length;
  const gens = c => (c.images || []).filter(i => i.src && i.src !== c.orig).slice(0, 3);
  const isIg = c => c.type === "ig";
  const meta = c => isIg(c) ? `${E(c.tag)} · 사진 ${(c.images || []).length}장 · 캡션·해시태그 ${(c.tags || []).length}개·첫 댓글·DM` : `${E(c.tag)} · 본문 ${chars(c).toLocaleString()}자 · 사진 ${(c.images || []).length}장`;
  // 인스타 사례: 피드 미리보기 + 캡션·해시태그·첫 댓글·DM
  function igHtml(c) {
    const ims = c.images || [], h = E(c.handle || "my_shop");
    const br = t => E(t).replace(/\n/g, "<br>");
    return `<div class="igp"><div class="igh"><span class="iga">${E((c.handle || "S")[0])}</span><b>${h}</b></div>
      <div class="igs">${ims.map((im, k) => `<figure><img src="${E(im.src)}" alt="${E(im.kind)}" loading="lazy"><figcaption>${k + 1}/${ims.length} · ${E(im.kind)}</figcaption></figure>`).join("")}</div>
      <div class="igb"><p><b>좋아요 128개</b></p><p><b>${h}</b> ${br(c.caption)}</p><p class="tags">${(c.tags || []).map(t => "#" + E(String(t).replace(/^#/, ""))).join(" ")}</p>
      <p class="igc"><b>${h}</b> ${br(c.comment)}</p></div></div>
      ${c.dm ? `<h3>DM 자동 응답 예시</h3><p class="igdm">${br(c.dm)}</p>` : ""}${c.postTime ? `<h3>추천 게시 시간</h3><p>${E(c.postTime)}</p>` : ""}
      <h3>올린 사진</h3><figure class="ph"><img src="${E(c.orig)}" alt="올린 사진" loading="lazy"><figcaption>올린 사진 1장 · 이 사진 하나로 위 이미지 ${ims.length}장과 글이 만들어졌어요</figcaption></figure>`;
  }
  const IGCSS = `.igp{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--card,#fff)}.igh{display:flex;gap:8px;align-items:center;padding:10px 12px}.iga{width:28px;height:28px;border-radius:50%;background:linear-gradient(45deg,#feda75,#d62976,#4f5bd5);color:#fff;display:grid;place-items:center;font-size:12px;font-weight:700}.igs{display:flex;overflow-x:auto;scroll-snap-type:x mandatory}.igs figure{flex:0 0 100%;margin:0;scroll-snap-align:start}.igs img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:0;display:block}.igs figcaption{font-size:11.5px;color:var(--mut);text-align:center;padding:4px}.igb{padding:10px 14px}.igb p{margin:0 0 8px}.igc{color:var(--mut)}.igdm{background:var(--coral-soft,#fff1ec);border-radius:12px;padding:12px 14px}`;
  window.HOC_CASES = { E, chars, gens, isIg, meta, igHtml, IGCSS };

  // 블로그 본문(## 소제목, [[사진 N]], **굵게**, - 목록) → HTML
  function bodyHtml(c) {
    const by = {}; (c.images || []).forEach((im, k) => by[im.slot || k + 1] = im);
    let h = "", ul = false, para = [];
    const flush = () => { if (para.length) { h += `<p>${E(para.join("\n"))}</p>`; para = []; } };
    const endUl = () => { if (ul) { h += "</ul>"; ul = false; } };
    (c.body || "").split("\n").forEach(line => {
      const l = line.trim().replace(/\*\*(.+?)\*\*/g, "$1");
      const m = l.match(/^\[\[\s*사진\s*(\d+)\s*\]\]$/);
      if (m) { flush(); endUl(); const im = by[+m[1]]; if (im) h += `<figure class="ph"><img src="${E(im.src)}" alt="${E(im.kind)}" loading="lazy"><figcaption>사진 ${m[1]} · ${E(im.kind)}${im.src === c.orig ? " (올린 사진)" : " (헤이원컷 생성)"}</figcaption></figure>`; return; }
      if (/^##\s+/.test(l)) { flush(); endUl(); h += `<h3>${E(l.replace(/^##\s+/, ""))}</h3>`; return; }
      if (/^[-•]\s+/.test(l)) { flush(); if (!ul) { h += "<ul>"; ul = true; } h += `<li>${E(l.replace(/^[-•]\s+/, ""))}</li>`; return; }
      if (!l) { flush(); endUl(); return; }
      endUl(); para.push(l);
    });
    flush(); endUl();
    if ((c.tags || []).length) h += `<p class="tags">${c.tags.map(t => "#" + E(String(t).replace(/^#/, ""))).join(" ")}</p>`;
    return h;
  }
  window.HOC_CASES.bodyHtml = bodyHtml;

  // ---- 첫 화면 카드 ----
  const g = document.getElementById("gallery");
  if (g) fetch("/api/cases", { cache: "no-store" }).then(r => r.json()).then(list => {
    if (!Array.isArray(list) || !list.length) return;
    g.classList.remove("hidden");
    g.innerHTML = `<h3>📸 사진 한 장이 이렇게 바뀌어요</h3><p class="note">왼쪽이 올린 사진 1장, 오른쪽이 헤이원컷이 만든 사진이에요. 제목을 누르면 함께 만들어진 인스타 게시물·블로그 글 전체를 볼 수 있어요.</p>
      ${list.slice(0, 3).map(c => `<div class="case-row">
        <div class="case-imgs"><figure class="co"><img loading="lazy" src="${E(c.orig)}" alt="올린 사진"><figcaption>올린 사진</figcaption></figure><span class="case-arrow">→</span>
        ${gens(c).map(im => `<figure><img loading="lazy" src="${E(im.src)}" alt="${E(im.kind)}"><figcaption>${E(im.kind)}</figcaption></figure>`).join("")}</div>
        <a class="case-title" href="/cases#full-${E(c.id)}"><small${isIg(c) ? ' class="ig"' : ""}>${meta(c)}</small>${E(c.title)} <span>${isIg(c) ? "게시물 전체 보기 →" : "원문 전체 보기 →"}</span></a></div>`).join("")}
      <p style="text-align:center;margin:14px 0 0"><a href="/portfolio" style="display:inline-block;font-weight:700;color:#fff;background:#111;border-radius:99px;padding:11px 20px;text-decoration:none">⭐ 성공 사례 자세히 보기 →</a></p>`;
    const st = document.createElement("style");
    st.textContent = `.case-row{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px;margin:12px 0}.case-imgs{display:grid;grid-template-columns:1fr auto 1fr 1fr 1fr;gap:8px;align-items:center}.case-imgs figure{margin:0}.case-imgs img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:8px;display:block}.case-imgs figcaption{font-size:11px;color:var(--mut);margin-top:4px;text-align:center}.case-imgs .co img{outline:2px solid #191716;outline-offset:-2px}.case-arrow{color:#ff5a36;font-weight:800}.case-title{display:block;margin-top:10px;text-decoration:none;color:var(--fg);font-weight:700;font-size:14px;line-height:1.45}.case-title small{display:block;color:#03a94e;font-weight:600;font-size:11.5px}.case-title small.ig{color:#d62976}.case-title span{color:#ff5a36;font-size:12.5px;white-space:nowrap}.case-title:hover{text-decoration:underline}@media(max-width:600px){.case-imgs{grid-template-columns:1fr 1fr}.case-arrow{display:none}}`;
    document.head.appendChild(st);
  }).catch(() => {});
})();
