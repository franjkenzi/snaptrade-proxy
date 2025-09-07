// /api/_client.js
import SnapTradePkg from "snaptrade-typescript-sdk";

const SDK = SnapTradePkg?.default ?? SnapTradePkg;
const pickCtor = (...candidates) => candidates.find((c) => typeof c === "function");

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

// Core
const ApiStatusApiCtor       = pickCtor(SDK.ApiStatusApi, SDK.APIStatusApi);
const AuthenticationApiCtor  = pickCtor(SDK.AuthenticationApi);
const AccountInformationCtor = pickCtor(
  SDK.AccountInformationApi,
  SDK.AccountsApi,
  SDK.AccountInformationApiGenerated
);

// >>> Transactions / Activities (više mogućih naziva po build-u)
const TransactionsApiCtor = pickCtor(
  SDK.TransactionsAndReportingApi,
  SDK.TransactionsAndReportingApiGenerated,
  SDK.TransactionsApi,
  SDK.TransactionApi,
  SDK.AccountTransactionsApi,
  SDK.ActivitiesApi,
  SDK.AccountActivitiesApi
);

if (!ApiStatusApiCtor || !AuthenticationApiCtor || !AccountInformationCtor) {
  const keys = Object.keys(SDK || {}).join(", ");
  throw new Error(`SnapTrade SDK: One or more API classes not found in this build. Exports: [${keys}]`);
}

const snaptrade = {
  apiStatus:          new ApiStatusApiCtor(config),
  authentication:     new AuthenticationApiCtor(config),
  accountInformation: new AccountInformationCtor(config),
  ...(TransactionsApiCtor ? { transactions: new TransactionsApiCtor(config) } : {}),
};

export default snaptrade;







