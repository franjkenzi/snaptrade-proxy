// /api/webhooks/snaptrade.js
import crypto from "crypto";

// Ako koristiš Next/Vercel Node funkcije, ovo gasi default parser,
// kako bismo dobili sirov body (bitno za HMAC).
export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", chunk => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const secret = process.env.SNAPTRADE_WEBHOOK_SECRET;
  const raw = await readRawBody(req);

  // Normalizuj headere (lowercase)
  const headers = Object.fromEntries(
    Object.entries(req.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
  );

  // Probaj sve uobičajene varijante headera koje provajderi koriste
  const signature =
    headers["x-snaptrade-signature"] ||
    headers["snaptrade-signature"] ||
    headers["x-snaptrade-hmac"] ||
    headers["x-webhook-signature"] ||
    headers["x-snaptrade-secret"] ||
    headers["x-webhook-secret"];

  // >>> DEBUG: videćemo tačno koje headere šalju (bez raw secreta)
  console.log("snaptrade webhook headers (keys):", Object.keys(headers));
  console.log("received signature header name/value preview:", signature?.toString().slice(0, 12));

  let verified = false;

  // 1) Plain secret (neki servisi šalju secret direktno u headeru)
  if (signature && secret && signature === secret) {
    verified = true;
    console.log("Webhook verified via plain secret header.");
  }

  // 2) HMAC-SHA256(rawBody, secret) u hex
  if (!verified && signature && secret) {
    try {
      const h = crypto.createHmac("sha256", secret).update(raw).digest("hex");
      if (signature === h) {
        verified = true;
        console.log("Webhook verified via HMAC-SHA256.");
      }
    } catch (e) {
      console.error("HMAC verify error:", e);
    }
  }

  // PRIVREMENO: možeš dozvoliti prolaz bez verifikacije kad postaviš env flag
  // ALLOW_INSECURE_WEBHOOK=1 (samo za test, posle ugasi!)
  const allowInsecure = process.env.ALLOW_INSECURE_WEBHOOK === "1";
  if (!verified && !allowInsecure) {
    return res.status(401).json({ ok: false, reason: "bad signature" });
  }

  // Parse payload (ako nije JSON, samo ostavi kao raw)
  let payload = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = { raw };
  }

  console.log("snaptrade webhook payload preview:", payload?.type || Object.keys(payload || {}));

  // TODO: ovde radiš svoju logiku: upiši status u bazu itd.
  return res.status(200).json({ ok: true });
}

