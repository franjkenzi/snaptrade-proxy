// api/_client.js

import pkg from "snaptrade-typescript-sdk";

// CJS paket => sve ide kroz default import pa destrukturiranje
const {
  Configuration,        // << umesto createConfiguration
  APIStatusApi,
  AuthenticationApi,
  AccountsApi,
  HoldingsApi,
} = pkg;

// Napravi konfiguraciju sa env varovima iz Vercel-a
const config = new Configuration({
  consumerKey: process.env.SNAP_CONSUMER_KEY,
  clientId: process.env.SNAP_CLIENT_ID,
});

// Izvezi instancirane API-je
const snaptrade = {
  apiStatus: new APIStatusApi(config),
  authentication: new AuthenticationApi(config),
  accountInformation: new AccountsApi(config),
  holdings: new HoldingsApi(config),
};

export default snaptrade;


