// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/BitMaps.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import "hardhat/console.sol";

/**
 * @notice An example Advanced NFT Contract showing two different ways of implementing the minting. Shows other advanced features as well.
 * @dev This contract will be deployed with 6 leading zeros as its address.
 * @dev We leverage the Merkle Tree generation library by OZ here: https://github.com/OpenZeppelin/merkle-tree
 */
contract AdvancedNFT is ERC721, ERC721URIStorage, ReentrancyGuard, Ownable {
    /*****************************************************************************************
                                            SETUP
    ******************************************************************************************/
    uint256 immutable totalSupply;
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
    constructor(string memory name, string memory symbol, bytes32 _root, uint256 _preSaleSupply, uint256 _totalSupply)
        ERC721(name, symbol)
    {
        require(_totalSupply > 0, "Invalid Total Supply!");

        root = _root; // use OZ's javascript library to create the Merkle tree

        // // USE THIS TO TEST GAS SAVINGS - WE WANT A LARGE COLLECTION OF 5,000:
        // // Make sure at least 5000 bits are available (aka support a total mint of 5000).
        // // Each slot is 32 bytes = 256 bits. So 5000 / 256 = 19.53125, we need 20 slots set to 1
        // for (uint256 i = 0; i < 20; i++)
        //     hasMintedBitmap._data[i] = type(uint256).max; // set all bits to 1 in this bucket
        
        // for simplicity, keep the collection small
        totalSupply = _totalSupply;

        for (uint256 i = 0; i < _preSaleSupply; i++)
            hasMintedBitmap.set(i);
        
        state = SaleState.PRESALE; // start in presale state
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
        public
        payable
        nonReentrant
        checkMintIsAllowed(SaleState.PRESALE)
    {
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
        public
        payable
        nonReentrant
        checkMintIsAllowed(SaleState.PRESALE)
    {
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

    /*******************************************************************************************************************
                                        PUBLIC MINTING
    ********************************************************************************************************************/
    function mint()
        public
        payable
        nonReentrant
        checkMintIsAllowed(SaleState.PUBLIC)
    {
        // make it impossible for smart contracts to mint
        require(_msgSender() == tx.origin, "Smart contracts are not allowed to mint!");
        // NFTs should have a nonzero ether cost so that you can withdraw the funds later.
        require(msg.value >= COST, "Insufficient funds!");

        (bool sent, ) = address(this).call{value: msg.value}(""); // use with non-reentrant
        require(sent, "Payment for the NFT failed!");

        return _mint(_msgSender(), tokenId++);
    }

    /*******************************************************************************************************************
                    COMMIT/REVEAL TO ASSOCIATE MINTED IDs TO FINAL TOKEN IDs (to avoid gaming the airdrop)
    ********************************************************************************************************************/
    struct Commit {
        bytes32 commit; // the data (hash of the shift uint) committed
        uint64 blockNumber; // the block number when the commit took place
        uint256 revealed; // has the shift been revealed?
    }

    uint64 immutable REVEAL_BLOCK_DELTA = 10;
    Commit public s_commit; // hold the "shift" commit/reveal scheme

    event CommitHash(bytes32 shiftHash, uint64 blockNumber);
    event Reveal(uint256 answerShift, bytes32 salt);

    /**
     * @notice Commit the shift imposed on the minted IDs to generate the actual tokenIds (or the NFT IDs)
     * @notice The idea is to ensure that if we mint initially number 20 then later on this might be shifted to 122. So we can't predict what NFT we get.
     * @dev Only the owner of the NFT can commit and reveal this.
     * @param saltedShift the integer shift salted and hashed
     */
    function commit(bytes32 saltedShift) external onlyOwner {
        s_commit.commit = saltedShift;
        s_commit.blockNumber = uint64(block.number);
        s_commit.revealed = 0;

        emit CommitHash(s_commit.commit, s_commit.blockNumber);
    }

    /**
     * @notice Create a salted hash of incoming data. Can also (and will be when generating the commit data) run off-chain.
     * @param shift the shift to use for the NFT IDs, e.g., 400.
     * @param salt the salt to use when hashing the data
     * @return the salted hash of the incoming data
     */
    function createSaltedHash(uint256 shift, bytes32 salt) public view returns (bytes32) {
        return keccak256(abi.encodePacked(address(this), shift, salt));
    }

    /**
     * @notice Reveal the shift in minted IDs to create the finally assigned tokenIds.
     * @param answerShift the shift to use which was committed previously.
     * @param salt the salt used in the salted hash to create the original hashed shift.
     */
    function reveal(uint256 answerShift, bytes32 salt) external onlyOwner {
        // make sure it hasn't been revealed yet and set it to revealed
        require(s_commit.revealed == 0, "Already revealed!");
        s_commit.revealed = 1;

        // check that the reveal happens after at least 10 blocks:
        require(uint64(block.number) >= s_commit.blockNumber + REVEAL_BLOCK_DELTA, "Reveal has to happen >=10 blocks from commit!");

        // require that they can produce the committed hash
        require(createSaltedHash(answerShift, salt) == s_commit.commit, "Revealed hash does not match original committed hash!");

        emit Reveal(answerShift, salt);
    }

    /*****************************************************************************************
                                MULTIDELEGATECALL
    ******************************************************************************************/
    // we use some custom errors:
    error DelegatecallFailed();
    error InvalidCall();

    /**
     * @notice Multi-transfer of NFTs via multi-delegatecall.
     * @param data the data array specifying which NFTs need to be transferred between which parties.
     */
    function multiTransfer(
        bytes[] memory data
    ) external {
        // only transferFrom can be called using this approach:
        bytes4 approvedSelector = transferFrom.selector;

        // perfrom the multi transfer:
        for (uint i; i < data.length; i++) {
            bytes4 thisSelector = bytes4(data[i]);

            if (thisSelector != approvedSelector) revert InvalidCall(); // revert everything if invalid data is used at all

            (bool ok, ) = address(this).delegatecall(data[i]);
            if (!ok) revert DelegatecallFailed();
        }
    }

    /**
     * @notice Helper function to get call data for the caller
     * @param from the address to transfer from
     * @param to the address to transfer to
     * @param _tokenId the tokenId to transfer
     * @return the signature of the transferFrom function
     */
    function helperGetCallData(address from, address to, uint256 _tokenId) external view returns (bytes memory) {
        return abi.encodeWithSelector(transferFrom.selector, from, to, _tokenId);
    }

    /**
     * @notice Helper function to get *WRONG* call data for the caller (for testing purposes).
     * See mintWithBitMap for parameter documentation.
     */
    function helperGetWrongCallData(bytes32[] calldata proof, uint256 ticketNumber) external view returns (bytes memory) {
        return abi.encodeWithSignature("mintWithBitMap(bytes32[],uint256)", proof, ticketNumber);
    }

    /*****************************************************************************************
                                            STATE MACHINE
    ******************************************************************************************/
    // use a state machine to determine which sale state is relevant
    enum SaleState{ PRESALE, PUBLIC, NOSUPPLY }
    SaleState public state;

    /**
     * @notice Check inputs and confirm that we are in the correct minting state.
     * @param _state the minting state the contract is in (e.g., SaleState.PRESALE)
     * @dev the state machine is written via an enum. See `SaleState`.
     */
    modifier checkMintIsAllowed(SaleState _state) {
        // (1) check inputs:
        // make it impossible for smart contracts to mint
        require(_msgSender() == tx.origin, "Smart contracts are not allowed to mint!");
        // NFTs should have a nonzero ether cost so that you can withdraw the funds later.
        require(msg.value >= COST, "Insufficient funds!");

        // (2) check the state and confirm we are allowed to mint
        if(_state != state || state == SaleState.NOSUPPLY) {
            revert("Invalid Mint State!");
        }
        
        _;

        // after minting, make sure to update the state:
        if (state == SaleState.PRESALE && hasMintedBitmap._data[0] == 0) {
            // flip to public sale
            state = SaleState.PUBLIC;
        }

        if (state == SaleState.PUBLIC && tokenId == totalSupply) {
            state = SaleState.NOSUPPLY;
        }
    }

    /**
     * @dev Sanity check.
     */
    function _afterTokenTransfer(address from, address to, uint256 firstTokenId, uint256 batchSize) internal virtual override {
        require(tokenId <= totalSupply);
    }
    
    /*****************************************************************************************
                                ENABLE SETTING NFT NICKNAMES
    ******************************************************************************************/
    /**
     * @notice Ensure the burn function is implemented. On burn, we need to clear the tokenURI storage.
     * @param _tokenId The tokenId being burned.
     */
    function _burn(uint256 _tokenId) internal virtual override(ERC721, ERC721URIStorage) {
        super._burn(_tokenId);
    }

    /**
     * @notice Return the token URI (the Nickname) for a given Token ID. This is the NFT Nickname the user chose.
     * @param _tokenId The tokenId to get the `nickname` of.
     */
    function tokenURI(uint256 _tokenId) public view virtual override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(_tokenId);
    }

    /**
     * @notice Return the token URI (the Nickname) for a given Token ID. This is the NFT Nickname the user chose.
     * @param _tokenId The tokenId to get the `nickname` of.
     */
    function nickName(uint256 _tokenId) public view returns (string memory) {
        return tokenURI(_tokenId);
    }

    /**
     * @notice An NFT owner can set the nickname of their NFT.
     * @param _tokenId The tokenId to set a `nickname` for.
     */
    function setNickname(uint256 _tokenId, string memory nickname) public {
        require(msg.sender == ownerOf(_tokenId), "Not Owner!");
        // impose a length restriction on the nickname:
        require(strlen(nickname) <= 20, "Nickname must be at least 20 characters!");

        // set the nickname:
        _setTokenURI(_tokenId, nickname);
    }

    /**
     * @dev Returns the length of a given string
     * @dev from: https://github.com/ensdomains/ens-contracts/blob/master/contracts/ethregistrar/StringUtils.sol
     *
     * @param s The string to measure the length of
     * @return The length of the input string
     */
    function strlen(string memory s) internal pure returns (uint256) {
        uint256 len;
        uint256 i = 0;
        uint256 bytelength = bytes(s).length;
        for (len = 0; i < bytelength; len++) {
            bytes1 b = bytes(s)[i];
            if (b < 0x80) {
                i += 1;
            } else if (b < 0xE0) {
                i += 2;
            } else if (b < 0xF0) {
                i += 3;
            } else if (b < 0xF8) {
                i += 4;
            } else if (b < 0xFC) {
                i += 5;
            } else {
                i += 6;
            }
        }
        return len;
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
