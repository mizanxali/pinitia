export const PlaceOracleABI = [
  "function postPlaceData(string placeId, uint256 rating, uint256 reviewCount)",
  "function batchPost(string[] placeIds, uint256[] ratings, uint256[] reviewCounts)",
  "function setOracle(address oracle)",
  "function forceResolveMarket(address market, uint256 rating, uint256 reviewCount)",
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
  "function getUserPosition(address user) view returns (uint256 longAmount, uint256 shortAmount, uint256 claimable)",
  "function betLong() payable",
  "function betShort() payable",
  "function resolve(uint256 finalRating, uint256 finalReviewCount)",
  "function claim()",
  "function placeId() view returns (string)",
  "function resolveDate() view returns (uint256)",
  "function resolved() view returns (bool)",
  "function longWins() view returns (bool)",
  "function longPool() view returns (uint256)",
  "function shortPool() view returns (uint256)",
  "function target() view returns (uint256)",
  "function marketType() view returns (uint8)",
  "event BetPlaced(address indexed user, bool isLong, uint256 amount)",
  "event MarketResolved(bool longWins)",
  "event WinningsClaimed(address indexed user, uint256 amount)",
];
