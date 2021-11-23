import fs from "fs";
import { ethers, providers, BigNumber } from "ethers";
import {
  VotemakBribe,
  VoteTracker,
  Multicall,
  VotemakBribe__factory,
  VoteTracker__factory,
  Multicall__factory,
  UserVotesList,
  ERC20__factory,
  Bribes,
  MultiMerkleDistributorInfo,
  UserClaimsList,
} from "./types";
import { ADDRESSES, END_BLOCK_VOTETRACKER } from "./constants";
import { getEnvError, getReactorVotes, getBribes, getTokenToReactorKey } from "./utils";
import votemakBribeDeployment from "../deployments/mainnet/VotemakBribe.json";
import multiMerkleDistributorDeployment from "../deployments/mainnet/MultiMerkleDistributor.json";

const provider: providers.Provider = new ethers.providers.StaticJsonRpcProvider(getEnvError("ETH_RPC_URL"));
const polygonProvider: providers.Provider = new ethers.providers.StaticJsonRpcProvider(getEnvError("POLYGON_RPC_URL"));

const userVotesEpsilon = BigNumber.from("1000000");
const totalVotesEpsilon = userVotesEpsilon.mul(BigNumber.from("100"));

export async function validate(voteTracker: VoteTracker, userVotesList: UserVotesList): Promise<boolean> {
  let valid = true;
  const accounts = Object.keys(userVotesList);
  const systemVotes = await voteTracker.getSystemVotes({ blockTag: END_BLOCK_VOTETRACKER });

  let totalVotes = BigNumber.from("0");
  for (const account of accounts) {
    let total = BigNumber.from("0");
    const userVotes = userVotesList[account];
    totalVotes = totalVotes.add(BigNumber.from(userVotes.totalVotes));
    for (const allocation of userVotes.allocations) {
      total = total.add(BigNumber.from(allocation.amount));
    }
    if (
      !BigNumber.from(userVotes.totalVotes).lt(total.add(userVotesEpsilon)) ||
      !BigNumber.from(userVotes.totalVotes).gt(total.sub(userVotesEpsilon))
    ) {
      console.log(`INVALID user votes: ${account} (${total.toString()})`);
      valid = false;
    }
  }
  if (
    !BigNumber.from(systemVotes.details.totalVotes).lt(totalVotes.add(totalVotesEpsilon)) ||
    !BigNumber.from(systemVotes.details.totalVotes).gt(totalVotes.sub(totalVotesEpsilon))
  ) {
    console.log(`INVALID total votes: ${totalVotes.toString()}`);
    valid = false;
  }

  const reactorVotes = await getReactorVotes(userVotesList);

  for (const systemVote of systemVotes.votes) {
    if (!systemVote.totalVotes.eq(reactorVotes[systemVote.reactorKey])) {
      console.log(
        `INVALID reactor votes: ${systemVote.reactorKey} (${reactorVotes[systemVote.reactorKey].toString()})`,
      );
      valid = false;
    }
  }

  return valid;
}

export async function validateBribes(provider: providers.Provider, bribes: Bribes): Promise<boolean> {
  let valid = true;
  const tokens = Object.keys(bribes);
  for (const token of tokens) {
    let expectedTokenBalance = BigNumber.from("0");
    const reactorKeys = Object.keys(bribes[token]);
    for (const reactorKey of reactorKeys) {
      expectedTokenBalance = expectedTokenBalance.add(bribes[token][reactorKey]);
    }
    const tokenBalance = await ERC20__factory.connect(token, provider).balanceOf(
      multiMerkleDistributorDeployment.address,
    );
    if (tokenBalance.lt(expectedTokenBalance)) {
      console.log(
        `[Ignore if claiming has started] INVALID bribe amount: ${token} (${expectedTokenBalance.toString()})`,
      );
      valid = false;
    }
  }
  return valid;
}

export function validateMerkleTree(
  bribes: Bribes,
  multiMerkleDistributorInfo: MultiMerkleDistributorInfo,
  userClaimsList: UserClaimsList,
) {
  const users = Object.keys(userClaimsList);
  const tokenAmounts: { [token: string]: BigNumber } = {};
  for (const user of users) {
    const userClaims = userClaimsList[user];
    const userTokens = Object.keys(userClaims);
    for (const userToken of userTokens) {
      if (multiMerkleDistributorInfo[userToken].claims[user].amount !== userClaims[userToken].amount) {
        console.log(`INVALID user claim: ${user} (${userClaims[userToken].amount})`);
      }
      if (userToken in tokenAmounts) {
        tokenAmounts[userToken] = tokenAmounts[userToken].add(BigNumber.from(userClaims[userToken].amount));
      } else {
        tokenAmounts[userToken] = BigNumber.from(userClaims[userToken].amount);
      }
    }
  }
  const tokens = Object.keys(bribes);
  for (const token of tokens) {
    let totalAmount = BigNumber.from("0");
    const reactorKeys = Object.keys(bribes[token]);
    for (const reactorKey of reactorKeys) {
      totalAmount = totalAmount.add(bribes[token][reactorKey]);
    }
    if (totalAmount.lt(tokenAmounts[token])) {
      console.log(`INVALID token amount: ${token} (${totalAmount.toString()})`);
    }
  }
}

async function main() {
  const { chainId } = await polygonProvider.getNetwork();

  if (!(chainId in ADDRESSES)) {
    throw new Error("Invalid chainId");
  }

  const polygonVoteTracker: VoteTracker = VoteTracker__factory.connect(ADDRESSES[chainId].voteTracker, polygonProvider);
  const multicall: Multicall = Multicall__factory.connect(ADDRESSES[chainId].multicall, polygonProvider);
  const votemakBribe: VotemakBribe = VotemakBribe__factory.connect(votemakBribeDeployment.address, provider);
  const userVotesList = JSON.parse(fs.readFileSync("data/userVotes.json", "utf8")) as UserVotesList;

  console.log("Validating votes...");

  await validate(polygonVoteTracker, userVotesList);

  console.log("Validating bribes...");

  const tokenToReactorKey = await getTokenToReactorKey(polygonVoteTracker, multicall);
  const bribes = await getBribes(votemakBribe, tokenToReactorKey);

  await validateBribes(provider, bribes);

  console.log("Validating claims...");

  const multiMerkleDistributorInfo = JSON.parse(
    fs.readFileSync("data/multiMerkleDistributorInfo.json", "utf8"),
  ) as MultiMerkleDistributorInfo;
  const userClaimsList = JSON.parse(fs.readFileSync("data/userClaims.json", "utf8")) as UserClaimsList;

  validateMerkleTree(bribes, multiMerkleDistributorInfo, userClaimsList);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}
