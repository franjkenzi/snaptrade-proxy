// api/webhook.js
import crypto from "crypto";

function tSafe(a, b) {
  const A = Buffer.from(a || "");
  const B = Buffer.from(b || "");
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // raw body (za HMAC). Ako je već objekat, stringify je ok za test.
  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});

  // 1) BASIC AUTH (ClientID:ConsumerKey)
  const auth = req.headers["authorization"] || "";
  const expected = "Basic " + Buffer.from(
    `${process.env.SNAP_CLIENT_ID}:${process.env.SNAP_CONSUMER_KEY}`
  ).toString("base64");
  const basicOK = tSafe(auth, expected);

  // 2) HMAC (nekad dolazi kao x-snaptrade-hmac / x-snaptrade-signature / x-hub-signature-256)
  const sigHeader =
    req.headers["x-snaptrade-hmac"] ||
    req.headers["x-snaptrade-signature"] ||
    req.headers["x-hub-signature-256"];
  let hmacOK = false;
  if (sigHeader) {
    const sent = String(sigHeader).replace(/^sha256=/, "").trim();
    const digest = crypto.createHmac("sha256", process.env.SNAP_CONSUMER_KEY).update(raw).digest("hex");
    hmacOK = tSafe(sent, digest);
  }

  if (!(basicOK || hmacOK)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  // OK – primi event
  const event = req.body?.type || "unknown";
  console.log("SnapTrade webhook:", { event, body: req.body });

  // Odmah potvrdi prijem (SnapTrade očekuje 2xx)
  res.status(200).json({ ok: true, received: true });

  // (opciono) fire-and-forget: na određene evente pokreni sync u pozadini
  // if (event === "ACCOUNT_SYNC_COMPLETED") {
  //   fetch(`${process.env.PROXY_BASE_URL}/api/positions?userId=...&userSecret=...&accountId=...`).catch(()=>{});
  // }
}

