// /api/transactions.js
import snaptrade from "./_client.js";

// Nađi funkciju koja liči na "get/list activities/transactions"
function pickTransactionsFn(api) {
  if (!api) return null;
  const prefer = [
    "getActivities", "activitiesGet", "listActivities", "listUserActivities",
    "getTransactions", "transactionsGet", "listTransactions", "listUserTransactions"
  ];
  for (const k of prefer) {
    if (typeof api[k] === "function") return api[k].bind(api);
  }
  const any = Object.keys(api).find(
    (k) => typeof api[k] === "function" && /(activit|transact)/i.test(k)
  );
  return any ? api[any].bind(api) : null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { userId, userSecret, accountId, start, end } = req.query;
  if (!userId || !userSecret) {
    return res.status(400).json({ ok: false, error: "Missing userId or userSecret" });
  }

  // SnapTrade tipično želi snake_case – pazi da prođe bez obzira na verziju SDK-a
  const params = {
    userId,            // userId / user_id (SDK obično prihvata oba)
    user_id: userId,
    userSecret,        // userSecret / user_secret
    user_secret: userSecret,
  };
  if (accountId) params.accountId = params.account_id = accountId;
  if (start) params.start = params.start_date = start;
  if (end) params.end = params.end_date = end;

  try {
    const api = snaptrade.transactions || snaptrade.accountInformation;
    const fn = pickTransactionsFn(api);

    if (!fn) {
      return res.status(500).json({
        ok: false,
        error: "Transactions API not found in this SDK build",
        availableFns: Object.keys(api || {}),
      });
    }

    const resp = await fn(params);
    const data = resp?.data ?? resp;

    // Razni oblici po build-u
    const rawList =
      Array.isArray(data) ? data :
      Array.isArray(data?.activities) ? data.activities :
      Array.isArray(data?.transactions) ? data.transactions :
      Array.isArray(data?.results) ? data.results :
      [];

    // Normalizacija u naš “Trade” oblik
    const transactions = rawList.map((n) => {
      const qty = Number(n.quantity ?? n.units ?? n.shares ?? 0);
      const price = Number(n.price ?? n.unit_price ?? n.amount_per_share ?? 0);
      const amount = Number(n.amount ?? n.gross_amount ?? qty * price || 0);

      // buy/sell/dividend/interest/fee/... – sve spuštamo na lowercase
      const side = String(n.action ?? n.side ?? n.transaction_type ?? "").toLowerCase();

      return {
        id: n.id ?? n.activity_id ?? n.transaction_id ?? null,
        date: n.trade_date ?? n.transaction_date ?? n.date ?? n.timestamp ?? null,
        symbol: n.symbol ?? n.ticker ?? n.security?.symbol ?? null,
        description: n.description ?? n.note ?? null,
        side,
        quantity: qty,
        price,
        gross_amount: amount,
        fees: Number(n.fees ?? n.commissions ?? 0),
        currency: n.currency ?? n.settlement_currency ?? n.money?.currency ?? null,
        accountId: accountId ?? n.account ?? n.account_id ?? null,
        raw: n, // čuvamo original u slučaju daljeg mapiranja
      };
    });

    return res.status(200).json({
      ok: true,
      usedMethod: fn.name,
      payloadUsed: { userId, accountId, start, end },
      count: transactions.length,
      transactions,
    });
  } catch (err) {
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { message: String(err) };
    return res.status(status).json({ ok: false, error: data });
  }
}



