// 다른 사이트(이미지 모델 저장소)에 있는 생성 이미지를 같은 주소로 받아 저장할 수 있게 중계. 허용한 이미지 호스트만
const OK = /^https:\/\/([a-z0-9-]+\.)*(blob\.vercel-storage\.com|bfl\.ai|delivery-[a-z0-9-]+\.bfl\.ai|oaiusercontent\.com|openai\.com|byteplus\.com|volces\.com|bytepluses\.com|vercel\.sh|vercel-storage\.com)\//i;
export default async function handler(req, res) {
  const u = String(req.query.u || "");
  if (!OK.test(u)) return res.status(400).json({ error: "허용되지 않은 주소예요." });
  const r = await fetch(u).catch(() => null);
  if (!r || !r.ok) return res.status(404).json({ error: "이미지를 가져오지 못했어요. 이미 만료됐을 수 있어요." });
  const type = r.headers.get("content-type") || "image/jpeg";
  if (!type.startsWith("image/")) return res.status(400).json({ error: "이미지가 아니에요." });
  res.setHeader("Content-Type", type); res.setHeader("Cache-Control", "private, max-age=3600");
  res.status(200).send(Buffer.from(await r.arrayBuffer()));
}
