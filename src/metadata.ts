import { ApiPromise, WsProvider } from '@polkadot/api';
import { promises } from 'fs';

export async function run() {

  const networks = ['polkadot', 'kusama', 'westend'];
  const endpoints = {
    polkadot: 'wss://apps-rpc.polkadot.io',
    kusama: 'wss://kusama-rpc.polkadot.io',
    westend: 'wss://westend-rpc.polkadot.io',
  }

  try {

    for (let network of networks ) {

      const filePath = `metadata-${network}.json`;

      const wsProvider = new WsProvider(endpoints[network]);
      const api = await ApiPromise.create({ provider: wsProvider });

      const metadata = api.runtimeMetadata;

      await promises.writeFile(filePath, JSON.stringify(metadata, null, 2));
    }
} catch (err) {
    console.log(err)
    throw err
  }
}

run()