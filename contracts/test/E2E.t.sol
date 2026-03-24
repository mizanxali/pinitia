// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Market.sol";
import "../src/MarketFactory.sol";
import "../src/PlaceOracle.sol";

/**
 * End-to-end integration test simulating the real deploy + oracle pipeline.
 * Mirrors Deploy.s.sol wiring: deployer = owner = oracle EOA.
 */
contract E2ETest is Test {
    MarketFactory factory;
    PlaceOracle placeOracle;

    // Simulates the single deployer/owner/oracle key (as in Deploy.s.sol)
    address deployer = address(this);

    address alice = address(0xA1);
    address bob = address(0xB0);
    address carol = address(0xC0);

    string venue1 = "ChIJ-a6pEckVrjsRVXIhjVbVQ5o";
    string venue2 = "ChIJN1t_tDeuEmsRUsoyG83frY4";

    function setUp() public {
        // Replicate Deploy.s.sol: deployer deploys both, wires oracle
        factory = new MarketFactory(deployer); // temp oracle = deployer
        placeOracle = new PlaceOracle(deployer, address(factory));
        factory.setOracle(address(placeOracle)); // now markets get PlaceOracle as oracle
    }

    /// Full lifecycle: seed markets → bet → oracle resolves → claim
    function test_fullLifecycle() public {
        uint256 velocityResolve = block.timestamp + 7 days;
        uint256 ratingResolve = block.timestamp + 14 days;

        // --- SEED: create markets (mirrors oracle/seed.ts) ---
        address velMarket = factory.createVelocityMarket(venue1, 50, velocityResolve, 1000);
        address ratMarket = factory.createRatingMarket(venue1, 420, ratingResolve);

        // Verify factory indexing
        address[] memory v1Markets = factory.getMarketsByPlace(venue1);
        assertEq(v1Markets.length, 2);
        address[] memory active = factory.getActiveMarkets();
        assertEq(active.length, 2);

        // --- BETTING PHASE ---
        vm.deal(alice, 5 ether);
        vm.deal(bob, 5 ether);
        vm.deal(carol, 5 ether);

        // Alice and Carol go long on velocity, Bob goes short
        vm.prank(alice);
        Market(velMarket).betLong{value: 2 ether}();
        vm.prank(carol);
        Market(velMarket).betLong{value: 1 ether}();
        vm.prank(bob);
        Market(velMarket).betShort{value: 3 ether}();

        // Bob goes long on rating, Alice goes short
        vm.prank(bob);
        Market(ratMarket).betLong{value: 2 ether}();
        vm.prank(alice);
        Market(ratMarket).betShort{value: 1 ether}();

        assertEq(Market(velMarket).longPool(), 3 ether);
        assertEq(Market(velMarket).shortPool(), 3 ether);
        assertEq(Market(ratMarket).longPool(), 2 ether);
        assertEq(Market(ratMarket).shortPool(), 1 ether);

        // --- ORACLE RESOLVES VELOCITY MARKET ---
        vm.warp(velocityResolve);

        // Oracle posts: 1060 reviews (gained 60 >= 50) → long wins
        placeOracle.postPlaceData(venue1, 430, 1060);

        assertTrue(Market(velMarket).resolved());
        assertTrue(Market(velMarket).longWins());
        assertFalse(Market(ratMarket).resolved()); // not past resolveDate yet

        // --- CLAIM VELOCITY WINNINGS ---
        // Losing pool = 3 ETH, fee = 0.06 ETH, distributable = 2.94 ETH
        // Alice: 2/3 of long pool → 2 + (2.94 * 2/3) = 3.96 ETH
        // Carol: 1/3 of long pool → 1 + (2.94 * 1/3) = 1.98 ETH
        uint256 aliceBal = alice.balance;
        vm.prank(alice);
        Market(velMarket).claim();
        assertEq(alice.balance - aliceBal, 3.96 ether);

        uint256 carolBal = carol.balance;
        vm.prank(carol);
        Market(velMarket).claim();
        assertEq(carol.balance - carolBal, 1.98 ether);

        // Bob lost — cannot claim
        vm.prank(bob);
        vm.expectRevert("No winning bet");
        Market(velMarket).claim();

        // --- ORACLE RESOLVES RATING MARKET ---
        vm.warp(ratingResolve);

        // Rating 4.1 (410) < 4.2 (420) → short wins
        placeOracle.postPlaceData(venue1, 410, 1100);

        assertTrue(Market(ratMarket).resolved());
        assertFalse(Market(ratMarket).longWins());

        // Alice (short) claims: 1 + (2 * 0.98 * 1/1) = 2.96 ETH
        aliceBal = alice.balance;
        vm.prank(alice);
        Market(ratMarket).claim();
        assertEq(alice.balance - aliceBal, 2.96 ether);
    }

    /// Multi-venue batch posting resolves correct markets
    function test_batchPostMultiVenue() public {
        uint256 resolveDate = block.timestamp + 1 days;

        address v1Market = factory.createVelocityMarket(venue1, 50, resolveDate, 1000);
        address v2Market = factory.createRatingMarket(venue2, 400, resolveDate);

        // Place some bets so there's something at stake
        vm.deal(alice, 2 ether);
        vm.prank(alice);
        Market(v1Market).betLong{value: 1 ether}();
        vm.prank(alice);
        Market(v2Market).betLong{value: 1 ether}();

        vm.warp(resolveDate);

        // Batch post both venues at once
        string[] memory ids = new string[](2);
        ids[0] = venue1;
        ids[1] = venue2;
        uint256[] memory ratings = new uint256[](2);
        ratings[0] = 430;
        ratings[1] = 450;
        uint256[] memory counts = new uint256[](2);
        counts[0] = 1060;
        counts[1] = 500;

        placeOracle.batchPost(ids, ratings, counts);

        assertTrue(Market(v1Market).resolved());
        assertTrue(Market(v2Market).resolved());
        assertTrue(Market(v1Market).longWins()); // 60 reviews >= 50
        assertTrue(Market(v2Market).longWins()); // 450 >= 400
    }

    /// Oracle posting before resolveDate does NOT resolve
    function test_earlyPostNoResolve() public {
        uint256 resolveDate = block.timestamp + 7 days;
        address m = factory.createVelocityMarket(venue1, 50, resolveDate, 1000);

        // Post data before resolveDate
        placeOracle.postPlaceData(venue1, 430, 1060);
        assertFalse(Market(m).resolved());

        // Post again after resolveDate — now it resolves
        vm.warp(resolveDate);
        placeOracle.postPlaceData(venue1, 430, 1060);
        assertTrue(Market(m).resolved());
    }

    /// Markets created after setOracle have correct oracle wiring
    function test_oracleWiring() public {
        // Market created after setUp — oracle should be PlaceOracle
        uint256 resolveDate = block.timestamp + 1 days;
        address m = factory.createVelocityMarket(venue1, 50, resolveDate, 1000);

        assertEq(Market(m).oracle(), address(placeOracle));

        // Direct resolve from EOA should fail (only PlaceOracle can resolve)
        vm.warp(resolveDate);
        vm.expectRevert("Only oracle");
        Market(m).resolve(430, 1060);

        // But posting through PlaceOracle works
        placeOracle.postPlaceData(venue1, 430, 1060);
        assertTrue(Market(m).resolved());
    }

    /// getUserPosition reflects claimable after resolution
    function test_getUserPositionAfterResolve() public {
        uint256 resolveDate = block.timestamp + 1 days;
        address m = factory.createVelocityMarket(venue1, 50, resolveDate, 1000);

        vm.deal(alice, 2 ether);
        vm.deal(bob, 1 ether);

        vm.prank(alice);
        Market(m).betLong{value: 2 ether}();
        vm.prank(bob);
        Market(m).betShort{value: 1 ether}();

        // Before resolve: no claimable
        (uint256 longAmt, , uint256 claimable) = Market(m).getUserPosition(alice);
        assertEq(longAmt, 2 ether);
        assertEq(claimable, 0);

        // Resolve — long wins
        vm.warp(resolveDate);
        placeOracle.postPlaceData(venue1, 430, 1060);

        // After resolve: claimable = 2 + (1 * 0.98 * 2/2) = 2.98 ETH
        (, , claimable) = Market(m).getUserPosition(alice);
        assertEq(claimable, 2.98 ether);

        // After claiming: claimable = 0
        vm.prank(alice);
        Market(m).claim();
        (, , claimable) = Market(m).getUserPosition(alice);
        assertEq(claimable, 0);
    }

    /// Fee withdrawal works
    function test_feeWithdrawal() public {
        uint256 resolveDate = block.timestamp + 1 days;
        address m = factory.createVelocityMarket(venue1, 50, resolveDate, 1000);

        vm.deal(alice, 1 ether);
        vm.deal(bob, 1 ether);

        vm.prank(alice);
        Market(m).betLong{value: 1 ether}();
        vm.prank(bob);
        Market(m).betShort{value: 1 ether}();

        vm.warp(resolveDate);
        placeOracle.postPlaceData(venue1, 430, 1060);

        // Winner claims
        vm.prank(alice);
        Market(m).claim();

        // Withdraw fee to deployer
        address feeRecipient = address(0xFEE);
        uint256 balBefore = feeRecipient.balance;

        // withdrawFees is factory-only, but factory doesn't expose it yet
        // Call directly from factory address
        vm.prank(address(factory));
        Market(m).withdrawFees(feeRecipient);

        // Fee = 1 ether * 200 / 10000 = 0.02 ether
        assertEq(feeRecipient.balance - balBefore, 0.02 ether);
    }
}
