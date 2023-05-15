const { expect } = require('chai')
const { deploy } = require('../test-utils/contracts')
const { labelhash, namehash, encodeName, FUSES } = require('../test-utils/ens')
const { EMPTY_BYTES32, EMPTY_ADDRESS } = require('../test-utils/constants')

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const ROOT_NODE = EMPTY_BYTES32

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

describe('Renewal Manager contract', function () {
  let ENSRegistry
  let ENSRegistry2
  let ENSRegistryH
  let BaseRegistrar
  let BaseRegistrar2
  let BaseRegistrarH
  let NameWrapper
  let NameWrapper2
  let NameWrapperH
  let NameWrapperUpgraded
  let MetaDataservice
  let RenewalManager
  let signers
  let accounts
  let account
  let account2
  let hacker
  let result
  let MAX_EXPIRY = 2n ** 64n - 1n

  let BasicSubdomainOracle
  let AnotherSubdomainOracle

  before(async () => {
    signers = await ethers.getSigners()
    account = await signers[0].getAddress()
    account2 = await signers[1].getAddress()
    hacker = await signers[2].getAddress()

    EnsRegistry = await deploy('ENSRegistry')
    EnsRegistry2 = EnsRegistry.connect(signers[1])
    EnsRegistryH = EnsRegistry.connect(signers[2])

    BaseRegistrar = await deploy(
      'BaseRegistrarImplementation',
      EnsRegistry.address,
      namehash('eth'),
    )

    BaseRegistrar2 = BaseRegistrar.connect(signers[1])
    BaseRegistrarH = BaseRegistrar.connect(signers[2])

    await BaseRegistrar.addController(account)
    await BaseRegistrar.addController(account2)

    MetaDataservice = await deploy(
      'StaticMetadataService',
      'https://ens.domains',
    )

    NameWrapper = await deploy(
      'NameWrapper',
      EnsRegistry.address,
      BaseRegistrar.address,
      MetaDataservice.address,
    )
    NameWrapper2 = NameWrapper.connect(signers[1])
    NameWrapperH = NameWrapper.connect(signers[2])

    NameWrapperUpgraded = await deploy(
      'UpgradedNameWrapperMock',
      EnsRegistry.address,
      BaseRegistrar.address,
    )

    RenewalManager = await deploy('RenewalManager', NameWrapper.address)

    // setup .eth
    await EnsRegistry.setSubnodeOwner(
      ROOT_NODE,
      labelhash('eth'),
      BaseRegistrar.address,
    )

    // setup .xyz
    await EnsRegistry.setSubnodeOwner(ROOT_NODE, labelhash('xyz'), account)

    //make sure base registrar is owner of eth TLD
    expect(await EnsRegistry.owner(namehash('eth'))).to.equal(
      BaseRegistrar.address,
    )

    BasicSubdomainOracle = await deploy('BasicSubdomainOracle')
    AnotherSubdomainOracle = await deploy('AnotherSubdomainOracle')
  })

  /*
  beforeEach(async () => {
    result = await ethers.provider.send('evm_snapshot')
  })
  afterEach(async () => {
    await ethers.provider.send('evm_revert', [result])
  })
*/

  const exampleNode =
    '0x3d5d2e21162745e4df4f56471fd7f651f441adaaca25deb70e4738c6f63d1224'
  const exampleLabelhashTokenId =
    '50581729048717371578262585285492117321305276024434183435897035210103648268661'
  const exampleNamehashTokenId =
    '27755718912946858216851288133620079020604200818669015994469856642925265228324'

  it('Is initially not available for registration', async function () {
    //const RenewalManager = await ethers.getContractFactory("RenewalManager");

    //const renewalManager = await RenewalManager.deploy(nameWrapper.address);

    expect(await RenewalManager.canRegister(exampleNode)).to.equal(false)
  })

  it('Setup unauthorised if not owner', async () => {
    await expect(
      RenewalManager.setupDomain(exampleNode, ZERO_ADDRESS),
    ).to.be.revertedWith(
      `Unauthorised(${exampleNamehashTokenId}, "${account}")`,
    )
  })

  it('Setup authorised if owner', async () => {
    //Register example.eth
    await BaseRegistrar.register(labelhash('example'), account, 86400)

    //Check its registered to our signer account
    const registrarOwner = await BaseRegistrar.ownerOf(exampleLabelhashTokenId)
    await expect(registrarOwner).to.equal(account)

    await BaseRegistrar.setApprovalForAll(NameWrapper.address, true)

    //Wrap example.eth setting the owner to our signer account
    await NameWrapper.wrapETH2LD(
      'example',
      account,
      CAN_DO_EVERYTHING | CANNOT_UNWRAP, //CANNOT_UNWRAP needs to be burned to register subdomains
      EMPTY_ADDRESS,
    )

    //Check the registrar owner is the NameWrapper
    //await expect(BaseRegistrar.ownerOf(exampleLabelhashTokenId), NameWrapper.address);

    const nameWrapperOwner = await NameWrapper.ownerOf(exampleNamehashTokenId)
    console.log('Name wrapper owner data', nameWrapperOwner)

    await expect(nameWrapperOwner).to.equal(account)

    console.log('-------------------------')
    console.log('-------------------------', BasicSubdomainOracle.address)

    //
    await NameWrapper.setApprovalForAll(RenewalManager.address, true)

    //Setup the domain with our RenewalManager
    await RenewalManager.setupDomain(exampleNode, BasicSubdomainOracle.address)

    const nameWrapperOwnern = await NameWrapper.ownerOf(exampleNamehashTokenId)
    console.log('Name wrapper owner data NOW', nameWrapperOwnern)

    //Get the data for the now setup domain
    const sldData = await RenewalManager.sldData(exampleNamehashTokenId)
    console.log('SLD data', sldData)

    //Verify it is what we expect
    expect(sldData.realOwner).to.equal(account)
    expect(sldData.currentStatus).to.equal(0)
    //expect(sldData.registrationFee.toString()).to.equal('100');

    const nameWrapperOwnerNow = await NameWrapper.ownerOf(
      exampleNamehashTokenId,
    )
    console.log('nameWrapperOwnerNow', nameWrapperOwnerNow)

    await expect(nameWrapperOwnerNow).to.equal(RenewalManager.address)

    //Setup the domain with our RenewalManager
    await RenewalManager.recoverDomain(exampleNamehashTokenId)

    const nameWrapperOwnerPostRecover = await NameWrapper.ownerOf(
      exampleNamehashTokenId,
    )
    await expect(nameWrapperOwnerPostRecover).to.equal(account)

    const price = await RenewalManager.rentPrice(exampleNode)
    await expect(price).to.equal(1000)

    const currentOracle = await RenewalManager.getSubdomainOracle(exampleNode)
    expect(currentOracle).equal(BasicSubdomainOracle.address)

    await RenewalManager.setSubdomainOracle(
      exampleNode,
      AnotherSubdomainOracle.address,
    )

    const newOracle = await RenewalManager.getSubdomainOracle(exampleNode)
    expect(newOracle).equal(AnotherSubdomainOracle.address)

    const subdomainNamehash =
      '0x0f8295411d826f29fb9acb99b4d5d70442cf9804cb43756451333711de632ab2'

    const isSubdomainAvailable = await RenewalManager.isSubdomainAvailable(
      subdomainNamehash,
    )
    expect(isSubdomainAvailable).to.equal(true)

    await RenewalManager.register(
      exampleNode,
      'subdomain',
      account,
      account,
      0,
      0,
      [],
    )

    const isSubdomainAvailableNow = await RenewalManager.isSubdomainAvailable(
      subdomainNamehash,
    )
    expect(isSubdomainAvailableNow).to.equal(false)
  })
})
