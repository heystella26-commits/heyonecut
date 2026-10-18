// 사례 표시 공용 스크립트: 첫 화면 카드(#gallery) / 사례 페이지(#caseList + 원문 보기) / 운영자 관리
(function () {
  const E = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const chars = c => (c.body || "").replace(/\[\[[^\]]+\]\]/g, "").replace(/^##\s+/gm, "").replace(/\s/g, "").length;
  const gens = c => (c.images || []).filter(i => i.src && i.src !== c.orig).slice(0, 3);
  window.HOC_CASES = { E, chars, gens };

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
    g.innerHTML = `<h3>📸 사진 한 장이 이렇게 바뀌어요</h3><p class="note">왼쪽이 올린 사진 1장, 오른쪽이 헤이원컷이 만든 블로그 사진이에요. 글 제목을 누르면 함께 만들어진 블로그 원문 전체를 볼 수 있어요.</p>
      ${list.slice(0, 3).map(c => `<div class="case-row">
        <div class="case-imgs"><figure class="co"><img loading="lazy" src="${E(c.orig)}" alt="올린 사진"><figcaption>올린 사진</figcaption></figure><span class="case-arrow">→</span>
        ${gens(c).map(im => `<figure><img loading="lazy" src="${E(im.src)}" alt="${E(im.kind)}"><figcaption>${E(im.kind)}</figcaption></figure>`).join("")}</div>
        <a class="case-title" href="/cases#full-${E(c.id)}"><small>${E(c.tag)} · 본문 ${chars(c).toLocaleString()}자 · 사진 ${(c.images || []).length}장</small>${E(c.title)} <span>원문 전체 보기 →</span></a></div>`).join("")}
      <p style="text-align:center;margin:14px 0 0"><a href="/cases" style="font-weight:700;color:#ff5a36">사례 전체 보기 →</a></p>`;
    const st = document.createElement("style");
    st.textContent = `.case-row{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px;margin:12px 0}.case-imgs{display:grid;grid-template-columns:1fr auto 1fr 1fr 1fr;gap:8px;align-items:center}.case-imgs figure{margin:0}.case-imgs img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:8px;display:block}.case-imgs figcaption{font-size:11px;color:var(--mut);margin-top:4px;text-align:center}.case-imgs .co img{outline:2px solid #191716;outline-offset:-2px}.case-arrow{color:#ff5a36;font-weight:800}.case-title{display:block;margin-top:10px;text-decoration:none;color:var(--fg);font-weight:700;font-size:14px;line-height:1.45}.case-title small{display:block;color:#03a94e;font-weight:600;font-size:11.5px}.case-title span{color:#ff5a36;font-size:12.5px;white-space:nowrap}.case-title:hover{text-decoration:underline}@media(max-width:600px){.case-imgs{grid-template-columns:1fr 1fr}.case-arrow{display:none}}`;
    document.head.appendChild(st);
  }).catch(() => {});
})();
