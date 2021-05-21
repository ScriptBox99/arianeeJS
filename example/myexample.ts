import { makeWalletReady } from '../features/steps/helpers/walletCreator';
import { NETWORK } from '../src';
import { Arianee } from '../src/core/arianee';

(async function () {
  const arianee = await new Arianee().init(NETWORK.testnet);
  console.log('hey');
  const wallet = arianee.fromPrivateKey('0x10e4cd5908f6c0a7b6a34494f1ca46c2c0daf3a96acfa3646dad0302e12f7082');

  console.log(wallet.address);
  /*
    const result = await wallet.methods.createCertificate({
      uri: 'https://transparianee.herokuapp.com/speakez.json',
      content: {
        $schema: 'https://cert.arianee.org/version1/ArianeeAsset.json',
        name: [

        ],
        medias: [

        ],
        strategies: [
          {
            provider: 'https://sokol.arianee.net',
            name: 'erc-20-balance-of',
            address: 'caller',
            params: {
              minBalance: '12',
              address: '0xB81AFe27c103bcd42f4026CF719AF6D802928765'
            }
          }
        ]
      }
    }); */


  const messageContent = () => ({
    $schema: 'https://cert.arianee.org/version1/ArianeeMessage-i18n.json',
    language: 'fr-FR',
    title: `titre 1 ${Date.now().toLocaleString()}`,
    content: 'content'
  });

  await wallet.methods.createAndStoreMessage({
    certificateId: 486984605,
    content: messageContent()
  }, 'http://localhost:3000/rpc');

  const messages = await wallet.methods.getGroupMessage({
    certificateId: 486984605,
    url: 'http://localhost:3000/rpc'
  });

  console.log(messages);

  /*
  const { content } = await wallet.methods.getCertificate(
    486984605,
    undefined,
    { content: true });
*/
})();
