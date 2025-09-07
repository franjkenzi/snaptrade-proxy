// /api/_client.js
// Koristi isti paket koji već imaš u package.json
import * as SnapTradePkg from "snaptrade-typescript-sdk";
// Ako koristiš scoped paket, promeni na:
// import * as SnapTradePkg from "@snaptrade/snaptrade-typescript-sdk";

const SDK = SnapTradePkg?.default ?? SnapTradePkg;
const pickCtor = (...candidates) => candidates.find((c) => typeof c === "function");

// --- Konfiguracija (radi i za različite buildove)
const makeConfig = () => {
  if (typeof SDK?.createConfiguration === "function") {
    return SDK.createConfiguration({
      consumerKey: process.env.SNAP_CONSUMER_KEY,
      clientId: process.env.SNAP_CLIENT_ID,
    });
  }
  if (typeof SDK?.Configuration === "function") {
    return new SDK.Configuration({
      consumerKey: process.env.SNAP_CONSUMER_KEY,
      clientId: process.env.SNAP_CLIENT_ID,
    });
  }
  throw new Error("SnapTrade SDK: Configuration helper not found");
};

const config = makeConfig();

// --- Core moduli (mora da postoji)
const ApiStatusApiCtor = pickCtor(SDK.ApiStatusApi, SDK.APIStatusApi);
const AuthenticationApiCtor = pickCtor(SDK.AuthenticationApi);
const AccountInformationCtor = pickCtor(
  SDK.AccountInformationApi,
  SDK.AccountsApi,
  SDK.AccountInformationApiGenerated
);

if (!ApiStatusApiCtor || !AuthenticationApiCtor || !AccountInformationCtor) {
  const keys = Object.keys(SDK || {}).join(", ");
  throw new Error(`SnapTrade SDK: One or more core API classes not found. Exports: [${keys}]`);
}

// --- Activities / Transactions moduli (nazivi variraju po verziji – hvatamo više)
const ActivitiesCtor = pickCtor(
  SDK.ActivitiesApi,
  SDK.AccountActivitiesApi,
  SDK.AccountActivityApi,
  SDK.ActivityApi,
  SDK.ActivitiesApiGenerated
);

const TransactionsCtor = pickCtor(
  SDK.TransactionsAndReportingApi,
  SDK.TransactionsApi,
  SDK.ReportingApi,
  SDK.TransactionsAndReportingApiGenerated
);

// --- Sastavi klijent
const snaptrade = {
  apiStatus: new ApiStatusApiCtor(config),
  authentication: new AuthenticationApiCtor(config),
  accountInformation: new AccountInformationCtor(config),
};

// Dodaj opcione grane samo ako postoje u ovom buildu
if (ActivitiesCtor)      snaptrade.accountActivities = new ActivitiesCtor(config);
if (TransactionsCtor)    snaptrade.transactions      = new TransactionsCtor(config);

export default snaptrade;







