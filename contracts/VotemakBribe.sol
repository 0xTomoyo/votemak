// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IWETH9 } from "./interfaces/IWETH9.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract VotemakBribe is AccessControl {
    using SafeERC20 for IERC20;

    address public immutable weth;
    uint256 public fee;
    address public feeAddress;
    address public distributor;
    mapping(address => uint256) public proposalDeadlines;
    uint256 internal constant MAX_FEE = 1e4;
    bytes32 internal constant TEAM_ROLE = keccak256("TEAM_ROLE");

    constructor(address _weth) {
        weth = _weth;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(TEAM_ROLE, msg.sender);
        uint256 _fee = 0.05e4;
        fee = _fee;
        feeAddress = msg.sender;
        emit NewFee(_fee);
        emit NewFeeAddress(msg.sender);
    }

    function depositBribe(
        address proposal,
        address token,
        uint256 amount
    ) external {
        require(proposalDeadlines[proposal] >= block.timestamp, "VotemakBribe: Invalid proposal");
        if (!_transferBribe(distributor, feeAddress, msg.sender, token, amount)) {
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }
        emit NewBribe(proposal, token, msg.sender, amount);
    }

    function depositBribe(address proposal) external payable {
        require(proposalDeadlines[proposal] >= block.timestamp, "VotemakBribe: Invalid proposal");
        IWETH9(weth).deposit{ value: msg.value }();
        _transferBribe(distributor, feeAddress, address(0), weth, msg.value);
        emit NewBribe(proposal, weth, msg.sender, msg.value);
    }

    function transferBribesToDistributor(address[] calldata tokens) external {
        address _distributor = distributor;
        address _feeAddress = feeAddress;
        require(_distributor != address(0), "VotemakBribe: Invalid distributor");
        require(_feeAddress != address(0), "VotemakBribe: Invalid feeAddress");
        for (uint256 i = 0; i < tokens.length; i++) {
            _transferBribe(_distributor, _feeAddress, address(0), tokens[i], IERC20(tokens[i]).balanceOf(address(this)));
        }
    }

    function updateProposals(address[] calldata proposals, uint256[] calldata deadlines) external onlyRole(TEAM_ROLE) {
        for (uint256 i = 0; i < proposals.length; i++) {
            require(deadlines[i] >= proposalDeadlines[proposals[i]], "VotemakBribe: Invalid deadline");
            proposalDeadlines[proposals[i]] = deadlines[i];
            emit NewProposal(proposals[i], deadlines[i]);
        }
    }

    function setFee(uint256 newFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newFee < MAX_FEE, "VotemakBribe: Invalid fee");
        fee = newFee;
        emit NewFee(newFee);
    }

    function setFeeAddress(address _feeAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        feeAddress = _feeAddress;
        emit NewFeeAddress(_feeAddress);
    }

    function setDistributor(address _distributor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        distributor = _distributor;
        emit NewDistributor(_distributor);
    }

    function _transferBribe(
        address _distributor,
        address _feeAddress,
        address from,
        address token,
        uint256 amount
    ) internal returns (bool) {
        if (_distributor != address(0) && _feeAddress != address(0) && amount > 0) {
            uint256 feeAmount = (amount * fee) / MAX_FEE;
            if (from == address(0)) {
                IERC20(token).safeTransfer(_distributor, amount - feeAmount);
                IERC20(token).safeTransfer(_feeAddress, feeAmount);
            } else {
                IERC20(token).safeTransferFrom(from, _distributor, amount - feeAmount);
                IERC20(token).safeTransferFrom(from, _feeAddress, feeAmount);
            }
            emit TransferredBribe(token, amount);
            return true;
        }
        return false;
    }

    event NewBribe(address indexed proposal, address indexed token, address indexed user, uint256 amount);
    event TransferredBribe(address indexed token, uint256 amount);
    event NewProposal(address indexed proposal, uint256 deadline);
    event NewFee(uint256 indexed fee);
    event NewFeeAddress(address indexed feeAddress);
    event NewDistributor(address indexed distributor);
}
