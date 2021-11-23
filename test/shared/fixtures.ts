import { ethers, waffle } from "hardhat";
import { Wallet } from "ethers";
import { TEAM_ROLE } from "./constants";
import {
  VotemakBribe,
  MultiMerkleDistributor,
  ERC20Mock,
  ERC20,
  VotemakBribe__factory,
  MultiMerkleDistributor__factory,
  ERC20Mock__factory,
} from "../../src/types";
import WETH9 from "../contracts/WETH9.json";

export interface VotemakBribeInterface {
  votemakBribe: VotemakBribe;
  token: ERC20Mock;
  weth: ERC20;
}

export interface MultiMerkleDistributorInterface {
  multiMerkleDistributor: MultiMerkleDistributor;
  token0: ERC20Mock;
  token1: ERC20Mock;
}

export async function votemakBribeFixture(wallet: Wallet[]): Promise<VotemakBribeInterface> {
  const owner: Wallet = wallet[0];
  const team: Wallet = wallet[1];
  const multisig: Wallet = wallet[3];
  const distributor: Wallet = wallet[4];

  const votemakBribeFactory: VotemakBribe__factory = (await ethers.getContractFactory(
    "contracts/VotemakBribe.sol:VotemakBribe",
    owner,
  )) as VotemakBribe__factory;
  const tokenFactory: ERC20Mock__factory = (await ethers.getContractFactory(
    "contracts/test/ERC20Mock.sol:ERC20Mock",
    owner,
  )) as ERC20Mock__factory;

  const weth = (await waffle.deployContract(owner, {
    bytecode: WETH9.bytecode,
    abi: WETH9.abi,
  })) as ERC20;
  const votemakBribe: VotemakBribe = await votemakBribeFactory.connect(owner).deploy(weth.address);
  const token: ERC20Mock = await tokenFactory.connect(owner).deploy("ERC20", "ERC20");

  await votemakBribe.connect(owner).grantRole(TEAM_ROLE, team.address);
  await votemakBribe.connect(owner).setDistributor(distributor.address);
  await votemakBribe.connect(owner).setFeeAddress(multisig.address);

  return { votemakBribe, token, weth };
}

export async function multiMerkleDistributorFixture(wallet: Wallet[]): Promise<MultiMerkleDistributorInterface> {
  const owner: Wallet = wallet[0];

  const multiMerkleDistributorFactory: MultiMerkleDistributor__factory = (await ethers.getContractFactory(
    "contracts/MultiMerkleDistributor.sol:MultiMerkleDistributor",
    owner,
  )) as MultiMerkleDistributor__factory;
  const tokenFactory: ERC20Mock__factory = (await ethers.getContractFactory(
    "contracts/test/ERC20Mock.sol:ERC20Mock",
    owner,
  )) as ERC20Mock__factory;

  const multiMerkleDistributor: MultiMerkleDistributor = await multiMerkleDistributorFactory.connect(owner).deploy();
  const token0: ERC20Mock = await tokenFactory.connect(owner).deploy("ERC20", "ERC20");
  const token1: ERC20Mock = await tokenFactory.connect(owner).deploy("ERC20", "ERC20");

  return { multiMerkleDistributor, token0, token1 };
}
