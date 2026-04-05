import { CHAIN_ID, REST_URL } from "./contracts";

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
    rest: [{ address: REST_URL }],
    indexer: [{ address: "http://localhost:8080" }],
  },
  fees: {
    fee_tokens: [
      {
        denom: "umin",
        fixed_min_gas_price: 0,
        low_gas_price: 0,
        average_gas_price: 0,
        high_gas_price: 0,
      },
    ],
  },
  staking: {
    staking_tokens: [{ denom: "umin" }],
  },
  metadata: {
    minitia: { type: "minimove" },
    is_l1: false,
  },
  native_assets: [
    {
      denom: "umin",
      name: "Min Token",
      symbol: "MIN",
      decimals: 6,
    },
  ],
};
