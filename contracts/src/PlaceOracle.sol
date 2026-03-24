// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MarketFactory.sol";
import "./Market.sol";

contract PlaceOracle {
    address public owner;
    address public oracle;
    MarketFactory public factory;

    event PlaceDataPosted(string placeId, uint256 rating, uint256 reviewCount);

    modifier onlyOracle() {
        require(msg.sender == oracle, "Only oracle");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address _oracle, address _factory) {
        owner = msg.sender;
        oracle = _oracle;
        factory = MarketFactory(_factory);
    }

    function postPlaceData(
        string calldata placeId,
        uint256 rating,
        uint256 reviewCount
    ) external onlyOracle {
        emit PlaceDataPosted(placeId, rating, reviewCount);
        _resolveEligible(placeId, rating, reviewCount);
    }

    function batchPost(
        string[] calldata placeIds,
        uint256[] calldata ratings,
        uint256[] calldata reviewCounts
    ) external onlyOracle {
        require(
            placeIds.length == ratings.length && ratings.length == reviewCounts.length,
            "Array length mismatch"
        );
        for (uint256 i = 0; i < placeIds.length; i++) {
            emit PlaceDataPosted(placeIds[i], ratings[i], reviewCounts[i]);
            _resolveEligible(placeIds[i], ratings[i], reviewCounts[i]);
        }
    }

    function _resolveEligible(
        string calldata placeId,
        uint256 rating,
        uint256 reviewCount
    ) internal {
        address[] memory markets = factory.getMarketsByPlace(placeId);
        for (uint256 i = 0; i < markets.length; i++) {
            Market market = Market(markets[i]);
            if (!market.resolved() && block.timestamp >= market.resolveDate()) {
                market.resolve(rating, reviewCount);
            }
        }
    }

    function setOracle(address _oracle) external onlyOwner {
        oracle = _oracle;
    }

    function setFactory(address _factory) external onlyOwner {
        factory = MarketFactory(_factory);
    }
}
