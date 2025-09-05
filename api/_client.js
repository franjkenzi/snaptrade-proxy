// api/_client.js

// Uvezemo ceo modul; u CJS buildu sve klase su pod `default`.
import * as SDK from "snaptrade-typescript-sdk";

// radi i za ESM i za CJS varijantu
const root = SDK?.default ?? SDK;

// Napravi configuration (u nekim buildovima je class, u nekim funkcija)
let config;
if (typeof root?.Configuration === "function") {
  config = new root.Configuration({
    consumerKey: process.env.SNAP_CONSUMER_KEY,
    clientId: process.env.SNAP_CLIENT_ID,
  });
} else if (typeof root?.createConfiguration === "function") {
  config = root.createConfiguration({
    consumerKey: process.env.SNAP_CONSUMER_KEY,
    clientId: process.env.SNAP_CLIENT_ID,
  });
} else {
  throw new Error("SnapTrade SDK: Configuration helper not found");
}

// U različitim buildovima nazivi mogu da variraju – dodaj fallback-e
const APIStatusApiCtor      = root.APIStatusApi      || root.ApiStatusApi;
const AuthenticationApiCtor = root.AuthenticationApi;
const AccountsApiCtor       = root.AccountsApi       || root.AccountInformationApi;
const HoldingsApiCtor       = root.HoldingsApi       || root.PortfolioHoldingsApi;

if (!APIStatusApiCtor || !AuthenticationApiCtor || !AccountsApiCtor || !HoldingsApiCtor) {
  throw new Error("SnapTrade SDK: One or more API classes not found in this build");
}

const snaptrade = {
  apiStatus:          new APIStatusApiCtor(config),
  authentication:     new AuthenticationApiCtor(config),
  accountInformation: new AccountsApiCtor(config),
  holdings:           new HoldingsApiCtor(config),
};

export default snaptrade;




