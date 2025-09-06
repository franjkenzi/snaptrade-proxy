// /api/webhook.js
import crypto from "crypto";

/* ----------------------- helpers ----------------------- */

function parseBasic(req) {
  const auth = req.headers.authorization || "";
  if (!auth.toLowerCase().startsWith("basic ")) return { user: null, pass: null };
  try {
    const raw = Buffer.from(auth.slice(6), "base64").toString("utf8"); // "user:pass"
    const i = raw.indexOf(":");
    const user = i === -1 ? raw : raw.slice(0, i);
    const pass = i === -1 ? ""  : raw.slice(i + 1);
    return { user, pass };
  } catch {
    return { user: null, pass: null };
  }
}

function checkBasic(req) {
  const { user, pass } = parseBasic(req);
  const envId  = (process.env.SNAP_CLIENT_ID || "").trim();
  const envKey = (process.env.SNAP_CONSUMER_KEY || "").trim();

  if (!user || pass == null) return false;
  // trim i header i env da uklonimo skrivene whitespace/newline
  return user.trim() === envId && pass.trim() === envKey;
}

async function readRawBody(req) {
  // pokušaj da pročitaš sirov body sa stream-a
  // (ako je već parsiran, vrati prazan string pa ćemo napraviti fallback)
  try {
    if (req.readableEnded || req.complete) return "";
    return await new Promise((resolve, reject) => {
      let data = "";
      req.setEncoding("utf8");
      req.on("data", (c) => (data += c));
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });
  } catch {
    return "";
  }
}

function verifyHmac(raw, req) {
  const secret = (process.env.SNAP_WEBHOOK_SECRET || "").trim();
  if (!secret) return false;

  let provided =
    req.headers["x-snaptrade-hmac"] ||
    req.headers["x-hub-signature-256"] ||
    "";

  if (!provided) return false;
  provided = String(provided);
  if (provided.startsWith("sha256=")) provided = provided.slice(7);

  const digest = crypto
    .createHmac("sha256", secret)
    .update(raw || "", "utf8")
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest, "hex"),
      Buffer.from(provided, "hex")
    );
  } catch {
    return digest === provided;
  }
}

/* ----------------------- handler ----------------------- */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // 1) sirovi body (za HMAC)
  let raw = await readRawBody(req);

  // 2) objekat za rad (ako sirov nije dostupan, probaj req.body ili fallback)
  let body = {};
  try {
    if (raw) {
      body = raw ? JSON.parse(raw) : {};
    } else {
      body =
        typeof req.body === "string"
          ? JSON.parse(req.body || "{}")
          : req.body || {};
      raw = JSON.stringify(body ?? {});
    }
  } catch {
    // ako JSON parse fail-uje, tretiraj kao prazan
    body = {};
    raw = raw || "{}";
  }

  const basicOK = checkBasic(req);
  const hmacOK = verifyHmac(raw, req);

  // dozvoli ako bar jedan prolazi (Basic ili HMAC)
  if (!basicOK && !hmacOK) {
    const { user } = parseBasic(req);
    return res.status(401).json({
      ok: false,
      error: "Unauthorized",
      hasAuth: !!req.headers.authorization,
      hasSig:
        !!req.headers["x-snaptrade-hmac"] ||
        !!req.headers["x-hub-signature-256"],
      basicUser: user || null,
      expectedClientId: (process.env.SNAP_CLIENT_ID || "").trim(),
      consumerKeyLen: (process.env.SNAP_CONSUMER_KEY || "").trim().length,
      basicOK,
      hmacOK,
    });
  }

  // ping/pong za jednostavan test
  if (body && body.ping) {
    return res.status(200).json({
      ok: true,
      pong: true,
      via: basicOK ? "basic" : "hmac",
    });
  }

  // ovde možeš da obradiš realne evente iz SnapTrade-a (holdings/transactions sync, itd.)
  // primer bezbednog loga:
  // console.log("SnapTrade webhook event:", { type: body?.type, accountId: body?.accountId });

  return res.status(200).json({
    ok: true,
    received: body,
    via: basicOK ? "basic" : "hmac",
  });
}




