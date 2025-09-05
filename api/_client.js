// api/_client.js
// SnapTrade SDK je CommonJS -> koristi default import
import pkg from "snaptrade-typescript-sdk";

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

// Napravi instancirane API-e i izvezi ih pod jednim objektom
const snaptrade = {
  apiStatus: new APIStatusApi(config),
  authentication: new AuthenticationApi(config),
  accountInformation: new AccountsApi(config),
  holdings: new HoldingsApi(config),
};

export default snaptrade;

