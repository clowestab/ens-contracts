//SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;
import {INameWrapper, PARENT_CANNOT_CONTROL, IS_DOT_ETH} from "contracts/wrapper/INameWrapper.sol";

import "hardhat/console.sol";

import "./ISubdomainOracle.sol";

import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

enum SLDState {
    AVAILABLE_OWNER,
    AVAILABLE_PUBLIC,
    CLOSED
}

error Unavailable();
error Unauthorised(uint256 tokenId, address addr);
error OperationProhibited(bytes32 node);

struct SLD {
    address realOwner;
    address feeOracle;
    SLDState currentStatus;
    uint256 balance;
}

contract RenewalManager is ERC1155Holder, Ownable {
    event NameRegistered(bytes32 node, uint256 expiry);
    event NameRenewed(bytes32 node, uint256 expiry);
    event SubdomainOracleUpdated(
        address indexed previousOracle,
        address indexed newOracle
    );

    INameWrapper public immutable wrapper;
    mapping(uint256 => SLD) slds;
    mapping(string => mapping(string => bool)) subdomainMinted;

    constructor(address _wrapper) {
        wrapper = INameWrapper(_wrapper);
    }

    function getSubdomainOracle(
        bytes32 node
    ) public view returns (ISubdomainOracle) {
        ISubdomainOracle oracle = ISubdomainOracle(
            sldData(uint256(node)).feeOracle
        );
        return oracle;
    }

    function setSubdomainOracle(
        bytes32 node,
        address feeOracle
    ) public onlyOwner {
        emit SubdomainOracleUpdated(slds[uint256(node)].feeOracle, feeOracle);

        //TODO add interface check
        //if () {
        slds[uint256(node)].feeOracle = feeOracle;
        //}
    }

    function setupDomain(bytes32 node, address feeOracle) public {
        uint256 nodeTokenId = uint256(node);
        address wrapperOwner = wrapper.ownerOf(nodeTokenId);

        console.log(
            "setupDomain - message.sender => %s wrapperOwner => %s",
            msg.sender,
            wrapperOwner
        );

        if (wrapperOwner != msg.sender) {
            revert Unauthorised(nodeTokenId, msg.sender);
        }

        //We use delegate call to maintain msg.sender in ERC1155Fuse.sol
        //This will be the address of the owner of the ERC1155 token associated with the ENS name
        //Otherwise it would be the contract address

        //EDIT
        //This doesn't work because delegatecall uses this contracts storage rather than wrappers storage so we dont get any of the actual owner info

        /*address(wrapper).delegatecall(
        	abi.encodeWithSignature("safeTransferFrom(address,address,uint256,uint256,bytes)", 		
        	msg.sender,
        	address(this),
        	tokenId,
        	1,
        	'0x' //bytes
        ));*/

        wrapper.safeTransferFrom(
            msg.sender,
            address(this),
            nodeTokenId,
            1,
            "0x" //bytes
        );

        (address owner, uint32 fuses, uint64 expiry) = wrapper.getData(
            nodeTokenId
        );

        if (fuses & PARENT_CANNOT_CONTROL == 0) {
            revert OperationProhibited(node);
        }

        //We don't need to check other authorised addresses because authorisations are specific to the owner when calling isApprovedForAll

        //wrapper.setFuses(node, )

        //TODO add interface check
        //if () {
        slds[nodeTokenId].feeOracle = feeOracle;
        //}

        slds[nodeTokenId].currentStatus = SLDState.AVAILABLE_OWNER;
        slds[nodeTokenId].realOwner = msg.sender;
    }

    function rentPrice(bytes32 node) external view returns (uint price) {
        return 1000;

        ISubdomainOracle oracle = getSubdomainOracle(node);

        return oracle.rentPrice(node);
    }

    function recoverDomain(uint256 nodeTokenId) public {
        wrapper.safeTransferFrom(
            address(this),
            msg.sender,
            nodeTokenId,
            1,
            "0x" //bytes
        );
    }

    function available(bytes32 node) public view virtual returns (bool) {
        try wrapper.getData(uint256(node)) returns (
            address,
            uint32,
            uint64 expiry
        ) {
            return expiry < block.timestamp;
        } catch {
            return true;
        }
    }

    function sldData(uint256 nodeTokenId) public view returns (SLD memory) {
        return slds[nodeTokenId];
    }

    function canRegister(bytes32 node) public view returns (bool) {
        if (!wrapper.isWrapped(node)) {
            return false;
        }

        if (!wrapper.allFusesBurned(node, IS_DOT_ETH)) {
            return false;
        }
    }

    function isSubdomainAvailable(
        bytes32 node
    ) public view virtual returns (bool) {
        try wrapper.getData(uint256(node)) returns (
            address,
            uint32,
            uint64 expiry
        ) {
            return expiry < block.timestamp;
        } catch {
            return true;
        }
    }

    function register(
        bytes32 parentNode,
        string calldata label,
        address newOwner,
        address resolver,
        uint16 fuses,
        uint64 duration,
        bytes[] calldata records
    ) public payable {
        /*if (!names[parentNode].active) {
            revert ParentNameNotSetup(parentNode);
        }
        uint256 fee = duration * names[parentNode].registrationFee;

        _checkParent(parentNode, duration);

        if (fee > 0) {
            if (IERC20(names[parentNode].token).balanceOf(msg.sender) < fee) {
                revert InsufficientFunds();
            }

            IERC20(names[parentNode].token).transferFrom(
                msg.sender,
                address(names[parentNode].beneficiary),
                fee
            );
        }*/

        _register(
            parentNode,
            label,
            newOwner,
            resolver,
            fuses,
            uint64(block.timestamp) + duration,
            records
        );
    }

    function _register(
        bytes32 parentNode,
        string calldata label,
        address newOwner,
        address resolver,
        uint32 fuses,
        uint64 expiry,
        bytes[] calldata records
    ) internal {
        bytes32 node = keccak256(
            abi.encodePacked(parentNode, keccak256(bytes(label)))
        );

        if (!isSubdomainAvailable(node)) {
            revert Unavailable();
        }

        if (records.length > 0) {
            wrapper.setSubnodeOwner(
                parentNode,
                label,
                address(this),
                0,
                expiry
            );
            //_setRecords(node, resolver, records);
        }

        wrapper.setSubnodeRecord(
            parentNode,
            label,
            newOwner,
            resolver,
            0,
            fuses | PARENT_CANNOT_CONTROL, // burn the ability for the parent to control
            expiry
        );

        emit NameRegistered(node, expiry);
    }
}
