import fs from "fs";
import { ethers, providers } from "ethers";
import { getEnvError } from "./utils";
import { ADDRESSES } from "./constants";
import { UserVotesList, ERC20__factory, VoteTracker__factory } from "./types";

const provider: providers.Provider = new ethers.providers.StaticJsonRpcProvider(getEnvError("ETH_RPC_URL"));
const polygonProvider: providers.Provider = new ethers.providers.StaticJsonRpcProvider(getEnvError("POLYGON_RPC_URL"));

(async () => {
  fs.mkdirSync("data/reactors", { recursive: true });
  const userVotesList = JSON.parse(fs.readFileSync("data/userVotes.json", "utf8")) as UserVotesList;
  const users = Object.keys(userVotesList);
  const reactorVotes: { [reactorKey: string]: { [address: string]: string } } = {};
  for (const user of users) {
    const userVotes = userVotesList[user];
    for (const allocation of userVotes.allocations) {
      if (allocation.reactorKey in reactorVotes) {
        reactorVotes[allocation.reactorKey][user] = allocation.amount;
      } else {
        reactorVotes[allocation.reactorKey] = {
          [user]: allocation.amount,
        };
      }
    }
  }
  const { chainId: polygonChainId } = await polygonProvider.getNetwork();
  const reactorKeys = Object.keys(reactorVotes);
  for (const reactorKey of reactorKeys) {
    const token = await VoteTracker__factory.connect(
      ADDRESSES[polygonChainId].voteTracker,
      polygonProvider,
    ).placementTokens(reactorKey);
    const symbol =
      token !== "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2"
        ? await ERC20__factory.connect(token, provider).symbol()
        : "MKR";
    fs.writeFileSync(`data/reactors/${symbol}.json`, JSON.stringify(reactorVotes[reactorKey]));
  }
})();
