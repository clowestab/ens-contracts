import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const registry = await ethers.getContract('ENSRegistry')

  //const bulkRegisterAndRenew = await ethers.getContract('BulkRegisterAndRenew')

  await deploy('BulkRegisterAndRenew', {
    from: deployer,
    args: [registry.address],
    log: true,
    contract: await deployments.getArtifact('BulkRegisterAndRenew'),
  })

  return true
}

func.id = 'bulk-reg-renew'
func.tags = ['labelhash', 'BulkRegisterAndRenew']
func.dependencies = ['registry', 'wrapper']

export default func
