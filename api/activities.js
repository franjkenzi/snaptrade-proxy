// /api/activities.js
import snaptrade from "./_client.js";

function pickError(err) {
  const status = err?.response?.status ?? 500;
  const data = err?.response?.data ?? { message: err?.message ?? "Unknown error" };
  return { status, data };
}

// pom. ISO now i -X meseci
const toISO = (d) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

export default async function handler(req, res) {
  // Samo GET
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { userId, userSecret, accountId, start, end, cursor, peek } = req.query;

    // Debug mod – vrati koje su klase i metode dostupne u SDK-u
    if (peek === "1") {
      const keys = (o) =>
        o
          ? Object.keys(Object.getOwnPropertyNames(Object.getPrototypeOf(o))
              .reduce((acc, k) => ({ ...acc, [k]: true }), {}))
            .filter((k) => typeof o[k] === "function" && k !== "constructor")
          : [];
      return res.status(200).json({
        ok: true,
        debug: {
          sdkKeys: Object.keys(snaptrade || {}),
          activitiesKeys: keys(snaptrade.activities),
          accountActivitiesKeys: keys(snaptrade.accountInformation),
          transactionsKeys: keys(snaptrade.transactions),
        },
      });
    }

    if (!userId || !userSecret || !accountId) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing userId, userSecret or accountId" });
    }

    // Default opseg: poslednja 3 meseca (možeš promeniti)
    const startISO = start || toISO(new Date(Date.now() - 90 * 24 * 3600 * 1000));
    const endISO   = end   || toISO(new Date());

    // --------- PRONAĐI FUNKCIJU KOJA POSTOJI U TVOM BUILDU ---------
    // Pokušavamo najpre u 'transactions', pa u 'accountInformation'
    const svcOrder = [
      ["transactions", snaptrade.transactions],
      ["accountInformation", snaptrade.accountInformation],
    ];

    // Lista mogućih imena metoda kroz različite buildove
    const candidateNames = [
      "listUserAccountTransactions",
      "listAccountTransactions",
      "getUserAccountTransactions",
      "getAccountTransactions",
      "listUserAccountActivities",
      "listActivitiesForAccount",
      "listActivities",
      "getActivities",
    ];

    let svcName = null;
    let fnName = null;
    let fn = null;

    for (const [name, svc] of svcOrder) {
      if (!svc) continue;
      for (const cand of candidateNames) {
        if (typeof svc[cand] === "function") {
          svcName = name;
          fnName = cand;
          fn = svc[cand].bind(svc);
          break;
        }
      }
      if (fn) break;
    }

    if (!fn) {
      return res.status(500).json({
        ok: false,
        error:
          "No activities/transactions function found in this SDK build (call with '?peek=1' to inspect keys)",
        debug: {
          sdkKeys: Object.keys(snaptrade || {}),
          activitiesKeys: snaptrade.activities ? Object.keys(snaptrade.activities) : [],
          accountActivitiesKeys: snaptrade.accountInformation
            ? Object.keys(snaptrade.accountInformation)
            : [],
          transactionsKeys: snaptrade.transactions ? Object.keys(snaptrade.transactions) : [],
        },
      });
    }

    // Argument objekat – šaljemo superset polja; SDK će uzeti ona koja mu trebaju
    const args = {
      userId,
      userSecret,
      accountId,
      accountID: accountId,      // neki buildovi očekuju drugačiji ključ
      startTime: startISO,
      endTime: endISO,
      startDate: startISO,
      endDate: endISO,
      cursor,
    };

    const resp = await fn(args);
    const payload = resp?.data ?? resp;

    // Normalizuj na unified listu
    const rawList =
      payload?.transactions ||
      payload?.activities ||
      payload?.data ||
      payload ||
      [];

    const items = (Array.isArray(rawList) ? rawList : []).map((t) => {
      // pokušaj sa najčešćim ključevima
      const id =
        t.id || t.transactionId || t.activityId || t.externalId || t.uuid || null;

      const symbol =
        t.symbol ||
        t.ticker ||
        t.security?.symbol ||
        t.instrument?.symbol ||
        "";

      const side =
        (t.side || t.action || t.type || t.transactionType || "").toString().toUpperCase();

      const quantity = Number(
        t.units ?? t.quantity ?? t.shares ?? t.amountUnits ?? 0
      );

      const price = Number(t.price ?? t.unitPrice ?? 0);
      const amount = Number(t.amount ?? t.netAmount ?? t.grossAmount ?? 0);
      const currency = t.currency || t.currencyCode || "USD";

      const executedAt =
        t.tradeDate ||
        t.transactionDate ||
        t.timestamp ||
        t.date ||
        t.executedAt ||
        null;

      const fees = Number(t.fees ?? t.totalFees ?? 0);

      return {
        id,
        accountId,
        symbol,
        side,
        quantity,
        price,
        amount,
        currency,
        executedAt,
        fees,
        raw: t,
      };
    });

    // next cursor/pagination
    const nextCursor =
      payload?.next || payload?.pagination?.next || payload?.cursor?.next || null;

    return res.status(200).json({
      ok: true,
      used: { svc: svcName, fn: fnName },
      items,
      nextCursor,
      count: items.length,
    });
  } catch (err) {
    const { status, data } = pickError(err);
    return res.status(status).json({ ok: false, error: data });
  }
}


