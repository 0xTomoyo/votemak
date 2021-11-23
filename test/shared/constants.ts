import { ethers } from "hardhat";

export const PROPOSAL = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
export const TEAM_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("TEAM_ROLE"));
