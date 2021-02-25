import { WalletService } from 'core/wallet/services/walletService/walletService';
import { Arianee, NETWORK } from '../src';

const csv = require('csv-parser');
const fs = require('fs');

let total = 0;

let start = 180000;


(async function () {
  const arianee = await new Arianee().init(NETWORK.mainnet);

  let wallet = arianee.fromRandomMnemonic()

  let cert;

  let csvTest = [];



  fs.createReadStream('dist/example/breitling.csv')
  .pipe(csv())
  .on('data',  (row) => {

    csvTest.push(row);

  })
  .on('end', () => {
    console.log('CSV file successfully processed');

    let csvTest2 = [];
    let i = 0;
    let i2 = 0;
    csvTest2[i2] = []


    for (const csvToTest of csvTest) {
      if (typeof csvTest2[i%40]=== 'undefined') {
        csvTest2[i%40] = [];
      }

      if (i >= start)
        csvTest2[i%40].push(csvToTest);
    
      i++;

    }
    testCsv2(csvTest2);

  });


 

async function testCsv2(csvTest2) {
  for (let a = 0; a < csvTest2.length ; a++) {
     testCsv(csvTest2[a], a)
  }
}

async function testCsv(csvTest,index) {

  let localTotal = 0;

  for (const cvsToTest of csvTest) {
    if (cvsToTest.passphrase ) {
      cert = await wallet.methods.getCertificate(+cvsToTest.arianeeId,cvsToTest.passphrase, { content:true, events: false, isRequestable: false, owner: false, arianeeEvents: false,  messageSenders: false});
      
      if (!cert.content.isAuthentic) {
        console.log(cvsToTest.arianeeId)
      }
    }
    
    total++
    localTotal++;
    if (total%1000==0) {
      console.log(total + ' ' + index + ' ' + localTotal);
    }


  }
}

})();
