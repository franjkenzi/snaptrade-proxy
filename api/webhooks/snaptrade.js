// Vercel (Node) API route
export const config = { api: { bodyParser: false } };

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

function headerSecret(req) {
  const h = req.headers || {};
  // Node ih već spušta na lowercase
  return (
    h["x-webhook-secret"] ||
    h["x-snaptrade-webhook-secret"] ||
    h["x-snaptrade-secret"] ||
    h["webhook-secret"] ||
    h["snaptrade-webhook-secret"]
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const expected = String(process.env.SNAPTRADE_WEBHOOK_SECRET || "").trim();
  const provided = String(headerSecret(req) || "").trim();

  if (!expected || !provided || provided !== expected) {
    // Blaga dijagnostika bez otkrivanja vrednosti
    return res.status(401).json({
      ok: false,
      error: "invalid_or_missing_secret",
      gotHeader: Boolean(provided),
    });
  }

  const event = await readBody(req);

  // --- ovde radi šta želiš sa događajem ---
  // npr. samo potvrdi prijem, a kasnije proširi
  // console.log("SnapTrade event:", event?.type, event?.eventId);

  return res.status(200).json({ ok: true });
}

