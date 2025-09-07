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
    // ── Query parametri (svi opcioni za peek=1)
    const {
      userId,
      userSecret,
      accountId,
      start,
      end,
      cursor,
      peek,
    } = req.query;

    // ── Pripremi default period (90 dana unazad) i ISO žice
    const startISO = start ? new Date(start).toISOString()
                           : new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    const endISO   = end   ? new Date(end).toISOString()
                           : new Date().toISOString();

    // ── Probaj sve moguće “grupe” i nazive funkcija (varira po SDK verziji)
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

    // ── Ako nismo našli funkciju: prikaži dostupne ključeve (peek=1)
    if (typeof fn !== "function") {
      const snapshot = {
        sdkKeys: Object.keys(snaptrade || {}),
        activitiesKeys: Object.keys(snaptrade?.activities || {}),
        accountActivitiesKeys: Object.keys(snaptrade?.accountActivities || {}),
        activityKeys: Object.keys(snaptrade?.activity || {}),
      };

      if (peek === "1") {
        return res.status(200).json({ ok: true, debug: snapshot });
      }

      console.error("ACTIVITIES_FN_NOT_FOUND", snapshot);
      return res.status(500).json({
        ok: false,
        error:
          "Activities function not found in SDK (call with ?peek=1 to inspect keys)",
      });
    }

    // ── Za stvarni poziv obavezni su userId, userSecret, accountId
    if (!userId || !userSecret || !accountId) {
      return res.status(400).json({
        ok: false,
        error: "Missing userId, userSecret or accountId",
      });
    }

    // ── Poziv SDK-a (šaljemo i alternativne nazive ključeva za datume)
    const args = {
      userId,
      userSecret,
      accountId,
      startTime: startISO,
      endTime: endISO,
      startDate: startISO,
      endDate: endISO,
      cursor,
    };

    const resp = await fn.call(svc, args);
    const payload = resp?.data ?? resp;

    // ── Izvuci listu stavki (različite strukture po verziji)
    const rawList =
      payload?.activities ||
      payload?.data ||
      (Array.isArray(payload) ? payload : []);

    const items = (rawList || []).map((a) => ({
      id: a.id || a.activityId || a.externalId || a.uuid || null,
      accountId,
      symbol: a.symbol || a.ticker || a.security?.symbol || "",
      side: String(a.action || a.type || a.side || "").toUpperCase(), // BUY / SELL / DIVIDEND ...
      quantity: Number(a.units ?? a.quantity ?? a.shares ?? 0),
      price: Number(a.price ?? a.unitPrice ?? 0),
      amount: Number(a.amount ?? a.netAmount ?? a.grossAmount ?? 0),
      currency: a.currency || a.currencyCode || a.settlementCurrency || "USD",
      executedAt:
        a.tradeDate ||
        a.transactionDate ||
        a.timestamp ||
        a.date ||
        a.executedAt ||
        null,
      fees: Number(a.fees ?? a.commissions ?? 0),
      raw: a, // kompletan original, za svaki slučaj
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

