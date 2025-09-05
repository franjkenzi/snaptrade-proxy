// api/positions.js
import snaptrade from "./_client.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { userId, userSecret, accountId } = req.query;
  if (!userId || !userSecret) {
    return res.status(400).json({ ok: false, error: "Missing userId or userSecret" });
  }

  try {
    const api = snaptrade.holdings;

    // razne verzije SDK-a: probaj ova imena redom
    const fn =
      api?.holdingsGet ??
      api?.getHoldings ??
      api?.portfolioHoldings?.holdingsGet;

    if (!fn) {
      return res
        .status(500)
        .json({ ok: false, error: "Holdings endpoint not available in SDK" });
    }

    const params = { userId, userSecret };
    if (accountId) params.accountId = accountId;

    const data = await fn.call(api, params);

    return res.status(200).json({ ok: true, positions: data });
  } catch (err) {
    const status = err?.response?.status || 500;
    const detail = err?.response?.data || { message: String(err) };
    return res.status(status).json({ ok: false, error: detail });
  }
}




