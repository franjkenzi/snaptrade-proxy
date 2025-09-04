// /api/positions.js
import snaptrade from "./_client.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId, userSecret, accountId } = req.query;
    if (!userId || !userSecret) {
      return res.status(400).json({ error: "Missing userId or userSecret" });
    }

    // accountId je opcionalan – ako ga pošalješ, dobit ćeš holdings za taj račun
    const params = { userId, userSecret, accountId };

    // ✅ ispravan poziv za holdings/positions
    const data = await snaptrade.portfolioHoldings.holdingsGet(params);
    // na nekim verzijama SDK-a je: await snaptrade.holdings.holdingsGet(params);

    return res.status(200).json({ ok: true, holdings: data });
  } catch (err) {
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { message: String(err) };
    return res.status(status).json({ ok: false, error: data });
  }
}

