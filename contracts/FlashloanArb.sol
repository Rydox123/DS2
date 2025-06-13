// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

contract FlashloanArb is FlashLoanSimpleReceiverBase, Ownable {
    address public immutable uniswapRouter;
    address public immutable sushiswapRouter;

    mapping(address => uint256) public lastCall;
    uint256 public constant COOLDOWN = 10; // 10 blocks

    // --- Risk Management State ---
    mapping(address => bool) public tokenBlacklist;
    uint256 public constant MAX_DEBT_RATIO = 8000; // 80%
    uint256 public constant DAILY_LOSS_LIMIT = 0.5 ether;
    uint256 public lastLossTime;
    uint256 public dailyLoss;

    modifier onlyEOA() {
        require(msg.sender == tx.origin, "Only EOA");
        _;
    }

    modifier cooldownProtected() {
        require(block.number > lastCall[msg.sender] + COOLDOWN, "Cooldown active");
        _;
        lastCall[msg.sender] = block.number;
    }

    modifier riskChecks(address asset, uint256 amount) {
        require(!tokenBlacklist[asset], "Blacklisted token");
        uint256 contractBalance = IERC20(asset).balanceOf(address(this));
        require(amount <= (contractBalance * MAX_DEBT_RATIO) / 10000, "Exceeds max debt");
        if (lastLossTime + 1 days < block.timestamp) dailyLoss = 0;
        require(dailyLoss < DAILY_LOSS_LIMIT, "Daily loss limit");
        _;
    }

    constructor(
        address _addressesProvider,
        address _uniswapRouter,
        address _sushiswapRouter,
        address initialOwner
    )
        FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_addressesProvider))
        Ownable(initialOwner)
    {
        require(_addressesProvider != address(0), "Invalid addressesProvider");
        require(_uniswapRouter != address(0), "Invalid Uniswap router");
        require(_sushiswapRouter != address(0), "Invalid Sushi router");
        uniswapRouter = _uniswapRouter;
        sushiswapRouter = _sushiswapRouter;
    }

    function setTokenBlacklist(address token, bool status) external onlyOwner {
        tokenBlacklist[token] = status;
    }

    function requestFlashLoan(
        address token,
        uint256 amount,
        address tokenIn,
        address tokenOut,
        uint256 minProfit,
        uint256 minOutUni,
        uint256 minOutSushi
    ) external onlyOwner onlyEOA cooldownProtected riskChecks(token, amount) {
        bytes memory params = abi.encode(
            tokenIn,
            tokenOut,
            minProfit,
            minOutUni,
            minOutSushi
        );
        POOL.flashLoanSimple(address(this), token, amount, params, 0);
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address,
        bytes calldata params
    ) external override returns (bool) {
        (
            address tokenIn,
            address tokenOut,
            uint256 minProfit,
            uint256 minOutUni,
            uint256 minOutSushi
        ) = abi.decode(params, (address, address, uint256, uint256, uint256));

        bool success = _arbitrage(asset, tokenOut, amount, premium, minProfit, minOutUni, minOutSushi);

        if (!success) {
            if (lastLossTime + 1 days < block.timestamp) dailyLoss = 0;
            dailyLoss += amount;
            lastLossTime = block.timestamp;
        }

        return success;
    }

    function _arbitrage(
        address asset,
        address tokenOut,
        uint256 amount,
        uint256 premium,
        uint256 minProfit,
        uint256 minOutUni,
        uint256 minOutSushi
    ) internal returns (bool) {
        IERC20 assetToken = IERC20(asset);
        IERC20 tokenOutToken = IERC20(tokenOut);

        uint256 slippageBps = _calcSlippage(asset, amount);
        require(_isLiquidPool(uniswapRouter), "Uniswap pool illiquid");
        require(_isLiquidPool(sushiswapRouter), "Sushi pool illiquid");

        assetToken.approve(uniswapRouter, 0);
        assetToken.approve(uniswapRouter, amount);
        uint256 amountOut = _swap(uniswapRouter, asset, tokenOut, amount, minOutUni);

        tokenOutToken.approve(sushiswapRouter, 0);
        tokenOutToken.approve(sushiswapRouter, amountOut);
        uint256 amountBack = _swap(sushiswapRouter, tokenOut, asset, amountOut, minOutSushi);

        uint256 totalRepay = amount + premium;
        if (amountBack < totalRepay) return false;
        uint256 profit = amountBack - totalRepay;
        if (profit < minProfit) return false;

        assetToken.approve(address(POOL), 0);
        assetToken.approve(address(POOL), totalRepay);
        return true;
    }

    function _swap(
        address router,
        address from,
        address to,
        uint256 amount,
        uint256 minOut
    ) internal returns (uint256) {
        unchecked {
            address[] memory path = new address[](2);
            path[0] = from;
            path[1] = to;
            uint[] memory amounts = IUniswapV2Router(router).swapExactTokensForTokens(
                amount, minOut, path, address(this), block.timestamp
            );
            return amounts[1];
        }
    }

    function _calcSlippage(address token, uint256 amount) internal view returns (uint256) {
        return 50; // Placeholder: 50 bps
    }

    function _isLiquidPool(address router) internal view returns (bool) {
        return true; // Placeholder
    }

    function withdraw(address token) external onlyOwner {
        IERC20(token).transfer(owner(), IERC20(token).balanceOf(address(this)));
    }

    receive() external payable {}
}
