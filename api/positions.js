// api/positions.js
import snaptrade from "./_client.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { userId, userSecret, accountId } = req.query;
    if (!userId || !userSecret) {
      return res.status(400).json({ ok: false, error: "Missing userId or userSecret" });
    }

    const params = { userId, userSecret, accountId };

    // različite varijante po verziji SDK-a
    const api =
      snaptrade.portfolioHoldings ??
      snaptrade.holdings ??
      snaptrade.accountInformation;

    const fn =
      api?.holdingsGet ??
      api?.getHoldings ??
      api?.listUserHoldings; // ako postoji u tvojoj verziji

    if (!fn) {
      throw new Error("Holdings method not found on current SDK version");
    }

    const data = await fn.call(api, params);
    return res.status(200).json({ ok: true, positions: data });
  } catch (err) {
    const status = err?.response?.status || 500;
    const data = err?.response?.data ?? { message: String(err) };
    return res.status(status).json({ ok: false, error: data });
  }
}



