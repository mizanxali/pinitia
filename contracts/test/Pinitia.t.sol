// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Market.sol";
import "../src/MarketFactory.sol";
import "../src/PlaceOracle.sol";

contract PinitiaTest is Test {
    MarketFactory factory;
    PlaceOracle placeOracle;

    address owner = address(this);
    address oracleEOA = address(0xAA);
    address alice = address(0xA1);
    address bob = address(0xB0);

    string placeId = "ChIJTest123";

    function setUp() public {
        // Deploy factory first with a placeholder oracle
        factory = new MarketFactory(address(0));

        // Deploy PlaceOracle pointing to oracleEOA and the factory
        placeOracle = new PlaceOracle(oracleEOA, address(factory));

        // Set factory's oracle to PlaceOracle address (so Markets accept resolve calls from PlaceOracle)
        factory.setOracle(address(placeOracle));
    }

    // --- Velocity market tests ---

    function test_velocityMarket_longWins() public {
        uint256 resolveDate = block.timestamp + 1 days;
        address marketAddr = factory.createVelocityMarket(placeId, 50, resolveDate, 1000);

        Market market = Market(marketAddr);

        // Alice bets long, Bob bets short
        vm.deal(alice, 2 ether);
        vm.deal(bob, 1 ether);

        vm.prank(alice);
        market.betLong{value: 1 ether}();

        vm.prank(bob);
        market.betShort{value: 1 ether}();

        assertEq(market.longPool(), 1 ether);
        assertEq(market.shortPool(), 1 ether);

        // Warp past resolve date
        vm.warp(resolveDate);

        // Oracle posts data: 1060 reviews (gained 60 >= 50 target)
        vm.prank(oracleEOA);
        placeOracle.postPlaceData(placeId, 430, 1060);

        assertTrue(market.resolved());

        // Alice claims winnings
        uint256 balBefore = alice.balance;
        vm.prank(alice);
        market.claim();
        uint256 payout = alice.balance - balBefore;

        // Payout = 1 ether (her bet) + 0.98 ether (loser pool minus 2% fee)
        assertEq(payout, 1.98 ether);
    }

    function test_velocityMarket_shortWins() public {
        uint256 resolveDate = block.timestamp + 1 days;
        address marketAddr = factory.createVelocityMarket(placeId, 50, resolveDate, 1000);
        Market market = Market(marketAddr);

        vm.deal(alice, 1 ether);
        vm.deal(bob, 1 ether);

        vm.prank(alice);
        market.betLong{value: 1 ether}();

        vm.prank(bob);
        market.betShort{value: 1 ether}();

        vm.warp(resolveDate);

        // Only gained 30 reviews, not enough
        vm.prank(oracleEOA);
        placeOracle.postPlaceData(placeId, 430, 1030);

        assertTrue(market.resolved());

        // Bob (short) claims
        uint256 balBefore = bob.balance;
        vm.prank(bob);
        market.claim();
        assertEq(bob.balance - balBefore, 1.98 ether);

        // Alice (long) cannot claim
        vm.prank(alice);
        vm.expectRevert("No winning bet");
        market.claim();
    }

    // --- Rating market tests ---

    function test_ratingMarket_longWins() public {
        uint256 resolveDate = block.timestamp + 1 days;
        // target = 420 (4.2 stars)
        address marketAddr = factory.createRatingMarket(placeId, 420, resolveDate);
        Market market = Market(marketAddr);

        vm.deal(alice, 1 ether);
        vm.deal(bob, 1 ether);

        vm.prank(alice);
        market.betLong{value: 1 ether}();

        vm.prank(bob);
        market.betShort{value: 1 ether}();

        vm.warp(resolveDate);

        // Rating is 4.3 (430) >= 4.2 (420) → long wins
        vm.prank(oracleEOA);
        placeOracle.postPlaceData(placeId, 430, 1000);

        assertTrue(market.resolved());

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        market.claim();
        assertEq(alice.balance - balBefore, 1.98 ether);
    }

    function test_ratingMarket_shortWins() public {
        uint256 resolveDate = block.timestamp + 1 days;
        address marketAddr = factory.createRatingMarket(placeId, 420, resolveDate);
        Market market = Market(marketAddr);

        vm.deal(alice, 1 ether);
        vm.deal(bob, 1 ether);

        vm.prank(alice);
        market.betLong{value: 1 ether}();

        vm.prank(bob);
        market.betShort{value: 1 ether}();

        vm.warp(resolveDate);

        // Rating is 4.1 (410) < 4.2 (420) → short wins
        vm.prank(oracleEOA);
        placeOracle.postPlaceData(placeId, 410, 1000);

        assertTrue(market.resolved());

        uint256 balBefore = bob.balance;
        vm.prank(bob);
        market.claim();
        assertEq(bob.balance - balBefore, 1.98 ether);
    }

    // --- Access control tests ---

    function test_onlyOwnerCanCreateMarkets() public {
        uint256 resolveDate = block.timestamp + 1 days;

        vm.prank(alice);
        vm.expectRevert("Only owner");
        factory.createVelocityMarket(placeId, 50, resolveDate, 1000);
    }

    function test_onlyOracleCanPost() public {
        vm.prank(alice);
        vm.expectRevert("Only oracle");
        placeOracle.postPlaceData(placeId, 430, 1000);
    }

    function test_cannotBetAfterResolveDate() public {
        uint256 resolveDate = block.timestamp + 1 days;
        address marketAddr = factory.createVelocityMarket(placeId, 50, resolveDate, 1000);
        Market market = Market(marketAddr);

        vm.warp(resolveDate);
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert("Betting closed");
        market.betLong{value: 1 ether}();
    }

    function test_cannotResolveEarly() public {
        uint256 resolveDate = block.timestamp + 1 days;
        factory.createVelocityMarket(placeId, 50, resolveDate, 1000);

        // Try resolving before resolveDate — should not resolve any markets
        vm.prank(oracleEOA);
        placeOracle.postPlaceData(placeId, 430, 1060);

        address[] memory markets = factory.getMarketsByPlace(placeId);
        Market market = Market(markets[0]);
        assertFalse(market.resolved());
    }

    function test_cannotClaimTwice() public {
        uint256 resolveDate = block.timestamp + 1 days;
        address marketAddr = factory.createVelocityMarket(placeId, 50, resolveDate, 1000);
        Market market = Market(marketAddr);

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        market.betLong{value: 1 ether}();

        vm.warp(resolveDate);
        vm.prank(oracleEOA);
        placeOracle.postPlaceData(placeId, 430, 1060);

        vm.prank(alice);
        market.claim();

        vm.prank(alice);
        vm.expectRevert("Already claimed");
        market.claim();
    }

    function test_maxMarketsPerPlace() public {
        for (uint256 i = 0; i < 5; i++) {
            factory.createVelocityMarket(placeId, 50, block.timestamp + 1 days + i, 1000);
        }
        vm.expectRevert("Max markets per place reached");
        factory.createVelocityMarket(placeId, 50, block.timestamp + 7 days, 1000);
    }

    // --- View function tests ---

    function test_getUserPosition() public {
        uint256 resolveDate = block.timestamp + 1 days;
        address marketAddr = factory.createVelocityMarket(placeId, 50, resolveDate, 1000);
        Market market = Market(marketAddr);

        vm.deal(alice, 2 ether);
        vm.prank(alice);
        market.betLong{value: 1 ether}();

        (uint256 longAmt, uint256 shortAmt, uint256 claimable) = market.getUserPosition(alice);
        assertEq(longAmt, 1 ether);
        assertEq(shortAmt, 0);
        assertEq(claimable, 0); // not resolved yet
    }

    function test_getMarketInfo() public {
        uint256 resolveDate = block.timestamp + 1 days;
        address marketAddr = factory.createVelocityMarket(placeId, 50, resolveDate, 1000);
        Market market = Market(marketAddr);

        (
            Market.MarketType mType,
            string memory pid,
            uint256 t,
            uint256 rd,
            uint256 lp,
            uint256 sp,
            uint256 irc,
            ,
            ,
            bool res
        ) = market.getMarketInfo();

        assertEq(uint8(mType), uint8(Market.MarketType.VELOCITY));
        assertEq(pid, placeId);
        assertEq(t, 50);
        assertEq(rd, resolveDate);
        assertEq(lp, 0);
        assertEq(sp, 0);
        assertEq(irc, 1000);
        assertFalse(res);
    }

    // --- Batch post test ---

    function test_batchPost() public {
        string memory placeId2 = "ChIJTest456";
        uint256 resolveDate = block.timestamp + 1 days;

        factory.createVelocityMarket(placeId, 50, resolveDate, 1000);
        factory.createRatingMarket(placeId2, 420, resolveDate);

        vm.warp(resolveDate);

        string[] memory ids = new string[](2);
        ids[0] = placeId;
        ids[1] = placeId2;

        uint256[] memory ratings = new uint256[](2);
        ratings[0] = 430;
        ratings[1] = 450;

        uint256[] memory counts = new uint256[](2);
        counts[0] = 1060;
        counts[1] = 500;

        vm.prank(oracleEOA);
        placeOracle.batchPost(ids, ratings, counts);

        address[] memory m1 = factory.getMarketsByPlace(placeId);
        address[] memory m2 = factory.getMarketsByPlace(placeId2);
        assertTrue(Market(m1[0]).resolved());
        assertTrue(Market(m2[0]).resolved());
    }

    // --- Proportional payout test ---

    function test_proportionalPayout() public {
        uint256 resolveDate = block.timestamp + 1 days;
        address marketAddr = factory.createVelocityMarket(placeId, 50, resolveDate, 1000);
        Market market = Market(marketAddr);

        vm.deal(alice, 3 ether);
        vm.deal(bob, 1 ether);

        // Alice bets 3 ETH long, Bob bets 1 ETH short
        vm.prank(alice);
        market.betLong{value: 3 ether}();

        vm.prank(bob);
        market.betShort{value: 1 ether}();

        vm.warp(resolveDate);
        vm.prank(oracleEOA);
        placeOracle.postPlaceData(placeId, 430, 1060);

        // Alice is the only long bettor, gets all of the distributable losers pool
        // Payout = 3 ether + (1 ether * 0.98) = 3.98 ether
        uint256 balBefore = alice.balance;
        vm.prank(alice);
        market.claim();
        assertEq(alice.balance - balBefore, 3.98 ether);
    }
}
