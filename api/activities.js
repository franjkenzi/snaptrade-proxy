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
      return res
        .status(400)
        .json({ ok: false, error: "Missing userId, userSecret or accountId" });
    }

    // default: poslednja 3 meseca
    const startISO =
      start || new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    const endISO = end || new Date().toISOString();

    // ---- pronađi servis i funkciju bez obzira na naziv u SDK-u
    const svc =
      snaptrade.activities ||
      snaptrade.accountActivities ||
      snaptrade.activity ||
      {};

    const fn =
      svc.listUserAccountActivities ||
      svc.listActivitiesForAccount ||
      svc.listActivities ||
      svc.getActivities;

    if (typeof fn !== "function") {
      console.error("ACTIVITIES_FN_NOT_FOUND", {
        sdkKeys: Object.keys(snaptrade || {}),
        svcKeys: Object.keys(svc || {}),
      });
      return res.status(500).json({
        ok: false,
        error:
          "Activities function not found in SDK (check logs for available keys)",
      });
    }

    const resp = await fn.call(svc, {
      userId,
      userSecret,
      accountId,
      startTime: startISO,
      endTime: endISO,
      cursor,
    });

    const payload = resp?.data ?? resp;

    // Normalizuj rezultate
    const list =
      payload?.activities ||
      payload?.data ||
      payload?.results ||
      payload ||
      [];

    const items = list.map((a) => ({
      id: a.id || a.activityId || a.externalId,
      accountId,
      symbol: a.symbol || a.ticker || "",
      side: String(a.action || a.type || "").toUpperCase(), // BUY/SELL/DIVIDEND...
      quantity: Number(a.units ?? a.quantity ?? 0),
      price: Number(a.price ?? 0),
      amount: Number(a.amount ?? 0),
      currency: a.currency || a.currencyCode || "USD",
      executedAt:
        a.tradeDate || a.transactionDate || a.timestamp || a.date || null,
      fees: Number(a.fees ?? 0),
      raw: a,
    }));

    res.status(200).json({
      ok: true,
      items,
      nextCursor: payload?.next ?? payload?.nextCursor ?? null,
    });
  } catch (err) {
    const { status, data } = pickError(err);
    console.error("ACTIVITIES_ERROR", data);
    res.status(status).json({ ok: false, error: data });
  }
}

