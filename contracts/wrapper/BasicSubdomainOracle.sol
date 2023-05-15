//SPDX-License-Identifier: MIT
pragma solidity >=0.8.17 <0.9.0;

import "./ISubdomainOracle.sol";

contract BasicSubdomainOracle is ISubdomainOracle {
    /**
     * @dev Returns a boolean indicating if this subdomain can be registered.
     * @param node The node/namehash of the domain in question.
     * @return a boolean indicating if the name can be registered
     */
    function canBeRegistered(bytes32 node) external view returns (bool) {
        return true;
    }

    function rentPrice(bytes32 node) external view returns (uint) {
        return 1000;
    }
}
