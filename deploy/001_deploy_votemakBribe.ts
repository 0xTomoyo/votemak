import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ADDRESSES } from "../src/constants";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, getChainId } = hre;
  const { deploy } = deployments;

  const chainId = Number(await getChainId());
  if (!(chainId in ADDRESSES)) {
    throw new Error("Invalid chainId");
  }
  const { deployer } = await getNamedAccounts();

  await deploy("VotemakBribe", {
    from: deployer,
    args: [ADDRESSES[chainId].weth],
    log: true,
  });
};

func.tags = ["VotemakBribe"];
export default func;
