import { Interface } from 'ethers/lib/utils'
import { hre, ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const { makeInterfaceId } = require('@openzeppelin/test-helpers')

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts()
  const { deploy } = hre.deployments

  const registry = await ethers.getContract('ENSRegistry')
  const registrar = await ethers.getContract('BaseRegistrarImplementation')
  const metadata = await ethers.getContract('StaticMetadataService')

  console.log('Deploying contracts with the account:', deployer)

  //console.log("Account balance:", (await deployer.getBalance()).toString());

  const nameWrapper = await ethers.getContract('NameWrapper')
  //const nameWrapper = await NameWrapper.deploy(registry.address, registrar.address, metadata.address);

  console.log('NameWrapper address:', nameWrapper.address)

  const response = await deploy('RenewalManager', {
    from: deployer,
    args: [nameWrapper.address],
    log: true,
    //nonce:338
  })
}

func.id = 'renewal-manager'
func.tags = ['wrapper', 'NameWrapper']
func.dependencies = [
  'BaseRegistrarImplementation',
  'StaticMetadataService',
  'registry',
]

export default func
