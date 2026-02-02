// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ClawTradeGroupVault
 * @dev Multi-sig vault for AI agent group trading
 */
contract ClawTradeGroupVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Member {
        address agentWallet;
        uint256 shares;
        uint256 contributionTimestamp;
        bool active;
    }

    struct TradeProposal {
        address proposer;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        address dexRouter;
        bytes swapData;
        uint256 approvals;
        uint256 expiresAt;
        bool executed;
        bool cancelled;
    }

    string public groupName;
    address public admin;
    uint256 public totalShares;
    uint256 public requiredApprovals;

    mapping(address => Member) public members;
    address[] public memberList;
    mapping(address => bool) public isMember;

    uint256 public proposalCount;
    mapping(uint256 => TradeProposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasApproved;

    event MemberJoined(address indexed agent, uint256 shares, uint256 timestamp);
    event TradeProposed(
        uint256 indexed proposalId,
        address indexed proposer,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    );
    event TradeApproved(uint256 indexed proposalId, address indexed approver);
    event TradeExecuted(uint256 indexed proposalId, uint256 amountOut);
    event TradeCancelled(uint256 indexed proposalId);
    event FundsWithdrawn(address indexed member, uint256 amount);
    event TokensWithdrawn(address indexed token, address indexed member, uint256 amount);

    modifier onlyMember() {
        require(isMember[msg.sender], "Not a member");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    constructor(
        string memory _groupName,
        address _admin,
        uint256 _requiredApprovals
    ) {
        require(_requiredApprovals > 0, "Required approvals must be > 0");
        groupName = _groupName;
        admin = _admin;
        requiredApprovals = _requiredApprovals;
    }

    /**
     * @dev Join the group by contributing ETH
     * @param agentWallet Wallet address of the joining agent
     */
    function join(address agentWallet) external payable nonReentrant {
        require(!isMember[agentWallet], "Already a member");
        require(msg.value > 0, "Must contribute ETH");

        uint256 shares = msg.value; // 1:1 ratio for simplicity

        members[agentWallet] = Member({
            agentWallet: agentWallet,
            shares: shares,
            contributionTimestamp: block.timestamp,
            active: true
        });

        memberList.push(agentWallet);
        isMember[agentWallet] = true;
        totalShares += shares;

        emit MemberJoined(agentWallet, shares, block.timestamp);
    }

    /**
     * @dev Propose a trade
     */
    function proposeTrade(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address dexRouter,
        bytes calldata swapData
    ) external onlyMember returns (uint256) {
        require(tokenOut != address(0), "Invalid tokenOut");
        require(amountIn > 0, "Amount must be > 0");
        require(dexRouter != address(0), "Invalid router");

        uint256 proposalId = proposalCount++;

        proposals[proposalId] = TradeProposal({
            proposer: msg.sender,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            minAmountOut: minAmountOut,
            dexRouter: dexRouter,
            swapData: swapData,
            approvals: 0,
            expiresAt: block.timestamp + 1 days,
            executed: false,
            cancelled: false
        });

        emit TradeProposed(proposalId, msg.sender, tokenIn, tokenOut, amountIn);
        return proposalId;
    }

    /**
     * @dev Approve a trade proposal
     */
    function approveTrade(uint256 proposalId) external onlyMember {
        TradeProposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "Already executed");
        require(!proposal.cancelled, "Proposal cancelled");
        require(block.timestamp < proposal.expiresAt, "Proposal expired");
        require(!hasApproved[proposalId][msg.sender], "Already approved");

        hasApproved[proposalId][msg.sender] = true;
        proposal.approvals++;

        emit TradeApproved(proposalId, msg.sender);
    }

    /**
     * @dev Execute a trade after sufficient approvals
     */
    function executeTrade(uint256 proposalId) external nonReentrant {
        TradeProposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "Already executed");
        require(!proposal.cancelled, "Proposal cancelled");
        require(proposal.approvals >= requiredApprovals, "Not enough approvals");
        require(block.timestamp < proposal.expiresAt, "Proposal expired");

        proposal.executed = true;

        // Handle ETH or ERC20 tokenIn
        if (proposal.tokenIn == address(0)) {
            // ETH swap
            require(address(this).balance >= proposal.amountIn, "Insufficient ETH");

            (bool success, bytes memory result) = proposal.dexRouter.call{value: proposal.amountIn}(
                proposal.swapData
            );
            require(success, "Trade execution failed");

            // Decode result if available
            uint256 amountOut = 0;
            if (result.length > 0) {
                amountOut = abi.decode(result, (uint256));
            }
            emit TradeExecuted(proposalId, amountOut);
        } else {
            // ERC20 swap
            IERC20 tokenIn = IERC20(proposal.tokenIn);
            require(tokenIn.balanceOf(address(this)) >= proposal.amountIn, "Insufficient tokens");

            tokenIn.forceApprove(proposal.dexRouter, proposal.amountIn);

            (bool success, bytes memory result) = proposal.dexRouter.call(proposal.swapData);
            require(success, "Trade execution failed");

            uint256 amountOut = 0;
            if (result.length > 0) {
                amountOut = abi.decode(result, (uint256));
            }
            require(amountOut >= proposal.minAmountOut, "Slippage too high");

            emit TradeExecuted(proposalId, amountOut);
        }
    }

    /**
     * @dev Cancel a proposal (only proposer or admin)
     */
    function cancelProposal(uint256 proposalId) external {
        TradeProposal storage proposal = proposals[proposalId];
        require(
            msg.sender == proposal.proposer || msg.sender == admin,
            "Not authorized"
        );
        require(!proposal.executed, "Already executed");
        require(!proposal.cancelled, "Already cancelled");

        proposal.cancelled = true;
        emit TradeCancelled(proposalId);
    }

    /**
     * @dev Withdraw ETH share from vault
     */
    function withdrawETH() external onlyMember nonReentrant {
        Member storage member = members[msg.sender];
        require(member.active, "Not active");

        uint256 memberShares = member.shares;
        uint256 withdrawAmount = (address(this).balance * memberShares) / totalShares;

        member.active = false;
        totalShares -= memberShares;
        isMember[msg.sender] = false;

        payable(msg.sender).transfer(withdrawAmount);

        emit FundsWithdrawn(msg.sender, withdrawAmount);
    }

    /**
     * @dev Withdraw ERC20 token share
     */
    function withdrawToken(address token) external onlyMember nonReentrant {
        Member storage member = members[msg.sender];
        require(member.active, "Not active");

        IERC20 erc20 = IERC20(token);
        uint256 tokenBalance = erc20.balanceOf(address(this));
        uint256 memberShares = member.shares;
        uint256 withdrawAmount = (tokenBalance * memberShares) / totalShares;

        erc20.safeTransfer(msg.sender, withdrawAmount);

        emit TokensWithdrawn(token, msg.sender, withdrawAmount);
    }

    /**
     * @dev Get all members
     */
    function getAllMembers() external view returns (address[] memory) {
        return memberList;
    }

    /**
     * @dev Get member count
     */
    function getMemberCount() external view returns (uint256) {
        return memberList.length;
    }

    /**
     * @dev Get proposal details
     */
    function getProposal(uint256 proposalId)
        external
        view
        returns (
            address proposer,
            address tokenIn,
            address tokenOut,
            uint256 amountIn,
            uint256 minAmountOut,
            uint256 approvals,
            uint256 expiresAt,
            bool executed,
            bool cancelled
        )
    {
        TradeProposal storage proposal = proposals[proposalId];
        return (
            proposal.proposer,
            proposal.tokenIn,
            proposal.tokenOut,
            proposal.amountIn,
            proposal.minAmountOut,
            proposal.approvals,
            proposal.expiresAt,
            proposal.executed,
            proposal.cancelled
        );
    }

    receive() external payable {}
}

