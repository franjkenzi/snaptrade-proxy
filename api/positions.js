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

    // U ovom buildu holdings su ispod AccountInformation API-ja
    const api = snaptrade.accountInformation;

    // Helper: sakupi SVA imena funkcija sa instance + SVIH prototipova
    const collectFunctionKeys = (obj) => {
      const out = new Set();

      // own (uključuje i ne-enumerabilna svojstva)
      for (const k of Object.getOwnPropertyNames(obj)) {
        try {
          if (typeof obj[k] === "function") out.add(k);
        } catch (_) {}
      }

      // chain
      let cur = Object.getPrototypeOf(obj);
      while (cur && cur !== Object.prototype) {
        for (const k of Object.getOwnPropertyNames(cur)) {
          try {
            if (typeof obj[k] === "function") out.add(k);
          } catch (_) {}
        }
        cur = Object.getPrototypeOf(cur);
      }
      return [...out];
    };

    const allFnKeys = collectFunctionKeys(api);

    // Kandidati po nazivima u raznim verzijama SDK-a
    const preferred = [
      "holdingsGet",
      "getHoldings",
      "portfolioHoldings",
      "portfolioHoldingsHoldingsGet",
      "getAllHoldings",
      "listHoldings",
      "listUserHoldings",
    ];

    // Prvo probaj preferirane
    let fnName = preferred.find((n) => allFnKeys.includes(n));
    // Ako nema – bilo koja metoda koja sadrži 'hold'
    if (!fnName) fnName = allFnKeys.find((k) => /hold/i.test(k));

    if (debug === "1" && !fnName) {
      return res.status(500).json({
        ok: false,
        error: "Holdings method not found on AccountInformationApi for this SDK build",
        tried: preferred,
        allFunctionKeys: allFnKeys,
      });
    }

    if (!fnName) {
      return res.status(500).json({
        ok: false,
        error:
          "Holdings method not found on AccountInformationApi for this SDK build (pogledaj ?debug=1 da vidiš dostupne ključeve)",
      });
    }

    // Različite verzije očekuju različite oblike parametara
    const payloads = [];
    if (accountId) {
      payloads.push({ userId, userSecret, accountId });
      payloads.push({ userId, userSecret, accounts: [accountId] });
      payloads.push({ userId, userSecret, account: accountId });
    }
    payloads.push({ userId, userSecret }); // fallback: sve naloge

    let lastErr = null;
    for (const payload of payloads) {
      try {
        const data = await api[fnName].call(api, payload);
        return res
          .status(200)
          .json({ ok: true, usedMethod: fnName, payloadUsed: payload, positions: data });
      } catch (e) {
        lastErr = e?.response?.data ?? { message: String(e) };
      }
    }

    return res.status(500).json({
      ok: false,
      error: lastErr || "All attempts failed",
      usedMethod: fnName,
      triedPayloads: payloads,
      availableFns: allFnKeys,
    });
  } catch (err) {
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { message: String(err) };
    return res.status(status).json({ ok: false, error: data });
  }
}








