// api/_client.js
import SnapTradePkg from "snaptrade-typescript-sdk";

// SDK objekat (radi i za CJS i za ESM build)
const SDK = SnapTradePkg?.default ?? SnapTradePkg;

// helper – izaberi prvu “klasu” koja postoji
const pickCtor = (...candidates) => candidates.find((c) => typeof c === "function");

// Configuration može biti funkcija (createConfiguration) ili klasa (Configuration)
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

// U ovom buildu imamo ove klase:
const ApiStatusApiCtor         = pickCtor(SDK.ApiStatusApi, SDK.APIStatusApi);
const AuthenticationApiCtor    = pickCtor(SDK.AuthenticationApi);
const AccountInformationCtor   = pickCtor(
  SDK.AccountInformationApi,
  SDK.AccountsApi,                   // fallback ako je starije ime
  SDK.AccountInformationApiGenerated // fallback ako build eksportuje “Generated”
);

if (!ApiStatusApiCtor || !AuthenticationApiCtor || !AccountInformationCtor) {
  const keys = Object.keys(SDK || {}).join(", ");
  throw new Error(
    `SnapTrade SDK: One or more API classes not found in this build. Exports: [${keys}]`
  );
}

const snaptrade = {
  apiStatus:          new ApiStatusApiCtor(config),
  authentication:     new AuthenticationApiCtor(config),
  accountInformation: new AccountInformationCtor(config),
  // NEMA holdings ovde – u ovom buildu holdings rute su u AccountInformationApi
};

export default snaptrade;






