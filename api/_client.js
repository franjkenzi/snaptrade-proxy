// api/_client.js

// ⛳️ UVEK koristi default import – ovo radi i za CJS i za ESM buildove
import SnapTradePkg from "snaptrade-typescript-sdk";

// root pokazuje na pravi objekat (i za CJS i za ESM)
const root = SnapTradePkg?.default ?? SnapTradePkg;

// Helper: uzmi prvu funkciju-konstruktor koja postoji na listi kandidata
const pickCtor = (...candidates) => candidates.find((c) => typeof c === "function");

// --- Configuration (u nekim buildovima je funkcija, u nekim class)
const createConfiguration =
  typeof root?.createConfiguration === "function"
    ? root.createConfiguration
    : null;

const ConfigurationCtor =
  typeof root?.Configuration === "function" ? root.Configuration : null;

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

// --- API klase: probaj na više mogućih lokacija/imenovanja
const APIStatusApiCtor = pickCtor(
  root.APIStatusApi,
  root.ApiStatusApi,
  root?.apis?.APIStatusApi,
  root?.default?.APIStatusApi
);

const AuthenticationApiCtor = pickCtor(
  root.AuthenticationApi,
  root?.apis?.AuthenticationApi,
  root?.default?.AuthenticationApi
);

const AccountsApiCtor = pickCtor(
  root.AccountsApi,
  root.AccountInformationApi,
  root?.apis?.AccountsApi,
  root?.apis?.AccountInformationApi,
  root?.default?.AccountsApi,
  root?.default?.AccountInformationApi
);

const HoldingsApiCtor = pickCtor(
  root.HoldingsApi,
  root.PortfolioHoldingsApi,
  root?.apis?.HoldingsApi,
  root?.apis?.PortfolioHoldingsApi,
  root?.default?.HoldingsApi,
  root?.default?.PortfolioHoldingsApi
);

if (!APIStatusApiCtor || !AuthenticationApiCtor || !AccountsApiCtor || !HoldingsApiCtor) {
  // prikaži šta SDK stvarno eksportuje – da se lakše debuguje ako zatreba
  const exportedKeys = Object.keys(root || {}).join(", ");
  throw new Error(
    `SnapTrade SDK: One or more API classes not found in this build. Exports: [${exportedKeys}]`
  );
}

// --- Instanciraj sve API-je
const snaptrade = {
  apiStatus:          new APIStatusApiCtor(config),
  authentication:     new AuthenticationApiCtor(config),
  accountInformation: new AccountsApiCtor(config),
  holdings:           new HoldingsApiCtor(config),
};

export default snaptrade;





