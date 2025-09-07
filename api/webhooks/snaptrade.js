// /api/webhooks/snaptrade.js
import crypto from "crypto";
import snaptrade from "../api/_client.js"; // isti klijent koji već koristiš

// ---------- pomoćne:
const OK = (res, json = { ok: true }) => res.status(200).json(json);
const BAD = (res, code, data) => res.status(code).json({ ok: false, ...data });

// čitaj raw body (potreban za HMAC)
export const config = { api: { bodyParser: false } };

// verifikacija potpisa (podesi HEADERE prema SnapTrade docs u dashboardu)
function verifySignature(req, raw) {
  const secret = process.env.SNAPTRADE_WEBHOOK_SECRET;
  if (!secret) return true; // ako nisi setovao secret, preskoči (za test)
  const header =
    req.headers["x-snaptrade-signature"] ||
    req.headers["x-signature"] ||
    req.headers["x-hub-signature"]; // prilagodi ako je drugačije
  if (!header) return false;
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header));
  } catch {
    return false;
  }
}

// poziv Bubble Data API
async function bubbleFetch(path, options = {}) {
  const base = process.env.BUBBLE_DATA_API_BASE; // npr: https://tradealyst.bubbleapps.io/version-test/api/1.1/obj
  const token = process.env.BUBBLE_DATA_API_TOKEN;
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(text);
  return json;
}

// pomoćno: nađi/kreiraj ConnectedAccount i upiši status / accounts
async function findOrCreateConnectedAccount({ userId, broker, accountIds }) {
  const type = (process.env.BUBBLE_CONNECTED_ACCOUNT_TYPE || "connectedaccount").toLowerCase();

  // search po userId + broker
  const constraints = encodeURIComponent(JSON.stringify([
    { key: "snaptrade_user_id", constraint_type: "equals", value: userId },
    ...(broker ? [{ key: "broker_name", constraint_type: "equals", value: broker }] : []),
  ]));
  const search = await bubbleFetch(`/${type}?constraints=${constraints}`);
  const results = search?.response?.results || [];

  if (results.length) {
    const id = results[0]._id;
    await bubbleFetch(`/${type}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "connected",
        account_ids: accountIds || [],
        last_error: null,
      }),
    });
    return id;
  }

  const created = await bubbleFetch(`/${type}`, {
    method: "POST",
    body: JSON.stringify({
      snaptrade_user_id: userId,
      broker_name: broker,
      status: "connected",
      account_ids: accountIds || [],
    }),
  });
  return created.id || created._id;
}

export default async function handler(req, res) {
  if (req.method === "GET") return OK(res, { ok: true, ping: "snaptrade webhook" });
  if (req.method !== "POST") return BAD(res, 405, { error: "Method not allowed" });

  try {
    // skupi raw body (za HMAC)
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8");

    if (!verifySignature(req, raw)) return BAD(res, 401, { error: "Invalid signature" });

    const event = JSON.parse(raw || "{}");
    // struktura eventa može varirati; izvući najbitnije:
    const type = event.type || event.event || "";
    const userId = event.userId || event.user_id || event.user?.id || "";
    const broker = event.broker || event.broker_slug || event.institution || "";

    // --- mapiranje najčešćih:
    if (type === "connection.completed" || type === "account.linked") {
      // 1) uzmi userSecret iz Bubble-a (zato smo ga sačuvali i na CA)
      const typeSlug = (process.env.BUBBLE_CONNECTED_ACCOUNT_TYPE || "connectedaccount").toLowerCase();
      const constraints = encodeURIComponent(JSON.stringify([
        { key: "snaptrade_user_id", constraint_type: "equals", value: userId },
      ]));
      const list = await bubbleFetch(`/${typeSlug}?constraints=${constraints}`);
      const any = list?.response?.results?.[0];
      const userSecret = any?.snaptrade_user_secret;

      // 2) povuci naloge sa SnapTrade (da dobijemo account_ids)
      let accountIds = [];
      let guessedBroker = broker || any?.broker_name;
      if (userId && userSecret) {
        const resp = await snaptrade.accountListing.getUserInvestmentAccounts({
          userId, userSecret,
        });
        const accounts = resp?.data?.accounts || resp?.accounts || [];
        accountIds = accounts.map(a => a?.id).filter(Boolean);
        if (!guessedBroker && accounts[0]) {
          guessedBroker = accounts[0]?.institution || accounts[0]?.broker;
        }
      }

      await findOrCreateConnectedAccount({
        userId,
        broker: guessedBroker,
        accountIds,
      });

      return OK(res);
    }

    if (type === "connection.cancelled" || type === "connection.failed" || type.startsWith("error")) {
      const typeSlug = (process.env.BUBBLE_CONNECTED_ACCOUNT_TYPE || "connectedaccount").toLowerCase();
      const constraints = encodeURIComponent(JSON.stringify([
        { key: "snaptrade_user_id", constraint_type: "equals", value: userId },
        ...(broker ? [{ key: "broker_name", constraint_type: "equals", value: broker }] : []),
      ]));
      const list = await bubbleFetch(`/${typeSlug}?constraints=${constraints}`);
      const results = list?.response?.results || [];
      const msg = event.message || event.error || "failed";

      await Promise.all(results.map(obj =>
        bubbleFetch(`/${typeSlug}/${obj._id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "failed", last_error: msg }),
        })
      ));
      return OK(res);
    }

    if (type === "connection.disconnected") {
      const typeSlug = (process.env.BUBBLE_CONNECTED_ACCOUNT_TYPE || "connectedaccount").toLowerCase();
      const constraints = encodeURIComponent(JSON.stringify([
        { key: "snaptrade_user_id", constraint_type: "equals", value: userId },
        ...(broker ? [{ key: "broker_name", constraint_type: "equals", value: broker }] : []),
      ]));
      const list = await bubbleFetch(`/${typeSlug}?constraints=${constraints}`);
      const results = list?.response?.results || [];

      await Promise.all(results.map(obj =>
        bubbleFetch(`/${typeSlug}/${obj._id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "disconnected" }),
        })
      ));
      return OK(res);
    }

    if (type === "sync.completed" || type === "positions.updated") {
      const typeSlug = (process.env.BUBBLE_CONNECTED_ACCOUNT_TYPE || "connectedaccount").toLowerCase();
      const constraints = encodeURIComponent(JSON.stringify([
        { key: "snaptrade_user_id", constraint_type: "equals", value: userId },
      ]));
      const list = await bubbleFetch(`/${typeSlug}?constraints=${constraints}`);
      const results = list?.response?.results || [];

      await Promise.all(results.map(obj =>
        bubbleFetch(`/${typeSlug}/${obj._id}`, {
          method: "PATCH",
          body: JSON.stringify({ last_sync_at: new Date().toISOString(), status: "connected" }),
        })
      ));
      return OK(res);
    }

    // fallback: ignoriši nepoznato
    return OK(res, { ok: true, ignored: type });
  } catch (e) {
    return BAD(res, 500, { error: e?.message || String(e) });
  }
}
