// /api/transactions.js
import snaptrade from "./_client.js";

/**
 * Normalizacija datuma:
 * - prima bilo koji string/date, vraća "YYYY-MM-DD"
 * - SnapTrade uglavnom očekuje samo datum bez vremena
 */
function toIsoDate(v) {
  if (!v) return undefined;
  const d = new Date(v);
  if (isNaN(d)) return undefined;
  return d.toISOString().slice(0, 10);
}

/**
 * Odaberi prvi postojeći metod sa liste kandidata (razne verzije SDK-a).
 */
function pickMethod(obj, names = []) {
  return names.find((n) => typeof obj?.[n] === "function") || null;
}

/**
 * Vercel handler
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { userId, userSecret, accountId, start, end } = req.query;

  if (!userId || !userSecret) {
    return res.status(400).json({ ok: false, error: "Missing userId or userSecret" });
  }

  // payload koji će (u zavisnosti od SDK builda) pokriti više varijanti imena polja
  const payload = {
    userId,
    userSecret,
  };

  // filter po nalogu (neke verzije traže accounts:[], neke accountId)
  if (accountId) {
    payload.accounts = [accountId];
    payload.accountId = accountId;
  }

  const startDate = toIsoDate(start);
  const endDate = toIsoDate(end);
  if (startDate) {
    payload.start = startDate;
    payload.startDate = startDate;
  }
  if (endDate) {
    payload.end = endDate;
    payload.endDate = endDate;
  }

  try {
    // Odaberi koji "api" objekat imamo u clientu (zavisno od SDK builda)
    const api =
      snaptrade.transactions ||
      snaptrade.transactionsAndReporting ||
      snaptrade.accountInformation ||
      snaptrade.activities;

    if (!api) {
      return res
        .status(500)
        .json({ ok: false, error: "Transactions API not initialized on client" });
    }

    // Kandidati metoda (različiti buildovi SDK-a imaju druga imena)
    const methodName = pickMethod(api, [
      // Transactions
      "getUserTransactions",
      "getTransactions",
      "listTransactions",
      "userTransactionsGet",
      "transactionsGet",
      "getUserAccountTransactions",

      // Activities
      "getActivities",
      "getUserActivities",
      "getAccountActivities",
      "activitiesGet",
    ]);

    if (!methodName) {
      const keys = Object.keys(api || {});
      return res.status(500).json({
        ok: false,
        error: "Transactions method not found on this SDK build",
        availableKeys: keys,
      });
    }

    // Pozovi metod
    let resp = await api[methodName](payload);

    // Neke verzije SDK vraćaju { data }, druge direktno niz
    let data = resp?.data ?? resp ?? [];
    return res.status(200).json({
      ok: true,
      usedMethod: methodName,
      payloadUsed: {
        userId: payload.userId,
        accountId: payload.accountId,
        start: payload.start || payload.startDate,
        end: payload.end || payload.endDate,
      },
      transactions: data,
    });
  } catch (err) {
    const status = err?.response?.status || 500;
    const data = err?.response?.data ?? { message: String(err) };
    return res.status(status).json({ ok: false, error: data });
  }
}



