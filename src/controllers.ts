import fs, { promises } from 'fs';
import { DedotClient, WsProvider } from 'dedot';
import type { KusamaApi, PolkadotApi } from '@dedot/chaintypes'

export async function run() {
  try {
    const ss58Prefixes = [
      0, 2
    ];
    const networks = ['polkadot', 'kusama'];
    const endpoints = {
      polkadot: 'wss://apps-rpc.polkadot.io',
      kusama: 'wss://rpc.ibp.network/kusama',
    }
    
    console.log('connecting to networks');

    const apis = [
       await  DedotClient.new<PolkadotApi>(new WsProvider(endpoints.polkadot)),
       await  DedotClient.new<KusamaApi>(new WsProvider(endpoints.kusama)),
    ]

    let i = 0
    for (let api of apis) {
      const ss58 = ss58Prefixes[i]

      const filePath = `bonded-${networks[i]}.json`;
      let bonded: [string, string][] = [];

      try {
        await promises.access(filePath, fs.constants.F_OK);
        const data = await promises.readFile(filePath,  'utf8');
        bonded =  JSON.parse(data);

      } catch (err) {
        console.error(`File '${filePath}' does not exist. Re-fetching bonded records.`);
          
        const result = await api.query.staking.bonded.entries();
        let jsonData: [string, string][] = [];

       result.map(([key, val]) => {
          try {
            const stash = key.address(ss58);
            const controller = val.address(ss58);
            jsonData.push([stash, controller]);
          } catch (err) {
            console.log('Error parsing key:', key, val);
          }
        });

        await promises.writeFile(filePath, JSON.stringify(jsonData, null, 2));
        bonded = jsonData;
      }

      const uniquePairs = bonded.filter((pair) => pair[0] !== pair[1]);
      const countUniquePairs = uniquePairs?.length || 0;
      const percentageUnique = (countUniquePairs / bonded.length) * 100;

      // TODO: write uniquePairs to new file.
      await promises.writeFile(`unique-${networks[i]}.json`, JSON.stringify(uniquePairs.map((pair) => pair[1]), null, 2));


    let totalUniqueActive = 0;
     const res = await api.query.staking.ledger.multi(uniquePairs.map((pair) => pair[1]));
      for (let json of res) {
        const active = json?.active || 0n;
        if (active !== 0n) 
          totalUniqueActive++;
      }

      const precentUniqueActive = (totalUniqueActive / countUniquePairs) * 100;

      console.log(`---------\n${networks[i]} stats:`);
      console.log('Total records: ', bonded.length);
      console.log('Unique pairs: ', countUniquePairs);
      console.log('Percentage still unique: ', percentageUnique.toFixed(2), '%');
      console.log('Unique pairs that are active: ', totalUniqueActive);
      console.log('Percentage of unique pairs that are active: ', precentUniqueActive.toFixed(2), '%');
      console.log('---------');
      await api.disconnect(); 
      i++
    }
  
  console.log('Done');

} catch (err) {
    console.log(err)
    throw err
  }
}

run()