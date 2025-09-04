import snaptrade from "./_client.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const out = await snaptrade.authentication.registerSnapTradeUser({ userId });
    return res.status(200).json(out);
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
