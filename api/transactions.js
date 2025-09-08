// /api/transactions.js
// Next.js / Vercel API route
// U ovoj ruti radimo dva pokušaja prema SnapTrade-u:
//   1) /activities
//   2) /transactions
// šta god vrati listu, normalizujemo u "items" + dodamo rawText i executedAtMs.
//
// Konfiguracija:
//   process.env.UPSTREAM_BASE   -> baza za upstream (npr. "https://api.snaptrade.com/api/v1")
//   (Ako koristiš svoj interni upstream/proxy, stavi njegov base ovde.)
//
/* eslint-disable no-console */

export default async function handler(req, res) {
  try {
    // CORS (safe po defaultu)
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      return res.status(200).end();
    }
    if (req.method !== "GET") {
      return json(res, 405, { ok: false, error: "Method not allowed" });
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json; charset=utf-8");

    const {
      userId,
      userSecret,
      accountId,
      start,
      end,
      peek,
    } = req.query;

    // Validacija inputa
    if (!userId || !userSecret || !accountId) {
      return json(res, 400, {
        ok: false,
        error: "Missing required query params: userId, userSecret, accountId",
      });
    }

    // Datumi (fallback: zadnja 3 meseca)
    const { startISO, endISO } = makeDateRange(start, end);

    // Upstream base
    const UPSTREAM = process.env.UPSTREAM_BASE || "https://api.snaptrade.com/api/v1";

    // Helper: zovi upstream (GET qs)
    const callUpstream = async (path, qs) => {
      const url = new URL(path, UPSTREAM);
      Object.entries(qs).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
      });
      const r = await fetch(url.toString(), { method: "GET" });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(`Upstream ${path} error ${r.status}: ${txt || r.statusText}`);
      }
      return r.json();
    };

    // 1) pokušaj: activities
    let usedMethod = "getActivities";
    let data = null;
    try {
      data = await callUpstream("/activities", {
        userId,
        userSecret,
        accountId,
        start: startISO,
        end: endISO,
      });
    } catch (e) {
      // nastavi na /transactions
      data = null;
    }

    // strukture koje eventualno mogu doći
    let list =
      (Array.isArray(data?.activities) && data.activities) ||
      (Array.isArray(data?.data?.activities) && data.data.activities) ||
      null;

    // 2) fallback: transactions
    if (!list || list.length === 0) {
      usedMethod = "getTransactions";
      const tData = await callUpstream("/transactions", {
        userId,
        userSecret,
        accountId,
        start: startISO,
        end: endISO,
      });
      list =
        (Array.isArray(tData?.transactions) && tData.transactions) ||
        (Array.isArray(tData?.data?.transactions) && tData.data.transactions) ||
        [];
      data = tData;
    }

    // Normalizacija -> items
    const items = (Array.isArray(list) ? list : []).map((t) => normalizeItem(t, accountId));

    // Ako želiš peek, samo skrati
    let outItems = items;
    if (peek) {
      const n = Number(peek);
      if (!Number.isNaN(n) && n > 0) outItems = items.slice(0, n);
    }

    return json(res, 200, {
      ok: true,
      usedMethod,
      payloadUsed: {
        userId,
        accountId,
        start: startISO,
        end: endISO,
      },
      // ostavljamo "transactions" zbog kompatibilnosti sa Bubble setupom
      transactions: list || [],
      items: outItems,
    });
  } catch (err) {
    console.error("transactions route error:", err);
    return json(res, 500, { ok: false, error: String(err?.message || err) });
  }
}

/* ----------------------- helpers ----------------------- */

function json(res, status, body) {
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

function makeDateRange(start, end) {
  const now = new Date();
  const endDate = parseDate(end) || now;
  const startDate =
    parseDate(start) || new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000); // -90d

  return {
    startISO: toISODate(startDate),
    endISO: toISODate(endDate),
  };
}

function parseDate(v) {
  if (!v) return null;
  if (typeof v === "number") return new Date(v);
  if (typeof v === "string") {
    // podrži ms timestamp ili ISO
    const n = Number(v);
    if (!Number.isNaN(n) && v.trim() !== "") return new Date(n);
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function toISODate(d) {
  // SnapTrade očekuje ISO; ostavi ceo ISO string
  return d.toISOString();
}

function normalizeItem(t, accountId) {
  // pokuša da nađe "najbolje" polje za datum
  const dateStr =
    t.tradeDate ||
    t.transactionDate ||
    t.timestamp ||
    t.date ||
    t.trade_date ||
    t.transaction_date ||
    null;

  let rawText = "";
  try {
    rawText = JSON.stringify(t);
  } catch (_) {
    rawText = "";
  }

  const symbol =
    t.symbol ||
    t.ticker ||
    t?.universal_symbol?.symbol ||
    t?.security_symbol ||
    "";

  const currency =
    t.currency ||
    t.currencyCode ||
    t?.price?.currency ||
    "USD";

  return {
    id: t.id || t.activityId || t.externalId || t.external_id || null,
    accountId,
    symbol,
    side: String(t.action || t.type || "").toUpperCase(),
    quantity: Number(t.units ?? t.quantity ?? 0),
    price: Number(t.price ?? 0),
    amount: Number(t.amount ?? 0),
    currency,
    executedAt: dateStr,                                 // ISO tekst (kako je došlo)
    executedAtMs: dateStr ? new Date(dateStr).getTime() : null, // broj (ms)
    fees: Number(t.fees ?? t.fee ?? 0),
    raw: t,          // originalni objekat (za debug)
    rawText,        // <<< tekst za Bubble (snima se u Trade.raw_json)
  };
}






