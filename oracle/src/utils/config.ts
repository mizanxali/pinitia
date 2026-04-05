import "dotenv/config";

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

export const config = {
  moduleAddress: required("MODULE_ADDRESS"), // bech32 deployer address
  moduleName: process.env.MODULE_NAME ?? "prediction_market",
  oracleKeyName: required("ORACLE_KEY_NAME"), // keyring key name (e.g., "gas-station")
  chainId: required("CHAIN_ID"),
  restUrl: required("REST_URL"),
  googlePlacesApiKey: required("GOOGLE_PLACES_API_KEY"),
  databaseUrl: required("DATABASE_URL"),
};
