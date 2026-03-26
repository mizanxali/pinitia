import "dotenv/config";

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

export const config = {
  oraclePrivateKey: required("ORACLE_PRIVATE_KEY"),
  minitiaRpcUrl: required("MINITIA_RPC_URL"),
  placeOracleAddress: required("PLACE_ORACLE_ADDRESS"),
  marketFactoryAddress: required("MARKET_FACTORY_ADDRESS"),
  googlePlacesApiKey: required("GOOGLE_PLACES_API_KEY"),
  databaseUrl: required("DATABASE_URL"),
};
