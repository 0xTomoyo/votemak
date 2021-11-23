import { ethers } from "hardhat";
import { Wallet, BigNumber } from "ethers";
import { expect, provider, createFixtureLoader, votemakBribeFixture, PROPOSAL } from "./shared";
import { MAX_FEE } from "../src/constants";

describe("unit/VotemakBribe", () => {
  let loadFixture: ReturnType<typeof createFixtureLoader>;
  const wallets: Wallet[] = provider.getWallets();
  const [owner, team, user] = wallets;

  before(async () => {
    loadFixture = createFixtureLoader(wallets, provider);
  });

  describe("depositBribe", async () => {
    it("should deposit a bribe", async () => {
      const { votemakBribe, token } = await loadFixture(votemakBribeFixture);
      await votemakBribe.connect(owner).setDistributor(ethers.constants.AddressZero);
      const timestamp = (await provider.getBlock("latest")).timestamp;
      const deadline = timestamp + 86400;
      await votemakBribe.connect(owner).updateProposals([PROPOSAL], [deadline]);

      const bribeAmount = ethers.utils.parseUnits("1", await token.decimals());
      await token.connect(owner).mint(owner.address, bribeAmount);

      const votemakTokenBalance0 = await token.balanceOf(votemakBribe.address);
      const ownerTokenBalance0 = await token.balanceOf(owner.address);

      await token.connect(owner).approve(votemakBribe.address, bribeAmount);
      await expect(
        votemakBribe.connect(owner)["depositBribe(address,address,uint256)"](PROPOSAL, token.address, bribeAmount),
      )
        .to.emit(votemakBribe, "NewBribe")
        .withArgs(PROPOSAL, token.address, owner.address, bribeAmount);

      const votemakTokenBalance1 = await token.balanceOf(votemakBribe.address);
      const ownerTokenBalance1 = await token.balanceOf(owner.address);
      expect(votemakTokenBalance1.sub(bribeAmount)).to.be.eq(votemakTokenBalance0);
      expect(ownerTokenBalance1.add(bribeAmount)).to.be.eq(ownerTokenBalance0);
    });

    it("should deposit an ether bribe", async () => {
      const { votemakBribe, weth } = await loadFixture(votemakBribeFixture);
      await votemakBribe.connect(owner).setDistributor(ethers.constants.AddressZero);
      const timestamp = (await provider.getBlock("latest")).timestamp;
      const deadline = timestamp + 86400;
      3;
      await votemakBribe.connect(owner).updateProposals([PROPOSAL], [deadline]);

      const bribeAmount = ethers.utils.parseEther("1");

      const votemakWethBalance0 = await weth.balanceOf(votemakBribe.address);
      const ownerEthBalance0 = await ethers.provider.getBalance(owner.address);

      await expect(votemakBribe.connect(owner)["depositBribe(address)"](PROPOSAL, { value: bribeAmount }))
        .to.emit(votemakBribe, "NewBribe")
        .withArgs(PROPOSAL, weth.address, owner.address, bribeAmount);

      const votemakWethBalance1 = await weth.balanceOf(votemakBribe.address);
      const ownerEthBalance1 = await ethers.provider.getBalance(owner.address);
      expect(votemakWethBalance1.sub(bribeAmount)).to.be.eq(votemakWethBalance0);
      expect(ownerEthBalance1.add(bribeAmount)).to.be.lte(ownerEthBalance0);
    });

    it("should deposit and transfer a bribe", async () => {
      const { votemakBribe, token } = await loadFixture(votemakBribeFixture);
      const timestamp = (await provider.getBlock("latest")).timestamp;
      const deadline = timestamp + 86400;
      await votemakBribe.connect(owner).updateProposals([PROPOSAL], [deadline]);

      const bribeAmount = ethers.utils.parseUnits("1", await token.decimals());

      const ownerTokenBalance0 = await token.balanceOf(owner.address);
      const votemakTokenBalance0 = await token.balanceOf(votemakBribe.address);
      const feeAddress = await votemakBribe.feeAddress();
      const feeTokenBalance0 = await token.balanceOf(feeAddress);
      const distributor = await votemakBribe.distributor();
      const distributorTokenBalance0 = await token.balanceOf(distributor);
      const feeAmount = bribeAmount.mul(await votemakBribe.fee()).div(MAX_FEE);

      await token.connect(owner).mint(owner.address, bribeAmount);
      await token.connect(owner).approve(votemakBribe.address, bribeAmount);
      await expect(
        votemakBribe.connect(owner)["depositBribe(address,address,uint256)"](PROPOSAL, token.address, bribeAmount),
      )
        .to.emit(votemakBribe, "NewBribe")
        .withArgs(PROPOSAL, token.address, owner.address, bribeAmount);

      const ownerTokenBalance1 = await token.balanceOf(owner.address);
      const votemakTokenBalance1 = await token.balanceOf(votemakBribe.address);
      const feeTokenBalance1 = await token.balanceOf(feeAddress);
      const distributorTokenBalance1 = await token.balanceOf(distributor);
      expect(ownerTokenBalance1).to.be.eq(ownerTokenBalance0);
      expect(votemakTokenBalance1).to.be.eq(votemakTokenBalance0);
      expect(feeTokenBalance1.sub(feeAmount)).to.be.eq(feeTokenBalance0);
      expect(distributorTokenBalance1.sub(bribeAmount.sub(feeAmount))).to.be.eq(distributorTokenBalance0);
    });

    it("should deposit and transfer an ether bribe", async () => {
      const { votemakBribe, weth } = await loadFixture(votemakBribeFixture);
      const timestamp = (await provider.getBlock("latest")).timestamp;
      const deadline = timestamp + 86400;
      await votemakBribe.connect(owner).updateProposals([PROPOSAL], [deadline]);

      const bribeAmount = ethers.utils.parseEther("1");

      const votemakWethBalance0 = await weth.balanceOf(votemakBribe.address);
      const feeAddress = await votemakBribe.feeAddress();
      const feeWethBalance0 = await weth.balanceOf(feeAddress);
      const distributor = await votemakBribe.distributor();
      const distributorWethBalance0 = await weth.balanceOf(distributor);
      const feeAmount = bribeAmount.mul(await votemakBribe.fee()).div(MAX_FEE);
      const ownerEthBalance0 = await ethers.provider.getBalance(owner.address);

      await expect(votemakBribe.connect(owner)["depositBribe(address)"](PROPOSAL, { value: bribeAmount }))
        .to.emit(votemakBribe, "NewBribe")
        .withArgs(PROPOSAL, weth.address, owner.address, bribeAmount);

      const ownerEthBalance1 = await ethers.provider.getBalance(owner.address);
      const votemakWethBalance1 = await weth.balanceOf(votemakBribe.address);
      const feeWethBalance1 = await weth.balanceOf(feeAddress);
      const distributorWethBalance1 = await weth.balanceOf(distributor);
      expect(ownerEthBalance1).to.be.lte(ownerEthBalance0);
      expect(votemakWethBalance1).to.be.eq(votemakWethBalance0);
      expect(feeWethBalance1.sub(feeAmount)).to.be.eq(feeWethBalance0);
      expect(distributorWethBalance1.sub(bribeAmount.sub(feeAmount))).to.be.eq(distributorWethBalance0);
    });

    it("should deposit a bribe from a non owner", async () => {
      const { votemakBribe, token } = await loadFixture(votemakBribeFixture);
      await votemakBribe.connect(owner).setDistributor(ethers.constants.AddressZero);
      const timestamp = (await provider.getBlock("latest")).timestamp;
      const deadline = timestamp + 86400;
      await votemakBribe.connect(owner).updateProposals([PROPOSAL], [deadline]);

      const bribeAmount = ethers.utils.parseUnits("1", await token.decimals());
      await token.connect(owner).mint(user.address, bribeAmount);

      const votemakTokenBalance0 = await token.balanceOf(votemakBribe.address);
      const userTokenBalance0 = await token.balanceOf(user.address);

      await token.connect(user).approve(votemakBribe.address, bribeAmount);
      await expect(
        votemakBribe.connect(user)["depositBribe(address,address,uint256)"](PROPOSAL, token.address, bribeAmount),
      )
        .to.emit(votemakBribe, "NewBribe")
        .withArgs(PROPOSAL, token.address, user.address, bribeAmount);

      const votemakTokenBalance1 = await token.balanceOf(votemakBribe.address);
      const userTokenBalance1 = await token.balanceOf(user.address);
      expect(votemakTokenBalance1.sub(bribeAmount)).to.be.eq(votemakTokenBalance0);
      expect(userTokenBalance1.add(bribeAmount)).to.be.eq(userTokenBalance0);
    });

    it("should deposit an ether bribe from a non owner", async () => {
      const { votemakBribe, weth } = await loadFixture(votemakBribeFixture);
      await votemakBribe.connect(owner).setDistributor(ethers.constants.AddressZero);
      const timestamp = (await provider.getBlock("latest")).timestamp;
      const deadline = timestamp + 86400;
      3;
      await votemakBribe.connect(owner).updateProposals([PROPOSAL], [deadline]);

      const bribeAmount = ethers.utils.parseEther("1");

      const votemakWethBalance0 = await weth.balanceOf(votemakBribe.address);
      const userEthBalance0 = await ethers.provider.getBalance(user.address);

      await expect(votemakBribe.connect(user)["depositBribe(address)"](PROPOSAL, { value: bribeAmount }))
        .to.emit(votemakBribe, "NewBribe")
        .withArgs(PROPOSAL, weth.address, user.address, bribeAmount);

      const votemakWethBalance1 = await weth.balanceOf(votemakBribe.address);
      const userEthBalance1 = await ethers.provider.getBalance(user.address);
      expect(votemakWethBalance1.sub(bribeAmount)).to.be.eq(votemakWethBalance0);
      expect(userEthBalance1.add(bribeAmount)).to.be.lte(userEthBalance0);
    });

    it("should revert if the proposal deadline has not been initialized", async () => {
      const { votemakBribe, token } = await loadFixture(votemakBribeFixture);
      await votemakBribe.connect(owner).setDistributor(ethers.constants.AddressZero);

      const bribeAmount = ethers.utils.parseUnits("1", await token.decimals());
      await token.connect(owner).mint(owner.address, bribeAmount);

      await token.connect(owner).approve(votemakBribe.address, bribeAmount);
      await expect(
        votemakBribe.connect(owner)["depositBribe(address,address,uint256)"](PROPOSAL, token.address, bribeAmount),
      ).to.revertedWith("VotemakBribe: Invalid proposal");
    });

    it("should revert ether bribe if the proposal deadline has not been initialized", async () => {
      const { votemakBribe } = await loadFixture(votemakBribeFixture);
      await votemakBribe.connect(owner).setDistributor(ethers.constants.AddressZero);

      const bribeAmount = ethers.utils.parseEther("1");

      await expect(
        votemakBribe.connect(owner)["depositBribe(address)"](PROPOSAL, { value: bribeAmount }),
      ).to.revertedWith("VotemakBribe: Invalid proposal");
    });

    it("should revert if the proposal deadline has passed", async () => {
      const { votemakBribe, token } = await loadFixture(votemakBribeFixture);
      await votemakBribe.connect(owner).setDistributor(ethers.constants.AddressZero);

      const timestamp = (await provider.getBlock("latest")).timestamp;
      const deadline = timestamp + 86400;
      await votemakBribe.connect(owner).updateProposals([PROPOSAL], [deadline]);

      const bribeAmount = ethers.utils.parseUnits("1", await token.decimals());
      await token.connect(owner).mint(owner.address, bribeAmount);

      await provider.send("evm_setNextBlockTimestamp", [deadline + 1]);
      await provider.send("evm_mine", []);

      await token.connect(owner).approve(votemakBribe.address, bribeAmount);
      await expect(
        votemakBribe.connect(owner)["depositBribe(address,address,uint256)"](PROPOSAL, token.address, bribeAmount),
      ).to.revertedWith("VotemakBribe: Invalid proposal");
    });

    it("should revert depositing ether if the proposal deadline has passed", async () => {
      const { votemakBribe } = await loadFixture(votemakBribeFixture);
      await votemakBribe.connect(owner).setDistributor(ethers.constants.AddressZero);

      const timestamp = (await provider.getBlock("latest")).timestamp;
      const deadline = timestamp + 86400;
      await votemakBribe.connect(owner).updateProposals([PROPOSAL], [deadline]);

      const bribeAmount = ethers.utils.parseEther("1");

      await provider.send("evm_setNextBlockTimestamp", [deadline + 1]);
      await provider.send("evm_mine", []);

      await expect(
        votemakBribe.connect(owner)["depositBribe(address)"](PROPOSAL, { value: bribeAmount }),
      ).to.revertedWith("VotemakBribe: Invalid proposal");
    });
  });

  describe("transferBribesToDistributor", async () => {
    it("should transfer bribes to distributor", async () => {
      const { votemakBribe, token } = await loadFixture(votemakBribeFixture);
      const timestamp = (await provider.getBlock("latest")).timestamp;
      const deadline = timestamp + 86400;
      await votemakBribe.connect(owner).updateProposals([PROPOSAL], [deadline]);

      const bribeAmount = ethers.utils.parseUnits("1", await token.decimals());
      await token.connect(owner).mint(owner.address, bribeAmount);

      const oldDistributor = await votemakBribe.distributor();
      await votemakBribe.connect(owner).setDistributor(ethers.constants.AddressZero);
      await token.connect(owner).approve(votemakBribe.address, bribeAmount);
      await votemakBribe.connect(owner)["depositBribe(address,address,uint256)"](PROPOSAL, token.address, bribeAmount);

      const feeAddress = await votemakBribe.feeAddress();
      const votemakTokenBalance0 = await token.balanceOf(votemakBribe.address);
      const feeTokenBalance0 = await token.balanceOf(feeAddress);
      const distributorTokenBalance0 = await token.balanceOf(oldDistributor);
      const feeAmount = votemakTokenBalance0.mul(await votemakBribe.fee()).div(MAX_FEE);

      await votemakBribe.connect(owner).setDistributor(oldDistributor);
      await expect(votemakBribe.connect(owner).transferBribesToDistributor([token.address]))
        .to.emit(votemakBribe, "TransferredBribe")
        .withArgs(token.address, bribeAmount);

      const votemakTokenBalance1 = await token.balanceOf(votemakBribe.address);
      const feeTokenBalance1 = await token.balanceOf(feeAddress);
      const distributorTokenBalance1 = await token.balanceOf(oldDistributor);
      expect(votemakTokenBalance1).to.be.eq(BigNumber.from("0"));
      expect(feeTokenBalance1.sub(feeAmount)).to.be.eq(feeTokenBalance0);
      expect(distributorTokenBalance1.sub(votemakTokenBalance0.sub(feeAmount))).to.be.eq(distributorTokenBalance0);
    });

    it("should transfer bribes to distributor from a non owner", async () => {
      const { votemakBribe, token } = await loadFixture(votemakBribeFixture);
      const timestamp = (await provider.getBlock("latest")).timestamp;
      const deadline = timestamp + 86400;
      await votemakBribe.connect(owner).updateProposals([PROPOSAL], [deadline]);

      const bribeAmount = ethers.utils.parseUnits("1", await token.decimals());
      await token.connect(owner).mint(owner.address, bribeAmount);

      const oldDistributor = await votemakBribe.distributor();
      await votemakBribe.connect(owner).setDistributor(ethers.constants.AddressZero);
      await token.connect(owner).approve(votemakBribe.address, bribeAmount);
      await votemakBribe.connect(owner)["depositBribe(address,address,uint256)"](PROPOSAL, token.address, bribeAmount);

      const feeAddress = await votemakBribe.feeAddress();
      const votemakTokenBalance0 = await token.balanceOf(votemakBribe.address);
      const feeTokenBalance0 = await token.balanceOf(feeAddress);
      const distributorTokenBalance0 = await token.balanceOf(oldDistributor);
      const feeAmount = votemakTokenBalance0.mul(await votemakBribe.fee()).div(MAX_FEE);

      await votemakBribe.connect(owner).setDistributor(oldDistributor);
      await expect(votemakBribe.connect(user).transferBribesToDistributor([token.address]))
        .to.emit(votemakBribe, "TransferredBribe")
        .withArgs(token.address, bribeAmount);

      const votemakTokenBalance1 = await token.balanceOf(votemakBribe.address);
      const feeTokenBalance1 = await token.balanceOf(feeAddress);
      const distributorTokenBalance1 = await token.balanceOf(oldDistributor);
      expect(votemakTokenBalance1).to.be.eq(BigNumber.from("0"));
      expect(feeTokenBalance1.sub(feeAmount)).to.be.eq(feeTokenBalance0);
      expect(distributorTokenBalance1.sub(votemakTokenBalance0.sub(feeAmount))).to.be.eq(distributorTokenBalance0);
    });

    it("should revert if distributor not set", async () => {
      const { votemakBribe, token } = await loadFixture(votemakBribeFixture);
      const timestamp = (await provider.getBlock("latest")).timestamp;
      const deadline = timestamp + 86400;
      await votemakBribe.connect(owner).updateProposals([PROPOSAL], [deadline]);

      const bribeAmount = ethers.utils.parseUnits("1", await token.decimals());
      await token.connect(owner).mint(owner.address, bribeAmount);

      await token.connect(owner).approve(votemakBribe.address, bribeAmount);
      await votemakBribe.connect(owner)["depositBribe(address,address,uint256)"](PROPOSAL, token.address, bribeAmount);

      await votemakBribe.connect(owner).setDistributor(ethers.constants.AddressZero);

      await expect(votemakBribe.connect(owner).transferBribesToDistributor([token.address])).to.be.revertedWith(
        "VotemakBribe: Invalid distributor",
      );
    });

    it("should revert if feeAddress not set", async () => {
      const { votemakBribe, token } = await loadFixture(votemakBribeFixture);
      const timestamp = (await provider.getBlock("latest")).timestamp;
      const deadline = timestamp + 86400;
      await votemakBribe.connect(owner).updateProposals([PROPOSAL], [deadline]);

      const bribeAmount = ethers.utils.parseUnits("1", await token.decimals());
      await token.connect(owner).mint(owner.address, bribeAmount);

      await token.connect(owner).approve(votemakBribe.address, bribeAmount);
      await votemakBribe.connect(owner)["depositBribe(address,address,uint256)"](PROPOSAL, token.address, bribeAmount);

      await votemakBribe.connect(owner).setFeeAddress(ethers.constants.AddressZero);

      await expect(votemakBribe.connect(owner).transferBribesToDistributor([token.address])).to.be.revertedWith(
        "VotemakBribe: Invalid feeAddress",
      );
    });
  });

  describe("updateProposals", async () => {
    it("should update proposals from owner", async () => {
      const { votemakBribe } = await loadFixture(votemakBribeFixture);
      const timestamp = (await provider.getBlock("latest")).timestamp;
      const deadline = timestamp + 86400;
      await expect(votemakBribe.connect(owner).updateProposals([PROPOSAL], [deadline]))
        .to.emit(votemakBribe, "NewProposal")
        .withArgs(PROPOSAL, deadline);
      expect(await votemakBribe.proposalDeadlines(PROPOSAL)).to.be.eq(deadline);
    });

    it("should update multiple proposals", async () => {
      const { votemakBribe } = await loadFixture(votemakBribeFixture);
      const proposal0 = PROPOSAL;
      const proposal1 = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9";
      const timestamp = (await provider.getBlock("latest")).timestamp;
      const deadline0 = timestamp + 86400;
      const deadline1 = deadline0 + 1;
      await votemakBribe.connect(owner).updateProposals([proposal0, proposal1], [deadline0, deadline1]);
      expect(await votemakBribe.proposalDeadlines(proposal0)).to.be.eq(deadline0);
      expect(await votemakBribe.proposalDeadlines(proposal1)).to.be.eq(deadline1);
    });

    it("should update proposals from team", async () => {
      const { votemakBribe } = await loadFixture(votemakBribeFixture);
      const timestamp = (await provider.getBlock("latest")).timestamp;
      const deadline = timestamp + 86400;
      await expect(votemakBribe.connect(team).updateProposals([PROPOSAL], [deadline]))
        .to.emit(votemakBribe, "NewProposal")
        .withArgs(PROPOSAL, deadline);
      expect(await votemakBribe.proposalDeadlines(PROPOSAL)).to.be.eq(deadline);
    });

    it("updating proposal should fail if not team or owner", async () => {
      const { votemakBribe } = await loadFixture(votemakBribeFixture);
      const timestamp = (await provider.getBlock("latest")).timestamp;
      const deadline = timestamp + 86400;
      await expect(votemakBribe.connect(user).updateProposals([PROPOSAL], [deadline])).to.be.reverted;
    });

    it("updating proposal should fail if it decreases the deadline", async () => {
      const { votemakBribe } = await loadFixture(votemakBribeFixture);
      const timestamp = (await provider.getBlock("latest")).timestamp;
      const deadline = timestamp + 86400;
      await votemakBribe.connect(owner).updateProposals([PROPOSAL], [deadline]);
      await expect(votemakBribe.connect(owner).updateProposals([PROPOSAL], [0])).to.be.revertedWith(
        "VotemakBribe: Invalid deadline",
      );
      await expect(votemakBribe.connect(owner).updateProposals([PROPOSAL], [deadline - 1])).to.be.revertedWith(
        "VotemakBribe: Invalid deadline",
      );
    });
  });

  describe("setFee", async () => {
    it("should set fee", async () => {
      const { votemakBribe } = await loadFixture(votemakBribeFixture);
      const newFee = BigNumber.from("1");

      await expect(votemakBribe.connect(owner).setFee(newFee)).to.emit(votemakBribe, "NewFee").withArgs(newFee);

      expect(await votemakBribe.fee()).to.be.eq(newFee);
    });

    it("should revert if not owner", async () => {
      const { votemakBribe } = await loadFixture(votemakBribeFixture);
      const newFee = BigNumber.from("1");

      await expect(votemakBribe.connect(team).setFee(newFee)).to.be.reverted;
      await expect(votemakBribe.connect(user).setFee(newFee)).to.be.reverted;
    });

    it("should revert if fee is invalid", async () => {
      const { votemakBribe } = await loadFixture(votemakBribeFixture);

      await expect(votemakBribe.connect(owner).setFee(MAX_FEE.add(BigNumber.from("1")))).to.be.revertedWith(
        "VotemakBribe: Invalid fee",
      );
    });
  });

  describe("setFeeAddress", async () => {
    it("should set fee", async () => {
      const { votemakBribe } = await loadFixture(votemakBribeFixture);
      const newFeeAddress = owner.address;

      await expect(votemakBribe.connect(owner).setFeeAddress(newFeeAddress))
        .to.emit(votemakBribe, "NewFeeAddress")
        .withArgs(newFeeAddress);

      expect(await votemakBribe.feeAddress()).to.be.eq(newFeeAddress);
    });

    it("should revert if not owner", async () => {
      const { votemakBribe } = await loadFixture(votemakBribeFixture);
      const newFeeAddress = owner.address;

      await expect(votemakBribe.connect(team).setFeeAddress(newFeeAddress)).to.be.reverted;
      await expect(votemakBribe.connect(user).setFeeAddress(newFeeAddress)).to.be.reverted;
    });
  });

  describe("setDistributor", async () => {
    it("should set fee", async () => {
      const { votemakBribe } = await loadFixture(votemakBribeFixture);
      const newDistributor = owner.address;

      await expect(votemakBribe.connect(owner).setDistributor(newDistributor))
        .to.emit(votemakBribe, "NewDistributor")
        .withArgs(newDistributor);

      expect(await votemakBribe.distributor()).to.be.eq(newDistributor);
    });

    it("should revert if not owner", async () => {
      const { votemakBribe } = await loadFixture(votemakBribeFixture);
      const newDistributor = owner.address;

      await expect(votemakBribe.connect(team).setDistributor(newDistributor)).to.be.reverted;
      await expect(votemakBribe.connect(user).setDistributor(newDistributor)).to.be.reverted;
    });
  });
});
