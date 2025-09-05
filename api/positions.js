// api/positions.js
import snaptrade from "./_client.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { userId, userSecret, accountId } = req.query;
    if (!userId || !userSecret) {
      return res.status(400).json({ ok: false, error: "Missing userId or userSecret" });
    }

    // Različite verzije SDK-a: negde je holdingsGet, negde getHoldings.
    const api = snaptrade.holdings;
    const fn = api?.holdingsGet ?? api?.getHoldings;
    if (!fn) {
      return res.status(500).json({ ok: false, error: "Holdings API not initialized" });
    }

    const out = await fn.call(api, {
      userId,
      userSecret,
      accountId, // može i bez ovoga – onda vraća za sve naloge
    });

    return res.status(200).json({ ok: true, positions: out });
  } catch (err) {
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { message: String(err) };
    return res.status(status).json({ ok: false, error: data });
  }
}

