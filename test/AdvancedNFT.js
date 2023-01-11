const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const hre = require("hardhat");

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
});
