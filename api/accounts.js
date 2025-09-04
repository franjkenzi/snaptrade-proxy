// /api/accounts.js
import snaptrade from "./_client.js";

function pickError(err) {
  const status = err?.response?.status ?? 500;
  const data = err?.response?.data ?? { message: err?.message ?? "Unknown error" };
  return { status, data };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId, userSecret } = req.query;
    if (!userId || !userSecret) {
      return res.status(400).json({ ok: false, error: "Missing userId or userSecret" });
    }

    // ⚠️ PRAVILAN API: AccountInformation → listUserAccounts
    const api =
      snaptrade.accountInformation ||
      snaptrade.AccountInformation ||
      snaptrade.accounts ||
      null;

    if (!api || typeof api.listUserAccounts !== "function") {
      throw new Error("SDK mismatch: accountInformation.listUserAccounts not found");
    }

    const resp = await api.listUserAccounts({ userId, userSecret });

    // Neki SDK buildovi vraćaju { data }, neki direktno niz:
    const accounts = Array.isArray(resp) ? resp : (resp?.data ?? resp ?? []);
    return res.status(200).json({ ok: true, accounts });
  } catch (err) {
    const { status, data } = pickError(err);
    return res.status(status).json({ ok: false, error: data });
  }
}



