// 인스타 이미지 컷 규칙: 사진 종류(업종)별로 어울리는 앵글·구도·포즈를 따로 정해 두고 서로 다른 2컷을 고름
const C = {
  food: { name: "음식", keep: "Keep exactly the same dish (same food, ingredients, portion, colors and cooking state).", shots: [
    ["45도 메인컷", "a classic 45-degree hero shot of the dish at table height, the dish filling the center, appetizing highlights, side dishes softly blurred around it"],
    ["탑뷰 상차림", "a top-down shot from directly above showing the dish with side dishes, drinks and utensils arranged as a full table spread"],
    ["집어 올린 컷", "a close shot of chopsticks or tongs lifting one bite of the food toward the camera, glossy and juicy, background blurred (only a hand, no face)"],
    ["클로즈업 디테일", "an extreme close-up of the food texture (sizzling surface, sauce, steam, crispy edges), shallow depth of field"],
    ["매장 분위기 와이드", "a wider shot of the dish on the table with the restaurant's warm interior and other tables softly visible behind"],
    ["로우앵글 시즐컷", "a low side-angle shot at plate level with steam rising and warm backlight emphasizing freshness"]] },
  cafe: { name: "카페·디저트", keep: "Keep exactly the same drink and dessert (same shape, colors, toppings, glass and plate style).", shots: [
    ["손에 든 음료컷", "a hand holding the drink up toward the window light, the dessert blurred behind (only a hand, no face)"],
    ["창가 45도컷", "a 45-degree shot of the dessert and drink on a table by a sunny window with soft shadows"],
    ["탑뷰 테이블", "a top-down shot from directly above with the dessert, drink, cutlery and a napkin arranged on the table"],
    ["단면 클로즈업", "an extreme close-up of the dessert texture (cut side, cream, crumb) with a fork, shallow depth of field"],
    ["카페 공간 와이드", "a wider shot showing the table in a cozy cafe interior, the menu smaller in frame so the atmosphere is visible"],
    ["무드 사이드라이트", "a moody shot with strong side light from a window, deep shadows and a dark background, cinematic"]] },
  fashion_person: { name: "패션(착용)", person: true, keep: "Keep the same person (same face, hair and body) wearing exactly the same outfit and items with the same colors.", shots: [
    ["다른 포즈 전신컷", "a full-body shot of the same person in a new natural pose (walking or mid-step), from a slightly different angle"],
    ["상반신 클로즈업", "a waist-up shot of the same person in a different pose, focusing on the outfit details, looking away from the camera"],
    ["뒤돌아보는 컷", "an over-the-shoulder shot of the same person turning back toward the camera, candid street-snap mood"],
    ["앉은 포즈컷", "the same person sitting casually in a new pose, shot at a low angle, relaxed lifestyle mood"],
    ["소재 디테일컷", "a close-up of the outfit's fabric, buttons and stitching while worn, face cropped out"]] },
  fashion_item: { name: "패션(제품)", keep: "Keep exactly the same clothing items (same design, colors, fabric and details). Do not add a person.", shots: [
    ["플랫레이", "a top-down flat lay of the items neatly styled with matching accessories on a clean surface"],
    ["행거컷", "the clothing hanging on a minimal wooden hanger against a clean wall with soft daylight"],
    ["소재 디테일", "an extreme close-up of the fabric texture, buttons and stitching"],
    ["라이프스타일 공간", "the items placed naturally in a stylish room (on a chair or bed), shot at eye level"]] },
  nail: { name: "네일", keep: "Keep exactly the same nail design (same colors, art, shape and length) on the same hand.", shots: [
    ["손가락 펼친 컷", "a close shot of the hand with fingers gracefully spread, nails in sharp focus, soft clean background"],
    ["소품 쥔 컷", "the hand gently holding a small prop (a coffee cup, a flower or a perfume bottle), nails in focus"],
    ["매크로 디테일", "an extreme macro close-up of two or three nails showing gloss and art details"],
    ["자연광 측면컷", "the hand resting on a textured fabric or table in soft window light, shot from the side"]] },
  hair: { name: "헤어", person: true, keep: "Keep the same person and exactly the same hairstyle, hair color and length.", shots: [
    ["옆모습 프로필", "a side profile shot showing the hairstyle shape clearly, clean salon background"],
    ["뒷모습 컷", "a back view shot showing the full hairstyle and its flow"],
    ["45도 반측면", "a three-quarter angle portrait with soft light emphasizing hair texture and shine"],
    ["모발 클로즈업", "a close-up of the hair texture and color, face partly cropped"]] },
  flower: { name: "꽃", keep: "Keep exactly the same flowers and arrangement (same kinds, colors and wrapping).", shots: [
    ["꽃다발 든 컷", "hands holding the bouquet toward the camera, face not shown, soft natural light"],
    ["테이블 화병컷", "the flowers styled in a vase on a table by a window, 45-degree angle"],
    ["탑뷰 꽃", "a top-down shot of the arrangement with scattered petals and ribbon around it"],
    ["꽃잎 클로즈업", "an extreme close-up of the petals with dew-like freshness, shallow depth of field"]] },
  product: { name: "상품", keep: "Keep exactly the same product (same shape, colors, label and details).", shots: [
    ["히어로 단독컷", "a clean hero shot of the product alone at eye level on a simple pedestal with soft shadow"],
    ["사용 장면", "a hand naturally using or holding the product, lifestyle moment (only a hand, no face)"],
    ["플랫레이", "a top-down flat lay of the product with a few matching props arranged around it"],
    ["디테일 클로즈업", "an extreme close-up of the product's texture and finish"],
    ["라이프스타일 공간", "the product placed naturally in a stylish home or shop setting, wider shot"]] },
  space: { name: "매장 공간", keep: "Keep the same place recognizable (same interior style, furniture and colors).", shots: [
    ["입구에서 본 와이드", "a wide shot of the space from the entrance with natural light, inviting"],
    ["코너 디테일", "a close shot of a characteristic corner or decor detail"],
    ["좌석 아이레벨", "an eye-level shot from a seat looking across the room, warm atmosphere"]] },
};
const SCENES = {
  food: ["on a dark wooden restaurant table with warm lighting", "on a clean stone table in a bright modern restaurant", "on a rustic table with a cozy evening mood"],
  cafe: ["on a white marble table by a sunny window", "on a warm wooden cafe table", "on a pastel solid-color backdrop", "on a linen cloth with soft daylight"],
  fashion_person: ["a stylish city street with soft daylight", "a bright cafe with large windows", "a minimal white studio wall", "a sunny park path", "an urban alley with warm evening light"],
  fashion_item: ["a clean light wooden floor", "a minimal white studio", "a cozy bedroom with linen bedding"],
  nail: ["a soft beige linen background", "a white marble surface", "a pastel backdrop"], hair: ["a bright minimal salon", "a soft neutral studio backdrop"],
  flower: ["a bright flower studio", "a white table by a window", "a wooden table with linen"], product: ["a minimal studio with soft shadows", "a marble surface", "a warm wooden shelf", "a pastel backdrop"],
  space: ["the shop itself"],
};
const shuffle = a => a.map(x => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
export const KINDS = Object.keys(C);
export const menuFor = kind => (C[kind] || C.product).shots;
// 설계된 프롬프트 → 최종 지시 (블로그 사진 규칙과 같은 형식)
export function plannedPrompt(kind, prompt, custom = "") {
  const c = C[kind] || C.product;
  const noPeople = c.person ? "" : " Do not add any people or faces (a hand only if the instruction asks for it).";
  return `Using this photo as the reference, create a new photo: ${prompt}. ${c.keep}${noPeople} Photorealistic, natural high-end Instagram photo, vertical 4:5, no text, no logos, no watermarks.${custom}`;
}
// 사진 종류가 모를 때 업종 입력으로 추정
export function kindFromText(...hints) {
  const t = hints.filter(Boolean).join(" ");
  if (/카페|디저트|커피|베이커리|빵|케이크|cafe|dessert|coffee|bakery/i.test(t)) return "cafe";
  if (/음식|식당|맛집|고기|요리|분식|술집|food|restaurant/i.test(t)) return "food";
  if (/네일|nail/i.test(t)) return "nail";
  if (/헤어|미용|hair/i.test(t)) return "hair";
  if (/꽃|플라워|flower/i.test(t)) return "flower";
  if (/패션|옷|의류|쇼핑몰|fashion|apparel/i.test(t)) return "fashion_item";
  return "product";
}
export function pickShots(n, kind) {
  const c = C[kind] || C.product, scenes = shuffle(SCENES[kind] || SCENES.product);
  return shuffle(c.shots).slice(0, n).map(([label, p], k) => ({ label, p, scene: scenes[k % scenes.length], kind }));
}
export function shotPrompt(s, { info = "", custom = "" } = {}) {
  const c = C[s.kind] || C.product;
  const noPeople = c.person ? "" : " Do not add any people or faces (a hand only if this shot asks for it).";
  return `Using this photo as the reference, create a NEW photo with a clearly different camera angle and composition: ${s.p}. Setting: ${s.scene}. ${info ? `Brand context: ${info}. ` : ""}Remove all clutter (cables, receipts, boxes, machines). Photorealistic, high-end Instagram photo, vertical 4:5. ${c.keep}${noPeople} Do not add text or logos.${custom}`;
}