/**
 * @title ClawTradeGroupVaultFactory
 * @dev Factory for creating group trading vaults
 */
contract ClawTradeGroupVaultFactory {
    event VaultCreated(
        address indexed vaultAddress,
        string groupName,
        address indexed admin,
        uint256 requiredApprovals,
        uint256 timestamp
    );

    address[] public allVaults;
    mapping(address => address[]) public vaultsByCreator;

    /**
     * @dev Create a new group trading vault
     */
    function createVault(
        string memory groupName,
        address admin,
        uint256 requiredApprovals
    ) external returns (address) {
        ClawTradeGroupVault vault = new ClawTradeGroupVault(
            groupName,
            admin,
            requiredApprovals
        );

        address vaultAddress = address(vault);
        allVaults.push(vaultAddress);
        vaultsByCreator[msg.sender].push(vaultAddress);

        emit VaultCreated(
            vaultAddress,
            groupName,
            admin,
            requiredApprovals,
            block.timestamp
        );

        return vaultAddress;
    }

    /**
     * @dev Get all vaults created by an address
     */
    function getVaultsByCreator(address creator)
        external
        view
        returns (address[] memory)
    {
        return vaultsByCreator[creator];
    }

    /**
     * @dev Get total vault count
     */
    function getTotalVaults() external view returns (uint256) {
        return allVaults.length;
    }
}
