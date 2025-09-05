// api/positions.js
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

    // SDK razlike: negde je getHoldings, negde holdingsGet
    const api = snaptrade.holdings;
    const fn = api?.getHoldings || api?.holdingsGet;

    if (!fn) {
      return res
        .status(500)
        .json({ ok: false, error: "Holdings API not initialized" });
    }

    // Neke verzije traže brokerageAccountId umesto accountId
    const params =
      accountId
        ? { userId, userSecret, accountId, brokerageAccountId: accountId }
        : { userId, userSecret };

    const out = await fn.call(api, params);

    return res.status(200).json({ ok: true, positions: out });
  } catch (err) {
    const status = err?.response?.status ?? 500;
    const data =
      err?.response?.data ?? { message: String(err?.message || err) };
    return res.status(status).json({ ok: false, error: data });
  }
}



