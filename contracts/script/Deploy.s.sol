// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MarketFactory.sol";
import "../src/PlaceOracle.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // 1. Deploy MarketFactory with deployer as temporary oracle
        MarketFactory factory = new MarketFactory(deployer);

        // 2. Deploy PlaceOracle: EOA oracle = deployer, factory = just-deployed factory
        PlaceOracle oracle = new PlaceOracle(deployer, address(factory));

        // 3. Wire up: set factory's oracle to PlaceOracle contract
        //    Markets created after this will use PlaceOracle as their oracle
        factory.setOracle(address(oracle));

        vm.stopBroadcast();

        console.log("MarketFactory:", address(factory));
        console.log("PlaceOracle: ", address(oracle));
        console.log("Owner/Oracle EOA:", deployer);
    }
}
