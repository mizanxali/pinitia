export const MarketFactoryABI = [
  {
    type: "function",
    name: "getActiveMarkets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "getMarketsByPlace",
    stateMutability: "view",
    inputs: [{ name: "placeId", type: "string" }],
    outputs: [{ name: "", type: "address[]" }],
  },
] as const;

export const MarketABI = [
  {
    type: "function",
    name: "betLong",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "betShort",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "getMarketInfo",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "marketType", type: "uint8" },
      { name: "placeId", type: "string" },
      { name: "target", type: "uint256" },
      { name: "resolveDate", type: "uint256" },
      { name: "longPool", type: "uint256" },
      { name: "shortPool", type: "uint256" },
      { name: "initialReviewCount", type: "uint256" },
      { name: "finalRating", type: "uint256" },
      { name: "finalReviewCount", type: "uint256" },
      { name: "resolved", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "getUserPosition",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "longAmount", type: "uint256" },
      { name: "shortAmount", type: "uint256" },
      { name: "claimable", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "placeId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "resolveDate",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "resolved",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "longWins",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "longPool",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "shortPool",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "target",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "marketType",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "event",
    name: "BetPlaced",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "isLong", type: "bool", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MarketResolved",
    inputs: [{ name: "longWins", type: "bool", indexed: false }],
  },
  {
    type: "event",
    name: "WinningsClaimed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export const PlaceOracleABI = [
  {
    type: "function",
    name: "postPlaceData",
    stateMutability: "nonpayable",
    inputs: [
      { name: "placeId", type: "string" },
      { name: "rating", type: "uint256" },
      { name: "reviewCount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "batchPost",
    stateMutability: "nonpayable",
    inputs: [
      { name: "placeIds", type: "string[]" },
      { name: "ratings", type: "uint256[]" },
      { name: "reviewCounts", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "PlaceDataPosted",
    inputs: [
      { name: "placeId", type: "string", indexed: false },
      { name: "rating", type: "uint256", indexed: false },
      { name: "reviewCount", type: "uint256", indexed: false },
    ],
  },
] as const;
