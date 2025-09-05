// /api/positions.js
import snaptrade from "./_client.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { userId, userSecret, accountId } = req.query;
    if (!userId || !userSecret) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing userId or userSecret" });
    }

    // SDK traži 'accounts' (lista); accountId je opcionalan
    const params = { userId, userSecret };
    if (accountId) params.accounts = [accountId];

    // Neke verzije SDK-a imaju holdingsGet, neke getHoldings
    const api = snaptrade.holdings;
    const fn =
      api?.holdingsGet?.bind(api) ||
      api?.getHoldings?.bind(api);
    if (!fn) {
      return res
        .status(500)
        .json({ ok: false, error: "Holdings API not initialized" });
    }

    const resp = await fn(params);
    const payload = resp?.data ?? resp; // pokriva obe varijante SDK-a

    return res.status(200).json({ ok: true, positions: payload });
  } catch (err) {
    const status = err?.response?.status ?? 500;
    const data =
      err?.response?.data ??
      err?.message ??
      String(err);
    return res.status(status).json({ ok: false, error: data });
  }
}


