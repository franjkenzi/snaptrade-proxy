// /api/_client.js
import SnapTradePkg from "snaptrade-typescript-sdk";

// SDK objekat (CJS/ESM kompatibilno)
const SDK = SnapTradePkg?.default ?? SnapTradePkg;

// Helper – uzmi prvu "klasu" koja postoji
const pickCtor = (...candidates) => candidates.find((c) => typeof c === "function");

// Configuration helper (createConfiguration ili Configuration)
const createConfiguration =
  typeof SDK?.createConfiguration === "function" ? SDK.createConfiguration : null;
const ConfigurationCtor =
  typeof SDK?.Configuration === "function" ? SDK.Configuration : null;

if (!createConfiguration && !ConfigurationCtor) {
  throw new Error("SnapTrade SDK: Configuration helper not found");
}

const config = createConfiguration
  ? createConfiguration({
      consumerKey: process.env.SNAP_CONSUMER_KEY,
      clientId: process.env.SNAP_CLIENT_ID,
    })
  : new ConfigurationCtor({
      consumerKey: process.env.SNAP_CONSUMER_KEY,
      clientId: process.env.SNAP_CLIENT_ID,
    });

// Pokušaji za razne buildove SDK-a (imena klasa variraju)
const ApiStatusApiCtor       = pickCtor(SDK.ApiStatusApi, SDK.APIStatusApi);
const AuthenticationApiCtor  = pickCtor(SDK.AuthenticationApi);
const AccountInformationCtor = pickCtor(
  SDK.AccountInformationApi,
  SDK.AccountsApi,
  SDK.AccountInformationApiGenerated
);
// >>> NOVO: Transactions (u ovom buildu je to klasa za activities/transactions)
const TransactionsApiCtor    = pickCtor(
  SDK.TransactionsApi,
  SDK.TransactionApi,
  SDK.AccountTransactionsApi,
  SDK.ActivitiesApi,           // fallback, ako je build ovo nazvao ActivitiesApi
  SDK.AccountActivitiesApi     // još jedan mogući naziv
);

if (!ApiStatusApiCtor || !AuthenticationApiCtor || !AccountInformationCtor) {
  const keys = Object.keys(SDK || {}).join(", ");
  throw new Error(
    `SnapTrade SDK: One or more API classes not found in this build. Exports: [${keys}]`
  );
}

// Napravi instancirane klijente
const snaptrade = {
  apiStatus:          new ApiStatusApiCtor(config),
  authentication:     new AuthenticationApiCtor(config),
  accountInformation: new AccountInformationCtor(config),
  // Ako Transactions klasa postoji u ovom buildu – koristi je
  ...(TransactionsApiCtor ? { transactions: new TransactionsApiCtor(config) } : {}),
};

export default snaptrade;







