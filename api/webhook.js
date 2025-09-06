// api/webhook.js
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const clientId = process.env.SNAP_CLIENT_ID;       // npr. KOVAC-DIG-TEST-EXJOH
  const consumerKey = process.env.SNAP_CONSUMER_KEY; // tajni key iz SnapTrade-a

  // ---------- BASIC AUTH PROVERA ----------
  let basicOK = false;
  let basicUser = null;
  const auth = req.headers.authorization || "";
  if (auth.toLowerCase().startsWith("basic ")) {
    try {
      const raw = Buffer.from(auth.slice(6), "base64").toString("utf8");
      const [user, pass] = raw.split(":");
      basicUser = user || null;
      if (user === clientId && pass === consumerKey) {
        basicOK = true;
      }
    } catch (_) {}
  }

  // ---------- (OPCIONO) HMAC PROVERA ----------
  let hmacOK = false;
  const sig =
    req.headers["x-snaptrade-hmac"] ||
    req.headers["x-snaptrade-signature"] ||
    req.headers["x-hub-signature-256"];

  if (sig) {
    try {
      const rawBody =
        typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
      const mac = crypto
        .createHmac("sha256", consumerKey || "")
        .update(rawBody)
        .digest("hex");
      const cleanSig = String(sig).replace(/^sha256=/i, "");
      hmacOK = crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(cleanSig));
    } catch (_) {}
  }

  // ---------- AKO NIJE PROŠLA AUTORIZACIJA, VRATI DEBUG 401 ----------
  if (!(basicOK || hmacOK)) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized",
      hasAuth: !!auth,
      hasSig: !!sig,
      basicUser,                          // šta je stiglo kao Basic username
      expectedClientId: clientId || null, // šta očekujemo
      consumerKeyLen: (consumerKey || "").length // da li je key učitan iz env-a
    });
  }

  // ---------- SVE OK ----------
  return res.status(200).json({ ok: true, received: true, basicOK, hmacOK });
}


