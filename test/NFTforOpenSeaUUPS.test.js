const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("NFTforOpenSeaUUPS", function () {
    let NFTContract, nftContract, owner, addr1, addr2;

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        // Deploy the upgradable contract
        NFTContract = await ethers.getContractFactory("NFTforOpenSeaUUPS");
        nftContract = await upgrades.deployProxy(NFTContract, [], {
            initializer: "initialize",
        });
        await nftContract.deployed();
    });

    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            expect(await nftContract.owner()).to.equal(owner.address);
        });

        it("Should have the correct base URI", async function () {
            expect(await nftContract._baseURI()).to.equal(
                "https://crimson-peaceful-moose-675.mypinata.cloud/ipfs/QmQ9FHz65cCHT9Q6jteHmLeYYYVm4dputGVHDgNA62inux"
            );
        });
    });

    describe("Minting NFTs", function () {
        it("Should mint a new NFT and assign it to the caller", async function () {
            await expect(nftContract.connect(addr1).mintNewNFT())
                .to.emit(nftContract, "newNFTMinted")
                .withArgs(addr1.address, 0);

            expect(await nftContract.ownerOf(0)).to.equal(addr1.address);
            expect(await nftContract.nextTokenId()).to.equal(1);
        });
    });

    describe("Listing and Buying NFTs", function () {
        beforeEach(async function () {
            await nftContract.connect(addr1).mintNewNFT(); // Mint tokenId = 0
        });

        it("Should list an NFT for sale", async function () {
            const price = ethers.utils.parseEther("1");

            await expect(nftContract.connect(addr1).listNFT(0, price))
                .to.emit(nftContract, "NFTforSale")
                .withArgs(addr1.address, 0, price);

            const sale = await nftContract.getSaleDetails(0);
            expect(sale.seller).to.equal(addr1.address);
            expect(sale.price).to.equal(price);
            expect(sale.isForSale).to.be.true;
        });

        it("Should allow a buyer to purchase an NFT", async function () {
            const price = ethers.utils.parseEther("1");
            await nftContract.connect(addr1).listNFT(0, price);

            await expect(
                nftContract.connect(addr2).buyNFT(0, { value: price })
            )
                .to.emit(nftContract, "NFTPurchased")
                .withArgs(addr2.address, 0, price);

            expect(await nftContract.ownerOf(0)).to.equal(addr2.address);

            const sale = await nftContract.getSaleDetails(0);
            expect(sale.isForSale).to.be.false;
        });

        it("Should not allow buying with incorrect value", async function () {
            const price = ethers.utils.parseEther("1");
            await nftContract.connect(addr1).listNFT(0, price);

            await expect(
                nftContract.connect(addr2).buyNFT(0, { value: ethers.utils.parseEther("0.5") })
            ).to.be.revertedWith("Incorrect value sent");
        });
    });

    describe("Delisting NFTs", function () {
        beforeEach(async function () {
            await nftContract.connect(addr1).mintNewNFT();
            await nftContract.connect(addr1).listNFT(0, ethers.utils.parseEther("1"));
        });

        it("Should allow the owner to delist an NFT", async function () {
            await nftContract.connect(addr1).delistNFT(0);

            const sale = await nftContract.getSaleDetails(0);
            expect(sale.isForSale).to.be.false;
        });

        it("Should not allow non-owners to delist an NFT", async function () {
            await expect(nftContract.connect(addr2).delistNFT(0)).to.be.revertedWith(
                "You are not the owner of this NFT"
            );
        });
    });

    describe("Upgradability", function () {
        it("Should upgrade the contract", async function () {
            const NewNFTContract = await ethers.getContractFactory("NFTforOpenSeaUUPS");
            const upgradedContract = await upgrades.upgradeProxy(
                nftContract.address,
                NewNFTContract
            );
            expect(upgradedContract.address).to.equal(nftContract.address);
        });
    });

    describe("Fallback Function", function () {
        it("Should revert on direct Ether transfers", async function () {
            await expect(
                addr1.sendTransaction({ to: nftContract.address, value: ethers.utils.parseEther("1") })
            ).to.be.revertedWith("");
        });
    });
});
