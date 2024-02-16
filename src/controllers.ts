import fs, { promises } from 'fs';
import { ApiPromise, WsProvider } from '@polkadot/api';

/* LAST RUN:
polkadot stats:
Total records:  67173
Unique pairs:  5890
Percentage still unique:  8.77 %
Unique pairs that are active:  5037
Percentage of unique pairs that are active:  85.52 %

kusama stats:
Total records:  22092
Unique pairs:  5596
Percentage still unique:  25.33 %
Unique pairs that are active:  5187
Percentage of unique pairs that are active:  92.69 %

westend stats:
Total records:  72425
Unique pairs:  751
Percentage still unique:  1.04 %
Unique pairs that are active:  671
Percentage of unique pairs that are active:  89.35 %
*/

export async function run() {
  try {

    const networks = ['polkadot', 'kusama', 'westend'];
    const endpoints = {
      polkadot: 'wss://apps-rpc.polkadot.io',
      kusama: 'wss://kusama-rpc.polkadot.io',
      westend: 'wss://westend-rpc.polkadot.io',
    }

    for (let network of networks ) {
      console.log('connecting to', network);
      const wsProvider = new WsProvider(endpoints[network]);
      const api = await ApiPromise.create({ provider: wsProvider });

      const filePath = `bonded-${network}.json`;
      let bonded: any = [];

      try {
        await promises.access(filePath, fs.constants.F_OK);
        const data = await promises.readFile(filePath,  'utf8');
        bonded =  JSON.parse(data);

      } catch (err) {
        console.error(`File '${filePath}' does not exist. Re-fetching bonded records.`);
          
        const result = await api.query.staking.bonded.entries();
        const jsonData = result.map(([keys, val]: any) => {
          const stash =  keys.toHuman()[0];
          const controller = val.toHuman();
          return [stash, controller];
        });

        await promises.writeFile(filePath, JSON.stringify(jsonData, null, 2));
        bonded = jsonData;
      }

      const uniquePairs = bonded.filter((pair: any) => pair[0] !== pair[1]);
      const countUniquePairs = uniquePairs?.length || 0;
      const percentageUnique = (countUniquePairs / bonded.length) * 100;

      // TODO: write uniquePairs to new file.
      await promises.writeFile(`unique-${network}.json`, JSON.stringify(uniquePairs.map((pair) => pair[1]), null, 2));


      let totalUniqueActive = 0;
     const res = await api.query.staking.ledger.multi(uniquePairs.map((pair: any) => pair[1]));
      for (let raw of res) {
        const json: any = raw.toHuman();
        const active: string = String(json?.active || 0);
        if (active !== '0') 
          totalUniqueActive++;
      }

      const precentUniqueActive = (totalUniqueActive / countUniquePairs) * 100;

      console.log(`---------\n${network} stats:`);
      console.log('Total records: ', bonded.length);
      console.log('Unique pairs: ', countUniquePairs);
      console.log('Percentage still unique: ', percentageUnique.toFixed(2), '%');
      console.log('Unique pairs that are active: ', totalUniqueActive);
      console.log('Percentage of unique pairs that are active: ', precentUniqueActive.toFixed(2), '%');
      console.log('---------');

      await api.disconnect(); 
    }
  
  console.log('Done');

} catch (err) {
    console.log(err)
    throw err
  }
}

run()