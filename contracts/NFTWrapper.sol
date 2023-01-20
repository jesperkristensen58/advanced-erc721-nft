// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "./AdvancedNFT.sol";

/**
 * @notice An NFT wrapper contract: Receive ERC721 and get an ERC1155 in return. Vice versa works as well.
 * @dev This is assumed to be used with the `AdvancedNFT.sol` contract.
 */
contract NFTWrapper is ERC1155, IERC721Receiver {
    /*****************************************************************************************
                                            SETUP
    ******************************************************************************************/
    address payable immutable advancedNFT;

    /**
     * @notice Contruct the wrapper against the deployed advanced NFT collection.
     */
    constructor (address payable _advancedNFT) ERC1155("Wrapped NFT") {
        advancedNFT = _advancedNFT;
    }

    /**
     * @notice Wrap the ERC721 NFT and receive an ERC1155 in return.
     */
    function wrap(uint256 tokenId) external {
        require(balanceOf(msg.sender, tokenId) == 0, "Already wrapped!");

        // transfer ERC721 to this contract - this also confirms ownership:
        AdvancedNFT(advancedNFT).safeTransferFrom(msg.sender, address(this), tokenId);
        
        _mint(msg.sender, tokenId, 1, ""); // just mint 1

        assert(balanceOf(msg.sender, tokenId) == 1);
    }

    function unwrap(uint256 tokenId) external {
        require(balanceOf(msg.sender, tokenId) == 1, "Not the owner!");

        _burn(msg.sender, tokenId, 1);
        AdvancedNFT(advancedNFT).safeTransferFrom(address(this), msg.sender, tokenId);
        
        assert(balanceOf(msg.sender, tokenId) == 0);
    }

    /**
     * @dev Whenever an {IERC721} `tokenId` token is transferred to this contract via {IERC721-safeTransferFrom}
     * by `operator` from `from`, this function is called.
     *
     * It must return its Solidity selector to confirm the token transfer.
     * If any other value is returned or the interface is not implemented by the recipient, the transfer will be reverted.
     *
     * The selector can be obtained in Solidity with `IERC721Receiver.onERC721Received.selector`.
     */
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}