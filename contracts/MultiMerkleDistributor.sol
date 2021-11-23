// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract MultiMerkleDistributor is Ownable {
    using SafeERC20 for IERC20;

    struct Claim {
        address token;
        address account;
        uint256 index;
        uint256 amount;
        bytes32[] merkleProof;
    }

    // Variables for updateable merkle
    mapping(address => bytes32) public merkleRoot;
    mapping(address => uint256) public update;
    // This is a packed array of booleans
    mapping(address => mapping(uint256 => mapping(uint256 => uint256))) private claimedBitMap;

    function claim(Claim[] calldata claims) external {
        for (uint256 i = 0; i < claims.length; i++) {
            _claim(claims[i].token, claims[i].index, claims[i].account, claims[i].amount, claims[i].merkleProof);
        }
    }

    function updateMerkleRoots(address[] calldata tokens, bytes32[] calldata _merkleRoots) external onlyOwner {
        for (uint256 i = 0; i < tokens.length; i++) {
            // Increment the update (simulates the clearing of the claimedBitMap)
            update[tokens[i]] += 1;
            // Set the new merkle root
            merkleRoot[tokens[i]] = _merkleRoots[i];
            emit MerkleRootUpdated(tokens[i], _merkleRoots[i], update[tokens[i]]);
        }
    }

    function isClaimed(address token, uint256 index) public view returns (bool) {
        uint256 claimedWordIndex = index / 256;
        uint256 claimedBitIndex = index % 256;
        uint256 claimedWord = claimedBitMap[token][update[token]][claimedWordIndex];
        uint256 mask = (1 << claimedBitIndex);
        return claimedWord & mask == mask;
    }

    function _claim(
        address token,
        uint256 index,
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) internal {
        require(merkleRoot[token] != 0, "MultiMerkleDistributor: Frozen");
        require(!isClaimed(token, index), "MultiMerkleDistributor: Drop already claimed");

        // Verify the merkle proof
        bytes32 node = keccak256(abi.encodePacked(index, account, amount));
        require(MerkleProof.verify(merkleProof, merkleRoot[token], node), "MultiMerkleDistributor: Invalid proof");

        _setClaimed(token, index);
        IERC20(token).safeTransfer(account, amount);

        emit Claimed(token, account, update[token], index, amount);
    }

    function _setClaimed(address token, uint256 index) internal {
        uint256 claimedWordIndex = index / 256;
        uint256 claimedBitIndex = index % 256;
        claimedBitMap[token][update[token]][claimedWordIndex] =
            claimedBitMap[token][update[token]][claimedWordIndex] |
            (1 << claimedBitIndex);
    }

    event Claimed(address indexed token, address indexed account, uint256 indexed update, uint256 index, uint256 amount);
    event MerkleRootUpdated(address indexed token, bytes32 indexed merkleRoot, uint256 indexed update);
}
