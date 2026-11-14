// 첫 화면 보조: 업종 칩 → 업종 입력, 예시 사진으로 체험
(function () {
  const ind = document.getElementById("industry");
  document.querySelectorAll("#indChips button").forEach(b => b.addEventListener("click", () => {
    const on = !b.classList.contains("on");
    document.querySelectorAll("#indChips button").forEach(x => x.classList.remove("on"));
    if (on) b.classList.add("on");
    if (ind) ind.value = on ? b.textContent : "";
  }));
  if (ind) ind.addEventListener("input", () => document.querySelectorAll("#indChips button").forEach(x => x.classList.toggle("on", x.textContent === ind.value)));
  const sb = document.getElementById("sampleBtn");
  if (sb) sb.addEventListener("click", async () => {
    sb.textContent = "불러오는 중…";
    try {
      const blob = await fetch("/cases/yeonnam-0.jpg").then(r => r.blob());
      load(new File([blob], "sample.jpg", { type: blob.type || "image/jpeg" }));
      const n = document.getElementById("bizName"); if (n && !n.value) n.value = "연남 세시";
      const chip = [...document.querySelectorAll("#indChips button")].find(x => x.textContent.startsWith("패션")); if (chip && !chip.classList.contains("on")) chip.click();
      sb.textContent = "예시 사진을 넣었어요 · 아래 버튼을 눌러 보세요";
    } catch { sb.textContent = "예시 사진을 불러오지 못했어요"; }
  });
})();
// 업종별 예시 전환 · 유입 경로별 첫 화면 · 모바일 하단 고정 버튼
(function () {
  const D = {
    cafe: { o: "cafe-0", a: "cafe-7", b: "cafe-3", pos: ["center", "center", "center"], cap: "오후 세 시, 이 조합은 반칙이잖아요 🍰☕ 겉바속꾸 바스크 치즈케이크", tags: "#연남동카페 #바스크치즈케이크 #카페스타그램" },
    pork: { o: "pork-0", a: "pork-1", b: "pork-3", pos: ["center", "center", "center"], cap: "지글지글 소리부터 맛있는 날엔 여기 🔥 겉은 바삭 속은 촉촉한 삼겹살", tags: "#연남동맛집 #삼겹살맛집 #고기스타그램" },
    street: { o: "street-0", a: "street-1", b: "street-2", pos: ["center 15%", "center 15%", "center"], cap: "겨울 코디 고민 끝, 이 조합이면 게임 오버 🖤 빈티지 시어링 자켓 × 와이드 블랙 데님", tags: "#겨울코디 #스트릿패션 #빈티지룩" }
  };
  const $ = id => document.getElementById(id);
  const sw = $("demoSw"); if (!sw) return;
  function show(k, sync) {
    const d = D[k]; if (!d) return;
    [["dmO", d.o, 0], ["dmA", d.a, 1], ["dmB", d.b, 2]].forEach(([id, f, i]) => { const im = $(id); if (im) { im.src = "/cases/" + f + ".jpg"; im.style.objectPosition = d.pos[i]; } });
    const c = $("dmCap"); if (c) c.innerHTML = d.cap + "<br><em>" + d.tags + "</em>";
    const a = $("heroDemo"); if (a) a.href = "/cases#full-" + k;
    sw.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.k === k));
    const map = { cafe: "카페·디저트", pork: "음식점", street: "패션·쇼핑몰" };
    const chip = [...document.querySelectorAll("#indChips button")].find(x => x.textContent === map[k]);
    if (sync && chip && !chip.classList.contains("on")) chip.click();
  }
  sw.querySelectorAll("button").forEach(b => b.addEventListener("click", () => show(b.dataset.k, true)));
  setTimeout(() => Object.values(D).forEach(d => [d.o, d.a, d.b].forEach(f => { const i = new Image(); i.src = "/cases/" + f + ".jpg"; })), 1200);
  // 당근 광고로 들어온 사람: 카페 예시 + 당근 할인 안내
  const ch = (document.cookie.match(/(?:^|; )sp_ch=([a-z]{2})/) || [])[1] || "";
  if (ch === "dg") {
    const p = $("heroPill"); if (p) p.textContent = "🥕 당근 이웃 사장님 · 결제 시 '당근30%할인' 입력";
    show("cafe");
  } else show("street");
  // 모바일: 시작 버튼이 화면 밖으로 나가면 하단 고정 버튼
  const cta = $("heroCta"), st = $("stickyCta"), form = $("form");
  if (cta && st && "IntersectionObserver" in window) {
    let ctaOut = false;
    const upd = () => st.classList.toggle("show", ctaOut && !document.querySelector("#drop.has") && form && !form.classList.contains("hidden") && getComputedStyle(form).display !== "none");
    new IntersectionObserver(es => { ctaOut = !es[0].isIntersecting && es[0].boundingClientRect.top < 0; upd(); }).observe(cta);
    document.addEventListener("change", upd, true);
  }
})();
