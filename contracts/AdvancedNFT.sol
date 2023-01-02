// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract AdvancedNFT is ERC721 {
    
    uint constant COST = 1_000_000; // 1 million wei per NFT

    constructor(string memory name, string memory symbol) ERC721(name, symbol) {}

    function mint(uint256 tokenId) external {
        return _mint(msg.sender, tokenId);
    }

}
