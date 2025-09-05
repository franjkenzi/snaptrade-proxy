// api/_client.js
import {
  createConfiguration,
  APIStatusApi,
  AuthenticationApi,
  AccountsApi,
  HoldingsApi, // 👈 DODATO
} from "snaptrade-typescript-sdk"; // koristi isti paket kao i do sada kod tebe

const config = createConfiguration({
  consumerKey: process.env.SNAP_CONSUMER_KEY,
  clientId: process.env.SNAP_CLIENT_ID,
});

const snaptrade = {
  apiStatus: new APIStatusApi(config),
  authentication: new AuthenticationApi(config),
  accountInformation: new AccountsApi(config),
  holdings: new HoldingsApi(config), // 👈 DODATO
};

export default snaptrade;
