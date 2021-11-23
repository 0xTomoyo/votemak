import { BigNumber } from "ethers";

export const ADDRESSES: {
  [chainId: number]: {
    [contract: string]: string;
  };
} = {
  137: {
    voteTracker: "0x63368f34B84C697d9f629F33B5CAdc22cb00510E",
    multicall: "0x11ce4B23bD875D7F5C6a31084f55fDe1e9A87507",
  },
  1: {
    weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  },
  1337: {
    weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  },
  3: {
    weth: "0xc778417E063141139Fce010982780140Aa0cD5Ab",
  },
};

export const START_BLOCK_VOTETRACKER = 21177899;
export const END_BLOCK_VOTETRACKER = 21449733;

export const START_BLOCK_VOTEMAKBRIBE = 13554860;
export const END_BLOCK_VOTEMAKBRIBE = 13628582;

export const MAX_FEE = BigNumber.from("10000");
