const {
  loadFixture
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const hre = require("hardhat");
const { mine } = require("@nomicfoundation/hardhat-network-helpers"); // need this to advance the chain

describe("AdvancedNFT", function () {

  const cost = 1_000_000; // cost of 1 NFT (see the contract)

  // run this fixture once and re-use in all tests
  async function deployTokenFixture() {
    const [owner, alice, bob] = await ethers.getSigners();

    // prepare the pre-sale to some random minters
    // const numMinters = 5000; // create this many random minters of the NFT - we used this to compare gas prices (takes a long time to run)
    const numPresaleMinters = 10; // number of pre-sale recipients

    const valuesMapping = [];
    const valuesBitmap = [];
    const presaleMintersAsSigners = [];
    for (let i = 0; i < numPresaleMinters; i++) {
      let signer = ethers.Wallet.createRandom().connect(hre.ethers.provider); // a minter
      valuesMapping.push([signer.address]);
      valuesBitmap.push([signer.address, i]);
      presaleMintersAsSigners.push(signer);

      // send some funds to this minter so that they can mint later on in the tests...
      await hre.network.provider.send("hardhat_setBalance", [
        signer.address,
        "0x8ac7230489e80000" // give a lot of ether
      ]);
    }

    const publicsaleMintersAsSigners = [];
    for (let i = 0; i < 14; i++) {
      let signer = ethers.Wallet.createRandom().connect(hre.ethers.provider); // a minter
      publicsaleMintersAsSigners.push(signer);

      // send some funds to this minter so that they can mint later on in the tests...
      await hre.network.provider.send("hardhat_setBalance", [
        signer.address,
        "0x8ac7230489e80000" // give a lot of ether
      ]);
    }

    const treeWithBitmap = StandardMerkleTree.of(valuesBitmap, ["address", "uint256"]);
    console.log('Merkle Root for "Bitmap" Presale: ', treeWithBitmap.root);

    const treeWithMapping = StandardMerkleTree.of(valuesMapping, ["address"]);
    console.log('Merkle Root for "Mapping" Presale: ', treeWithMapping.root);

    const ANFT = await ethers.getContractFactory("AdvancedNFT");
    const anft1 = await ANFT.deploy("mapping", "MAP", treeWithMapping.root, 8, 20); // let's use 8 for presale (and we have prepared 10 minters above to test invalid mints later)
    await anft1.deployed();

    const anft2 = await ANFT.deploy("bitmap", "BMP", treeWithBitmap.root, 8, 20);
    await anft2.deployed();

    return { anft1, anft2, treeWithBitmap, treeWithMapping, valuesBitmap, valuesMapping, presaleMintersAsSigners, publicsaleMintersAsSigners, owner, alice, bob };
  }

  describe("Deployment", async () => {
    it("Should deploy as expected", async function () {
      const { anft1, anft2 } = await loadFixture(deployTokenFixture);

      expect(anft1.address).to.not.be.null;
      expect(await anft1.name()).to.equal("mapping");
      expect(await anft1.symbol()).to.equal("MAP");

      expect(anft2.address).to.not.be.null;
      expect(await anft2.name()).to.equal("bitmap");
      expect(await anft2.symbol()).to.equal("BMP");
    })
  });

  describe("Advanced NFT", function () {
    it("Mapping: Should mint at an ether cost", async function () {
      const { anft1, anft2, treeWithBitmap, treeWithMapping, valuesBitmap, valuesMapping, presaleMintersAsSigners, owner, alice, bob } = await loadFixture(deployTokenFixture);

      expect(await anft1.balanceOf(owner.address)).to.equal("0")
      expect(await anft1.balanceOf(alice.address)).to.equal("0")
      expect(await anft1.balanceOf(bob.address)).to.equal("0")

      // nobody owns token id 0 (or any other id for that matter)
      await expect(anft1.ownerOf(0)).to.be.revertedWith("ERC721: invalid token ID");

      // pick a minter
      const minter1 = presaleMintersAsSigners[0];

      // shouldn't be possible without sending funds
      await expect(anft1.connect(minter1).mintWithMapping([])).to.be.revertedWith("Insufficient funds!");

      // it's also not possible without proof of allowlisting!
      
      await expect(anft1.connect(minter1).mintWithMapping([], {value: cost})).to.be.revertedWith("Unauthorized mint!");

      // find the Merkle proof of minter1:
      let proof;
      for (const [i, v] of treeWithMapping.entries()) {
        if (v[0] === minter1.address) {
          proof = treeWithMapping.getProof(i);
          break;
        }
      }
      // now use that - this should work:
      expect(await anft1.balanceOf(minter1.address)).to.equal("0");
      await anft1.connect(minter1).mintWithMapping(proof, {value: cost});
      expect(await anft1.balanceOf(minter1.address)).to.equal("1");

      // but minter2 should not be able to when using the same proof and parameters:
      const minter2 = presaleMintersAsSigners[1];
      expect(await anft1.balanceOf(minter2.address)).to.equal("0");
      expect(await anft1.balanceOf(minter1.address)).to.equal("1"); // minter1 ofc should not change its holdings
      await expect(anft1.connect(minter2).mintWithMapping(proof, {value: cost})).to.be.revertedWith("Unauthorized mint!");
      expect(await anft1.balanceOf(minter2.address)).to.equal("0");
      expect(await anft1.balanceOf(minter1.address)).to.equal("1");
    })

    it("BitMap: Should mint at an ether cost", async function () {
      // now mint but using the Bitmap approach
      const { anft1, anft2, treeWithBitmap, treeWithMapping, valuesBitmap, valuesMapping, presaleMintersAsSigners, owner, alice, bob } = await loadFixture(deployTokenFixture);

      expect(await anft2.balanceOf(owner.address)).to.equal("0")
      expect(await anft2.balanceOf(alice.address)).to.equal("0")
      expect(await anft2.balanceOf(bob.address)).to.equal("0")

      // nobody owns token id 0 (or any other id for that matter)
      await expect(anft2.ownerOf(0)).to.be.revertedWith("ERC721: invalid token ID");

      // pick a minter
      const minter1 = presaleMintersAsSigners[0];

      // shouldn't be possible without sending funds
      await expect(anft2.connect(minter1).mintWithBitMap([], 0)).to.be.revertedWith("Insufficient funds!");

      // it's also not possible without proof of allowlisting!
      let cost = 1_000_000; // cost of 1 NFT (see the contract)
      await expect(anft2.connect(minter1).mintWithBitMap([], 0, {value: cost})).to.be.revertedWith("Unauthorized mint!");

      // find the Merkle proof of minter1:
      let proof;
      let ticketNumber;
      for (const [i, v] of treeWithBitmap.entries()) {
        if (v[0] === minter1.address) {
          proof = treeWithBitmap.getProof(i);
          ticketNumber = v[1];
          break;
        }
      }
      
      // now use that - this should work:
      expect(await anft2.balanceOf(minter1.address)).to.equal("0");
      await anft2.connect(minter1).mintWithBitMap(proof, ticketNumber, {value: cost});
      expect(await anft2.balanceOf(minter1.address)).to.equal("1");

      // but minter2 should not be able to when using the same proof and parameters:
      const minter2 = presaleMintersAsSigners[1];
      expect(await anft2.balanceOf(minter2.address)).to.equal("0");
      expect(await anft2.balanceOf(minter1.address)).to.equal("1"); // minter1 ofc should not change its holdings
      await expect(anft2.connect(minter2).mintWithBitMap(proof, ticketNumber, {value: cost})).to.be.revertedWith("Unauthorized mint!");
      expect(await anft2.balanceOf(minter2.address)).to.equal("0");
      expect(await anft2.balanceOf(minter1.address)).to.equal("1");
    })
  });

  it("Mapping: Should mint a lot of NFTs and test the gas", async function() {
    const { presaleMintersAsSigners, treeWithMapping, anft1 } = await loadFixture(deployTokenFixture);

    let num = 0;
    for (const minter of presaleMintersAsSigners) {
      // find the Merkle proof of minter1:
      let proof;
      for (const [i, v] of treeWithMapping.entries()) {
        if (v[0] === minter.address) {
          proof = treeWithMapping.getProof(i);
          break;
        }
      }
      // now use that - this should work:
      expect(await anft1.balanceOf(minter.address)).to.equal("0");
      await anft1.connect(minter).mintWithMapping(proof, {value: cost});
      expect(await anft1.balanceOf(minter.address)).to.equal("1");

      num += 1;

      if (num == 8) {
        break;
      }
    }
  });

  it("Bitmap: Should mint a lot of NFTs and test the gas", async function() {
    const { presaleMintersAsSigners, treeWithBitmap, anft2 } = await loadFixture(deployTokenFixture);
    
    let num = 0;
    for (const minter of presaleMintersAsSigners) {
      // find the Merkle proof of minter1:
      let proof;
      let ticketNumber;
      for (const [i, v] of treeWithBitmap.entries()) {
        if (v[0] === minter.address) {
          proof = treeWithBitmap.getProof(i);
          ticketNumber = v[1];
          break;
        }
      }
      // now use that - this should work:
      expect(await anft2.balanceOf(minter.address)).to.equal("0");
      await anft2.connect(minter).mintWithBitMap(proof, ticketNumber, {value: cost});
      expect(await anft2.balanceOf(minter.address)).to.equal("1");
      num += 1;

      if (num == 8) {
        break;
      }
    }
  });

  it("should not allow to mint more than 1 NFT per minter", async function() {
    const { anft1, treeWithMapping, presaleMintersAsSigners, owner, alice, bob } = await loadFixture(deployTokenFixture);

    expect(await anft1.balanceOf(owner.address)).to.equal("0")
    expect(await anft1.balanceOf(alice.address)).to.equal("0")
    expect(await anft1.balanceOf(bob.address)).to.equal("0")

    // pick a minter
    const minter1 = presaleMintersAsSigners[0];

    // find the Merkle proof of minter1:
    let proof;
    for (const [i, v] of treeWithMapping.entries()) {
      if (v[0] === minter1.address) {
        proof = treeWithMapping.getProof(i);
        break;
      }
    }
    // now use that - this should work:
    expect(await anft1.balanceOf(minter1.address)).to.equal("0");
    await anft1.connect(minter1).mintWithMapping(proof, {value: cost});
    expect(await anft1.balanceOf(minter1.address)).to.equal("1");

    // try minting again - should not work:
    await expect(anft1.connect(minter1).mintWithMapping(proof, {value: cost})).to.be.revertedWith("Already minted!");
  });

  it("should allow minters to transfer NFTs to anyone", async function() {
    const { anft1, treeWithMapping, presaleMintersAsSigners, owner, alice, bob } = await loadFixture(deployTokenFixture);

    expect(await anft1.balanceOf(owner.address)).to.equal("0")
    expect(await anft1.balanceOf(alice.address)).to.equal("0")
    expect(await anft1.balanceOf(bob.address)).to.equal("0")

    // pick a minter
    const minter1 = presaleMintersAsSigners[0];
    
    // find the Merkle proof of minter1:
    let proof;
    for (const [i, v] of treeWithMapping.entries()) {
      if (v[0] === minter1.address) {
        proof = treeWithMapping.getProof(i);
        break;
      }
    }
    // now use that - this should work:
    expect(await anft1.balanceOf(minter1.address)).to.equal("0");
    await anft1.connect(minter1).mintWithMapping(proof, {value: cost});
    expect(await anft1.balanceOf(minter1.address)).to.equal("1");

    expect(await anft1.ownerOf(0)).to.equal(minter1.address);

    // transfer to some other account
    const minter2 = presaleMintersAsSigners[1];
    let tx = await anft1.connect(minter1).transferFrom(minter1.address, minter2.address, 0);
    await tx.wait();

    expect(await anft1.ownerOf(0)).to.equal(minter2.address);
    expect(await anft1.balanceOf(minter1.address)).to.equal("0");
    expect(await anft1.balanceOf(minter2.address)).to.equal("1");

    // be sure the access rights are fine:
    await expect(anft1.connect(minter1).transferFrom(minter1.address, minter2.address, 0)).to.be.revertedWith("ERC721: caller is not token owner or approved");
  });

  it("Should enable the commit/reveal scheme", async () => {
    const { anft1, owner, alice } = await loadFixture(deployTokenFixture);

    let answer = 4;
    const salt = "0x4444444444444444444444444444444444444444444444444444444444444444";
    let saltedShift = await anft1.createSaltedHash(answer, salt);
    
    // a non-owner cannot commit:
    await expect(anft1.connect(alice).commit(saltedShift)).to.be.revertedWith("Ownable: caller is not the owner");

    // but the owner can:
    let tx = await anft1.connect(owner).commit(saltedShift);
    await tx.wait();

    // and the event is emitted:
    await expect(anft1.connect(owner).commit(saltedShift)).to.emit(anft1, "CommitHash").withArgs(saltedShift, 5); // happens to be block 5 after uint64

    // we cannot reveal within 10 blocks:
    await expect(anft1.connect(owner).reveal(answer, salt)).to.be.revertedWith("Reveal has to happen >=10 blocks from commit!");

    // so let's move the chain forward by 10 blocks:
    await mine(10);

    // but we can't reveal the wrong answer:
    await expect(anft1.connect(owner).reveal(2 * answer, salt)).to.be.revertedWith("Revealed hash does not match original committed hash!");

    // we can, however, reveal the correct answer - and ensure that the emitted event matches it:
    await expect(anft1.connect(owner).reveal(answer, salt)).to.emit(anft1, "Reveal").withArgs(answer, salt);

    // but we can't reveal more than once:
    await expect(anft1.connect(owner).reveal(answer, salt)).to.be.revertedWith("Already revealed!");
  });

  it("Should enable multitransfer via multidelegatecall", async () => {
    const { anft2, alice, presaleMintersAsSigners, treeWithBitmap } = await loadFixture(deployTokenFixture);

      await expect(anft2.ownerOf(0)).to.be.revertedWith("ERC721: invalid token ID");
      // pick a minter
      const minter1 = presaleMintersAsSigners[0];

      // find the Merkle proof of minter1:
      let proof;
      let ticketNumber;
      for (const [i, v] of treeWithBitmap.entries()) {
        if (v[0] === minter1.address) {
          proof = treeWithBitmap.getProof(i);
          ticketNumber = v[1];
          break;
        }
      }
      
      // now use that - this should work:
      expect(await anft2.balanceOf(minter1.address)).to.equal("0");
      await anft2.connect(minter1).mintWithBitMap(proof, ticketNumber, {value: cost});
      expect(await anft2.balanceOf(minter1.address)).to.equal("1");

      expect(await anft2.ownerOf(0)).to.equal(minter1.address);

      // get the call data needed to move from minter1 to alice:
      let callData = await anft2.helperGetCallData(minter1.address, alice.address, 0);

      result = await anft2.connect(minter1).multiTransfer([callData]);
      await result.wait();

      // now alice owns the nft
      expect(await anft2.ownerOf(0)).to.equal(alice.address);
      expect(await anft2.balanceOf(minter1.address)).to.equal("0");
      expect(await anft2.balanceOf(alice.address)).to.equal("1");

      // let's transfer multiple NFTs
      // pick a minter
      const minter2 = presaleMintersAsSigners[1];
      const minter3 = presaleMintersAsSigners[2];

      // find the Merkle proof of minter1:
      let proof2;
      let ticketNumber2;
      let proof3;
      let ticketNumber3;
      for (const [i, v] of treeWithBitmap.entries()) {
        if (v[0] === minter2.address) {
          proof2 = treeWithBitmap.getProof(i);
          ticketNumber2 = v[1];
        }
        if (v[0] === minter3.address) {
          proof3 = treeWithBitmap.getProof(i);
          ticketNumber3 = v[1];
          break;
        }
      }

      expect(await anft2.balanceOf(minter2.address)).to.equal("0");
      await anft2.connect(minter2).mintWithBitMap(proof2, ticketNumber2, {value: cost});
      expect(await anft2.ownerOf(1)).to.equal(minter2.address);
      expect(await anft2.balanceOf(minter2.address)).to.equal("1");

      expect(await anft2.balanceOf(minter3.address)).to.equal("0");
      await anft2.connect(minter3).mintWithBitMap(proof3, ticketNumber3, {value: cost});
      expect(await anft2.ownerOf(2)).to.equal(minter3.address);
      expect(await anft2.balanceOf(minter3.address)).to.equal("1");

      // now first transfer from 3 to 2:
      callData = await anft2.helperGetCallData(minter3.address, minter2.address, 2);
      result = await anft2.connect(minter3).multiTransfer([callData]);
      await result.wait();

      expect(await anft2.balanceOf(minter2.address)).to.equal("2");

      // now do a multi-transfer from 2 to 1:
      expect(await anft2.balanceOf(minter1.address)).to.equal("0"); // who has 0 to start
      callData1 = await anft2.helperGetCallData(minter2.address, minter1.address, 1);
      callData2 = await anft2.helperGetCallData(minter2.address, minter1.address, 2);

      result = await anft2.connect(minter2).multiTransfer([callData1, callData2]);
      await result.wait();

      expect(await anft2.balanceOf(minter1.address)).to.equal("2"); // and now has both (aka all)

      expect(await anft2.balanceOf(minter2.address)).to.equal("0");
      expect(await anft2.balanceOf(minter3.address)).to.equal("0");

      // we can't call mint, though b/c it's payable
      wrongCallData = await anft2.helperGetWrongCallData(proof2, ticketNumber2);

      // pick any person to make the wrong call:
      await expect(anft2.connect(minter1).multiTransfer([wrongCallData])).to.be.revertedWithCustomError(anft2, "InvalidCall");
  });

  it("Should check that the State Machine works", async () => {
    const { presaleMintersAsSigners, publicsaleMintersAsSigners, treeWithBitmap, anft2 } = await loadFixture(deployTokenFixture);

    // we should be in presale state
    expect(await anft2.state()).to.equal(0);

    // we can't publicly mint during presale:
    let minter = publicsaleMintersAsSigners[0]; // pick a public minter
    expect(await anft2.balanceOf(minter.address)).to.equal("0");
    await expect(anft2.connect(minter).mint({value: cost})).to.be.revertedWith("Invalid Mint State!");
    expect(await anft2.balanceOf(minter.address)).to.equal("0");
    
    // now mint all presales
    let num = 0;
    for (const minter of presaleMintersAsSigners) {
      // find the Merkle proof of minter:
      let proof;
      let ticketNumber;
      for (const [i, v] of treeWithBitmap.entries()) {
        if (v[0] === minter.address) {
          proof = treeWithBitmap.getProof(i);
          ticketNumber = v[1];
          break;
        }
      }
      // now use that - this should work:
      expect(await anft2.balanceOf(minter.address)).to.equal("0");
      await anft2.connect(minter).mintWithBitMap(proof, ticketNumber, {value: cost});
      expect(await anft2.balanceOf(minter.address)).to.equal("1");

      num += 1;

      // confirm we are still in presale state:
      if (num < 8) { // we have 8 presales
        expect(await anft2.state()).to.equal(0);
      }

      if (num >= 8) {
        break;
      }
    }

    // we are in a public sale now:
    expect(await anft2.state()).to.equal(1);

    // pick a fresh presale minter (who didn't make the presale):
    minter = presaleMintersAsSigners[9]
    // find the Merkle proof of minter:
    let proof;
    let ticketNumber;
    for (const [i, v] of treeWithBitmap.entries()) {
      if (v[0] === minter.address) {
        proof = treeWithBitmap.getProof(i);
        ticketNumber = v[1];
        break;
      }
    }

    // we can't mint in a presale state:
    expect(await anft2.balanceOf(minter.address)).to.equal("0");
    await expect(anft2.connect(minter).mintWithBitMap(proof, ticketNumber, {value: cost})).to.be.revertedWith("Invalid Mint State!");
    expect(await anft2.balanceOf(minter.address)).to.equal("0");

    // since we have 20 total nfts, mint another 10 in a public way now - they don't need proofs:
    num = 0;
    for (const minter of publicsaleMintersAsSigners) {
      expect(await anft2.balanceOf(minter.address)).to.equal("0");
      await anft2.connect(minter).mint({value: cost});
      expect(await anft2.balanceOf(minter.address)).to.equal("1");

      num += 1;

      if (num == 12) {
        break;
      }

      expect(await anft2.state()).to.equal(1); // public state
    }

    // now we have run out of supply
    expect(await anft2.state()).to.equal(2); // out of supply state

    // we can't mint anymore
    minter = publicsaleMintersAsSigners[13]; // pick a minter not used
    expect(await anft2.balanceOf(minter.address)).to.equal("0");
    await expect(anft2.connect(minter).mint({value: cost})).to.be.revertedWith("Invalid Mint State!");
    expect(await anft2.balanceOf(minter.address)).to.equal("0");

    // still cannot presale mint of course:
    expect(await anft2.balanceOf(minter.address)).to.equal("0");
    await expect(anft2.connect(minter).mintWithBitMap(proof, ticketNumber, {value: cost})).to.be.revertedWith("Invalid Mint State!");
    expect(await anft2.balanceOf(minter.address)).to.equal("0");
  });

  it("Should allow users to set a nickname for their NFT", async () => {
    const { presaleMintersAsSigners, publicsaleMintersAsSigners, treeWithBitmap, anft2 } = await loadFixture(deployTokenFixture);

    // we should be in presale state
    expect(await anft2.state()).to.equal(0);

    // we can't publicly mint during presale:
    let minter = publicsaleMintersAsSigners[0]; // pick a public minter
    expect(await anft2.balanceOf(minter.address)).to.equal("0");
    await expect(anft2.connect(minter).mint({value: cost})).to.be.revertedWith("Invalid Mint State!");
    expect(await anft2.balanceOf(minter.address)).to.equal("0");
    
    // now mint all presales
    let num = 0;
    for (const minter of presaleMintersAsSigners) {
      // find the Merkle proof of minter:
      let proof;
      let ticketNumber;
      for (const [i, v] of treeWithBitmap.entries()) {
        if (v[0] === minter.address) {
          proof = treeWithBitmap.getProof(i);
          ticketNumber = v[1];
          break;
        }
      }
      // now use that - this should work:
      expect(await anft2.balanceOf(minter.address)).to.equal("0");
      await anft2.connect(minter).mintWithBitMap(proof, ticketNumber, {value: cost});
      expect(await anft2.balanceOf(minter.address)).to.equal("1");

      num += 1;

      // confirm we are still in presale state:
      if (num < 8) { // we have 8 presales
        expect(await anft2.state()).to.equal(0);
      }

      if (num >= 8) {
        break;
      }
    }

    // now that we have minted a few NFTs, let's set some nicknames:
    expect(await anft2.tokenURI(0)).to.equal("");

    await anft2.connect(presaleMintersAsSigners[0]).setNickname(0, "hello world!");
    expect(await anft2.tokenURI(0)).to.equal("hello world!");
    expect(await anft2.nickName(0)).to.equal("hello world!");

    await anft2.connect(presaleMintersAsSigners[1]).setNickname(1, "❓❓❓");
    expect(await anft2.tokenURI(1)).to.equal("❓❓❓");

    // but if a user does not own the nft they can't set the nickname:
    await expect(anft2.connect(presaleMintersAsSigners[0]).setNickname(1, "❓")).to.be.revertedWith("Not Owner!");

    // the nickname cannot be more than 20 characters long:
    // 20 characters does not revert:
    await anft2.connect(presaleMintersAsSigners[0]).setNickname(0, "12345678901234567890");

    // but 21 does:
    await expect(anft2.connect(presaleMintersAsSigners[0]).setNickname(0, "123456789012345678901")).to.be.revertedWith("Nickname must be at least 20 characters!");

    // try with unicode characters too:
    // 20 chars should not revert:
    await anft2.connect(presaleMintersAsSigners[0]).setNickname(0, "❓❓❓❓❓❓❓❓❓❓❓❓❓❓❓❓❓❓❓❓");

    // but 21 does revert:
    await expect(anft2.connect(presaleMintersAsSigners[0]).setNickname(0, "❓❓❓❓❓❓❓❓❓❓❓❓❓❓❓❓❓❓❓❓❓")).to.be.revertedWith("Nickname must be at least 20 characters!");
  });

  it("Should allow only the owner to withdraw funds", async () => {
    const { anft2, alice, owner } = await loadFixture(deployTokenFixture);

    // send some funds to the contract:
    await hre.network.provider.send("hardhat_setBalance", [
      anft2.address,
      "0x8ac7230489e80000"
    ]);

    // anyone can't withdraw:
    await expect(anft2.connect(alice).withdraw()).to.be.revertedWith("Ownable: caller is not the owner");

    // but the owner can:
    let bal1 = await anft2.provider.getBalance(owner.address);
    await anft2.connect(owner).withdraw();
    let bal2 = await anft2.provider.getBalance(owner.address);
    expect(bal2 - bal1).to.be.greaterThan(0);

    // and not calling owner explicitly is the same:
    await hre.network.provider.send("hardhat_setBalance", [
      anft2.address,
      "0x8ac7230489e80000"
    ]);
    await anft2.withdraw();
  });

  it.only("Should deploy to predetermined address", async () => {
    const { anft2 } = await loadFixture(deployTokenFixture);

    // you can put whatever target number of zeroes you want
    let targetNumZeroes = 3;
    result = await anft2.mineAddress(anft2.address, targetNumZeroes, 0); // the loops=0 (last param, just says: loop until you find it; you'd run this offline in general)
    
    // the address that was mined for is (look at the returned args from mineAddress if in doubt):
    let addressMined = result[1];
    console.log(addressMined);

    // now that we have the address with the given number of zeros, we can deploy a clone of the existing contract to it:
    // @dev note that this pattern might be strange and perhaps we should use a "factory" instead to deploy the anft2s to vanity addresses
    // but the intent here is just to show how one could do this - so right now the anft2 actually can clone itself and deploy to any vanity address you want:
    await expect(anft2.launchContract(result[0])).to.emit(anft2, "EfficientContractLaunched").withArgs(addressMined);

    // ensure the deployed contract at the vanity address is correct
    // we attach to the contract below saying "the contract at address addressMined is an AdvancedNFT contract":
    const thevanitydeployedcontract = await hre.ethers.getContractAt("AdvancedNFT", addressMined);

    // Try calling any function to ensure things are working properly on the newly deployed vanity-address contract:
    expect(await thevanitydeployedcontract.numberOfLeadingHexZeros(thevanitydeployedcontract.address)).to.equal(targetNumZeroes);

    // the next step would then be to transfer ownership to the multisig (not shown here, but that's easy via TransferOwnership(...))
    // you can create the multisig on Polygon here: https://safe.global/
  });
});