const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("AdvancedNFT", function () {

  async function deployTokenFixture() {
    
    const [owner, alice, bob] = await ethers.getSigners();

    const ANFT = await ethers.getContractFactory("AdvancedNFT");
    const anft = await ANFT.deploy("test", "TST");
    await anft.deployed();

    return { anft, owner, alice, bob };
  }

  describe("Deployment", async () => {
    it("Should deploy as expected", async function () {
      const { anft } = await loadFixture(deployTokenFixture);

      expect(anft.address).to.not.be.null;
      expect(await anft.name()).to.equal("test");
      expect(await anft.symbol()).to.equal("TST");
    })
  });

  describe("Advanced NFT", function () {
    it("Should mint at an ether cost", async function () {
      const { anft, owner, alice, bob } = await loadFixture(deployTokenFixture);

      expect(await anft.balanceOf(owner.address)).to.equal("0")
      expect(await anft.balanceOf(alice.address)).to.equal("0")
      expect(await anft.balanceOf(bob.address)).to.equal("0")

      // nobody owns token id 0 (or any other id for that matter)
      await expect(anft.ownerOf(0)).to.be.revertedWith("ERC721: invalid token ID");

      let tx = await anft.connect(alice).mint(0);
      await tx.wait();

      // but now alice does
      expect(await anft.ownerOf(0)).to.equal(alice.address);

      expect(await anft.balanceOf(owner.address)).to.equal("0")
      expect(await anft.balanceOf(alice.address)).to.equal("1")
      expect(await anft.balanceOf(bob.address)).to.equal("0")
    })
  });
});
