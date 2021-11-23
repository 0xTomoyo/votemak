import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { VotemakBribe, VotemakBribe__factory } from "../src/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const signer = await ethers.provider.getSigner(deployer);
  const votemakBribeDeployment = await deployments.get("VotemakBribe");
  const votemakBribe: VotemakBribe = VotemakBribe__factory.connect(votemakBribeDeployment.address, signer);

  const multiMerkleDistributorDeployed = await deploy("MultiMerkleDistributor", {
    from: deployer,
    args: [],
    log: true,
  });

  await votemakBribe.setDistributor(multiMerkleDistributorDeployed.address);
};

func.tags = ["MultiMerkleDistributor"];
export default func;
