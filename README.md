# Advanced NFT Features

In this project, we will explore adding advanced features to an NFT project.

For example, we will look at how to do a bitmap-based airdrop presale.

## Comparing Mapping-based Airdrop to Bitmap-based Airdrop

We ran the comparison against `5,000` NFTs and enabled the gas-report hardhat plugin (see `hardhat.config.js`).
Warning: This takes a very long time to run because 5000 accounts need to be generated along with 5000 proofs etc.
The test code under `test/` can surely be sped up by much faster matching account with proof, but for now this is what it is and demonstrates in full the intent of the project.

From this, the gas cost comparison between the mapping-based Airdrop and Bitmap-based Airdrop are as follows:

<pre>
·-----------------------------------|----------------------------|-------------|-----------------------------·
|        Solc version: 0.8.9        ·  Optimizer enabled: false  ·  Runs: 200  ·  Block limit: 30000000 gas  │
····································|····························|·············|······························
|  Methods                                                                                                   │
················|···················|··············|·············|·············|···············|··············
|  Contract     ·  Method           ·  Min         ·  Max        ·  Avg        ·  # calls      ·  usd (avg)  │
················|···················|··············|·············|·············|···············|··············
|  AdvancedNFT  ·  mintWithBitMap   ·       99543  ·     122351  ·     104687  ·         5001  ·          -  │
················|···················|··············|·············|·············|···············|··············
|  AdvancedNFT  ·  mintWithMapping  ·      120698  ·     137878  ·     121135  ·         5003  ·          -  │
················|···················|··············|·············|·············|···············|··············
|  AdvancedNFT  ·  transferFrom     ·           -  ·          -  ·      56198  ·            2  ·          -  │
················|···················|··············|·············|·············|···············|··············
|  Deployments                      ·                                          ·  % of limit   ·             │
····································|··············|·············|·············|···············|··············
|  AdvancedNFT                      ·           -  ·          -  ·    3786184  ·       12.6 %  ·          -  │
·-----------------------------------|--------------|-------------|-------------|---------------|-------------·
</pre>

We see that minting with the bitmap approach saves `121,135 - 104,687 = 16,448` gas units. This code can certainly be optimized further to show even bigger gains, but the purpose is to show that for large airdrops, the design obviously matters and the bitmap approach is a good choice (there are better global choices, but those are not considered here).

## Deploying to a Multisig

We deploy to a Gnosis Multisig on the Polygon network.

```
> npx hardhat run scripts/deploy.js --network polygon
```

Copy the `.env.example` file to `.env` and fill in the missing environment variables.

### Deployment

```
> npx hardhat run scripts/deploy.js --network polygon

🏁 Deploying contracts with the account: 0x4C6Caa288725b362d97728226e148680Ff7D1117
Account balance: 26138791427592662942
Merkle Root for "Bitmap" Presale:  0xa16116cbd560805a6ef406206ffa3cafa87fa4e30e3179477d80bf5e31674871
Advanced NFT address: 0xD9c34dAE4ca504F279Fa4c06352C6571eA72db9b
✓ Deployment completed.
✓ Ownership transferred to the multisig at:  0x9a2613Eda1411FE168d4E6D362eF4C8FA8f521d2
```

The deployment and transfer of ownership to the Gnosis safe multisig succeeded.

### Verification

Take the address from the deployment process and use this below during the verification. Also make sure to take the Merkle root as printed during deployment. We need to input all the constructor arguments as they were during deployment, when we verify:

```
> npx hardhat verify --network polygon 0xD9c34dAE4ca504F279Fa4c06352C6571eA72db9b "Advanced NFT" "ANFT" 0xa16116cbd560805a6ef406206ffa3cafa87fa4e30e3179477d80bf5e31674871 10 20

Nothing to compile

Successfully submitted source code for contract
contracts/AdvancedNFT.sol:AdvancedNFT at 0xD9c34dAE4ca504F279Fa4c06352C6571eA72db9b
for verification on the block explorer. Waiting for verification result...

Successfully verified contract AdvancedNFT on Etherscan.
https://polygonscan.com/address/0xD9c34dAE4ca504F279Fa4c06352C6571eA72db9b#code
```

The verification of the Advanced NFT contract is successful. Only the owner can withdraw funds and hence only the multisig can withdraw funds.

## Contact
[![Twitter URL](https://img.shields.io/twitter/url/https/twitter.com/cryptojesperk.svg?style=social&label=Follow%20%40cryptojesperk)](https://twitter.com/cryptojesperk)

## License
This project uses the following license: [MIT](https://github.com/bisguzar/twitter-scraper/blob/master/LICENSE).
