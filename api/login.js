import snaptrade from "./_client.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { userId, userSecret, customRedirect, immediateRedirect = true } = req.body || {};
    if (!userId || !userSecret) return res.status(400).json({ error: "Missing userId or userSecret" });

    const out = await snaptrade.authentication.loginSnapTradeUser({
      userId,
      userSecret,
      immediateRedirect,
      customRedirect,
    });

    return res.status(200).json(out); // očekuješ { redirectURI, expiresAt }
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
