// /api/webhooks/snaptrade.js
import crypto from "crypto";

export const config = { api: { bodyParser: false } };

// ---- helpers ----
function readRawBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

// Vrati potpis iz headera (pokrivamo više mogućih naziva + Bearer fallback)
function getIncomingSignature(req) {
  const h = req.headers || {};

  // Najčešća imena koja koriste provajderi:
  return (
    h["x-snaptrade-hmac-sha256"] ||
    h["snaptrade-hmac-sha256"] ||
    h["x-snaptrade-signature"] ||
    h["snaptrade-signature"] ||
    // fallback: Authorization: Bearer <signature>
    (typeof h.authorization === "string" &&
      /^Bearer\s+(.+)$/i.exec(h.authorization)?.[1]) ||
    null
  );
}

// Sigurno poređenje (sprečava timing napade)
function safeEqual(a, b) {
  const A = Buffer.from(String(a) || "", "utf8");
  const B = Buffer.from(String(b) || "", "utf8");
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const secret = (process.env.SNAPTRADE_WEBHOOK_SECRET || "").trim();
  if (!secret) {
    // Bez tajne ne možemo verifikovati
    return res.status(500).json({ ok: false, error: "Missing server secret" });
  }

  // 1) Pročitaj sirovo telo (VAŽNO! za ispravan HMAC)
  const rawBody = await readRawBody(req);

  // 2) Pokupi potpis iz headera
  const incomingSig = getIncomingSignature(req);

  // 3) DEV fallback (dozvoli i “X-Webhook-Secret: <secret>” za ručni test)
  const devHeader = req.headers["x-webhook-secret"];
  if (!incomingSig && devHeader && String(devHeader).trim() === secret) {
    // ručni test bez HMAC-a
  } else {
    // 4) Izračunaj HMAC u oba formata (hex i base64), pa uporedi
    const hmac = crypto.createHmac("sha256", secret).update(rawBody);

    const expectedHex = hmac.digest("hex");
    // moramo ponovo jer je stream potrošen posle digest-a
    const expectedB64 = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");

    if (!incomingSig || !(safeEqual(incomingSig, expectedHex) || safeEqual(incomingSig, expectedB64))) {
      return res.status(401).json({
        ok: false,
        error: "invalid_signature",
        // ako baš zapne, uključi kratko debug pa isključi u produkciji:
        // debug: { incomingSig, expectedHex, expectedB64 }
      });
    }
  }

  // 5) Kada je verifikacija prošla, parsiraj telo i obradi event
  let payload = {};
  try {
    payload = JSON.parse(rawBody.toString("utf8") || "{}");
  } catch {
    // ok, ostaje {}
  }

  // Primer: izvuci osnovno
  const type = payload?.type || payload?.event_type || null;
  const id = payload?.eventId || payload?.id || null;

  // TODO: ovde mapiraj evente na tvoje radnje (Bubble Data API, itd.)
  // npr:
  // if (type === "connection.completed" || type === "account.linked") { ... }
  // if (type === "connection.failed" || type === "connection.cancelled") { ... }
  // if (type === "connection.disconnected") { ... }
  // if (type === "sync.completed" || type === "positions.updated") { ... }

  return res.status(200).json({ ok: true });
}



