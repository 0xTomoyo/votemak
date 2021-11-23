import fs from "fs";
import { ethers, BigNumber, providers } from "ethers";
import { parseBalanceMap } from "./merkle";
import {
  VotemakBribe,
  VoteTracker,
  Multicall,
  MultiMerkleDistributor__factory,
  VotemakBribe__factory,
  VoteTracker__factory,
  Multicall__factory,
  UserVotesList,
  TokenDistribution,
  ReactorVotes,
  TokenToReactorKey,
  Bribes,
  MultiMerkleDistributorInfo,
  UserClaimsList,
} from "./types";
import { ADDRESSES } from "./constants";
import { getEnvError, getReactorVotes, getTokenToReactorKey, getBribes } from "./utils";
import votemakBribeDeployment from "../deployments/mainnet/VotemakBribe.json";

const provider: providers.Provider = new ethers.providers.StaticJsonRpcProvider(getEnvError("ETH_RPC_URL"));
const polygonProvider: providers.Provider = new ethers.providers.StaticJsonRpcProvider(getEnvError("POLYGON_RPC_URL"));

export function generateDistribution(
  bribes: Bribes,
  userVotesList: UserVotesList,
  reactorVotes: ReactorVotes,
): TokenDistribution {
  const tokens = Object.keys(bribes);
  const users = Object.keys(userVotesList);
  const distribution: TokenDistribution = {};
  for (const user of users) {
    const userVote = userVotesList[user];
    for (const allocation of userVote.allocations) {
      for (const token of tokens) {
        const reactorKeys = Object.keys(bribes[token]);
        for (const reactorKey of reactorKeys) {
          if (reactorKey === allocation.reactorKey) {
            const bribeAmount = bribes[token][reactorKey];
            const claimAmount = bribeAmount.mul(BigNumber.from(allocation.amount)).div(reactorVotes[reactorKey]);
            if (claimAmount.gt(BigNumber.from("0"))) {
              if (token in distribution) {
                if (user in distribution[token]) {
                  distribution[token][user] = BigNumber.from(distribution[token][user]).add(claimAmount).toString();
                } else {
                  distribution[token][user] = claimAmount.toString();
                }
              } else {
                distribution[token] = {
                  [user]: claimAmount.toString(),
                };
              }
            }
          }
        }
      }
    }
  }
  return distribution;
}

export function generateMerkleTree(distribution: TokenDistribution): {
  multiMerkleDistributorInfo: MultiMerkleDistributorInfo;
  userClaimsList: UserClaimsList;
} {
  const multiMerkleDistributorInfo: MultiMerkleDistributorInfo = {};
  const userClaimsList: UserClaimsList = {};
  const tokens = Object.keys(distribution);
  for (const token of tokens) {
    const merkleDistributorInfo = parseBalanceMap(distribution[token]);
    multiMerkleDistributorInfo[token] = merkleDistributorInfo;
    const users = Object.keys(merkleDistributorInfo.claims);
    for (const user of users) {
      if (user in userClaimsList) {
        userClaimsList[user][token] = merkleDistributorInfo.claims[user];
      } else {
        userClaimsList[user] = {
          [token]: merkleDistributorInfo.claims[user],
        };
      }
    }
  }
  return { multiMerkleDistributorInfo, userClaimsList };
}

export function generateCalldata(multiMerkleDistributorInfo: MultiMerkleDistributorInfo): {
  tokens: string[];
  merkleRoots: string[];
  calldata: string;
} {
  const tokens = Object.keys(multiMerkleDistributorInfo);
  const merkleRoots = tokens.map(token => multiMerkleDistributorInfo[token].merkleRoot);
  const calldata = MultiMerkleDistributor__factory.createInterface().encodeFunctionData("updateMerkleRoots", [
    tokens,
    merkleRoots,
  ]);
  return { tokens, merkleRoots, calldata };
}

async function main() {
  const { chainId } = await polygonProvider.getNetwork();

  if (!(chainId in ADDRESSES)) {
    throw new Error("Invalid chainId");
  }

  const userVotesList: UserVotesList = JSON.parse(fs.readFileSync("data/userVotes.json", "utf8")) as UserVotesList;
  const polygonVoteTracker: VoteTracker = VoteTracker__factory.connect(ADDRESSES[chainId].voteTracker, polygonProvider);
  const multicall: Multicall = Multicall__factory.connect(ADDRESSES[chainId].multicall, polygonProvider);
  const votemakBribe: VotemakBribe = VotemakBribe__factory.connect(votemakBribeDeployment.address, provider);
  const tokenToReactorKey: TokenToReactorKey = await getTokenToReactorKey(polygonVoteTracker, multicall);
  const bribes = await getBribes(votemakBribe, tokenToReactorKey);

  console.log("Generating distribution...");

  const reactorVotes = await getReactorVotes(userVotesList);
  const distribution = generateDistribution(bribes, userVotesList, reactorVotes);

  console.log("Generating merkle tree...");

  const { multiMerkleDistributorInfo, userClaimsList } = generateMerkleTree(distribution);

  fs.writeFileSync("data/multiMerkleDistributorInfo.json", JSON.stringify(multiMerkleDistributorInfo));
  fs.writeFileSync("data/userClaims.json", JSON.stringify(userClaimsList));

  const { tokens, merkleRoots, calldata } = generateCalldata(multiMerkleDistributorInfo);

  console.log("Tokens:", tokens);
  console.log("Merkle roots:", merkleRoots);
  console.log("updateMerkleRoots() calldata:", calldata);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}
