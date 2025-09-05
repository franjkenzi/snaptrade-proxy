// api/_client.js

// Uvezi ceo modul kao namespace – radi i kad je paket CommonJS.
import * as SDK from "snaptrade-typescript-sdk";

// Napravi config – SDK u nekim buildovima ima class Configuration,
// a u nekim createConfiguration(). Podržimo oba.
let config;
if (typeof SDK.Configuration === "function") {
  config = new SDK.Configuration({
    consumerKey: process.env.SNAP_CONSUMER_KEY,
    clientId: process.env.SNAP_CLIENT_ID,
  });
} else if (typeof SDK.createConfiguration === "function") {
  config = SDK.createConfiguration({
    consumerKey: process.env.SNAP_CONSUMER_KEY,
    clientId: process.env.SNAP_CLIENT_ID,
  });
} else {
  throw new Error("SnapTrade SDK: Configuration helper not found");
}

// Neke verzije imaju malo drugačija imena – obezbedimo fallback.
const APIStatusApiCtor       = SDK.APIStatusApi       || SDK.ApiStatusApi;
const AuthenticationApiCtor  = SDK.AuthenticationApi;
const AccountsApiCtor        = SDK.AccountsApi        || SDK.AccountInformationApi;
const HoldingsApiCtor        = SDK.HoldingsApi        || SDK.PortfolioHoldingsApi;

if (!APIStatusApiCtor || !AuthenticationApiCtor || !AccountsApiCtor || !HoldingsApiCtor) {
  throw new Error("SnapTrade SDK: One or more API classes not found in this build");
}

// Izvezi objekat sa instanciranim API-jevima
const snaptrade = {
  apiStatus:        new APIStatusApiCtor(config),
  authentication:   new AuthenticationApiCtor(config),
  accountInformation: new AccountsApiCtor(config),
  holdings:         new HoldingsApiCtor(config),
};

export default snaptrade;



