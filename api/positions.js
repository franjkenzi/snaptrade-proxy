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

    // U ovom buildu holdings endpointi su u AccountInformationApi
    const api = snaptrade.accountInformation;

    // Moguća imena metoda kroz različite verzije SDK-a
    const candidates = [
      "holdingsGet",
      "getHoldings",
      "portfolioHoldings",
      "portfolioHoldingsHoldingsGet",
      "getAllHoldings",
      "listHoldings",
      "listUserHoldings",
    ];

    const fnName = candidates.find(
      (name) => typeof api?.[name] === "function"
    );

    if (!fnName) {
      return res.status(500).json({
        ok: false,
        error:
          "Holdings method not found on AccountInformationApi for this SDK build",
      });
    }

    const params = { userId, userSecret };
    if (accountId) params.accountId = accountId;

    const data = await api[fnName](params);

    return res.status(200).json({ ok: true, positions: data });
  } catch (err) {
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { message: String(err) };
    return res.status(status).json({ ok: false, error: data });
  }
}







