// /api/webhook.js
import crypto from "crypto";

function parseBasic(req) {
  const auth = req.headers.authorization || "";
  if (!auth.toLowerCase().startsWith("basic ")) return { user: null, pass: null };
  try {
    const raw = Buffer.from(auth.slice(6), "base64").toString("utf8"); // "user:pass"
    const i = raw.indexOf(":");
    const user = i === -1 ? raw : raw.slice(0, i);
    const pass = i === -1 ? "" : raw.slice(i + 1);
    return { user, pass };
  } catch {
    return { user: null, pass: null };
  }
}

function checkBasic(req) {
  const { user, pass } = parseBasic(req);
  return (
    user === process.env.SNAP_CLIENT_ID &&
    pass === process.env.SNAP_CONSUMER_KEY
  );
}

function checkHmac(req, rawBody) {
  const secret = process.env.SNAP_WEBHOOK_SECRET;
  const sig =
    req.headers["x-snaptrade-hmac"] || req.headers["x-hub-signature-256"];
  if (!secret || !sig) return false;

  // NAPOMENA: za pravu HMAC verifikaciju najbolje je koristiti *raw* body.
  // Za test dugme (SnapTrade "Test webhook") HMAC se obično ne šalje.
  const body = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody || {});
  const h = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const expected = sig.startsWith("sha256=") ? `sha256=${h}` : h;

  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const basicOK = checkBasic(req);
  const hmacOK = checkHmac(req, req.body);

  // DOZVOLI: Basic OR HMAC
  if (!(basicOK || hmacOK)) {
    const { user } = parseBasic(req);
    return res.status(401).json({
      ok: false,
      error: "Unauthorized",
      hasAuth: !!req.headers.authorization,
      hasSig: !!(req.headers["x-snaptrade-hmac"] || req.headers["x-hub-signature-256"]),
      basicUser: user,
      expectedClientId: process.env.SNAP_CLIENT_ID,
      consumerKeyLen: (process.env.SNAP_CONSUMER_KEY || "").length,
      basicOK,
      hmacOK,
    });
  }

  // "Test webhook" ping
  if (req.body && req.body.ping) {
    return res.json({ ok: true, pong: true });
  }

  // TODO: ovde obradjuj stvarne evente (connection.updated, transactions.sync.completed, itd.)
  return res.json({ ok: true });
}



