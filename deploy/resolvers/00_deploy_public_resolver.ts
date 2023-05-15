import { Interface } from 'ethers/lib/utils'
import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { keccak256 } from 'js-sha3'

const { makeInterfaceId } = require('@openzeppelin/test-helpers')

function computeInterfaceId(iface: Interface) {
  return makeInterfaceId.ERC165(
    Object.values(iface.functions).map((frag) => frag.format('sighash')),
  )
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { deploy } = deployments
  const { deployer, owner } = await getNamedAccounts()

  const registry = await ethers.getContract('ENSRegistry', owner)
  const nameWrapper = await ethers.getContract('NameWrapper', owner)
  const controller = await ethers.getContract('ETHRegistrarController', owner)
  const reverseRegistrar = await ethers.getContract('ReverseRegistrar', owner)
  const registrar = await ethers.getContract('BaseRegistrarImplementation')

  const deployArgs = {
    from: deployer,
    args: [
      registry.address,
      nameWrapper.address,
      controller.address,
      reverseRegistrar.address,
    ],
    log: true,
  }
  const publicResolver = await deploy('PublicResolver', deployArgs)
  if (!publicResolver.newlyDeployed) return

  const tx = await reverseRegistrar.setDefaultResolver(publicResolver.address)
  console.log(
    `Setting default resolver on ReverseRegistrar to PublicResolver (tx: ${tx.hash})...`,
  )
  await tx.wait()

  const resolverContract = await ethers.getContractAt(
    'PublicResolver',
    publicResolver.address,
  )

  const root = await ethers.getContract('Root')

  const tx2B = await root
    .connect(await ethers.getSigner(owner))
    .setSubnodeOwner('0x' + keccak256('eth'), owner)
  console.log(
    `Setting owner of eth node to registrar on root (tx: ${tx2B.hash})...`,
  )
  await tx2B.wait()

  const artifact = await deployments.getArtifact('IETHRegistrarController')
  const interfaceId = computeInterfaceId(new Interface(artifact.abi))

  const tx3 = await resolverContract.setInterface(
    ethers.utils.namehash('eth'),
    interfaceId,
    controller.address,
  )
  console.log(
    `Setting ETHRegistrarController interface ID ${interfaceId} on .eth resolver (tx: ${tx3.hash})...`,
  )
  await tx3.wait()

  const tx2c = await root
    .connect(await ethers.getSigner(owner))
    .setSubnodeOwner('0x' + keccak256('eth'), registrar.address)
  console.log(
    `Setting owner of eth node to registrar on root (tx: ${tx2c.hash})...`,
  )
  await tx2c.wait()

  if ((await registry.owner(ethers.utils.namehash('resolver.eth'))) === owner) {
    const pr = (await ethers.getContract('PublicResolver')).connect(
      await ethers.getSigner(owner),
    )
    const resolverHash = ethers.utils.namehash('resolver.eth')
    const tx2 = await registry.setResolver(resolverHash, pr.address)
    console.log(
      `Setting resolver for resolver.eth to PublicResolver (tx: ${tx2.hash})...`,
    )
    await tx2.wait()

    const tx4 = await pr['setAddr(bytes32,address)'](resolverHash, pr.address)
    console.log(
      `Setting address for resolver.eth to PublicResolver (tx: ${tx4.hash})...`,
    )
    await tx4.wait()
  } else {
    console.log(
      'resolver.eth is not owned by the owner address, not setting resolver',
    )
  }

  //Sets ETH resolver on registry
  registrar.setResolver(publicResolver.address)
}

func.id = 'resolver'
func.tags = ['resolvers', 'PublicResolver']
func.dependencies = [
  'registry',
  'ETHRegistrarController',
  'NameWrapper',
  'ReverseRegistrar',
]

export default func
