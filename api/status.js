import snaptrade from "./_client.js";

export default async function handler(req, res) {
  try {
    const check = await snaptrade.apiStatus.check();
    res.status(200).json({
      ok: true,
      hasClientId: !!process.env.SNAP_CLIENT_ID,
      hasConsumerKey: !!process.env.SNAP_CONSUMER_KEY,
      status: check,
    });
  } catch (err) {
    res.status(err?.response?.status || 500).json({
      ok: false,
      hasClientId: !!process.env.SNAP_CLIENT_ID,
      hasConsumerKey: !!process.env.SNAP_CONSUMER_KEY,
      error: err?.response?.data || err?.message || String(err),
    });
  }
}
