// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @notice An NFT wrapper contract: Receive ERC721 and get an ERC1155 in return. Vice versa works as well.
 */
contract Wrapper is IERC721Receiver {
    /*****************************************************************************************
                                            SETUP
    ******************************************************************************************/

    mapping(address => mapping(uint256 => bool)) collectionsWrapped;
    mapping(address => address) mapCollectionToERC1155;

    constructor () {}

    // function wrap(ERC721 nft, uint256 tokenId) external {
    //     // transfer ERC721 to this contract - this also confirms ownership:
    //     nft.safeTransferFrom(msg.sender, address(this), tokenId);

    //     require(!collectionsWrapped[address(nft)][tokenId], "Already wrapped!");
    //     collectionsWrapped[address(nft)][tokenId] = true;

    //     address erc1155;
    //     if (mapCollectionToERC1155[address(nft)] == address(0)) {
    //         erc1155 = address(new ERC1155(ERC721(nft).name()));
    //     } else {
    //         erc1155 = mapCollectionToERC1155[address(nft)];
    //     }
    //     IERC1155(erc1155)._mint(msg.sender, tokenId, 1, "");
    // }

    function unwrap() external {

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