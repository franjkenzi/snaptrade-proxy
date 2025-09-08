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

/** Odaberi prvi postojeći metod sa liste kandidata (razne verzije SDK-a). */
function pickMethod(obj, names = []) {
  return names.find((n) => typeof obj?.[n] === "function") || null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { userId, userSecret, accountId, start, end, peek } = req.query;

  if (!userId || !userSecret) {
    return res
      .status(400)
      .json({ ok: false, error: "Missing userId or userSecret" });
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

  // --- PEEK / debug: vrati koje su klase/metode dostupne u SDK-u
  if (peek === "1") {
    const sdkKeys = Object.keys(snaptrade || {});
    const transactionsKeys = Object.keys(snaptrade?.transactions || {});
    const accountInfoKeys = Object.keys(snaptrade?.accountInformation || {});
    const activitiesKeys = Object.keys(snaptrade?.activities || {});
    return res.status(200).json({
      ok: true,
      debug: {
        sdkKeys,
        transactionsKeys,
        accountInfoKeys,
        activitiesKeys,
      },
    });
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

      // Activities (ako build transakcije izbacuje kao “activities”)
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
    const resp = await api[methodName](payload);
    const data = resp?.data ?? resp ?? [];

    // Izvuci listu: može biti data.activities, data.transactions ili sam niz
    const list = Array.isArray(data?.activities)
      ? data.activities
      : Array.isArray(data?.transactions)
      ? data.transactions
      : Array.isArray(data)
      ? data
      : [];

    // Normalizuj u jedinstvenu šemu + dodaj executedAtMs za Bubble (date)
    const items = list.map((t) => {
      const dateStr =
        t.tradeDate ||
        t.transactionDate ||
        t.timestamp ||
        t.date ||
        t.trade_date ||
        t.transaction_date;

      return {
        id: t.id || t.activityId || t.externalId,
        accountId,
        symbol: t.symbol || t.ticker || "",
        side: String(t.action || t.type || "").toUpperCase(),
        quantity: Number(t.units ?? t.quantity ?? 0),
        price: Number(t.price ?? 0),
        amount: Number(t.amount ?? 0),
        currency: t.currency || t.currencyCode || "USD",
        executedAt: dateStr, // ISO/tekst
        executedAtMs: dateStr ? new Date(dateStr).getTime() : null, // ← ključno za Bubble date
        fees: Number(t.fees ?? 0),
        raw: t,
      };
    });

    // Vraćamo normalizovane zapise pod "transactions"
    return res.status(200).json({
      ok: true,
      usedMethod: methodName,
      payloadUsed: {
        userId: payload.userId,
        accountId: payload.accountId,
        start: payload.start || payload.startDate,
        end: payload.end || payload.endDate,
      },
      transactions: items, // listu za Bubble "Schedule API workflow on a list"
      raw: list, // neobavezno: originalni zapisi ako ti zatrebaju
    });
  } catch (err) {
    const status = err?.response?.status || 500;
    const data = err?.response?.data ?? { message: String(err) };
    return res.status(status).json({ ok: false, error: data });
  }
}

}




