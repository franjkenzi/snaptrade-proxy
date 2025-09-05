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

    // Nazivi koji se javljaju u različitim verzijama SDK-a
    const preferred = [
      "holdingsGet",
      "getHoldings",
      "portfolioHoldings",
      "portfolioHoldingsHoldingsGet",
      "getAllHoldings",
      "listHoldings",
      "listUserHoldings",
    ];

    // 1) Pokušaj direktno na instanci
    let fnName = preferred.find((n) => typeof api?.[n] === "function");

    // 2) Ako nema, pretraži PROTOTIP (tu su metode u ovom buildu)
    const proto = Object.getPrototypeOf(api) || {};
    const protoFnKeys = Object.getOwnPropertyNames(proto).filter(
      (k) => typeof api[k] === "function"
    );

    if (!fnName) {
      fnName = preferred.find((n) => protoFnKeys.includes(n));
    }
    // 3) Ako i dalje nema, uzmi prvu metodu koja u nazivu sadrži "hold"
    if (!fnName) {
      fnName = protoFnKeys.find((k) => /hold/i.test(k));
    }

    if (debug === "1" && !fnName) {
      return res.status(500).json({
        ok: false,
        error: "Holdings method not found on AccountInformationApi for this SDK build",
        tried: preferred,
        dynamicFound: [],
        allFunctionKeys: Object.keys(api || {}).filter((k) => typeof api[k] === "function"),
        protoFunctionKeys: protoFnKeys,
      });
    }

    if (!fnName) {
      return res.status(500).json({
        ok: false,
        error:
          "Holdings method not found on AccountInformationApi for this SDK build (proveri protoFunctionKeys sa ?debug=1)",
      });
    }

    const params = { userId, userSecret };
    if (accountId) params.accountId = accountId;

    // Važno: pozovi metodu sa ispravnim this-om
    const data = await api[fnName].call(api, params);

    return res.status(200).json({ ok: true, usedMethod: fnName, positions: data });
  } catch (err) {
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { message: String(err) };
    return res.status(status).json({ ok: false, error: data });
  }
}








