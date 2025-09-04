import snaptrade from "./_client.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { accountId, userId, userSecret } = req.query || {};
    if (!accountId || !userId || !userSecret) {
      return res.status(400).json({ error: "Missing accountId, userId or userSecret" });
    }

    const out = await snaptrade.accountInformation.listUserHoldings({
      accountId,
      userId,
      userSecret,
    });

    return res.status(200).json(out);
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
