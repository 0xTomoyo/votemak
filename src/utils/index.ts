import * as dotenv from "dotenv";
import { BigNumber } from "ethers";
import { END_BLOCK_VOTETRACKER, START_BLOCK_VOTEMAKBRIBE, END_BLOCK_VOTEMAKBRIBE, MAX_FEE } from "../constants";
import { ReactorVotes, UserVotesList, VoteTracker, Multicall, TokenToReactorKey, VotemakBribe, Bribes } from "../types";

dotenv.config();

export function getEnvError(variable: string): string {
  const envVariable: string | undefined = process.env[variable];
  if (!envVariable) {
    throw new Error(`Please set your ${variable} in a .env file`);
  }
  return envVariable;
}

export function getEnvWarn(variable: string): string | undefined {
  const envVariable: string | undefined = process.env[variable];
  if (!envVariable) {
    console.log(`Optional: set a ${variable} in a .env file`);
  }
  return envVariable;
}

export async function getReactorVotes(userVotesList: UserVotesList): Promise<ReactorVotes> {
  const accounts = Object.keys(userVotesList);
  const reactorVotes: ReactorVotes = {};
  for (const account of accounts) {
    const userVotes = userVotesList[account];
    for (const allocation of userVotes.allocations) {
      const amountBigNumber = BigNumber.from(allocation.amount);
      if (allocation.reactorKey in reactorVotes) {
        reactorVotes[allocation.reactorKey] = reactorVotes[allocation.reactorKey].add(amountBigNumber);
      } else {
        reactorVotes[allocation.reactorKey] = amountBigNumber;
      }
    }
  }
  return reactorVotes;
}

export async function getTokenToReactorKey(voteTracker: VoteTracker, multicall: Multicall): Promise<TokenToReactorKey> {
  const reactorKeys = await voteTracker.getReactorKeys();
  const calls = reactorKeys.map((reactorKey: string) => ({
    target: voteTracker.address,
    callData: voteTracker.interface.encodeFunctionData("placementTokens", [reactorKey]),
  }));
  const encodedData = await multicall.callStatic.aggregate(calls, { blockTag: END_BLOCK_VOTETRACKER });
  const tokens: string[] = encodedData.returnData.map((returnData: string) => {
    const decoded = voteTracker.interface.decodeFunctionResult("placementTokens", returnData);
    return decoded[0];
  });
  const tokenToReactorKey: TokenToReactorKey = {};
  reactorKeys.forEach((reactorKey: string, index: number) => {
    tokenToReactorKey[tokens[index]] = reactorKey;
  });
  return tokenToReactorKey;
}

export async function getBribes(votemakBribe: VotemakBribe, tokenToReactorKey: TokenToReactorKey): Promise<Bribes> {
  const feeEvents = await votemakBribe.queryFilter(
    votemakBribe.filters.NewFee(),
    START_BLOCK_VOTEMAKBRIBE,
    END_BLOCK_VOTEMAKBRIBE,
  );
  const bribeEvents = await votemakBribe.queryFilter(
    votemakBribe.filters.NewBribe(),
    START_BLOCK_VOTEMAKBRIBE,
    END_BLOCK_VOTEMAKBRIBE,
  );
  let currentFeeIndex = 0;
  const bribes: Bribes = {};
  for (const bribeEvent of bribeEvents) {
    if (feeEvents[currentFeeIndex + 1]?.blockNumber ?? 0 >= bribeEvent.blockNumber) {
      currentFeeIndex++;
    }
    const currentFee = feeEvents[currentFeeIndex].args.fee;
    const bribeAmount = bribeEvent.args.amount.sub(bribeEvent.args.amount.mul(currentFee).div(MAX_FEE));
    const reactorKey = tokenToReactorKey[bribeEvent.args.proposal];
    if (bribeEvent.args.token in bribes) {
      if (reactorKey in bribes[bribeEvent.args.token]) {
        bribes[bribeEvent.args.token][reactorKey] = bribes[bribeEvent.args.token][reactorKey].add(bribeAmount);
      } else {
        bribes[bribeEvent.args.token][reactorKey] = bribeAmount;
      }
    } else {
      bribes[bribeEvent.args.token] = {
        [reactorKey]: bribeAmount,
      };
    }
  }
  return bribes;
}
