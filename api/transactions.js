// /api/transactions.js
import snaptrade from "./_client.js";

/** Pretvori bilo koji date/string u "YYYY-MM-DD" (SnapTrade tipično očekuje datum bez vremena) */
function toIsoDate(v) {
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

/** Vrati prvo postojeće ime metode sa liste kandidata (različiti SDK buildovi) */
function pickMethod(obj, names = []) {
  return names.find((n) => typeof obj?.[n] === "function") || null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { userId, userSecret, accountId, start, end, cursor, peek } = req.query;

    if (!userId || !userSecret) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing userId or userSecret" });
    }

    // Payload (pokriva i starije i novije nazive polja po SDK-u)
    const payload = {
      userId,
      userSecret,
    };

    // Account filter: neke verzije traže accounts[], neke accountId
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

    // Odaberi API objekat prisutan u klijentu (zavisno od builda)
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

    // Kandidati za ime metode na različitim buildovima
    const methodName = pickMethod(api, [
      // Transactions
      "getUserTransactions",
      "getTransactions",
      "listTransactions",
      "userTransactionsGet",
      "transactionsGet",
      "getUserAccountTransactions",

      // Activities (neki buildovi vraćaju isto kroz “activities”)
      "getActivities",
      "getUserActivities",
      "getAccountActivities",
      "activitiesGet",
      "listActivities",
    ]);

    // Debug peek (vrati dostupne ključeve da lakše pogodimo naziv)
    if (!methodName) {
      const sdkKeys = Object.keys(api || {});
      if (peek === "1") {
        return res.status(200).json({
          ok: true,
          debug: { sdkKeys },
        });
      }
      return res.status(500).json({
        ok: false,
        error: "Transactions/Activities function not found in this SDK build",
        debug: { sdkKeys },
      });
    }

    // Poziv SDK-a
    const resp = await api[methodName]({
      ...payload,
      cursor, // opcionalno, ako build podržava paginaciju
    });

    // Neke verzije vraćaju { data }, neke direktno niz
    const data = resp?.data ?? resp ?? [];

    // Izvuci listu transakcija/aktivnosti iz različitih oblika
    const list = Array.isArray(data?.activities)
      ? data.activities
      : Array.isArray(data?.transactions)
      ? data.transactions
      : Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data)
      ? data
      : [];

    // NORMALIZACIJA → items (uvek isti ključevi)
    const items = list.map((t) => ({
      id: t.id || t.transactionId || t.activityId || t.externalId,
      accountId: t.accountId || t.account_id,
      symbol: t.symbol || t.ticker || "",
      side: String(t.transaction_type || t.type || t.action || "").toUpperCase(),
      quantity: Number(t.units ?? t.quantity ?? 0),
      price: Number(t.price ?? 0),
      amount: Number(t.amount ?? 0),
      currency: t.currency || t.currencyCode || "USD",
      executedAt:
        t.trade_date ||
        t.transaction_date ||
        t.timestamp ||
        t.date ||
        null, // Bubble: :converted to date
      fees: Number(t.fee ?? t.fees ?? 0),
      raw: t,
    }));

    return res.status(200).json({
      ok: true,
      usedMethod: methodName,
      payloadUsed: {
        userId: payload.userId,
        accountId: payload.accountId,
        start: payload.start || payload.startDate,
        end: payload.end || payload.endDate,
      },
      transactions: data, // ostavljeno radi kompatibilnosti
      items, // ← OVO koristi u Bubble-u
    });
  } catch (err) {
    const status = err?.response?.status ?? 500;
    const data = err?.response?.data ?? { message: String(err) };
    return res.status(status).json({ ok: false, error: data });
  }
}




