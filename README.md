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

## Contact
[![Twitter URL](https://img.shields.io/twitter/url/https/twitter.com/cryptojesperk.svg?style=social&label=Follow%20%40cryptojesperk)](https://twitter.com/cryptojesperk)

## License
This project uses the following license: [MIT](https://github.com/bisguzar/twitter-scraper/blob/master/LICENSE).
