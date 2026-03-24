import { CHAIN_ID, MINITIA_RPC_URL } from "./contracts";

export const pinitiaChain = {
  chain_id: CHAIN_ID,
  chain_name: "pinitia",
  pretty_name: "Pinitia",
  network_type: "testnet" as const,
  bech32_prefix: "init",
  logo_URIs: {
    png: "https://raw.githubusercontent.com/initia-labs/initia-registry/main/testnets/initia/images/initia.png",
    svg: "https://raw.githubusercontent.com/initia-labs/initia-registry/main/testnets/initia/images/initia.svg",
  },
  apis: {
    rpc: [{ address: "http://localhost:26657" }],
    rest: [{ address: "http://localhost:1317" }],
    indexer: [{ address: "http://localhost:8080" }],
    "json-rpc": [{ address: MINITIA_RPC_URL }],
  },
  fees: {
    fee_tokens: [
      {
        denom: "GAS",
        fixed_min_gas_price: 0,
        low_gas_price: 0,
        average_gas_price: 0,
        high_gas_price: 0,
      },
    ],
  },
  staking: {
    staking_tokens: [{ denom: "GAS" }],
  },
  metadata: {
    minitia: { type: "minievm" },
    is_l1: false,
  },
  native_assets: [
    {
      denom: "GAS",
      name: "Gas Token",
      symbol: "GAS",
      decimals: 18,
    },
  ],
};
