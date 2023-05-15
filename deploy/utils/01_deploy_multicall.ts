import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  await deploy('Multicall', {
    from: deployer,
    args: [],
    log: true,
  })
}

func.id = 'multicall'
func.tags = ['utils', 'Multicall']
func.dependencies = []

export default func
