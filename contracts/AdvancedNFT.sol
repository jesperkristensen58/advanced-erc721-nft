// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/BitMaps.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @notice An example Advanced NFT Contract showing two different ways of implementing the minting. Shows other advanced features as well.
 * @dev This contract will be deployed with 6 leading zeros as its address.
 * @dev We leverage the Merkle Tree generation library by OZ here: https://github.com/OpenZeppelin/merkle-tree
 */
contract AdvancedNFT is ERC721, ReentrancyGuard, Ownable {
    /*****************************************************************************************
                                            SETUP
    ******************************************************************************************/
    uint256 tokenId;
    // the merkle tree; pre-computed and stored during construction
    bytes32 private root;
    // mapping-based allowlist
    mapping(address => uint256) hasMintedMapping; // map a user to whether they have already minted (start at "not minted" == true)
    // NFTs should have a nonzero ether cost so that you can withdraw the funds later.
    uint constant COST = 1_000_000; // 1 million wei per NFT
    // store in a bitmap whether an eligible user has already minted the NFT
    using BitMaps for BitMaps.BitMap;
    BitMaps.BitMap private hasMintedBitmap;

    /**
     * @notice Construct the Advanced NFT with gas-optimized minting.
     * @param name the name of the NFT
     * @param symbol the symbol of the NFT
     * @param _root the Merkle tree allowlist root (addresses in this tree are allowed to min the NFT)
     */
    constructor(string memory name, string memory symbol, bytes32 _root)
        ERC721(name, symbol)
    {
        root = _root; // use OZ's javascript library to create the Merkle tree

        // Make sure at least 5000 bits are available (aka support a total mint of 5000).
        // Each slot is 32 bytes = 256 bits. So 5000 / 256 = 19.53125, we need 20 slots set to 1
        for (uint256 i = 0; i < 20; i++)
            hasMintedBitmap._data[i] = type(uint256).max; // set all bits to 1 in this bucket
    }
    
    /*****************************************************************************************
                                METHOD 1: MINT VIA THE "MAPPING" APPROACH
    ******************************************************************************************/
    /**
     * @notice Mint a single NFT if the caller is on the internal allowlist.
     * @dev uses an internal mapping to track whether a user has already minted the NFT.
     * @param proof the proof that msg.sender is allowlisted to mint.
     */
    function mintWithMapping(bytes32[] calldata proof)
        external
        payable
        nonReentrant
    {
        // make it impossible for smart contracts to mint
        require(_msgSender() == tx.origin, "Smart contracts are not allowed to mint!");
        // NFTs should have a nonzero ether cost so that you can withdraw the funds later.
        require(msg.value >= COST, "Insufficient funds!");

        _verifyWithMapping(proof); // is the caller on the allowlist? Check Merkle tree

        // they are allowed to mint; but did they already mint in the past?
        require(hasMintedMapping[_msgSender()] == 0, "Already minted!");
        hasMintedMapping[_msgSender()] = 1; // Method 1: we always set a zero value to a non-zero value (costly)

        (bool sent, ) = address(this).call{value: msg.value}(""); // use with non-reentrant
        require(sent, "Payment for the NFT failed!");

        return _mint(_msgSender(), tokenId++);
    }

    /**
     * @notice Verify that a user is on the AllowList to mint an NFT.
     * @dev This is to be used in conjunction with the `mapping` approach where we just check an address's presence in an internal mapping.
     * @param proof the Merkle Proof provided by the user to be checked against the internal Merkle Tree.
     */
    function _verifyWithMapping(bytes32[] calldata proof)
        private view
    {
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(_msgSender()))));
        require(MerkleProof.verify(proof, root, leaf), "Unauthorized mint!");
    }

    /*****************************************************************************************
                                METHOD 2: MINT VIA THE "BITMAP" APPROACH
    ******************************************************************************************/
    /**
     * @notice Mint a single NFT if the caller is on the internal allowlist.
     * @dev uses an internal bitmap to track whether a user has already minted the NFT. `ticketNumber` simply refers to bit index.
     * @param proof the proof that msg.sender is allowlisted to mint.
     * @param ticketNumber the NFT ticket number the user is allowed to mint.
     */
    function mintWithBitMap(bytes32[] calldata proof, uint256 ticketNumber)
        external
        payable
        nonReentrant
    {
        // make it impossible for smart contracts to mint
        require(_msgSender() == tx.origin, "Smart contracts are not allowed to mint!");
        // NFTs should have a nonzero ether cost so that you can withdraw the funds later.
        require(msg.value >= COST, "Insufficient funds!");

        _verifyWithBitmap(proof, ticketNumber); // is the caller on the allowlist? Check Merkle tree

        require(hasMintedBitmap.get(ticketNumber), "User has already minted!");
        hasMintedBitmap.unset(ticketNumber); // Method 2: most of the time we are setting a non-zero value to another non-zero value (point: less costly than Method 1)

        (bool sent, ) = address(this).call{value: msg.value}(""); // use with non-reentrant
        require(sent, "Payment for the NFT failed!");

        return _mint(_msgSender(), tokenId++);
    }

    /**
     * @notice Verify that a user is on the AllowList to mint an NFT.
     * @dev This is to be used in conjunction with the `bitmap` approach where we verify against a user's position in a bitmap as well.
     * @param proof the Merkle Proof provided by the user to be checked against the internal Merkle Tree.
     */
    function _verifyWithBitmap(bytes32[] calldata proof, uint256 bitmapIndex)
        private view
    {
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(_msgSender(), bitmapIndex)))); // note the`verifyWithMapping` function which just uses the address
        require(MerkleProof.verify(proof, root, leaf), "Unauthorized mint!");
    }


    /*****************************************************************************************
                                HELPERS
    ******************************************************************************************/
    /**
     * @notice The owner can withdraw all funds received in this contract.
     * @dev Sends all contract funds to the caller.
     */
    function withdraw()
        external
        onlyOwner
    {
        (bool sent, ) = payable(_msgSender()).call{value: address(this).balance}("");
        require(sent, "Withdrawal unsuccessful!");
    }

    /**
     * @notice Make sure we can receive ether/payment for the NFTs sold.
     */
    receive() external payable {}
}