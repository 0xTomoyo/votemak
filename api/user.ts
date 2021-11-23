import { VercelRequest, VercelResponse } from "@vercel/node";
import { ethers } from "ethers";
import { UserClaims } from "../src/types";
import userClaims from "../data/userClaims.json";

const defaultUserClaim: UserClaims = {};

async function handler(req: VercelRequest, res: VercelResponse) {
  const { address } = req.query;

  let parsedAddress: string = ethers.constants.AddressZero;

  try {
    if (address) {
      parsedAddress =
        typeof address === "string" ? ethers.utils.getAddress(address) : ethers.utils.getAddress(address[0]);
    } else {
      throw new Error("Undefined address");
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to parse address" });
  }

  if (parsedAddress in userClaims) {
    const userClaim: UserClaims = userClaims[parsedAddress as keyof typeof userClaims];
    return res.status(200).json({ claims: userClaim });
  } else {
    return res.status(200).json({ claims: defaultUserClaim });
  }
}

export default handler;
