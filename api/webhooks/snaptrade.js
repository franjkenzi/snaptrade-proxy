// /api/webhooks/snaptrade.js

// Pomoćna: bez dependencija, pročitaj sirovi body ako treba
async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req, res) {
  // 1) Dev/test: GET u browseru
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      info: "SnapTrade webhook endpoint radi. Pošalji POST iz SnapTrade dashboarda.",
    });
  }

  // 2) Samo POST za stvarne webhookove
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // 3) Učitaj body – pokušaj obje varijante (parsiran i sirovi)
  let raw = "";
  let body = {};
  try {
    if (req.body && typeof req.body === "object") {
      body = req.body;
      raw = JSON.stringify(req.body);
    } else if (typeof req.body === "string") {
      raw = req.body;
      body = JSON.parse(req.body || "{}");
    } else {
      raw = await readRawBody(req);
      body = JSON.parse(raw || "{}");
    }
  } catch (e) {
    console.error("WEBHOOK_BODY_PARSE_ERROR", { message: e?.message, rawPreview: raw?.slice?.(0, 500) });
    return res.status(400).json({ ok: false, error: "Invalid JSON body" });
  }

  // 4) Provjera tajne (dokument: 'webhookSecret' iz body-ja)
  const incomingSecret = body?.webhookSecret;
  const expectedSecret = process.env.SNAPTRADE_WEBHOOK_SECRET;

  if (!incomingSecret || !expectedSecret || incomingSecret !== expectedSecret) {
    // Log bez otkrivanja vrijednosti
    console.warn("WEBHOOK_UNAUTHORIZED", {
      hasBody: !!raw,
      hasSecretInBody: !!incomingSecret,
      eventType: body?.eventType,
      userId: body?.userId,
    });
    return res.status(401).json({ ok: false, error: "Invalid webhookSecret" });
  }

  // 5) Obrada događaja (dodaj po potrebi)
  console.log("WEBHOOK_OK", {
    eventType: body?.eventType,
    userId: body?.userId,
    accountId: body?.accountId,
    brokerageAuthorizationId: body?.brokerageAuthorizationId,
  });

  // Primaj 2xx da SnapTrade prestane retry
  return res.status(200).json({ ok: true });
}



