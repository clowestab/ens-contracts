import { Interface } from 'ethers/lib/utils'
import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const { makeInterfaceId } = require('@openzeppelin/test-helpers')

function computeInterfaceId(iface: Interface) {
  return makeInterfaceId.ERC165(
    Object.values(iface.functions).map((frag) => frag.format('sighash')),
  )
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, network } = hre
  const { deploy } = deployments
  const { deployer, owner } = await getNamedAccounts()

  console.log('there 1')

  const registry = await ethers.getContract('ENSRegistry', owner)
  const registrar = await ethers.getContract(
    'BaseRegistrarImplementation',
    owner,
  )
  const metadata = await ethers.getContract('StaticMetadataService', owner)

  console.log('there 2')

  const deployArgs = {
    from: deployer,
    args: [registry.address, registrar.address, metadata.address],
    log: true,
  }

  console.log('there 2b', deployArgs)

  const nameWrapper = await deploy('NameWrapper', deployArgs)

  console.log('there 2c')

  if (!nameWrapper.newlyDeployed) return

  console.log('there 3')

  if (owner !== deployer) {
    const wrapper = await ethers.getContract('NameWrapper', deployer)
    const tx = await wrapper.transferOwnership(owner)
    console.log(
      `Transferring ownership of NameWrapper to ${owner} (tx: ${tx.hash})...`,
    )
    await tx.wait()
  }

  // Only attempt to make controller etc changes directly on testnets
  if (network.name === 'mainnet') return

  const tx2 = await registrar.addController(nameWrapper.address)
  console.log(
    `Adding NameWrapper as controller on registrar (tx: ${tx2.hash})...`,
  )
  await tx2.wait()

  const artifact = await deployments.getArtifact('INameWrapper')
  const interfaceId = computeInterfaceId(new Interface(artifact.abi))
  const providerWithEns = new ethers.providers.StaticJsonRpcProvider(
    ethers.provider.connection.url,
    { ...ethers.provider.network, ensAddress: registry.address },
  )
  const resolver = await providerWithEns.getResolver('eth')
  if (resolver === null) {
    console.log(
      `No resolver set for .eth; not setting interface ${interfaceId} for NameWrapper`,
    )
    return
  }
  const resolverContract = await ethers.getContractAt(
    'PublicResolver',
    resolver.address,
  )
  const tx3 = await resolverContract.setInterface(
    ethers.utils.namehash('eth'),
    interfaceId,
    nameWrapper.address,
  )
  console.log(
    `Setting NameWrapper interface ID ${interfaceId} on .eth resolver (tx: ${tx3.hash})...`,
  )
  await tx3.wait()
}

func.id = 'name-wrapper'
func.tags = ['wrapper', 'NameWrapper']
func.dependencies = [
  'BaseRegistrarImplementation',
  'StaticMetadataService',
  'registry',
  'ReverseRegistrar',
]

export default func
