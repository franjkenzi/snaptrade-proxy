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

    const api = snaptrade.accountInformation;

    // Helper: bezbedno izdvoj samo payload iz Axios odgovora
    const callAndUnwrap = async (fnName, payload) => {
      const resp = await api[fnName](payload);
      const raw = resp && typeof resp === "object" && "data" in resp ? resp.data : resp;
      // očisti sve ne-serializabilne stvari
      return JSON.parse(JSON.stringify(raw));
    };

    let usedMethod = null;
    let data = null;

    if (accountId) {
      // imamo konkretan nalog → probaj getUserHoldings sa nekoliko "shape"-ova
      usedMethod = "getUserHoldings";
      const payloads = [
        { userId, userSecret, accountId },
        { userId, userSecret, accounts: [accountId] },
        { userId, userSecret, account: accountId },
      ];

      let lastErr = null;
      for (const p of payloads) {
        try {
          data = await callAndUnwrap(usedMethod, p);
          return res.status(200).json({ ok: true, usedMethod, payloadUsed: p, positions: data });
        } catch (e) {
          lastErr = e?.response?.data ?? { message: String(e?.message || e) };
        }
      }
      return res.status(500).json({
        ok: false,
        error: lastErr || "All attempts failed",
        usedMethod,
        triedPayloads: payloads,
      });
    }

    // bez accountId → sve pozicije korisnika
    usedMethod = "getAllUserHoldings";
    try {
      data = await callAndUnwrap(usedMethod, { userId, userSecret });
      return res.status(200).json({ ok: true, usedMethod, positions: data });
    } catch (e) {
      const errData = e?.response?.data ?? { message: String(e?.message || e) };
      return res.status(500).json({ ok: false, error: errData, usedMethod });
    }
  } catch (err) {
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { message: String(err?.message || err) };
    return res.status(status).json({ ok: false, error: data });
  }
}









