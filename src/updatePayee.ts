import { ApiPromise, WsProvider , Keyring} from '@polkadot/api';

const createAccount = (phrase: string) => {
  const keyring = new Keyring({ type: 'sr25519' });
  keyring.setSS58Format(2);
  return keyring.addFromUri(phrase);
}

export async function run() {
  try {
    
    // Kusama only.
    const wsProvider = new WsProvider('wss://kusama-rpc.polkadot.io');
    const api = await ApiPromise.create({ provider: wsProvider });
    
    const account = createAccount(`${process.env.PHRASE || ''}//kusama`);

    console.log('using account: ', account.address);

    console.log('Getting payee entries...');
    // Get payee entries and filter those with `Controller` variant
    const payees = await api.query.staking.payee.entries();

    // Get only those who currently have `Controller` as payee.
   const stashes = payees
   .map(([key, value]) => {
      const keys = key.toHuman();
      const stash = keys?.[0] || '';
      const payee = value.toHuman();      
      return [stash, payee];
   })
   .filter(([stash, payee]) => {
      return stash !== '' && payee === 'Controller'
    });

    console.log(`${stashes.length} payees to migrate. Accumulating batch tx.`);

    // Seperate batch transactions per `batchSize` stashes.
    const batchSize = 200;
    const batches: any[] = [];
    while (stashes.length > 0) {
      batches.push(stashes.splice(0, batchSize));
    }

    console.log(batches.length, 'batches');

    let nonce = 0;
    try {
      // Get signers start nonce.
      let accountData: any = (await api.query.system.account(account.address)).toHuman();
      nonce = accountData.nonce;
      console.log(nonce);
    } catch(err) {
      console.log('failed getting nonce');
      console.log(err);
    }

    let i = 0;
    for (const batch of batches) {
      console.log('Attempting migrating batch ', ++i);

      try {
        // Get the bonded `controller` accounts of each stash.
        let controllers = (await Promise.all(
          batch.map(([stash,]) => api.query.staking.bonded(stash))
        )).map((bonded) => bonded.toHuman());

        // Accumulate batch transaction.
        let txs: any[] = [];
        for (const controller of controllers) {
          txs.push(api.tx.staking.updatePayee(controller));
        }

        // Send batch transaction.
        const unsub = await api.tx.utility.batch(txs).signAndSend(
          account, { nonce }, ({ events }: any ) => {
            events.forEach(({ event: { method } }) => {
              if (['ExtrinsicSuccess'].includes(method)) {
                console.log(`Migration Successful.`);
              }
              if (['ExtrinsicFailed'].includes(method)) {
                console.log(`Migratiion Failed.`);
              }
              if (['ExtrinsicSuccess', 'ExtrinsicFailed'].includes(method)) {
                unsub();
              }
            });
          }
        );

        nonce++;

      } catch (err) {
        console.log('Tx failed');
        console.log(err);
      }
    }
  
   await api.disconnect();

  } catch (err) {
    console.log(err)
    throw err
  }
}

run()