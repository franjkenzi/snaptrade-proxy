// api/login.js
import snaptrade from "./_client.js";

function pickError(err) {
  const status = err?.response?.status ?? 500;
  const data =
    err?.response?.data ??
    { message: err?.message ?? "Unknown error" };
  return { status, data };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body || {});
    const { userId, userSecret } = body;

    if (!userId || !userSecret) {
      return res
        .status(400)
        .json({ error: "Missing userId or userSecret" });
    }

    // SnapTrade login
    const resp = await snaptrade.authentication.loginSnapTradeUser({
      userId,
      userSecret,
    });

    // SDK ponekad vraća { data: ... }, pa uzmi samo payload
    const payload = resp?.data ?? resp;
    return res.status(200).json({ ok: true, ...payload });
  } catch (err) {
    const { status, data } = pickError(err);
    return res.status(status).json({ ok: false, error: data });
  }
}




