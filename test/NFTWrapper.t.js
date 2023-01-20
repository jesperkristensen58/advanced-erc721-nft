const {
    time,
    loadFixture,
  } = require("@nomicfoundation/hardhat-network-helpers");
  const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
  const { expect } = require("chai");
  const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
  const hre = require("hardhat");
  const { mine } = require("@nomicfoundation/hardhat-network-helpers"); // need this to advance the chain
  
  describe("NFT Wrapper", function () {

    const cost = 1_000_000; // cost of 1 NFT (see the contract)

    // run this fixture once and re-use in all tests
    async function deployTokenFixture() {
        const [owner, alice, bob] = await ethers.getSigners();

        // prepare the pre-sale to some random minters
        // const numMinters = 5000; // create this many random minters of the NFT - we used this to compare gas prices (takes a long time to run)
        const numPresaleMinters = 10; // number of pre-sale recipients

        const valuesBitmap = [];
        const presaleMintersAsSigners = [];
        for (let i = 0; i < numPresaleMinters; i++) {
            let signer = ethers.Wallet.createRandom().connect(hre.ethers.provider); // a minter
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

        const ANFT = await ethers.getContractFactory("AdvancedNFT");
        const anft2 = await ANFT.deploy("bitmap", "BMP", treeWithBitmap.root, 8, 20);
        await anft2.deployed();

        // now deploy the wrapper
        const WRAPPER = await ethers.getContractFactory("NFTWrapper");
        const wrapper = await WRAPPER.deploy(anft2.address);
        await wrapper.deployed();

        return { anft2, wrapper, owner, alice, bob, treeWithBitmap, presaleMintersAsSigners };
    }

    describe("Deployment", async () => {
        it("Should deploy as expected", async function () {
        const { anft2, wrapper } = await loadFixture(deployTokenFixture);
    
        expect(anft2.address).to.not.be.null;
        expect(await anft2.name()).to.equal("bitmap");
        expect(await anft2.symbol()).to.equal("BMP");

        expect(wrapper.address).to.not.be.null;
        })
    });

    it("Should wrap and unwrap correctly", async function () {
        const { anft2, wrapper, presaleMintersAsSigners, treeWithBitmap } = await loadFixture(deployTokenFixture);

        // a pre-sale minter mints the regular NFT first:
        let some_minter = presaleMintersAsSigners[0];

        let proof;
        let ticketNumber;
        for (const [i, v] of treeWithBitmap.entries()) {
            if (v[0] === some_minter.address) {
                proof = treeWithBitmap.getProof(i);
                ticketNumber = v[1];
                break;
            }
        }
        expect(await anft2.balanceOf(some_minter.address)).to.equal("0");
        await anft2.connect(some_minter).mintWithBitMap(proof, ticketNumber, {value: cost});
        expect(await anft2.balanceOf(some_minter.address)).to.equal("1");
        expect(await anft2.ownerOf(0)).to.equal(some_minter.address);
        
        // now the minter wraps the NFT:
        // first, the minter gives access to the NFT:
        await anft2.connect(some_minter).approve(wrapper.address, 0); // this could happen on the frontend
        // now wrap - the nft is transferred from some_minter to the wrapper:
        await wrapper.connect(some_minter).wrap(0);

        // confirm:
        expect(await anft2.balanceOf(some_minter.address)).to.equal("0"); // does not hold the nft
        expect(await anft2.balanceOf(wrapper.address)).to.equal("1"); // the contract has it
        
        // and now we check that the ERC1155 was transferred - so we ask the wrapper:
        expect(await wrapper.balanceOf(some_minter.address, 0)).to.equal("1"); // some_minter has the erc1155 token
        expect(await wrapper.balanceOf(wrapper.address, 0)).to.equal("0"); // not the wrapper contract

        // some_minter can now unwrap:
        await wrapper.connect(some_minter).unwrap(0);

        // the nft is back with the minter:
        expect(await anft2.balanceOf(some_minter.address)).to.equal("1"); // does not hold the nft
        expect(await anft2.balanceOf(wrapper.address)).to.equal("0"); // the contract has it

        // and the erc1155 id is burned:
        expect(await wrapper.balanceOf(some_minter.address, 0)).to.equal("0"); // some_minter has the erc1155 token
        expect(await wrapper.balanceOf(wrapper.address, 0)).to.equal("0"); // not the wrapper contract
    });

    it("Should wrap and unwrap even after transferring to others", async function () {
        const { anft2, wrapper, alice, bob, presaleMintersAsSigners, treeWithBitmap } = await loadFixture(deployTokenFixture);

        // a pre-sale minter mints the regular NFT first:
        let some_minter = presaleMintersAsSigners[0];

        let proof;
        let ticketNumber;
        for (const [i, v] of treeWithBitmap.entries()) {
            if (v[0] === some_minter.address) {
                proof = treeWithBitmap.getProof(i);
                ticketNumber = v[1];
                break;
            }
        }
        expect(await anft2.balanceOf(some_minter.address)).to.equal("0");
        await anft2.connect(some_minter).mintWithBitMap(proof, ticketNumber, {value: cost});
        expect(await anft2.balanceOf(some_minter.address)).to.equal("1");
        expect(await anft2.ownerOf(0)).to.equal(some_minter.address);

        // now the minter wraps the NFT:
        // first, the minter gives access to the NFT:
        await anft2.connect(some_minter).approve(wrapper.address, 0); // this could happen on the frontend
        // now wrap - the nft is transferred from some_minter to the wrapper:
        await wrapper.connect(some_minter).wrap(0);

        expect(await wrapper.balanceOf(some_minter.address, 0)).to.equal("1");
        expect(await wrapper.balanceOf(alice.address, 0)).to.equal("0");

        // now transfer to another person:
        // first, give the wrapper access to the token:
        await wrapper.connect(some_minter).setApprovalForAll(wrapper.address, true);
        await wrapper.connect(some_minter).safeTransferFrom(some_minter.address, alice.address, 0, 1, []);
        
        expect(await wrapper.balanceOf(some_minter.address, 0)).to.equal("0");
        expect(await wrapper.balanceOf(alice.address, 0)).to.equal("1"); // alice has it now

        // make sure the state is as expected:
        expect(await anft2.balanceOf(some_minter.address)).to.equal("0");
        expect(await anft2.balanceOf(alice.address)).to.equal("0");

        // now Alice should get back the original NFT when she unwraps:
        // but first... let's make sure some_minter cannot unwrap (since they don't own the erc1155):
        await expect(wrapper.connect(some_minter).unwrap(0)).to.be.revertedWith("Not the owner!");
        await expect(wrapper.connect(bob).unwrap(0)).to.be.revertedWith("Not the owner!"); // or anyone else

        expect(await anft2.balanceOf(some_minter.address)).to.equal("0");
        expect(await anft2.balanceOf(alice.address)).to.equal("0");

        // but now Alice unwraps:
        await wrapper.connect(alice).unwrap(0);

        expect(await anft2.balanceOf(some_minter.address)).to.equal("0");
        expect(await anft2.balanceOf(alice.address)).to.equal("1");

        // and the erc1155 is burned:
        expect(await wrapper.balanceOf(some_minter.address, 0)).to.equal("0");
        expect(await wrapper.balanceOf(alice.address, 0)).to.equal("0");
        expect(await wrapper.balanceOf(bob.address, 0)).to.equal("0");
    });
  });