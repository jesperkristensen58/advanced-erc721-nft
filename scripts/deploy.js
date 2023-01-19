const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("🏁 Deploying contracts with the account:", deployer.address);

    console.log("Account balance:", (await deployer.getBalance()).toString());

    const numPresaleMinters = 10; // number of pre-sale recipients
    const valuesBitmap = [];
    for (let i = 0; i < numPresaleMinters; i++) {
      let signer = ethers.Wallet.createRandom().connect(hre.ethers.provider); // a pre-sale participant
      valuesBitmap.push([signer.address, i]);
    }
    // note that these accounts won't have any ether so can't actually mint anything, but we just do this to construct the Merkle tree root

    const treeWithBitmap = StandardMerkleTree.of(valuesBitmap, ["address", "uint256"]);
    console.log('Merkle Root for "Bitmap" Presale: ', treeWithBitmap.root);

    const ANFT = await ethers.getContractFactory("AdvancedNFT");
    const anft = await ANFT.deploy("Advanced NFT", "ANFT", treeWithBitmap.root, 10, 20); // 10 pre-sale participants with 20 total supply; just as a simple example

    console.log("Advanced NFT address:", anft.address);
    console.log("✓ Deployment completed.")

    console.log("Transferring ownership of the contract to the multisig...")
    // transfer ownership to the multisig:
    let gnosis_safe_address = "0x9a2613Eda1411FE168d4E6D362eF4C8FA8f521d2";
    await anft.transferOwnership(gnosis_safe_address);

    console.log("✓ Ownership transferred to the multisig at: ", gnosis_safe_address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
});