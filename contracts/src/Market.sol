// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Market {
    enum MarketType { VELOCITY, RATING }

    MarketType public marketType;
    string public placeId;
    uint256 public target;
    uint256 public resolveDate;
    uint256 public initialReviewCount;
    address public oracle;
    address public factory;

    uint256 public longPool;
    uint256 public shortPool;
    uint256 public finalRating;
    uint256 public finalReviewCount;
    bool public resolved;
    bool public longWins;

    uint256 public constant FEE_BPS = 200; // 2%

    mapping(address => uint256) public longBets;
    mapping(address => uint256) public shortBets;
    mapping(address => bool) public claimed;

    event BetPlaced(address indexed user, bool isLong, uint256 amount);
    event MarketResolved(bool longWins);
    event WinningsClaimed(address indexed user, uint256 amount);

    modifier onlyOracle() {
        require(msg.sender == oracle, "Only oracle");
        _;
    }

    constructor(
        MarketType _marketType,
        string memory _placeId,
        uint256 _target,
        uint256 _resolveDate,
        uint256 _initialReviewCount,
        address _oracle
    ) {
        marketType = _marketType;
        placeId = _placeId;
        target = _target;
        resolveDate = _resolveDate;
        initialReviewCount = _initialReviewCount;
        oracle = _oracle;
        factory = msg.sender;
    }

    function betLong() external payable {
        require(!resolved, "Market resolved");
        require(block.timestamp < resolveDate, "Betting closed");
        require(msg.value > 0, "Zero bet");
        longBets[msg.sender] += msg.value;
        longPool += msg.value;
        emit BetPlaced(msg.sender, true, msg.value);
    }

    function betShort() external payable {
        require(!resolved, "Market resolved");
        require(block.timestamp < resolveDate, "Betting closed");
        require(msg.value > 0, "Zero bet");
        shortBets[msg.sender] += msg.value;
        shortPool += msg.value;
        emit BetPlaced(msg.sender, false, msg.value);
    }

    function resolve(uint256 _finalRating, uint256 _finalReviewCount) external onlyOracle {
        require(!resolved, "Already resolved");
        require(block.timestamp >= resolveDate, "Too early");

        resolved = true;
        finalRating = _finalRating;
        finalReviewCount = _finalReviewCount;

        if (marketType == MarketType.VELOCITY) {
            longWins = (finalReviewCount >= initialReviewCount)
                && (finalReviewCount - initialReviewCount >= target);
        } else {
            longWins = finalRating >= target;
        }

        emit MarketResolved(longWins);
    }

    function claim() external {
        require(resolved, "Not resolved");
        require(!claimed[msg.sender], "Already claimed");
        claimed[msg.sender] = true;

        uint256 winningPool = longWins ? longPool : shortPool;
        uint256 losingPool = longWins ? shortPool : longPool;
        uint256 userBet = longWins ? longBets[msg.sender] : shortBets[msg.sender];
        require(userBet > 0, "No winning bet");

        uint256 fee = (losingPool * FEE_BPS) / 10000;
        uint256 distributable = losingPool - fee;
        uint256 payout = userBet + (distributable * userBet) / winningPool;

        (bool sent, ) = msg.sender.call{value: payout}("");
        require(sent, "Transfer failed");

        emit WinningsClaimed(msg.sender, payout);
    }

    function withdrawFees(address to) external {
        require(msg.sender == factory, "Only factory");
        require(resolved, "Not resolved");
        uint256 losingPool = longWins ? shortPool : longPool;
        uint256 fee = (losingPool * FEE_BPS) / 10000;
        (bool sent, ) = to.call{value: fee}("");
        require(sent, "Transfer failed");
    }

    function getMarketInfo()
        external
        view
        returns (
            MarketType,
            string memory,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            bool
        )
    {
        return (
            marketType,
            placeId,
            target,
            resolveDate,
            longPool,
            shortPool,
            initialReviewCount,
            finalRating,
            finalReviewCount,
            resolved
        );
    }

    function getUserPosition(address user)
        external
        view
        returns (uint256 longAmount, uint256 shortAmount, uint256 claimable)
    {
        longAmount = longBets[user];
        shortAmount = shortBets[user];

        if (resolved && !claimed[user]) {
            uint256 winningPool = longWins ? longPool : shortPool;
            uint256 losingPool = longWins ? shortPool : longPool;
            uint256 userBet = longWins ? longBets[user] : shortBets[user];
            if (userBet > 0 && winningPool > 0) {
                uint256 fee = (losingPool * FEE_BPS) / 10000;
                uint256 distributable = losingPool - fee;
                claimable = userBet + (distributable * userBet) / winningPool;
            }
        }
    }
}
