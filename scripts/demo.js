import ethersPackage from 'ethers'
const { ethers, utils, BigNumber } = ethersPackage
import NameWrapper from '../deployments/localhost/NameWrapper.json' assert { type: 'json' }
import BaseRegistrarImplementation from '../deployments/localhost/BaseRegistrarImplementation.json' assert { type: 'json' }
import ENSRegistry from '../deployments/localhost/ENSRegistry.json' assert { type: 'json' }
import PublicResolver from '../deployments/localhost/PublicResolver.json' assert { type: 'json' }
import ETHRegistrarController from '../deployments/localhost/ETHRegistrarController.json' assert { type: 'json' }
import crypto from 'crypto'

const ETH_NODE = utils.namehash('eth')

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const DUMMY_ADDRESS = '0x0000000000000000000000000000000000000001'
const DAY = 86400
const GRACE_PERIOD = 90 * DAY
const ONE_YEAR_IN_SECONDS = 360 * 24 * 60 * 60

const FUSES = {
  CAN_DO_EVERYTHING: 0,
  CANNOT_UNWRAP: 1,
  CANNOT_BURN_FUSES: 2,
  CANNOT_TRANSFER: 4,
  CANNOT_SET_RESOLVER: 8,
  CANNOT_SET_TTL: 16,
  CANNOT_CREATE_SUBDOMAIN: 32,
  PARENT_CANNOT_CONTROL: 2 ** 16,
  IS_DOT_ETH: 2 ** 17,
  CAN_EXTEND_EXPIRY: 2 ** 18,
}

const {
  CANNOT_UNWRAP,
  CANNOT_BURN_FUSES,
  CANNOT_TRANSFER,
  CANNOT_SET_RESOLVER,
  CANNOT_SET_TTL,
  CANNOT_CREATE_SUBDOMAIN,
  PARENT_CANNOT_CONTROL,
  CAN_DO_EVERYTHING,
  IS_DOT_ETH,
  CAN_EXTEND_EXPIRY,
} = FUSES

let url = 'http://127.0.0.1:8545/'
let provider = new ethers.providers.JsonRpcProvider(url)

let mnemonicWallet = new ethers.Wallet(
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
)

const signer = mnemonicWallet.connect(provider)

