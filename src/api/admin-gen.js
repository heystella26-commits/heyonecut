// 운영자 전용: 샘플 갤러리용 '원본(폰으로 찍은 듯한) 사진'을 글로 생성
export default async function handler(req, res) {
  if (!process.env.QUOTA_SECRET || req.headers["x-sp-test"] !== process.env.QUOTA_SECRET) return res.status(403).json({ error: "forbidden" });
  const { prompt, model = "bytedance/seedream-4.0", size = "1024x1280" } = req.body || {};
  const token = process.env.AI_GATEWAY_API_KEY;
  const g = await fetch("https://ai-gateway.vercel.sh/v1/images/generations", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ model, prompt, size, n: 1, providerOptions: { blackForestLabs: { outputFormat: "jpeg" } } }),
  });
  const d = await g.json().catch(() => ({}));
  if (!g.ok) return res.status(g.status).json({ error: d.error?.message || "fail", d });
  const x = d.data?.[0];
  res.status(200).json({ src: x?.url || `data:image/jpeg;base64,${x?.b64_json}` });
}
