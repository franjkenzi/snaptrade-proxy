import snaptrade from "./_client.js";

function safeErr(err) {
  // pokušaj da izvučeš čitljivu poruku
  const status = err?.response?.status;
  const data = err?.response?.data;
  const msg =
    (typeof data === "string" && data) ||
    (data && data.message) ||
    err?.message ||
    "Unknown error";

  return { status: status || 500, message: String(msg) };
}

export default async function handler(req, res) {
  try {
    const check = await snaptrade.apiStatus.check();
    return res.status(200).json({
      ok: true,
      hasClientId: !!process.env.SNAP_CLIENT_ID,
      hasConsumerKey: !!process.env.SNAP_CONSUMER_KEY,
      status: check,
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

