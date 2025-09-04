import snaptrade from "./_client.js";

// izvuče najkorisniju poruku iz greške
function pickError(err) {
  const status = err?.response?.status ?? 500;
  const data =
    err?.response?.data?.message ??
    err?.response?.data ??
    err?.message ??
    "Unknown error";
  return { status, message: data };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { userId } = body;

    if (!userId) {
      return res.status(200).json({ ok: false, error: "Missing userId" });
    }

    // SnapTrade poziv
    const resp = await snaptrade.authentication.registerSnapTradeUser({ userId });

    // vraćamo samo "data", bez axios cirkularnih objekata
    const payload = resp?.data ?? resp;
    return res.status(200).json({ ok: true, data: payload });
  } catch (err) {
    const { status, message } = pickError(err);

    // idempotentno: ako API javi da korisnik već postoji, tretiraj kao uspeh
    if (status === 400 && /exist/i.test(String(message))) {
      return res.status(200).json({ ok: true, alreadyRegistered: true });
    }

    // u svim drugim slučajevima i dalje 200 (da Bubble Initialize uspe), ali uz ok:false
    return res.status(200).json({ ok: false, error: String(message), status });
  }
}


