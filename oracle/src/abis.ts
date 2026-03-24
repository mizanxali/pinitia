export const PlaceOracleABI = [
  "function postPlaceData(string placeId, uint256 rating, uint256 reviewCount)",
  "function batchPost(string[] placeIds, uint256[] ratings, uint256[] reviewCounts)",
  "function setOracle(address oracle)",
  "event PlaceDataPosted(string placeId, uint256 rating, uint256 reviewCount)",
];

export const MarketFactoryABI = [
  "function createVelocityMarket(string placeId, uint256 target, uint256 resolveDate, uint256 initialReviewCount) returns (address)",
  "function createRatingMarket(string placeId, uint256 target, uint256 resolveDate) returns (address)",
  "function getMarketsByPlace(string placeId) view returns (address[])",
  "function getActiveMarkets() view returns (address[])",
  "event MarketCreated(address market, string placeId, uint8 marketType, uint256 target, uint256 resolveDate)",
];

export const MarketABI = [
  "function getMarketInfo() view returns (uint8 marketType, string placeId, uint256 target, uint256 resolveDate, uint256 longPool, uint256 shortPool, uint256 initialReviewCount, uint256 finalRating, uint256 finalReviewCount, bool resolved)",
  "function resolve(uint256 finalRating, uint256 finalReviewCount)",
  "event MarketResolved(bool longWins)",
];
