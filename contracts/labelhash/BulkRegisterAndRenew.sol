// SPDX-License-Identifier: MIT
// Built by Thomas Clowes, 2022
// thomasclowes.com | thomasclowes.eth
//
// LabelHash.com - ENS Management tools

import "hardhat/console.sol";

pragma solidity ^0.8.4;

import "../registry/ENS.sol";
import "../ethregistrar/IBaseRegistrar.sol";
import "../ethregistrar/ETHRegistrarController.sol";
import "../resolvers/PublicResolver.sol";

contract BulkRegisterAndRenew {
    struct CartData {
        bool isAvailable;
        uint rentPriceOneYearInWei;
        uint expirationDate;
    }

    struct DomainData {
        bool isAvailable;
        uint rentPriceOneYearInWei;
        uint expirationDate;
        address registrarOwnerAddress;
        address registryOwnerAddress;
        address resolverAddress;
        address resolvesToAddress;
    }

    bytes32 private constant ETH_NAMEHASH =
        0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae;
    bytes4 private constant REGISTRAR_CONTROLLER_INTERFACE_ID = 0x612e8c09;

    uint public constant ONE_YEAR = 365 days;

    ENS public ens;

    constructor(ENS _ens) {
        ens = _ens;
    }

    function getController() public view returns (ETHRegistrarController) {
        console.log("hellOOOOO");

        Resolver r = Resolver(ens.resolver(ETH_NAMEHASH));

        console.logAddress(address(r));

        ETHRegistrarController c = ETHRegistrarController(
            r.interfaceImplementer(
                ETH_NAMEHASH,
                REGISTRAR_CONTROLLER_INTERFACE_ID
            )
        );

        console.logAddress(address(c));

        return c;
    }

    function getEthRegistrar() public view returns (IBaseRegistrar) {
        IBaseRegistrar r = IBaseRegistrar(ens.owner(ETH_NAMEHASH));
        return r;
    }

    function getResolver(
        address resolverAddress
    ) public view returns (PublicResolver) {
        PublicResolver r = PublicResolver(resolverAddress);
        return r;
    }

    function rentPrice(
        string[] calldata names,
        uint256[] calldata durations
    ) external view returns (uint total) {
        ETHRegistrarController controller = getController();

        uint durLen = durations.length;

        for (uint i = 0; i < names.length; ++i) {
            uint duration = durLen == 1 ? durations[0] : durations[i];
            IPriceOracle.Price memory price = controller.rentPrice(
                names[i],
                duration
            );
            total += (price.base + price.premium);
        }
    }

    function commitAll(bytes32[] calldata commitments) external {
        ETHRegistrarController controller = getController();

        for (uint i = 0; i < commitments.length; ++i) {
            controller.commit(commitments[i]);
        }
    }

    struct BasicRegistrationData {
        string[] names;
        address[] owners;
        uint256[] durations;
        bytes32 salt;
    }

    struct AdvancedRegistrationData {
        address[] resolvers;
        bytes[][] datas;
        bool[] reverseRecords;
        uint16[] ownerControlledFuses;
    }

    struct DataLengths {
        uint256 namesLen;
        uint256 ownerLen;
        uint256 durLen;
        uint256 resolverLen;
        uint256 dataLen;
        uint256 reverseRecordLen;
        uint256 fuseLen;
    }

    function registerAll(
        BasicRegistrationData calldata basic,
        AdvancedRegistrationData calldata advanced
    ) external payable {
        ETHRegistrarController controller = getController();

        DataLengths memory temp;

        temp.namesLen = basic.names.length;
        temp.ownerLen = basic.owners.length;
        temp.durLen = basic.durations.length;
        temp.resolverLen = advanced.resolvers.length;
        temp.dataLen = advanced.datas.length;
        temp.reverseRecordLen = advanced.reverseRecords.length;
        temp.fuseLen = advanced.ownerControlledFuses.length;

        for (uint i = 0; i < temp.namesLen; ++i) {
            address owner = msg.sender;

            if (temp.ownerLen == 1) {
                owner = basic.owners[0];
            } else if (temp.ownerLen > 1) {
                owner = basic.owners[i];
            }

            string memory name = basic.names[i];
            bytes32 salt = basic.salt;
            uint256 duration = temp.durLen == 1
                ? basic.durations[0]
                : basic.durations[i];
            address resolver = temp.resolverLen == 1
                ? advanced.resolvers[0]
                : advanced.resolvers[i];
            bytes[] memory data = temp.dataLen == 1
                ? advanced.datas[0]
                : advanced.datas[i];
            bool reverseRecord = temp.reverseRecordLen == 1
                ? advanced.reverseRecords[0]
                : advanced.reverseRecords[i];
            uint16 fuses = temp.fuseLen == 1
                ? advanced.ownerControlledFuses[0]
                : advanced.ownerControlledFuses[i];

            IPriceOracle.Price memory priceData = controller.rentPrice(
                name,
                duration
            );
            uint price = (priceData.base + priceData.premium);

            controller.register{value: price}(
                name,
                msg.sender,
                duration,
                salt,
                resolver,
                data,
                reverseRecord,
                fuses
            );
        }
    }

    function renewAll(
        string[] calldata names,
        uint256[] calldata durations
    ) external payable {
        ETHRegistrarController controller = getController();

        uint durLen = durations.length;

        for (uint i = 0; i < names.length; ++i) {
            uint duration = durLen == 1 ? durations[0] : durations[i];
            IPriceOracle.Price memory priceData = controller.rentPrice(
                names[i],
                duration
            );
            uint price = (priceData.base + priceData.premium);

            controller.renew{value: price}(names[i], duration);
        }
        // Send any excess funds back
        payable(msg.sender).transfer(address(this).balance);
    }

    function computeNamehash(
        string calldata name
    ) public pure returns (bytes32 namehash) {
        namehash = 0x0000000000000000000000000000000000000000000000000000000000000000;
        namehash = keccak256(
            abi.encodePacked(namehash, keccak256(abi.encodePacked("eth")))
        );
        namehash = keccak256(
            abi.encodePacked(namehash, keccak256(abi.encodePacked(name)))
        );
    }

    function allData(
        string calldata name
    ) external view returns (DomainData memory data) {
        IBaseRegistrar ethRegistrar = getEthRegistrar();
        ETHRegistrarController controller = getController();

        bytes32 nameHash = computeNamehash(name);
        bytes32 labelHash = keccak256(bytes(name));
        uint256 tokenId = uint256(labelHash);

        bool isAvailable = ethRegistrar.available(tokenId);
        bool isGrace = false;

        IPriceOracle.Price memory priceData = controller.rentPrice(
            name,
            ONE_YEAR
        );
        uint rentPrice = (priceData.base + priceData.premium);

        //Returns 0 if available. If expired but has a price premium this returns the previous expiry until registered.
        uint expiryDate = ethRegistrar.nameExpires(tokenId);
        address registrantAddress;
        address controllerAddress;
        address domainResolverAddress;
        address resolvesToAddress;

        if (!isAvailable) {
            registrantAddress = ethRegistrar.ownerOf(tokenId);

            if (expiryDate <= block.timestamp) {
                //If had fully expired and was available for a price premium we wouldnt be in the !isAvailable block
                isGrace = true;
            } else {
                //reverts on require(expiries[tokenId] > block.timestamp);
                //registrantAddress     = ethRegistrar.ownerOf(tokenId);
            }

            controllerAddress = ens.owner(nameHash);
            domainResolverAddress = ens.resolver(nameHash);

            if (domainResolverAddress != address(0x0)) {
                uint32 size;

                assembly {
                    size := extcodesize(domainResolverAddress)
                }

                if (size > 0) {
                    PublicResolver resolver = getResolver(
                        domainResolverAddress
                    );

                    try resolver.addr(nameHash) returns (
                        address payable resolvedAddress
                    ) {
                        resolvesToAddress = resolvedAddress;
                    } catch (bytes memory err) {}
                }
            }
        }

        return
            DomainData(
                isAvailable,
                rentPrice,
                expiryDate,
                registrantAddress,
                controllerAddress,
                domainResolverAddress,
                resolvesToAddress
            );
    }

    function cartData(
        string calldata name,
        uint lengthInSeconds
    ) external view returns (CartData memory data) {
        IBaseRegistrar ethRegistrar = getEthRegistrar();
        ETHRegistrarController controller = getController();

        bytes32 nameHash = computeNamehash(name);
        bytes32 labelHash = keccak256(bytes(name));
        uint256 tokenId = uint256(labelHash);

        bool isAvailable = ethRegistrar.available(tokenId);

        IPriceOracle.Price memory priceData = controller.rentPrice(
            name,
            lengthInSeconds
        );
        uint rentPrice = (priceData.base + priceData.premium);

        //Returns 0 if available
        uint expiryDate = ethRegistrar.nameExpires(tokenId);

        return CartData(isAvailable, rentPrice, expiryDate);
    }
}
