import snaptrade from "./_client.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { userId, userSecret } = req.query || {};
    if (!userId || !userSecret) return res.status(400).json({ error: "Missing userId or userSecret" });

    const out = await snaptrade.accountInformation.listUserAccounts({ userId, userSecret });
    return res.status(200).json(out);
  } catch (err) {
    const safe =
      err?.response?.data ?? err?.data ?? err?.message ?? String(err);
    return res.status(500).json({ error: safe });
  }
}
