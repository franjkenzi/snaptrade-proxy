// /api/webhooks/snaptrade.js
export const config = { api: { bodyParser: false } };

// --- helpers ---
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      try { resolve(JSON.parse(raw || "{}")); } catch { resolve({}); }
    });
  });
}

function pickSecretFromHeaders(req) {
  const h = req.headers || {};
  // različite moguće varijante koje smo viđali
  const direct =
    h["x-webhook-secret"] ||
    h["x-snaptrade-webhook-secret"] ||
    h["x-snaptrade-secret"] ||
    h["webhook-secret"] ||
    h["snaptrade-webhook-secret"];

  if (direct) return String(direct);

  // neke integracije šalju Bearer <secret>
  const auth = h["authorization"];
  if (auth) {
    const m = /^Bearer\s+(.+)$/i.exec(String(auth));
    if (m) return m[1];
  }
  return null;
}

function sanitize(str) {
  if (!str) return null;
  const s = String(str);
  if (s.length <= 4) return s;
  return s.slice(0, 2) + "…" + s.slice(-2);
}

// --- handler ---
export default async function handler(req, res) {
  const expected = String(process.env.SNAPTRADE_WEBHOOK_SECRET || "").trim();
  const provided = String(pickSecretFromHeaders(req) || "").trim();

  // pripremi debug info (bez otkrivanja tajne)
  const debug = {
    method: req.method,
    expectedLen: expected.length,
    providedLen: provided.length,
    providedPreview: sanitize(provided),
    // pokaži sve "x-" headere + sve koji sadrže "secret" (da vidimo šta zaista dolazi)
    seenHeaders: Object.fromEntries(
      Object.entries(req.headers || {}).filter(
        ([k]) => k.startsWith("x-") || k.includes("secret")
      )
    ),
  };

  if (req.method === "GET") {
    // GET koristimo samo za dijagnostiku
    return res.status(200).json({ ok: true, debug });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed", debug });
  }

  if (!expected || !provided || provided !== expected) {
    console.log("SnapTrade webhook auth FAILED", debug);
    return res.status(401).json({ ok: false, error: "invalid_or_missing_secret", debug });
  }

  // OK: pređi na payload
  const event = await readBody(req);
  console.log("SnapTrade webhook OK", {
    type: event?.type,
    id: event?.eventId || event?.id,
  });

  return res.status(200).json({ ok: true });
}


