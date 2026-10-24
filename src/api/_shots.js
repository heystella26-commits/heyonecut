// 인스타 이미지 컷 규칙 (블로그 사진 규칙 응용): 배경만 바꾸지 않고 앵글·구도·포즈·컷 종류를 서로 다르게
const SHOTS = [
  { label: "클로즈업 디테일", p: "an extreme close-up detail shot, camera very close to the subject at a 45-degree angle, shallow depth of field with creamy background blur, showing texture and fine details filling most of the frame" },
  { label: "탑뷰 플랫레이", p: "a top-down flat lay shot taken from directly above (90 degrees), the subject placed off-center with complementary props neatly arranged around it on the surface" },
  { label: "45도 테이블컷", p: "a classic 45-degree angle shot at table height, the subject in the foreground with a softly blurred styled background" },
  { label: "아이레벨 정면컷", p: "a straight-on eye-level shot, camera at the same height as the subject, clean symmetrical composition with negative space above for an Instagram feed" },
  { label: "로우앵글", p: "a low-angle shot from slightly below the subject, making it look bold and impressive, with depth behind it" },
  { label: "공간 와이드컷", p: "a wider environmental shot showing the subject placed in a stylish space, the subject smaller in the frame so the atmosphere of the place is visible" },
  { label: "손이 함께 나온 컷", p: "a lifestyle shot with a person's hand naturally interacting with the subject (holding, lifting, reaching for or using it), candid moment, face not shown" },
  { label: "무드 사이드라이트", p: "a moody shot with strong directional side light from a window, deep shadows and highlights, dark background, cinematic feel" },
];
// 사람(모델·착용컷)이 있는 사진용: 포즈·앵글 변주
const PEOPLE = [
  { label: "다른 포즈 전신컷", p: "a full-body shot of the same person in a new natural pose (walking, mid-step, or leaning), shot from a slightly different angle" },
  { label: "상반신 클로즈업", p: "a waist-up close shot of the same person in a different pose, focusing on the outfit details, looking away from the camera" },
  { label: "뒤돌아보는 컷", p: "an over-the-shoulder shot of the same person turning back toward the camera, candid street-snap mood" },
  { label: "앉은 포즈컷", p: "the same person sitting casually in a new pose, shot at a low angle, relaxed lifestyle mood" },
];
const SCENES = [
  "on a white marble table by a sunny window with a linen napkin", "on a warm wooden table in a cozy shop with soft blurred lights",
  "on a pastel solid-color backdrop with soft shadows", "on a rustic table on an outdoor terrace with green plants",
  "on a textured stone surface", "in a bright minimal modern interior with soft daylight", "on a dark walnut table in a dimly lit elegant interior",
];
const SPOTS = ["a stylish city street with soft daylight", "a bright cafe interior with large windows", "a minimal white studio wall", "a sunny park path with greenery", "an urban alley with warm evening light"];
const shuffle = a => a.map(x => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
// n개의 서로 다른 컷 (사람 사진이면 사람 컷 위주로 섞음)
export function pickShots(n, { people = false } = {}) {
  const person = shuffle(PEOPLE).slice(0, 1).map(x => ({ ...x, person: true }));
  const pool = people ? [...person, ...shuffle(SHOTS.filter(s => ["클로즈업 디테일", "공간 와이드컷", "로우앵글", "탑뷰 플랫레이"].includes(s.label)))] : shuffle(SHOTS);
  const scenes = shuffle(people ? SPOTS : SCENES);
  return pool.slice(0, n).map((s, k) => ({ ...s, scene: scenes[k % scenes.length] }));
}
export function shotPrompt(s, { info = "", custom = "", people = false } = {}) {
  const keep = people
    ? "Keep the same person (same face, hair and body) and exactly the same outfit, items and colors. Only the pose, camera angle and background may change."
    : "Keep the main subject exactly the same item (same food, product, flowers, or nails — same shape, colors, toppings and details). The camera angle, framing, background and props must change.";
  const what = people && s.person ? `If the reference shows a person wearing the items: ${s.p}. If it shows only the items without a person, instead make a styled product photo of the same items from a new angle.` : `${s.p}.`;
  return `Using this photo as the reference, create a NEW photo with a clearly different camera angle and composition: ${what} Setting: ${s.scene}. ${info ? `Brand context: ${info}. ` : ""}Remove all clutter (cables, receipts, boxes, machines). Photorealistic, high-end Instagram photo, vertical 4:5. ${keep} Do not add text or logos.${custom}`;
}
// 사진에 사람이 주인공인지(업종·분석 힌트로 간단히 판단)
export const looksLikePeople = (...hints) => /패션|옷|의류|코디|룩|모델|헤어|미용|fashion|apparel|outfit|model|person|woman|man/i.test(hints.filter(Boolean).join(" "));
