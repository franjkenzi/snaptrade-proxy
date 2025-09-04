import snaptrade from "./_client.js";

function safeErr(err) {
  const status = err?.response?.status || 500;
  const data = err?.response?.data;
  const msg =
    (typeof data === "string" && data) ||
    (data && data.message) ||
    err?.message ||
    "Unknown error";
  return { status, message: String(msg) };
}

export default async function handler(req, res) {
  try {
    // UZMI SAMO DATA iz Axios odgovora
    const { data } = await snaptrade.apiStatus.check();

    return res.status(200).json({
      ok: true,
      hasClientId: !!process.env.SNAP_CLIENT_ID,
      hasConsumerKey: !!process.env.SNAP_CONSUMER_KEY,
      status: data, // <-- serializabilno
    });
  } catch (err) {
    const e = safeErr(err);
    return res.status(e.status).json({
      ok: false,
      hasClientId: !!process.env.SNAP_CLIENT_ID,
      hasConsumerKey: !!process.env.SNAP_CONSUMER_KEY,
      error: e.message,
    });
  }
}

