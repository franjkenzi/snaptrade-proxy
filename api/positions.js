// api/positions.js
import snaptrade from "./_client.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { userId, userSecret, accountId, debug } = req.query;
    if (!userId || !userSecret) {
      return res.status(400).json({ ok: false, error: "Missing userId or userSecret" });
    }

    // U ovom buildu holdings su pod AccountInformationApi
    const api = snaptrade.accountInformation;

    // Kandidati iz raznih verzija SDK-a + fallback pretraga po imenu
    const preferred = [
      "holdingsGet",
      "getHoldings",
      "portfolioHoldings",
      "portfolioHoldingsHoldingsGet",
      "getAllHoldings",
      "listHoldings",
      "listUserHoldings",
    ];

    let fnName = preferred.find((name) => typeof api?.[name] === "function");

    // Fallback: pronađi PRVU metodu koja u nazivu sadrži "hold"
    if (!fnName) {
      const dynamic = Object.keys(api || {}).filter(
        (k) => typeof api[k] === "function" && /hold/i.test(k)
      );
      fnName = dynamic[0];
      if (debug === "1") {
        return res.status(500).json({
          ok: false,
          error: "Holdings method not found on AccountInformationApi for this SDK build",
          tried: preferred,
          dynamicFound: dynamic,
          allFunctionKeys: Object.keys(api || {}).filter((k) => typeof api[k] === "function"),
        });
      }
    }

    if (!fnName) {
      return res.status(500).json({
        ok: false,
        error: "Holdings method not found on AccountInformationApi for this SDK build",
      });
    }

    const params = { userId, userSecret };
    if (accountId) params.accountId = accountId;

    const data = await api[fnName](params);
    return res.status(200).json({ ok: true, usedMethod: fnName, positions: data });
  } catch (err) {
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { message: String(err) };
    return res.status(status).json({ ok: false, error: data });
  }
}








