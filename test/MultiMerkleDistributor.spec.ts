import { ethers } from "hardhat";
import { Wallet, BigNumber } from "ethers";
import { expect, provider, createFixtureLoader, multiMerkleDistributorFixture } from "./shared";
import { BalanceTree, parseBalanceMap } from "../src/merkle";
import { ERC20Mock, MultiMerkleDistributor } from "../src/types";

describe("unit/MultiMerkleDistributor", () => {
  let loadFixture: ReturnType<typeof createFixtureLoader>;
  const wallets: Wallet[] = provider.getWallets();
  const [wallet0, wallet1] = wallets;

  before(async () => {
    loadFixture = createFixtureLoader(wallets, provider);
  });

  describe("merkleRoot", () => {
    it("returns the zero merkle root", async () => {
      const { multiMerkleDistributor, token0, token1 } = await loadFixture(multiMerkleDistributorFixture);
      expect(await multiMerkleDistributor.merkleRoot(token0.address)).to.eq(ethers.constants.HashZero);
      expect(await multiMerkleDistributor.merkleRoot(token1.address)).to.eq(ethers.constants.HashZero);
    });
  });

  describe("claim", () => {
    it("fails for empty proof", async () => {
      const { multiMerkleDistributor, token0 } = await loadFixture(multiMerkleDistributorFixture);
      await expect(
        multiMerkleDistributor.connect(wallet0).claim([
          {
            token: token0.address,
            account: wallet0.address,
            index: BigNumber.from("0"),
            amount: BigNumber.from("10"),
            merkleProof: [],
          },
        ]),
      ).to.revertedWith("MultiMerkleDistributor: Frozen");
    });

    describe("merkle tree", () => {
      let multiMerkleDistributor: MultiMerkleDistributor;
      let token: ERC20Mock;
      let tree: BalanceTree;

      beforeEach("deploy", async () => {
        tree = new BalanceTree([
          { account: wallet0.address, amount: BigNumber.from("100") },
          { account: wallet1.address, amount: BigNumber.from("101") },
        ]);
        ({ multiMerkleDistributor, token0: token } = await loadFixture(multiMerkleDistributorFixture));
        await token.connect(wallet0).setBalance(multiMerkleDistributor.address, BigNumber.from("201"));
        await multiMerkleDistributor.connect(wallet0).updateMerkleRoots([token.address], [tree.getHexRoot()]);
      });

      it("successful claim", async () => {
        const proof0 = tree.getProof(BigNumber.from("0"), wallet0.address, BigNumber.from("100"));
        const update = await multiMerkleDistributor.update(token.address);
        await expect(
          multiMerkleDistributor.connect(wallet0).claim([
            {
              token: token.address,
              account: wallet0.address,
              index: BigNumber.from("0"),
              amount: BigNumber.from("100"),
              merkleProof: proof0,
            },
          ]),
        )
          .to.emit(multiMerkleDistributor, "Claimed")
          .withArgs(token.address, wallet0.address, update, BigNumber.from("0"), BigNumber.from("100"));
        const proof1 = tree.getProof(BigNumber.from("1"), wallet1.address, BigNumber.from("101"));
        await expect(
          multiMerkleDistributor.connect(wallet0).claim([
            {
              token: token.address,
              account: wallet1.address,
              index: BigNumber.from("1"),
              amount: BigNumber.from("101"),
              merkleProof: proof1,
            },
          ]),
        )
          .to.emit(multiMerkleDistributor, "Claimed")
          .withArgs(token.address, wallet1.address, update, BigNumber.from("1"), BigNumber.from("101"));
      });

      it("transfers the token", async () => {
        const proof0 = tree.getProof(BigNumber.from("0"), wallet0.address, BigNumber.from("100"));
        expect(await token.balanceOf(wallet0.address)).to.eq(BigNumber.from("0"));
        await multiMerkleDistributor.connect(wallet0).claim([
          {
            token: token.address,
            account: wallet0.address,
            index: BigNumber.from("0"),
            amount: BigNumber.from("100"),
            merkleProof: proof0,
          },
        ]);
        expect(await token.balanceOf(wallet0.address)).to.eq(BigNumber.from("100"));
      });

      it("must have enough to transfer", async () => {
        const proof0 = tree.getProof(BigNumber.from("0"), wallet0.address, BigNumber.from("100"));
        await token.connect(wallet0).setBalance(multiMerkleDistributor.address, BigNumber.from("99"));
        await expect(
          multiMerkleDistributor.connect(wallet0).claim([
            {
              token: token.address,
              account: wallet0.address,
              index: BigNumber.from("0"),
              amount: BigNumber.from("100"),
              merkleProof: proof0,
            },
          ]),
        ).to.revertedWith("ERC20: transfer amount exceeds balance");
      });

      it("sets isClaimed", async () => {
        const proof0 = tree.getProof(BigNumber.from("0"), wallet0.address, BigNumber.from(100));
        expect(await multiMerkleDistributor.isClaimed(token.address, BigNumber.from("0"))).to.eq(false);
        expect(await multiMerkleDistributor.isClaimed(token.address, BigNumber.from("1"))).to.eq(false);
        await multiMerkleDistributor.connect(wallet0).claim([
          {
            token: token.address,
            account: wallet0.address,
            index: BigNumber.from("0"),
            amount: BigNumber.from("100"),
            merkleProof: proof0,
          },
        ]);
        expect(await multiMerkleDistributor.isClaimed(token.address, BigNumber.from("0"))).to.eq(true);
        expect(await multiMerkleDistributor.isClaimed(token.address, BigNumber.from("1"))).to.eq(false);
      });

      it("cannot allow two claims", async () => {
        const proof0 = tree.getProof(BigNumber.from("0"), wallet0.address, BigNumber.from("100"));
        await multiMerkleDistributor.connect(wallet0).claim([
          {
            token: token.address,
            account: wallet0.address,
            index: BigNumber.from("0"),
            amount: BigNumber.from("100"),
            merkleProof: proof0,
          },
        ]);
        await expect(
          multiMerkleDistributor.connect(wallet0).claim([
            {
              token: token.address,
              account: wallet0.address,
              index: BigNumber.from("0"),
              amount: BigNumber.from("100"),
              merkleProof: proof0,
            },
          ]),
        ).to.revertedWith("MultiMerkleDistributor: Drop already claimed");
      });

      it("cannot claim more than once: 0 and then 1", async () => {
        await multiMerkleDistributor.connect(wallet0).claim([
          {
            token: token.address,
            account: wallet0.address,
            index: BigNumber.from("0"),
            amount: BigNumber.from("100"),
            merkleProof: tree.getProof(BigNumber.from("0"), wallet0.address, BigNumber.from("100")),
          },
          {
            token: token.address,
            account: wallet1.address,
            index: BigNumber.from("1"),
            amount: BigNumber.from("101"),
            merkleProof: tree.getProof(BigNumber.from("1"), wallet1.address, BigNumber.from("101")),
          },
        ]);

        await expect(
          multiMerkleDistributor.connect(wallet0).claim([
            {
              token: token.address,
              account: wallet0.address,
              index: BigNumber.from("0"),
              amount: BigNumber.from("100"),
              merkleProof: tree.getProof(BigNumber.from("0"), wallet0.address, BigNumber.from("100")),
            },
          ]),
        ).to.revertedWith("MultiMerkleDistributor: Drop already claimed");
      });

      it("cannot claim more than once: 1 and then 0", async () => {
        await multiMerkleDistributor.connect(wallet0).claim([
          {
            token: token.address,
            account: wallet1.address,
            index: BigNumber.from("1"),
            amount: BigNumber.from("101"),
            merkleProof: tree.getProof(BigNumber.from("1"), wallet1.address, BigNumber.from("101")),
          },
          {
            token: token.address,
            account: wallet0.address,
            index: BigNumber.from("0"),
            amount: BigNumber.from("100"),
            merkleProof: tree.getProof(BigNumber.from("0"), wallet0.address, BigNumber.from("100")),
          },
        ]);

        await expect(
          multiMerkleDistributor.connect(wallet0).claim([
            {
              token: token.address,
              account: wallet1.address,
              index: BigNumber.from("1"),
              amount: BigNumber.from("101"),
              merkleProof: tree.getProof(BigNumber.from("1"), wallet1.address, BigNumber.from("101")),
            },
          ]),
        ).to.revertedWith("MultiMerkleDistributor: Drop already claimed");
      });

      it("cannot claim for address other than proof", async () => {
        const proof0 = tree.getProof(BigNumber.from("0"), wallet0.address, BigNumber.from("100"));
        await expect(
          multiMerkleDistributor.connect(wallet0).claim([
            {
              token: token.address,
              account: wallet1.address,
              index: BigNumber.from("1"),
              amount: BigNumber.from("101"),
              merkleProof: proof0,
            },
          ]),
        ).to.revertedWith("MultiMerkleDistributor: Invalid proof");
      });

      it("cannot claim more than proof", async () => {
        const proof0 = tree.getProof(BigNumber.from("0"), wallet0.address, BigNumber.from("100"));
        await expect(
          multiMerkleDistributor.connect(wallet0).claim([
            {
              token: token.address,
              account: wallet0.address,
              index: BigNumber.from("0"),
              amount: BigNumber.from("101"),
              merkleProof: proof0,
            },
          ]),
        ).to.revertedWith("MultiMerkleDistributor: Invalid proof");
      });

      it("larger tree", async () => {
        const balanceTree = new BalanceTree(
          wallets.map((wallet, ix) => {
            return { account: wallet.address, amount: BigNumber.from(ix + 1) };
          }),
        );
        await token.connect(wallet0).setBalance(multiMerkleDistributor.address, BigNumber.from("201"));
        await multiMerkleDistributor.connect(wallet0).updateMerkleRoots([token.address], [balanceTree.getHexRoot()]);
        const proof4 = balanceTree.getProof(BigNumber.from("4"), wallets[4].address, BigNumber.from("5"));
        const update = await multiMerkleDistributor.update(token.address);
        await expect(
          multiMerkleDistributor.connect(wallet0).claim([
            {
              token: token.address,
              account: wallets[4].address,
              index: BigNumber.from("4"),
              amount: BigNumber.from("5"),
              merkleProof: proof4,
            },
          ]),
        )
          .to.emit(multiMerkleDistributor, "Claimed")
          .withArgs(token.address, wallets[4].address, update, BigNumber.from("4"), BigNumber.from("5"));
        const proof9 = balanceTree.getProof(BigNumber.from("9"), wallets[9].address, BigNumber.from("10"));
        await expect(
          multiMerkleDistributor.connect(wallet0).claim([
            {
              token: token.address,
              account: wallets[9].address,
              index: BigNumber.from("9"),
              amount: BigNumber.from("10"),
              merkleProof: proof9,
            },
          ]),
        )
          .to.emit(multiMerkleDistributor, "Claimed")
          .withArgs(token.address, wallets[9].address, update, BigNumber.from("9"), BigNumber.from("10"));
      });

      it("realistic size tree", async () => {
        const NUM_LEAVES = 100_000;
        const NUM_SAMPLES = 25;
        const elements: { account: string; amount: BigNumber }[] = [];
        for (let i = 0; i < NUM_LEAVES; i++) {
          const node = { account: wallet0.address, amount: BigNumber.from(100) };
          elements.push(node);
        }
        const balanceTree = new BalanceTree(elements);
        await token.connect(wallet0).setBalance(multiMerkleDistributor.address, ethers.constants.MaxUint256);
        await multiMerkleDistributor.connect(wallet0).updateMerkleRoots([token.address], [balanceTree.getHexRoot()]);

        const root = Buffer.from(balanceTree.getHexRoot().slice(2), "hex");
        for (let i = 0; i < NUM_LEAVES; i += NUM_LEAVES / NUM_SAMPLES) {
          const proof = balanceTree
            .getProof(i, wallet0.address, BigNumber.from(100))
            .map(el => Buffer.from(el.slice(2), "hex"));
          const validProof = BalanceTree.verifyProof(i, wallet0.address, BigNumber.from(100), proof, root);
          expect(validProof).to.be.true;
        }

        for (let i = 0; i < 25; i += Math.floor(Math.random() * (NUM_LEAVES / NUM_SAMPLES))) {
          const proof = balanceTree.getProof(BigNumber.from(i.toString()), wallet0.address, BigNumber.from("100"));
          await multiMerkleDistributor.claim([
            {
              token: token.address,
              account: wallet0.address,
              index: BigNumber.from(i.toString()),
              amount: BigNumber.from("100"),
              merkleProof: proof,
            },
          ]);
          await expect(
            multiMerkleDistributor.claim([
              {
                token: token.address,
                account: wallet0.address,
                index: BigNumber.from(i.toString()),
                amount: BigNumber.from("100"),
                merkleProof: proof,
              },
            ]),
          ).to.revertedWith("MultiMerkleDistributor: Drop already claimed");
        }
      });
    });
  });

  describe("updateMerkleRoots", () => {
    it("updates proof for a token", async () => {
      const { multiMerkleDistributor, token0 } = await loadFixture(multiMerkleDistributorFixture);
      const root0 = ethers.constants.HashZero.replace(/.$/, "1");
      const update0 = await multiMerkleDistributor.update(token0.address);
      await expect(multiMerkleDistributor.connect(wallet0).updateMerkleRoots([token0.address], [root0]))
        .to.emit(multiMerkleDistributor, "MerkleRootUpdated")
        .withArgs(token0.address, root0, update0.add(BigNumber.from("1")));
      expect(await multiMerkleDistributor.merkleRoot(token0.address)).to.eq(root0);
      expect(await multiMerkleDistributor.update(token0.address)).to.eq(update0.add(BigNumber.from("1")));
    });

    it("updates proof for multiple tokens", async () => {
      const { multiMerkleDistributor, token0, token1 } = await loadFixture(multiMerkleDistributorFixture);
      const root0 = ethers.constants.HashZero.replace(/.$/, "1");
      const root1 = ethers.constants.HashZero.replace(/.$/, "2");
      const update0 = await multiMerkleDistributor.update(token0.address);
      const update1 = await multiMerkleDistributor.update(token1.address);
      await multiMerkleDistributor.connect(wallet0).updateMerkleRoots([token0.address, token1.address], [root0, root1]);
      expect(await multiMerkleDistributor.merkleRoot(token0.address)).to.eq(root0);
      expect(await multiMerkleDistributor.merkleRoot(token1.address)).to.eq(root1);
      expect(await multiMerkleDistributor.update(token0.address)).to.eq(update0.add(BigNumber.from("1")));
      expect(await multiMerkleDistributor.update(token1.address)).to.eq(update1.add(BigNumber.from("1")));
    });

    it("should revert if not owner", async () => {
      const { multiMerkleDistributor, token0 } = await loadFixture(multiMerkleDistributorFixture);
      await expect(
        multiMerkleDistributor.connect(wallet1).updateMerkleRoots([token0.address], [ethers.constants.HashZero]),
      ).to.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("parseBalanceMap", () => {
    const balances = {
      [wallet0.address]: "200",
      [wallet1.address]: "300",
      [wallets[2].address]: "250",
    };
    let multiMerkleDistributor: MultiMerkleDistributor;
    let token: ERC20Mock;
    let claims: {
      [account: string]: {
        index: number;
        amount: string;
        proof: string[];
      };
    };
    let merkleRoot: string;

    beforeEach("deploy", async () => {
      let tokenTotal: string;
      ({ claims, merkleRoot, tokenTotal } = parseBalanceMap(balances));
      ({ multiMerkleDistributor, token0: token } = await loadFixture(multiMerkleDistributorFixture));
      await token.connect(wallet0).setBalance(multiMerkleDistributor.address, BigNumber.from(tokenTotal));
      await multiMerkleDistributor.connect(wallet0).updateMerkleRoots([token.address], [merkleRoot]);
    });

    it("check the proofs is as expected", async () => {
      const sortedAddresses = Object.keys(balances).sort();
      const tree = new BalanceTree(
        sortedAddresses.map(account => ({ account, amount: BigNumber.from(balances[account]) })),
      );
      expect(tree.getHexRoot()).to.eq(merkleRoot);
      for (const account of sortedAddresses) {
        const proof = tree.getProof(claims[account].index, account, BigNumber.from(claims[account].amount));
        expect(proof).to.deep.eq(claims[account].proof);
      }
    });

    it("all claims work exactly once", async () => {
      const update = await multiMerkleDistributor.update(token.address);
      for (const account in claims) {
        const claim = claims[account];
        await expect(
          multiMerkleDistributor.connect(wallet0).claim([
            {
              token: token.address,
              account: account,
              index: claim.index,
              amount: claim.amount,
              merkleProof: claim.proof,
            },
          ]),
        )
          .to.emit(multiMerkleDistributor, "Claimed")
          .withArgs(token.address, account, update, claim.index, claim.amount);
        await expect(
          multiMerkleDistributor.connect(wallet0).claim([
            {
              token: token.address,
              account: account,
              index: claim.index,
              amount: claim.amount,
              merkleProof: claim.proof,
            },
          ]),
        ).to.be.revertedWith("MultiMerkleDistributor: Drop already claimed");
      }
      expect(await token.balanceOf(multiMerkleDistributor.address)).to.eq(BigNumber.from("0"));
    });
  });
});
