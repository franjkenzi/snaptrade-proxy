import snaptrade from "./_client.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { userId } = body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const out = await snaptrade.authentication.registerSnapTradeUser({ userId });
    return res.status(200).json(out);
  } catch (err) {
    const safe =
      err?.response?.data ?? err?.data ?? err?.message ?? String(err);
    return res.status(500).json({ error: safe });
  }
}
