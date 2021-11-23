import fs from "fs";
import { ethers, providers } from "ethers";
import { VoteTracker, Multicall, VoteTracker__factory, Multicall__factory } from "./types";
import { UserVotes, UserVotesList } from "./types";
import { ADDRESSES, START_BLOCK_VOTETRACKER, END_BLOCK_VOTETRACKER } from "./constants";
import { getEnvError } from "./utils";

const polygonProvider: providers.Provider = new ethers.providers.StaticJsonRpcProvider(getEnvError("POLYGON_RPC_URL"));

const blockRange = END_BLOCK_VOTETRACKER - START_BLOCK_VOTETRACKER;
const incrementCalls = 100;

export async function snapshot(voteTracker: VoteTracker, multicall: Multicall): Promise<UserVotesList> {
  const userVotesList: UserVotesList = {};
  const accountsSet: Set<string> = new Set<string>();
  const accounts: string[] = [];

  let currentBlock = START_BLOCK_VOTETRACKER;
  while (currentBlock <= END_BLOCK_VOTETRACKER) {
    const newBlock = currentBlock + blockRange;
    accounts.push(
      ...(
        await voteTracker.queryFilter(
          voteTracker.filters.UserVoted(),
          currentBlock,
          newBlock > END_BLOCK_VOTETRACKER ? END_BLOCK_VOTETRACKER : newBlock,
        )
      )
        .map(event => {
          if (accountsSet.has(event.args.account)) {
            return "";
          } else {
            accountsSet.add(event.args.account);
            return event.args.account;
          }
        })
        .filter(value => value !== ""),
    );
    currentBlock = newBlock + 1;
  }

  let currentAccounts: string[] = [];
  for (let i = 0; i < accounts.length; i++) {
    currentAccounts.push(accounts[i]);
    if ((i > 0 && i % incrementCalls === 0) || i === accounts.length - 1) {
      const calls = currentAccounts.map(account => ({
        target: voteTracker.address,
        callData: voteTracker.interface.encodeFunctionData("getUserVotes", [account]),
      }));
      const encodedData = await multicall.callStatic.aggregate(calls, { blockTag: END_BLOCK_VOTETRACKER });
      const decodedData: UserVotes[] = encodedData.returnData.map(returnData => {
        const decoded = voteTracker.interface.decodeFunctionResult("getUserVotes", returnData);
        return {
          totalVotes: decoded[0].details.totalUsedVotes.toString(),
          allocations: decoded[0].votes.map((allocation: { reactorKey: string; amount: ethers.BigNumber }) => ({
            reactorKey: allocation.reactorKey,
            amount: allocation.amount.toString(),
          })),
        };
      });
      currentAccounts.forEach((account, index) => {
        userVotesList[account] = decodedData[index];
      });
      currentAccounts = [];
    }
  }

  return userVotesList;
}

async function main() {
  const { chainId } = await polygonProvider.getNetwork();

  if (!(chainId in ADDRESSES)) {
    throw new Error("Invalid chainId");
  }

  const voteTracker: VoteTracker = VoteTracker__factory.connect(ADDRESSES[chainId].voteTracker, polygonProvider);
  const multicall: Multicall = Multicall__factory.connect(ADDRESSES[chainId].multicall, polygonProvider);

  const userVotes: UserVotesList = await snapshot(voteTracker, multicall);

  fs.writeFileSync("data/userVotes.json", JSON.stringify(userVotes));
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}
