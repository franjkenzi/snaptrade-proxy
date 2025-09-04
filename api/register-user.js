import snaptrade from "./_client.js";

function pickError(err) {
  const status = err?.response?.status ?? 500;
  const data =
    err?.response?.data ?? { message: err?.message ?? "Unknown error" };
  return { status, data };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { userId } = body;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    // <<< KLJUČNA IZMJENA: UZMI SAMO .data >>>
    const resp = await snaptrade.authentication.registerSnapTradeUser({ userId });
    const payload = resp?.data ?? resp; // ako SDK već vraća "data", koristimo to
    return res.status(200).json(payload);
  } catch (err) {
    const { status, data } = pickError(err);
    return res.status(status).json({ error: data });
  }
}

