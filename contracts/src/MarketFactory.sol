// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Market.sol";

contract MarketFactory {
    address public owner;
    address public oracle;

    mapping(string => address[]) private placeMarkets;
    mapping(address => address[]) public userMarkets;
    address[] private allActiveMarkets;

    uint256 public constant MAX_MARKETS_PER_PLACE = 5;

    event MarketCreated(
        address market,
        string placeId,
        Market.MarketType marketType,
        uint256 target,
        uint256 resolveDate
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address _oracle) {
        owner = msg.sender;
        oracle = _oracle;
    }

    function createVelocityMarket(
        string calldata placeId,
        uint256 target,
        uint256 resolveDate,
        uint256 initialReviewCount
    ) external onlyOwner returns (address) {
        return _createMarket(
            Market.MarketType.VELOCITY,
            placeId,
            target,
            resolveDate,
            initialReviewCount
        );
    }

    function createRatingMarket(
        string calldata placeId,
        uint256 target,
        uint256 resolveDate
    ) external onlyOwner returns (address) {
        return _createMarket(
            Market.MarketType.RATING,
            placeId,
            target,
            resolveDate,
            0
        );
    }

    function _createMarket(
        Market.MarketType marketType,
        string calldata placeId,
        uint256 target,
        uint256 resolveDate,
        uint256 initialReviewCount
    ) internal returns (address) {
        require(resolveDate > block.timestamp, "Resolve date must be in the future");
        require(placeMarkets[placeId].length < MAX_MARKETS_PER_PLACE, "Max markets per place reached");

        Market market = new Market(
            marketType,
            placeId,
            target,
            resolveDate,
            initialReviewCount,
            oracle
        );

        address marketAddr = address(market);
        placeMarkets[placeId].push(marketAddr);
        allActiveMarkets.push(marketAddr);

        emit MarketCreated(marketAddr, placeId, marketType, target, resolveDate);
        return marketAddr;
    }

    function registerUserBet(address user, address market) external {
        require(msg.sender == market, "Only market");
        userMarkets[user].push(market);
    }

    function getMarketsByPlace(string calldata placeId) external view returns (address[] memory) {
        return placeMarkets[placeId];
    }

    function getActiveMarkets() external view returns (address[] memory) {
        return allActiveMarkets;
    }

    function setOracle(address _oracle) external onlyOwner {
        oracle = _oracle;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