async function doWork() {
  //Instantiate NameWrapper
  const wrapperContract = new ethers.Contract(
    NameWrapper.address,
    NameWrapper.abi,
    signer,
  )

  //console.log(wrapperContract);

  //Get the registry address from the wrapper
  const registryAddress = await wrapperContract.ens()
  console.log('ENS Registry', registryAddress)

  //Instantiate ENSRegistry
  const registryContract = new ethers.Contract(
    ENSRegistry.address,
    ENSRegistry.abi,
    provider,
  )

  const ethResolver = await registryContract.resolver(
    '0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae',
  )

  console.log('ethResolver', ethResolver)

  //Get the registrar address from the wrapper
  const registrarAddress = await wrapperContract.registrar()
  console.log('Registrar', registrarAddress)

  //console.log("Registry Contract", registryContract);

  //Instantiate BaseRegistrarImplementation
  const registrarContract = new ethers.Contract(
    BaseRegistrarImplementation.address,
    BaseRegistrarImplementation.abi,
    provider,
  )

  //console.log("Registrar Contract", registrarContract);

  //Get the resolver address for the ETH node from the registry
  const ethResolverAddress = await registryContract.resolver(ETH_NODE)

  console.log('Resolver Address', ethResolverAddress)

  //Instantiate PublicResolver
  const resolverContract = new ethers.Contract(
    PublicResolver.address,
    PublicResolver.abi,
    provider,
  )

  //console.log("Resolver Contract", resolverContract);

  //Interface IDs are calculated as the exclusive-or of the four-byte function identifiers of each function included in the interface.
  //https://docs.ens.domains/contract-api-reference/publicresolver#check-interface-support
  const controllerInterfaceId = '0x018fac06'
  const ethControllerAddress = await resolverContract.interfaceImplementer(
    ETH_NODE,
    controllerInterfaceId,
  )

  console.log(
    'Controller address',
    ETHRegistrarController.address + ' not ' + ethControllerAddress,
  )

  //Instantiate ETHRegistrarController
  const ethControllerContract = new ethers.Contract(
    ETHRegistrarController.address,
    ETHRegistrarController.abi,
    signer,
  )

  //console.log("ETH Controller Contract", ethControllerContract);

  /**
   * This will revert because its not called by a controller addred to the Controllable NameWrapper
   */
  /*

	const label                = "testlabel";
	const registrationDuration = DAY;
	const wrappedOwner         = signer.address;
	const resolverAddress      = ZERO_ADDRESS;
	const ownerControlledFuses = 0;//PARENT_CANNOT_CONTROL | CANNOT_UNWRAP;

	console.log("ownerControlledFuses", ownerControlledFuses);

	await wrapperContract.registerAndWrapETH2LD(
  		label,
  		wrappedOwner,
  		registrationDuration,
  		resolverAddress,
  		ownerControlledFuses
  	);*/

  //Read values from the .ETH registrar contract
  const minRegDuration = await ethControllerContract.MIN_REGISTRATION_DURATION()
  const minCommitmentAgeInSeconds =
    await ethControllerContract.minCommitmentAge()
  const maxCommitmentAgeInSeconds =
    await ethControllerContract.maxCommitmentAge()

  const registerDomain = async (nameToRegister) => {
    const nameToRegisterNameHash = utils.namehash(nameToRegister + '.eth')
    const nameToRegisterLabelHash = utils.keccak256(
      utils.toUtf8Bytes(nameToRegister),
    )
    const nameToRegisterTokenId = BigNumber.from(
      nameToRegisterLabelHash,
    ).toString()

    console.log('nameToRegisterLabelHash', nameToRegisterLabelHash)

    const registerForTimeInSeconds = ONE_YEAR_IN_SECONDS
    const addressToRegisterTo = signer.address
    const addressToResolveTo = ZERO_ADDRESS
    const salt = '0x' + crypto.randomBytes(32).toString('hex')

    //We create a commitment to register the name
    //const commitment = await ethControllerContract.makeCommitment(nameToRegister, addressToRegisterTo, salt);

    const commitment = await ethControllerContract.makeCommitment(
      nameToRegister,
      addressToRegisterTo,
      registerForTimeInSeconds,
      salt,
      addressToResolveTo,
      [],
      false,
      0,
    )

    //const commitment = await EthRegistrarControllerContract.makeCommitment(nameToRegister, address, salt, PublicResolverAddress, addressToResolveTo);

    console.log('======================================')
    console.log('======== Registration Details ========')
    console.log('======================================')
    console.log('Name to register: ' + nameToRegister)
    console.log('Address to register to (owner): ' + addressToRegisterTo)
    console.log('Commitment salt: ' + salt)
    //console.log("Resolver address: " + PublicResolverAddress);
    //console.log("Address to resolve to: " + addressToResolveTo);
    console.log('======================================')
    console.log('Commitment: ' + commitment)
    console.log('======================================')

    //Submit the commitment to the chain
    const commitmentResponse = await ethControllerContract.commit(commitment)

    await commitmentResponse.wait().catch((error) => {
      console.log('ERROR commit response - ' + error.reason)
      process.exit()
    })

    //Lets check that the commitment has actually been saved on chain
    const commitmentTimestamp = await ethControllerContract.commitments(
      commitment,
    )

    console.log('Commitment timestamp: ' + commitmentTimestamp)

    //We have to wait for the minCommitmentAgeInSeconds amount of time before submitting the registration
    console.log('Waiting ' + minCommitmentAgeInSeconds + ' seconds.')
    await timeout(minCommitmentAgeInSeconds * 1000)

    //Discern if the name we are trying to register is actually available
    const isAvailable = await ethControllerContract.available(nameToRegister)
    console.log('Available? ' + isAvailable)

    console.log('AVAILABLE: Will be registered.')

    //0xfd20451347a528d3483717ac73ac8f779683f325b3b45be3cf6b0d26377028da

    const rentPrice = await ethControllerContract.rentPrice(
      nameToRegister,
      registerForTimeInSeconds,
    )

    console.log('Rent price', rentPrice)

    const registerResponse = await ethControllerContract.register(
      nameToRegister,
      addressToRegisterTo,
      registerForTimeInSeconds,
      salt,
      addressToResolveTo,
      [],
      false,
      0,
      { value: BigNumber.from('2000000000000000000'), gasLimit: 500000 },
    )

    console.log('Register domain..')

    await registerResponse.wait().catch((error) => {
      console.log('ERROR register response - ' + error.reason)
      process.exit()
    })

    const isAvailableNow = await ethControllerContract.available(nameToRegister)
    console.log('Available? ' + isAvailableNow)

    const isWrappedNow = await wrapperContract['isWrapped(bytes32,bytes32)'](
      ETH_NODE,
      nameToRegisterLabelHash,
    )
    console.log('isWrapped (registered 2ld)', isWrappedNow)

    const data = await wrapperContract.getData(nameToRegisterNameHash)
    console.log('data', data)

    console.log('nameToRegisterTokenId? ' + nameToRegisterTokenId)

    //Check the owner of the wrapped 2LD
    const ownerNow = await wrapperContract.ownerOf(nameToRegisterNameHash)
    console.log('Owner', ownerNow)
  }

  const nameToRegister = 'testing123a9'

  const isAvailableNow = await ethControllerContract.available(nameToRegister)

  if (isAvailableNow) {
    await registerDomain(nameToRegister)
  }

  const nameToRegisterNameHash = utils.namehash(nameToRegister + '.eth')
  const registerForTimeInSeconds = ONE_YEAR_IN_SECONDS
  const addressToRegisterTo = signer.address

  const subToRegister = 'test'
  const subToRegisterNameHash = utils.namehash(subToRegister + '.eth')
  const subToRegisterLabelHash = utils.keccak256(
    utils.toUtf8Bytes(subToRegister),
  )
  const subToRegisterTokenId = BigNumber.from(subToRegisterLabelHash).toString()
  const invalidSubToRegisterLabelHash = utils.keccak256(
    utils.toUtf8Bytes('lalala'),
  )

  const subResultResponse = await wrapperContract.setSubnodeOwner(
    nameToRegisterNameHash,
    subToRegister,
    addressToRegisterTo,
    0,
    registerForTimeInSeconds,
  )

  console.log('labelhash', utils.keccak256(utils.toUtf8Bytes('test')))

  await subResultResponse.wait().catch((error) => {
    console.log('ERROR register response - ' + error.reason)
    process.exit()
  })

  //console.log("subResultResponse", subResultResponse);

  const isWrappednh = await wrapperContract['isWrapped(bytes32)'](
    subToRegisterNameHash,
  )
  console.log('isWrappenh', isWrappednh)

  //Check oif the subdomain is now wrapped
  const isWrapped2 = await wrapperContract['isWrapped(bytes32,bytes32)'](
    nameToRegisterNameHash,
    subToRegisterLabelHash,
  )
  console.log('isWrapped2', isWrapped2)

  const fullSub = subToRegister + '.' + nameToRegister + '.eth'
  const fullSubNamehash = utils.namehash(fullSub)
  console.log('sub', fullSub)
  console.log('namehash', fullSubNamehash)

  //This one should not be wrapped
  //const isWrappedInvalid = await wrapperContract['isWrapped(bytes32,bytes32)'](nameToRegisterNameHash, invalidSubToRegisterLabelHash);
  //console.log("isWrappedInvalid", isWrappedInvalid);

  //await registerDomain("sub.testing123a9");

  await wrapperContract.setFuses(nameToRegisterNameHash, CANNOT_UNWRAP)
  //await wrapperContract.setFuses(fullSubNamehash, (PARENT_CANNOT_CONTROL | CANNOT_UNWRAP));

  //setChildFuses takes uint32 param whereas setFuses only allows uint16
  //(PARENT_CANNOT_CONTROL | CANNOT_UNWRAP) is 65537 which is out of bounds for setFuses
  await wrapperContract.setChildFuses(
    nameToRegisterNameHash,
    subToRegisterLabelHash,
    PARENT_CANNOT_CONTROL | CANNOT_UNWRAP,
    0,
  )

  await wrapperContract.unwrap(
    nameToRegisterNameHash,
    subToRegisterLabelHash,
    ZERO_ADDRESS,
  )
}

//Helper function to pause for x milliseconds
function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

doWork()
