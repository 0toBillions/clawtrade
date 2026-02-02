// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ClawTradeToken
 * @dev ERC20 token created by ClawTrade agents
 */
contract ClawTradeToken is ERC20, Ownable {
    uint8 private _decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint256 totalSupply,
        uint8 decimals_,
        address creator
    ) ERC20(name, symbol) Ownable(creator) {
        _decimals = decimals_;
        _mint(creator, totalSupply);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}

/**
 * @title ClawTradeTokenFactory
 * @dev Factory contract for deploying ERC20 tokens by AI agents
 */
contract ClawTradeTokenFactory {
    event TokenCreated(
        address indexed tokenAddress,
        address indexed creator,
        string name,
        string symbol,
        uint256 totalSupply,
        uint8 decimals,
        uint256 timestamp
    );

    struct TokenInfo {
        address tokenAddress;
        address creator;
        string name;
        string symbol;
        uint256 totalSupply;
        uint8 decimals;
        uint256 createdAt;
    }

    TokenInfo[] public launchedTokens;
    mapping(address => address[]) public tokensByCreator;
    mapping(address => bool) public isToken;

    /**
     * @dev Create a new ERC20 token
     * @param name Token name
     * @param symbol Token symbol
     * @param totalSupply Total supply (in smallest unit)
     * @param decimals Number of decimals (typically 18)
     * @return tokenAddress Address of the deployed token
     */
    function createToken(
        string memory name,
        string memory symbol,
        uint256 totalSupply,
        uint8 decimals
    ) external returns (address tokenAddress) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(symbol).length > 0, "Symbol cannot be empty");
        require(totalSupply > 0, "Total supply must be greater than 0");
        require(decimals <= 18, "Decimals must be <= 18");

        ClawTradeToken token = new ClawTradeToken(
            name,
            symbol,
            totalSupply,
            decimals,
            msg.sender
        );

        tokenAddress = address(token);

        TokenInfo memory info = TokenInfo({
            tokenAddress: tokenAddress,
            creator: msg.sender,
            name: name,
            symbol: symbol,
            totalSupply: totalSupply,
            decimals: decimals,
            createdAt: block.timestamp
        });

        launchedTokens.push(info);
        tokensByCreator[msg.sender].push(tokenAddress);
        isToken[tokenAddress] = true;

        emit TokenCreated(
            tokenAddress,
            msg.sender,
            name,
            symbol,
            totalSupply,
            decimals,
            block.timestamp
        );

        return tokenAddress;
    }

    /**
     * @dev Get all tokens created by a specific address
     * @param creator The address of the token creator
     * @return Array of token addresses
     */
    function getTokensByCreator(address creator)
        external
        view
        returns (address[] memory)
    {
        return tokensByCreator[creator];
    }

    /**
     * @dev Get total number of tokens launched
     * @return Total count of launched tokens
     */
    function getTotalTokens() external view returns (uint256) {
        return launchedTokens.length;
    }

    /**
     * @dev Get token info by index
     * @param index Index in the launchedTokens array
     * @return Token information
     */
    function getTokenInfo(uint256 index)
        external
        view
        returns (TokenInfo memory)
    {
        require(index < launchedTokens.length, "Index out of bounds");
        return launchedTokens[index];
    }

    /**
     * @dev Check if an address is a token created by this factory
     * @param tokenAddress Address to check
     * @return True if token was created by this factory
     */
    function isFactoryToken(address tokenAddress) external view returns (bool) {
        return isToken[tokenAddress];
    }
}
