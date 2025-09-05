// api/_client.js

import pkg from "snaptrade-typescript-sdk";

// CommonJS -> iz default importa vadimo potrebne klase/funkcije
const {
  createConfiguration,
  APIStatusApi,
  AuthenticationApi,
  AccountsApi,
  HoldingsApi,
} = pkg;

const config = createConfiguration({
  consumerKey: process.env.SNAP_CONSUMER_KEY,
  clientId: process.env.SNAP_CLIENT_ID,
});

// Jedinstveni “client” koji izvozimo
const snaptrade = {
  apiStatus: new APIStatusApi(config),
  authentication: new AuthenticationApi(config),
  accountInformation: new AccountsApi(config),
  holdings: new HoldingsApi(config),
};

export default snaptrade;


