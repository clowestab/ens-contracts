//SPDX-License-Identifier: MIT
pragma solidity >=0.8.17 <0.9.0;

interface ISubdomainOracle {
    /**
     * @dev Returns a boolean indicating if this subdomain can be registered.
     * @param node The node/namehash of the domain in question.
     * @return a boolean indicating if the name can be registered
     */
    function canBeRegistered(bytes32 node) external view returns (bool);

    function rentPrice(bytes32 node) external view returns (uint);
}
