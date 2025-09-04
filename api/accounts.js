// /api/accounts.js
import snaptrade from "./_client.js";

function pickError(err) {
  const status = err?.response?.status ?? 500;
  const data = err?.response?.data ?? { message: err?.message ?? "Unknown error" };
  return { status, data };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId, userSecret } = req.query;
    if (!userId || !userSecret) {
      return res.status(400).json({ error: "Missing userId or userSecret" });
    }

    // Pozovi SnapTrade SDK za listu naloga (naziv metode zavisi od SDK-a koji koristiš)
    const resp = await snaptrade.accounts.list({ userId, userSecret });

    // ako SDK vraća { data }, uzmi data; ako vraća već gotov objekat, samo ga vrati
    const payload = resp?.data ?? resp;
    return res.status(200).json({ ok: true, accounts: payload });
  } catch (err) {
    const { status, data } = pickError(err);
    return res.status(status).json({ ok: false, error: data });
  }
}


