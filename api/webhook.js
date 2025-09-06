// api/webhook.js
import crypto from "crypto";

export const config = {
  api: { bodyParser: false }, // treba raw body za HMAC
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function timingSafeEqualHex(a, b) {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    return (
      ba.length === bb.length &&
      crypto.timingSafeEqual(ba, bb)
    );
  } catch (_) {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const secret = process.env.SNAP_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(500).json({ ok: false, error: "Missing webhook secret" });
  }

  const raw = await readRawBody(req);

  // <-- proveri u dokumentaciji tačan naziv headera.
  // Najčešće bude nešto tipa 'x-snaptrade-hmac-sha256' ili slično.
  const sigHeader =
    req.headers["x-snaptrade-hmac-sha256"] ||
    req.headers["x-signature"] ||
    req.headers["x-hub-signature-256"] ||
    "";

  const computed = crypto
    .createHmac("sha256", secret)
    .update(raw)
    .digest("hex");

  if (!timingSafeEqualHex(sigHeader, computed)) {
    // Ako potpis ne prođe, ne obrađuj poziv
    return res.status(401).json({ ok: false, error: "Invalid signature" });
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch (e) {
    return res.status(400).json({ ok: false, error: "Invalid JSON" });
  }

  // 1) Log – da vidiš tačno koje tipove eventa dobijamo i kakav je payload
  console.log("SNAPTRADE_WEBHOOK_EVENT", {
    type: event?.type || event?.event || "unknown",
    keys: Object.keys(event || {}),
    preview: JSON.stringify(event).slice(0, 500),
  });

  // 2) Pošalji u Bubble backend workflow
  //    Kreiraj u Bubble-u API Workflow PRIHVATNI endpoint, i stavi ga u env:
  //    BUBBLE_WEBHOOK_URL, npr: https://appname.bubbleapps.io/version-test/api/1.1/wf/snaptrade_webhook
  const bubbleUrl = process.env.BUBBLE_WEBHOOK_URL; // <-- dodaj u Vercel env
  if (bubbleUrl) {
    try {
      await fetch(bubbleUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: raw, // prosledi ceo originalan event
      });
    } catch (err) {
      console.error("Bubble forward failed:", err);
      // i dalje vraćamo 200 da SnapTrade ne retrajuje bezveze
    }
  }

  // Vrati brzo 200 (SnapTrade očekuje brz odgovor)
  return res.status(200).json({ ok: true });
}
