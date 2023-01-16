const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
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
    const numMinters = 10; // number of pre-sale recipients

    const valuesMapping = [];
    const valuesBitmap = [];
    const mintersAsSigners = [];
    
    for (let i = 0; i < numMinters; i++) {
      let signer = ethers.Wallet.createRandom().connect(hre.ethers.provider); // a minter
      valuesMapping.push([signer.address]);
      valuesBitmap.push([signer.address, i]);
      mintersAsSigners.push(signer);

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
    const anft1 = await ANFT.deploy("mapping", "MAP", treeWithMapping.root);
    await anft1.deployed();

    const anft2 = await ANFT.deploy("bitmap", "BMP", treeWithBitmap.root);
    await anft2.deployed();

    return { anft1, anft2, treeWithBitmap, treeWithMapping, valuesBitmap, valuesMapping, mintersAsSigners, owner, alice, bob };
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
      const { anft1, anft2, treeWithBitmap, treeWithMapping, valuesBitmap, valuesMapping, mintersAsSigners, owner, alice, bob } = await loadFixture(deployTokenFixture);

      expect(await anft1.balanceOf(owner.address)).to.equal("0")
      expect(await anft1.balanceOf(alice.address)).to.equal("0")
      expect(await anft1.balanceOf(bob.address)).to.equal("0")

      // nobody owns token id 0 (or any other id for that matter)
      await expect(anft1.ownerOf(0)).to.be.revertedWith("ERC721: invalid token ID");

      // pick a minter
      const minter1 = mintersAsSigners[0];

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
      const minter2 = mintersAsSigners[1];
      expect(await anft1.balanceOf(minter2.address)).to.equal("0");
      expect(await anft1.balanceOf(minter1.address)).to.equal("1"); // minter1 ofc should not change its holdings
      await expect(anft1.connect(minter2).mintWithMapping(proof, {value: cost})).to.be.revertedWith("Unauthorized mint!");
      expect(await anft1.balanceOf(minter2.address)).to.equal("0");
      expect(await anft1.balanceOf(minter1.address)).to.equal("1");
    })

    it("BitMap: Should mint at an ether cost", async function () {
      // now mint but using the Bitmap approach
      const { anft1, anft2, treeWithBitmap, treeWithMapping, valuesBitmap, valuesMapping, mintersAsSigners, owner, alice, bob } = await loadFixture(deployTokenFixture);

      expect(await anft2.balanceOf(owner.address)).to.equal("0")
      expect(await anft2.balanceOf(alice.address)).to.equal("0")
      expect(await anft2.balanceOf(bob.address)).to.equal("0")

      // nobody owns token id 0 (or any other id for that matter)
      await expect(anft2.ownerOf(0)).to.be.revertedWith("ERC721: invalid token ID");

      // pick a minter
      const minter1 = mintersAsSigners[0];

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
      const minter2 = mintersAsSigners[1];
      expect(await anft2.balanceOf(minter2.address)).to.equal("0");
      expect(await anft2.balanceOf(minter1.address)).to.equal("1"); // minter1 ofc should not change its holdings
      await expect(anft2.connect(minter2).mintWithBitMap(proof, ticketNumber, {value: cost})).to.be.revertedWith("Unauthorized mint!");
      expect(await anft2.balanceOf(minter2.address)).to.equal("0");
      expect(await anft2.balanceOf(minter1.address)).to.equal("1");
    })
  });

  it("Mapping: Should mint a lot of NFTs and test the gas", async function() {
    const { mintersAsSigners, treeWithMapping, anft1 } = await loadFixture(deployTokenFixture);

    for (const minter of mintersAsSigners) {
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
    }
  });

  it("Bitmap: Should mint a lot of NFTs and test the gas", async function() {
    const { mintersAsSigners, treeWithBitmap, anft2 } = await loadFixture(deployTokenFixture);
    
    for (const minter of mintersAsSigners) {
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
    }
  });

  it("should not allow to mint more than 1 NFT per minter", async function() {
    const { anft1, treeWithMapping, mintersAsSigners, owner, alice, bob } = await loadFixture(deployTokenFixture);

    expect(await anft1.balanceOf(owner.address)).to.equal("0")
    expect(await anft1.balanceOf(alice.address)).to.equal("0")
    expect(await anft1.balanceOf(bob.address)).to.equal("0")

    // pick a minter
    const minter1 = mintersAsSigners[0];

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
    const { anft1, treeWithMapping, mintersAsSigners, owner, alice, bob } = await loadFixture(deployTokenFixture);

    expect(await anft1.balanceOf(owner.address)).to.equal("0")
    expect(await anft1.balanceOf(alice.address)).to.equal("0")
    expect(await anft1.balanceOf(bob.address)).to.equal("0")

    // pick a minter
    const minter1 = mintersAsSigners[0];
    
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
    const minter2 = mintersAsSigners[1];
    let tx = await anft1.connect(minter1).transferFrom(minter1.address, minter2.address, 0);
    await tx.wait();

    expect(await anft1.ownerOf(0)).to.equal(minter2.address);
    expect(await anft1.balanceOf(minter1.address)).to.equal("0");
    expect(await anft1.balanceOf(minter2.address)).to.equal("1");

    // be sure the access rights are fine:
    await expect(anft1.connect(minter1).transferFrom(minter1.address, minter2.address, 0)).to.be.revertedWith("ERC721: caller is not token owner or approved");
  });

  it("Should enable the commit/reveal scheme", async () => {
    const { anft1, owner, alice, bob } = await loadFixture(deployTokenFixture);

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
    const { anft2, owner, alice, mintersAsSigners, treeWithBitmap } = await loadFixture(deployTokenFixture);

      await expect(anft2.ownerOf(0)).to.be.revertedWith("ERC721: invalid token ID");
      // pick a minter
      const minter1 = mintersAsSigners[0];

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
      const minter2 = mintersAsSigners[1];
      const minter3 = mintersAsSigners[2];

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
});