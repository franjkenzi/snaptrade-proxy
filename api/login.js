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
    const { userId, userSecret, broker } = body; // <-- PRIHVATI broker

    if (!userId || !userSecret) {
      return res.status(400).json({ error: "Missing userId or userSecret" });
    }

    // SnapTrade login (dobijaš redirectURI + sessionId)
    const resp = await snaptrade.authentication.loginSnapTradeUser({ userId, userSecret });
    const payload = resp?.data ?? resp;

    // Ako je stigao broker slug, ubaci ga u redirectURI da se portal otvori direktno za tog brokera
    let redirectURI = payload?.redirectURI;
    if (redirectURI && typeof broker === "string" && broker.trim()) {
      const url = new URL(redirectURI);
      // SnapTrade portal čita query param "broker" (slug npr. TRADING212, ROBINHOOD, WEBULL, ...)
      url.searchParams.set("broker", broker.trim().toUpperCase());
      redirectURI = url.toString();
    }

    return res.status(200).json({
      ok: true,
      redirectURI,             // <-- vraćamo (eventualno) izmenjeni link
      sessionId: payload?.sessionId,
    });
  } catch (err) {
    const { status, data } = pickError(err);
    return res.status(status).json({ ok: false, error: data });
  }
}





