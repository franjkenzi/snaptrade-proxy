// api/_client.js
import Snaptrade from "snaptrade-typescript-sdk";

const snaptrade = new Snaptrade({
  clientId: process.env.SNAP_CLIENT_ID,
  consumerKey: process.env.SNAP_CONSUMER_KEY,
});

export default snaptrade;


