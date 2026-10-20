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
