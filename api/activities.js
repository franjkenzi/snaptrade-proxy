// /api/activities.js
import snaptrade from "./_client.js";

function pickError(err) {
  const status = err?.response?.status ?? 500;
  const data = err?.response?.data ?? { message: err?.message ?? "Unknown error" };
  return { status, data };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { userId, userSecret, accountId, start, end, cursor, peek } = req.query;
    if (!userId || !userSecret || !accountId) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing userId, userSecret or accountId" });
    }

    // default range: poslednjih 12 meseci (po želji skrati na 90 dana)
    const startISO = start || new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
    const endISO = end || new Date().toISOString();

    // Servisi koji mogu da postoje u različitim buildovima SDK-a
    const activitiesSvc =
      snaptrade.activities || snaptrade.accountActivities || snaptrade.activity || null;
    const transactionsSvc = snaptrade.transactions || null;

    // Kandidati po raznim imenima funkcija kroz verzije SDK-a
    const fnCandidates = [
      // "activities" stil (stariji buildovi)
      activitiesSvc?.listUserAccountActivities,
      activitiesSvc?.listActivitiesForAccount,
      activitiesSvc?.listActivities,
      activitiesSvc?.getActivities,

      // "transactions" stil (noviji buildovi)
      transactionsSvc?.listUserAccountTransactions,
      transactionsSvc?.listTransactionsForAccount,
      transactionsSvc?.listUserTransactions,
      transactionsSvc?.getTransactionsForAccount,
      transactionsSvc?.getUserTransactions,
      transactionsSvc?.getTransactions,
    ];

    const picked = fnCandidates.find((f) => typeof f === "function");

    // Peek režim – samo vrati šta postoji da vidiš u logu
    if (peek === "1") {
      return res.status(200).json({
        ok: true,
        debug: {
          sdkKeys: Object.keys(snaptrade || {}),
          activitiesKeys: Object.keys(activitiesSvc || {}),
          transactionsKeys: Object.keys(transactionsSvc || {}),
          picked: picked ? picked.name : null,
        },
      });
    }

    if (!picked) {
      return res.status(500).json({
        ok: false,
        error: "No activities/transactions function found in this SDK build",
        debug: {
          sdkKeys: Object.keys(snaptrade || {}),
          activitiesKeys: Object.keys(activitiesSvc || {}),
          transactionsKeys: Object.keys(transactionsSvc || {}),
        },
      });
    }

    // Poziv – većina SDK funkcija prima isti objekt parametara
    const resp = await picked.call(activitiesSvc || transactionsSvc, {
      userId,
      userSecret,
      accountId,
      startTime: startISO,
      endTime: endISO,
      cursor,
    });

    const payload = resp?.data ?? resp;

    // U zavisnosti od rute, podaci mogu biti u različitim ključevima:
    const raw =
      payload?.activities ??
      payload?.transactions ??
      payload?.data ??
      payload?.results ??
      payload?.items ??
      payload;

    const list = Array.isArray(raw) ? raw : [];

    // Normalizacija – mapiraj različita polja na isto
    const items = list.map((t) => ({
      id: t.id || t.activityId || t.transactionId || t.externalId,
      accountId,
      symbol: t.symbol || t.ticker || t.securitySymbol || "",
      side: String(t.action || t.type || t.transactionType || "").toUpperCase(), // BUY/SELL/DIVIDEND...
      quantity: Number(t.units ?? t.quantity ?? 0),
      price: Number(t.price ?? t.unitPrice ?? 0),
      amount: Number(t.amount ?? t.netAmount ?? 0),
      currency: t.currency || t.currencyCode || "USD",
      executedAt: t.tradeDate || t.transactionDate || t.timestamp || t.date,
      fees: Number(t.fees ?? t.totalFees ?? 0),
      raw: t, // original, za svaki slučaj
    }));

    return res.status(200).json({
      ok: true,
      items,
      nextCursor: payload?.next ?? payload?.nextCursor ?? null,
    });
  } catch (err) {
    const { status, data } = pickError(err);
    return res.status(status).json({ ok: false, error: data });
  }
}

