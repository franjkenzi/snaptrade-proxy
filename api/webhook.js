// api/webhook.js
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const clientId = process.env.SNAP_CLIENT_ID || "";
  const consumerKey = process.env.SNAP_CONSUMER_KEY || "";

  // ---- BASIC AUTH (decode & compare) ----
  const auth = req.headers.authorization || "";
  let basicOK = false;

  if (auth.toLowerCase().startsWith("basic ")) {
    const b64 = auth.slice(6).trim();
    try {
      const decoded = Buffer.from(b64, "base64").toString("utf8"); // "user:pass"
      const i = decoded.indexOf(":");
      const user = decoded.slice(0, i);
      const pass = decoded.slice(i + 1);
      basicOK = user === clientId && pass === consumerKey;
    } catch (_) {
      basicOK = false;
    }
  }

  // ---- HMAC (opciono – pravi eventi) ----
  let hmacOK = false;
  const sigHeader =
    req.headers["x-snaptrade-hmac"] ||
    req.headers["x-snaptrade-signature"] ||
    req.headers["x-hub-signature-256"];

  if (sigHeader) {
    const raw = JSON.stringify(req.body || {});
    const sent = String(sigHeader).replace(/^sha256=/, "").trim();
    const digest = crypto
      .createHmac("sha256", consumerKey)
      .update(raw)
      .digest("hex");
    hmacOK = crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(digest));
  }

  if (!(basicOK || hmacOK)) {
    // za brzi debug možeš na kratko da loguješ auth prisustvo (NE tajne vrednosti!)
    // console.log("no auth", { hasAuth: !!auth, hasSig: !!sigHeader });
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  // OK – potvrdi prijem
  res.status(200).json({ ok: true, received: true });

  // (opciono) u pozadini pokreni sync na određene evente
  // const event = req.body?.type;
  // if (event === "ACCOUNT_SYNC_COMPLETED") { ... }
}


