const { assert, expect, use } = require('chai');
const { utils, wallets } = require('@aeternity/aeproject');
const chaiAsPromised = require('chai-as-promised');

const CONTRACT_SOURCE = './contracts/mintable_burnable.aes';
const RECEIVER_CONTRACT_SOURCE = './test/receiver.aes';

describe('mintable, burnable nft', () => {
  let aeSdk;
  let contract;
  let receiver_contract;
  let source;
  let fileSystem;
  let accounts;

  before(async () => {
    aeSdk = await utils.getSdk();

    // initialize the default accounts that can be passed to a contract methods in order to execute it on behalf of a specific accounts
    accounts = utils.getDefaultAccounts();

    // a fileSystem object must be passed to the compiler if the contract uses custom includes
    fileSystem = utils.getFilesystem(CONTRACT_SOURCE);

    // get content of contract
    source = utils.getContractContent(CONTRACT_SOURCE);
    const receiver_contract_source = utils.getContractContent(RECEIVER_CONTRACT_SOURCE);

    // initialize the contract instance
    contract = await aeSdk.getContractInstance({ source, fileSystem });
    await contract.deploy([
      'Test NFT',
      'TST',
      {'None': []},
      {'URL': []},
    ]);

    receiver_contract = await aeSdk.getContractInstance({ source: receiver_contract_source });
    await receiver_contract.deploy(); 

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
    assert.deepEqual(decodedResult, ["mintable", "burnable"]);
  });

  it('NFT: meta_info', async () => {
    const { decodedResult } = await contract.methods.meta_info();

    assert.equal(decodedResult.name, 'Test NFT');
    assert.equal(decodedResult.symbol, 'TST');
    assert.equal(decodedResult.metadata_type.URL.length, 0);
    assert.equal(decodedResult.base_url, undefined);
  });

  it('NFT: mint token', async () => {
    const token = await contract.methods.mint(wallets[0].publicKey, {'MetadataIdentifier': ['https://example.com/mynft']}, { onAccount: accounts[0] });
    assert.equal(token.decodedEvents[0].name, 'Transfer');
    assert.equal(token.decodedEvents[0].args[0].substr(2), contract.deployInfo.address.substr(2));
    assert.equal(token.decodedEvents[0].args[1], wallets[0].publicKey);
    assert.equal(token.decodedEvents[0].args[2], 0);

    let token_id = token.decodedResult;
    assert.equal(token_id, 0);

    {
      const { decodedResult } = await contract.methods.metadata(0);
      assert.equal(decodedResult.MetadataIdentifier[token_id], 'https://example.com/mynft');
    }

    {
      const { decodedResult } = await contract.methods.metadata(1);
      assert.equal(decodedResult, undefined);
    }

    {
      const { decodedResult } = await contract.methods.balance(wallets[0].publicKey);
      assert.equal(decodedResult, 1);
    }

    {
      const { decodedResult } = await contract.methods.owner(token_id);
      assert.equal(decodedResult, wallets[0].publicKey);
    }

    let new_token_id = token_id + BigInt(1);
    const token1 = await contract.methods.mint(wallets[0].publicKey, {'MetadataIdentifier': ['https://example.com/mynft']}, { onAccount: accounts[0] });
    assert.equal(token1.decodedEvents[0].name, 'Transfer');
    assert.equal(token1.decodedEvents[0].args[0].substr(2), contract.deployInfo.address.substr(2));
    assert.equal(token1.decodedEvents[0].args[1], wallets[0].publicKey);
    assert.equal(token1.decodedEvents[0].args[2], new_token_id);
    assert.equal(token1.decodedResult, new_token_id);
  });

  it('NFT: mint only by contract owner', async () => {
    await expect(
      contract.methods.mint(wallets[0].publicKey, 
      {'MetadataIdentifier': ['https://example.com/mynft']},
      {'None': []}, 
      { onAccount: accounts[1] }))
      .to.be.rejectedWith(`Invocation failed: "ONLY_CONTRACT_OWNER_CALL_ALLOWED"`);
  });

  it('NFT: burn token', async () => {
    const token = await contract.methods.mint(wallets[0].publicKey, {'MetadataIdentifier': ['https://example.com/mynft']}, { onAccount: accounts[0] });
    assert.equal(token.decodedEvents[0].name, 'Transfer');
    assert.equal(token.decodedEvents[0].args[0].substr(2), contract.deployInfo.address.substr(2));
    assert.equal(token.decodedEvents[0].args[1], wallets[0].publicKey);
    assert.equal(token.decodedEvents[0].args[2], 0);

    const burn = await contract.methods.burn(0, { onAccount: accounts[0] });
    assert.equal(burn.decodedEvents[0].name, 'Transfer');
    assert.equal(burn.decodedEvents[0].args[0], wallets[0].publicKey);
    assert.equal(burn.decodedEvents[0].args[1].substr(2), contract.deployInfo.address.substr(2));
    assert.equal(burn.decodedEvents[0].args[2], 0);
  });

  it('NFT: burn only by authorized', async () => {
    const token = await contract.methods.mint(wallets[0].publicKey, {'MetadataIdentifier': ['https://example.com/mynft']}, { onAccount: accounts[0] });
    assert.equal(token.decodedEvents[0].name, 'Transfer');
    assert.equal(token.decodedEvents[0].args[0].substr(2), contract.deployInfo.address.substr(2));
    assert.equal(token.decodedEvents[0].args[1], wallets[0].publicKey);
    assert.equal(token.decodedEvents[0].args[2], 0);

    await expect(
      contract.methods.burn(0, { onAccount: accounts[1] }))
      .to.be.rejectedWith(`Invocation failed: "ONLY_OWNER_APPROVED_OR_OPERATOR_CALL_ALLOWED"`);
  });

  it('NFT: contract with base_url', async () => {
    let contract = await aeSdk.getContractInstance({ source, fileSystem });
    await contract.deploy([
      'Test NFT',
      'TST',
      'https://example.com/',
      {'URL': []}
    ]);

    const token = await contract.methods.mint(wallets[0].publicKey, {'MetadataIdentifier': ['mynft']}, { onAccount: accounts[0] });
    assert.equal(token.decodedEvents[0].name, 'Transfer');
    assert.equal(token.decodedEvents[0].args[0].substr(2), contract.deployInfo.address.substr(2));
    assert.equal(token.decodedEvents[0].args[1], wallets[0].publicKey);
    assert.equal(token.decodedEvents[0].args[2], 0);

    {
      const  { decodedResult } = await contract.methods.metadata(0);
      assert.equal(decodedResult.MetadataIdentifier[0], 'https://example.com/mynft');
    }

    {
      const { decodedResult } = await contract.methods.meta_info();
      assert.equal(decodedResult.name, 'Test NFT');
      assert.equal(decodedResult.symbol, 'TST');
      assert.isEmpty(decodedResult.metadata_type.URL);
      assert.equal(decodedResult.base_url, 'https://example.com/');
    }
  });

  it('NFT: transfer', async () => {
    const token = await contract.methods.mint(wallets[0].publicKey, {'MetadataIdentifier': ['https://example.com/mynft']}, { onAccount: accounts[0] });
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
    const token = await contract.methods.mint(wallets[0].publicKey, {'MetadataIdentifier': ['https://example.com/mynft']}, { onAccount: accounts[0] });
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

    const tr = await contract.methods.transfer(wallets[0].publicKey, wallets[2].publicKey, 0, { onAccount: accounts[1] });
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
    const token = await contract.methods.mint(wallets[0].publicKey, {'MetadataIdentifier': ['https://example.com/mynft']}, { onAccount: accounts[0] });
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

    const tr = await contract.methods.transfer(wallets[0].publicKey, wallets[2].publicKey, 0, { onAccount: accounts[1] });
    assert.equal(tr.decodedEvents[0].name, 'Transfer');
    assert.equal(tr.decodedEvents[0].args[0], wallets[0].publicKey);
    assert.equal(tr.decodedEvents[0].args[1], wallets[2].publicKey);
    assert.equal(tr.decodedEvents[0].args[2], 0);

    const { decodedResult } = await contract.methods.owner(0);
    assert.equal(decodedResult, wallets[2].publicKey);
  });

  it('NFT: unauthorized transfer', async () => {
    const token = await contract.methods.mint(wallets[1].publicKey, {'MetadataIdentifier': ['https://example.com/mynft']}, { onAccount: accounts[0] });
    assert.equal(token.decodedEvents[0].name, 'Transfer');
    assert.equal(token.decodedEvents[0].args[0].substr(2), contract.deployInfo.address.substr(2));
    assert.equal(token.decodedEvents[0].args[1], wallets[1].publicKey);
    assert.equal(token.decodedEvents[0].args[2], 0);

    await expect(
      contract.methods.transfer(wallets[1].publicKey, wallets[0].publicKey, 0, { onAccount: accounts[0] }))
      .to.be.rejectedWith(`Invocation failed: "ONLY_OWNER_APPROVED_OR_OPERATOR_CALL_ALLOWED"`);
  });

  it('NFT: invalid transfer', async () => {
    const token = await contract.methods.mint(wallets[0].publicKey, {'MetadataIdentifier': ['https://example.com/mynft']}, { onAccount: accounts[0] });
    assert.equal(token.decodedEvents[0].name, 'Transfer');
    assert.equal(token.decodedEvents[0].args[0].substr(2), contract.deployInfo.address.substr(2));
    assert.equal(token.decodedEvents[0].args[1], wallets[0].publicKey);
    assert.equal(token.decodedEvents[0].args[2], 0);

    await expect(
      contract.methods.transfer(wallets[2].publicKey, wallets[1].publicKey, 0, { onAccount: accounts[0] }))
      .to.be.rejectedWith(`Invocation failed: "ONLY_OWNER_CALL_ALLOWED"`);
  });

  it('NFT: safe transfer', async () => {
    const token = await contract.methods.mint(wallets[0].publicKey, {'MetadataIdentifier': ['https://example.com/mynft']}, { onAccount: accounts[0] });
    assert.equal(token.decodedEvents[0].name, 'Transfer');
    assert.equal(token.decodedEvents[0].args[0].substr(2), contract.deployInfo.address.substr(2));
    assert.equal(token.decodedEvents[0].args[1], wallets[0].publicKey);
    assert.equal(token.decodedEvents[0].args[2], 0);

    const to = `ak${receiver_contract.deployInfo.address.substr(2)}`;
    const tr = await contract.methods.transfer(wallets[0].publicKey, to , 0, {'None': []}, { onAccount: accounts[0] });
    assert.equal(tr.decodedEvents[0].name, 'Transfer');
    assert.equal(tr.decodedEvents[0].args[0], wallets[0].publicKey);
    assert.equal(tr.decodedEvents[0].args[1], to);
    assert.equal(tr.decodedEvents[0].args[2], 0);
  });

  it('NFT: failed safe transfer', async () => {
    const token = await contract.methods.mint(wallets[0].publicKey, {'MetadataIdentifier': ['https://example.com/mynft']}, { onAccount: accounts[0] });
    assert.equal(token.decodedEvents[0].name, 'Transfer');
    assert.equal(token.decodedEvents[0].args[0].substr(2), contract.deployInfo.address.substr(2));
    assert.equal(token.decodedEvents[0].args[1], wallets[0].publicKey);
    assert.equal(token.decodedEvents[0].args[2], 0);

    const to = `ak${receiver_contract.deployInfo.address.substr(2)}`;

    await expect(
      contract.methods.transfer(wallets[0].publicKey, to, 0, 'FAILS', { onAccount: accounts[0] }))
      .to.be.rejectedWith(`Invocation failed: "SAFE_TRANSFER_FAILED"`);
  });
});
