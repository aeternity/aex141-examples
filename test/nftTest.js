const { assert, expect, use } = require('chai');
const { utils, wallets } = require('@aeternity/aeproject');
const chaiAsPromised = require('chai-as-promised');

const CONTRACT_SOURCE = './contracts/nft.aes';

describe('nft', () => {
  let aeSdk;
  let contract;

  before(async () => {
    aeSdk = await utils.getSdk();

    // a filesystem object must be passed to the compiler if the contract uses custom includes
    const filesystem = utils.getFilesystem(CONTRACT_SOURCE);

    // get content of contract
    const source = utils.getContractContent(CONTRACT_SOURCE);

    // initialize the contract instance
    contract = await aeSdk.getContractInstance({ source, filesystem });
    await contract.deploy([
      'Test NFT', 
      'TST', 
      {'URL': []}, 
      {'None' : []}
    ]);

    // create a snapshot of the blockchain state
    await utils.createSnapshot(aeSdk);

    use(chaiAsPromised);
  });

  // after each test roll back to initial state
  afterEach(async () => {
    await utils.rollbackSnapshot(aeSdk);
  });

  it('NFT: aex141_extensions', async () => {
    const { decodedResult } = await contract.methods.aex141_extensions();
    assert.equal(decodedResult.length, 0);
  });

  it('NFT: meta_info', async () => {
    const { decodedResult } = await contract.methods.meta_info();

    assert.equal(decodedResult.name, 'Test NFT');
    assert.equal(decodedResult.symbol, 'TST');
    assert.equal(decodedResult.metadata_type.URL.length, 0);
    assert.equal(decodedResult.base_url, undefined);
  });

  it('NFT: define_token with contract owner', async () => {
    const token = await contract.methods.define_token(wallets[0].publicKey, {'String': ['https://example.com/mynft']}, { onAccount: wallets[0].publicKey });
    assert.equal(token.decodedEvents[0].name, 'Transfer');
    assert.equal(token.decodedEvents[0].args[0].substr(2), contract.deployInfo.address.substr(2));
    assert.equal(token.decodedEvents[0].args[1], wallets[0].publicKey);
    assert.equal(token.decodedEvents[0].args[2], 0);

    // Should not be able to define the token again.
    await expect(
      contract.methods.define_token(wallets[0].publicKey, 
      {'String': ['https://example.com/mynft']}, 
      { onAccount: wallets[0].publicKey }))
      .to.be.rejectedWith(`Invocation failed: "TOKEN_ALREADY_DEFINED"`);

    {
      const  { decodedResult } = await contract.methods.metadata(0);
      assert.equal(decodedResult.String[0], 'https://example.com/mynft');
    }

    {
      const { decodedResult } = await contract.methods.metadata(1);
      assert.equal(decodedResult, undefined);
    }

    {
      const { decodedResult } = await contract.methods.meta_info();
      assert.equal(decodedResult.name, 'Test NFT');
      assert.equal(decodedResult.symbol, 'TST');
      assert.isEmpty(decodedResult.metadata_type.URL);
      assert.equal(decodedResult.base_url, undefined);
    }

    {
      const { decodedResult } = await contract.methods.balance(wallets[0].publicKey);
      assert.equal(decodedResult, 1);
    }

    {
      const { decodedResult } = await contract.methods.owner(0);
      assert.equal(decodedResult, wallets[0].publicKey);
    }

  });

  it('NFT: transfer', async () => {
    const token = await contract.methods.define_token(wallets[0].publicKey, {'String': ['https://example.com/mynft']}, { onAccount: wallets[0].publicKey });
    assert.equal(token.decodedEvents[0].name, 'Transfer');
    assert.equal(token.decodedEvents[0].args[0].substr(2), contract.deployInfo.address.substr(2));
    assert.equal(token.decodedEvents[0].args[1], wallets[0].publicKey);
    assert.equal(token.decodedEvents[0].args[2], 0);

    const tr = await contract.methods.transfer(wallets[0].publicKey, wallets[1].publicKey, 0);
    assert.equal(tr.decodedEvents[0].name, 'Transfer');
    assert.equal(tr.decodedEvents[0].args[0], wallets[0].publicKey);
    assert.equal(tr.decodedEvents[0].args[1], wallets[1].publicKey);
    assert.equal(tr.decodedEvents[0].args[2], 0);

    const { decodedResult } = await contract.methods.owner(0);
    assert.equal(decodedResult, wallets[1].publicKey);
  });

  it('NFT: approve', async () => {
    const token = await contract.methods.define_token(wallets[0].publicKey, {'String': ['https://example.com/mynft']}, { onAccount: wallets[0].publicKey });
    assert.equal(token.decodedEvents[0].name, 'Transfer');
    assert.equal(token.decodedEvents[0].args[0].substr(2), contract.deployInfo.address.substr(2));
    assert.equal(token.decodedEvents[0].args[1], wallets[0].publicKey);
    assert.equal(token.decodedEvents[0].args[2], 0);

    const approve = await contract.methods.approve(wallets[1].publicKey, 0, true);
    assert.equal(approve.decodedEvents[0].name, 'Approval');
    assert.equal(approve.decodedEvents[0].args[0], wallets[0].publicKey);
    assert.equal(approve.decodedEvents[0].args[1], wallets[1].publicKey);
    assert.equal(approve.decodedEvents[0].args[2], 0);
    assert.equal(approve.decodedEvents[0].args[3], "true");

    {
      const { decodedResult } = await contract.methods.get_approved(0);
      assert.equal(decodedResult, wallets[1].publicKey);
    }

    {
      const { decodedResult } = await contract.methods.is_approved(0, wallets[1].publicKey);
      assert.equal(decodedResult, true);
    }

    const tr = await contract.methods.transfer(wallets[0].publicKey, wallets[2].publicKey, 0, { onAccount: wallets[1].publicKey });
    assert.equal(tr.decodedEvents[0].name, 'Transfer');
    assert.equal(tr.decodedEvents[0].args[0], wallets[0].publicKey);
    assert.equal(tr.decodedEvents[0].args[1], wallets[2].publicKey);
    assert.equal(tr.decodedEvents[0].args[2], 0);

    {
      const { decodedResult } = await contract.methods.is_approved(0, wallets[1].publicKey);
      assert.equal(decodedResult, false);
    }

    const { decodedResult } = await contract.methods.owner(0);
    assert.equal(decodedResult, wallets[2].publicKey);
  });

  it('NFT: approve for all', async () => {
    const token = await contract.methods.define_token(wallets[0].publicKey, {'String': ['https://example.com/mynft']}, { onAccount: wallets[0].publicKey });
    assert.equal(token.decodedEvents[0].name, 'Transfer');
    assert.equal(token.decodedEvents[0].args[0].substr(2), contract.deployInfo.address.substr(2));
    assert.equal(token.decodedEvents[0].args[1], wallets[0].publicKey);
    assert.equal(token.decodedEvents[0].args[2], 0);

    const approve = await contract.methods.approve_all(wallets[1].publicKey, true);
    assert.equal(approve.decodedEvents[0].name, 'ApprovalForAll');
    assert.equal(approve.decodedEvents[0].args[0], wallets[0].publicKey);
    assert.equal(approve.decodedEvents[0].args[1], wallets[1].publicKey);
    assert.equal(approve.decodedEvents[0].args[2], "true");

    {
      const { decodedResult } = await contract.methods.is_approved_for_all(wallets[0].publicKey, wallets[1].publicKey);
      assert.equal(decodedResult, true);
    }

    const tr = await contract.methods.transfer(wallets[0].publicKey, wallets[2].publicKey, 0, { onAccount: wallets[1].publicKey });
    assert.equal(tr.decodedEvents[0].name, 'Transfer');
    assert.equal(tr.decodedEvents[0].args[0], wallets[0].publicKey);
    assert.equal(tr.decodedEvents[0].args[1], wallets[2].publicKey);
    assert.equal(tr.decodedEvents[0].args[2], 0);

    const { decodedResult } = await contract.methods.owner(0);
    assert.equal(decodedResult, wallets[2].publicKey);
  });

  it('NFT: unauthorized transfer', async () => {
    const token = await contract.methods.define_token(wallets[1].publicKey, {'String': ['https://example.com/mynft']}, { onAccount: wallets[0].publicKey });
    assert.equal(token.decodedEvents[0].name, 'Transfer');
    assert.equal(token.decodedEvents[0].args[0].substr(2), contract.deployInfo.address.substr(2));
    assert.equal(token.decodedEvents[0].args[1], wallets[1].publicKey);
    assert.equal(token.decodedEvents[0].args[2], 0);

    await expect(
      contract.methods.transfer(wallets[1].publicKey, wallets[0].publicKey, 0, { onAccount: wallets[0].publicKey }))
      .to.be.rejectedWith(`Invocation failed: "ONLY_OWNER_APPROVED_OR_OPERATOR_CALL_ALLOWED"`);
  });

  it('NFT: invalid transfer', async () => {
    const token = await contract.methods.define_token(wallets[0].publicKey, {'String': ['https://example.com/mynft']}, { onAccount: wallets[0].publicKey });
    assert.equal(token.decodedEvents[0].name, 'Transfer');
    assert.equal(token.decodedEvents[0].args[0].substr(2), contract.deployInfo.address.substr(2));
    assert.equal(token.decodedEvents[0].args[1], wallets[0].publicKey);
    assert.equal(token.decodedEvents[0].args[2], 0);

    await expect(
      contract.methods.transfer(wallets[2].publicKey, wallets[1].publicKey, 0, { onAccount: wallets[0].publicKey }))
      .to.be.rejectedWith(`Invocation failed: "ONLY_OWNER_CALL_ALLOWED"`);
  });
});
