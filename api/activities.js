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
    const { userId, userSecret, accountId, start, end, cursor } = req.query;
    if (!userId || !userSecret || !accountId) {
      return res.status(400).json({ ok: false, error: "Missing userId, userSecret or accountId" });
    }

    // default: poslednjih 12 meseci
    const startISO = start || new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    const endISO   = end   || new Date().toISOString();

    // ▼ SDK poziv – zavisi od verzije SDK-a; ako ti je ime metode drugačije,
    // pogledaj kako si radio u /api/accounts.js i prilagodi.
    const resp = await snaptrade.accountActivities.listUserAccountActivities({
      userId,
      userSecret,
      accountId,
      startTime: startISO,
      endTime: endISO,
      cursor, // opcionalno, za paginaciju
    });

    const payload = resp?.data ?? resp;

    // Normalizacija u jednostavne stavke, da Bubble lako vari
    const items = (payload?.activities ?? payload ?? []).map(a => ({
      id: a.id || a.activityId || a.externalId,
      accountId,
      symbol: a.symbol || a.ticker || "",
      side: (a.action || a.type || "").toUpperCase(),  // BUY / SELL / DIVIDEND / ...
      quantity: Number(a.units ?? a.quantity ?? 0),
      price: Number(a.price ?? 0),
      amount: Number(a.amount ?? 0),
      currency: a.currency || a.currencyCode || "USD",
      executedAt: a.tradeDate || a.transactionDate || a.timestamp || a.date,
      fees: Number(a.fees ?? 0),
      raw: a, // ceo objekat, za svaki slučaj
    }));

    res.status(200).json({
      ok: true,
      items,
      nextCursor: payload?.next ?? null, // za paginaciju
    });
  } catch (err) {
    const { status, data } = pickError(err);
    res.status(status).json({ ok: false, error: data });
  }
}
