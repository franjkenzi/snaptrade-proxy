// api/login.js
import snaptrade from "./_client.js";

function pickError(err) {
  const status = err?.response?.status ?? 500;
  const data = err?.response?.data ?? { message: err?.message ?? "Unknown error" };
  return { status, data };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { userId, userSecret, broker, redirectTo } = body;

    if (!userId || !userSecret) {
      return res.status(400).json({ error: "Missing userId or userSecret" });
    }

    // 1) Tražimo portal URL sa auto-redirectom nazad u tvoj Bubble
    //    (ako SDK prihvata ove opcije – u većini verzija radi).
    const portalReq = {
      userId,
      userSecret,
      immediateRedirect: true,                          // <—
      customRedirect: redirectTo || process.env.SNAP_CUSTOM_REDIRECT, // <—
      // opcionalno: culture, connectionType, itd.
    };

    let resp = await snaptrade.authentication.loginSnapTradeUser(portalReq);
    let payload = resp?.data ?? resp;
    let redirectURI = payload?.redirectURI;

    // 2) Ako želiš da unapred „otvori“ konkretnog brokera u portalu:
    if (redirectURI && typeof broker === "string" && broker.trim()) {
      const url = new URL(redirectURI);
      url.searchParams.set("broker", broker.trim().toUpperCase());
      redirectURI = url.toString();
    }

    return res.status(200).json({ ok: true, redirectURI, sessionId: payload?.sessionId });
  } catch (err) {
    const { status, data } = pickError(err);
    return res.status(status).json({ ok: false, error: data });
  }
}






