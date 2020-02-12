import { expect } from 'chai';
import axios from 'axios';
import { Given, Then, When } from 'cucumber';
import {
  CertificateSummary,
  ConsolidatedCertificateRequest,
  ConsolidatedIssuerRequest
} from '../../src/core/wallet/certificateSummary/certificateSummary';
import { waitFor } from './helpers/waitFor';

Given('user{int} has positive credit certificate balance', async function (
  userIndex
) {
  const wallet = this.store.getUserWallet(userIndex);
  const address = wallet.account.address;
  const balance = await wallet.contracts.creditHistoryContract.methods
    .balanceOf(wallet.publicKey, 0)
    .send();

  expect(balance.toNumber() > 0).equals(true);
});

When('user{int} can make different request on certificate{int}', async function (userIndex, tokenIndex) {
  const wallet = this.store.getUserWallet(userIndex);
  const certificateId = this.store.getToken(tokenIndex);

  const verify = async (query:ConsolidatedCertificateRequest) => {
    const cer = await wallet.methods.getCertificate(certificateId, undefined, query);
    const keys = Object.keys(query);
    for (var i = 0; i < keys.length; i++) {
      const value = keys[i];
      expect(cer[value], `${value} does not exist on query ${JSON.stringify(query)}`).to.be.not.undefined;
    }
  };

  const queryToTest:Array<ConsolidatedCertificateRequest> = [
    { issuer: true },
    { content: true },
    { messageSenders: true },
    { owner: true },
    { isRequestable: true },
    // { arianeeEvents: true }
    // { events: true }
    {
      content: true,
      issuer: {
        waitingIdentity: true
      }
    },
    { issuer: true, content: true }

  ];

  await Promise.all(queryToTest.map(query => verify(query)));
});

When(
  'user{int} creates a new certificate{int} with uri {string}',
  { timeout: 45000 },
  async function (userIndex, tokenIndex, uri) {
    const wallet = this.store.getUserWallet(userIndex);
    const hash = wallet.web3.utils.keccak256('ezofnzefon');

    try {
      const { certificateId } = await wallet.methods.createCertificate({
        uri: uri,
        hash
      });

      await waitFor();

      this.store.storeToken(tokenIndex, certificateId);

      expect(true).equals(true);
    } catch (err) {
      console.error('ERROR');
      expect(true).equals(false);
    }
  }
);

When(
  'user{int} creates a new certificate{int} with uri {string} and passphrase {word}',
  { timeout: 45000 },

  async function (userIndex, tokenIndex, uri, password) {
    const wallet = this.store.getUserWallet(userIndex);

    const hash = wallet.web3.utils.keccak256('ezofnzefon');
    try {
      const { certificateId } = await wallet.methods.createCertificate({
        uri: uri,
        hash,
        passphrase: password
      });

      await waitFor();

      this.store.storeToken(tokenIndex, certificateId);

      expect(true).equals(true);
    } catch (err) {
      console.error('ERROR');
      expect(true).equals(false);
    }
  }
);

When(
  'user{int} create a proof in certificate{int} with passphrase {word}',
  async function (userIndex, tokenIndex, password) {
    const certificateId = this.store.getToken(tokenIndex);
    const wallet = this.store.getUserWallet(userIndex);

    const linkObject = await wallet.methods.createCertificateProofLink(certificateId, password);

    expect(linkObject.passphrase).equals(password);
    expect(linkObject.certificateId).equals(certificateId);
    expect(linkObject.link).contain(certificateId);
    expect(linkObject.link).contain(password);
  }
);

Then(
  'user{int} can check the proof in certificate{int} with passphrase {word}',
  async function (userIndex, certificateIndex, password) {
    const wallet = this.store.getUserWallet(userIndex);
    const certificateId = this.store.getToken(certificateIndex);

    const proofIsValid = await wallet.methods.isCertificateProofValid(certificateId, password);

    expect(proofIsValid.isTrue).equal(true);
  }
);

Then(
  'user{int} cannot check the proof in certificate{int} with passphrase {word}',
  async function (userIndex, certificateIndex, password) {
    const wallet = this.store.getUserWallet(userIndex);
    const certificateId = this.store.getToken(certificateIndex);

    const proofIsValid = await wallet.methods.isCertificateProofValid(certificateId, password);
    expect(proofIsValid.isTrue).equal(false);
  }
);

Then('user{int} is the owner of the certificate{int}', async function (
  userIndex,
  certificateIndex
) {
  const token = this.store.getToken(certificateIndex);
  const wallet = this.store.getUserWallet(userIndex);

  const owner = await wallet.contracts.smartAssetContract.methods.ownerOf(token).call();
  expect(wallet.publicKey).equals(owner);
});

Then('user{int} destroys certificate{int}', async function (
  userIndex,
  certificateIndex
) {
  const token = this.store.getToken(certificateIndex);
  const wallet = this.store.getUserWallet(userIndex);

  await wallet.methods.destroyCertificate(token);
});

Then('user{int} recovers certificate{int}', async function (
  userIndex,
  certificateIndex
) {
  const token = this.store.getToken(certificateIndex);
  const wallet = this.store.getUserWallet(userIndex);

  await wallet.methods.recoverCertificate(token);
});

Then('user{int} is not the owner of the certificate{int}', async function (
  userIndex,
  certificateIndex
) {
  const token = this.store.getToken(certificateIndex);
  const wallet = this.store.getUserWallet(userIndex);

  const owner = await wallet.contracts.smartAssetContract.methods.ownerOf(token).call();
  expect(wallet.publicKey !== owner).to.be.true;
});

Then(
  'user{int} is the owner of the certificate{int} with uri {string}',
  async function (userIndex, tokenIndex, expectedUri) {
    const token = this.store.getToken(tokenIndex);
    const wallet = this.store.getUserWallet(userIndex);

    const owner = await wallet.contracts.smartAssetContract.methods.ownerOf(token).call();

    expect(wallet.publicKey).equals(owner);

    const uriKey = await wallet.contracts.smartAssetContract.methods
      .tokenURI(token)
      .call();

    expect(expectedUri).equals(uriKey);
  }
);

Given('user{int} requests certificate{int} with passprase {word}',
  async function (userIndex, tokenIndex, passphrase) {
    const wallet = this.store.getUserWallet(userIndex);
    const certificateId = this.store.getToken(tokenIndex);
    await wallet.methods.requestCertificateOwnership(certificateId, passphrase);
    await waitFor();
  }
);

Given('user{int} makes certificate{int} {word} without passphrase',
  async function (userIndex, tokenIndex, actionType) {
    const wallet = this.store.getUserWallet(userIndex);
    const certificateId = this.store.getToken(tokenIndex);

    const linkObject = await wallet.methods.createCertificateRequestOwnershipLink(certificateId);
    this.store.storeCustom('linkObject', linkObject);
  });

Given('user{int} requests certificate{int} with the link',
  async function (userIndex, tokenIndex) {
    const wallet = this.store.getUserWallet(userIndex);
    const certificateId = this.store.getToken(tokenIndex);

    const linkObject = this.store.getCustom('linkObject');

    await wallet.methods.requestCertificateOwnership(linkObject.certificateId, linkObject.passphrase);
  });

Given('user{int} checks if certificate{int} can be requested with passphrase {word}',
  async function (userIndex, tokenIndex, passphrase) {
    const wallet = this.store.getUserWallet(userIndex);
    const certificateId = this.store.getToken(tokenIndex);

    const isRequestable = await wallet.methods.isCertificateOwnershipRequestable(certificateId, passphrase);
    expect(isRequestable.isTrue).equal(true);
  });

Given('user{int} checks if certificate{int} can not be requested with passphrase {word}',
  async function (userIndex, tokenIndex, passphrase) {
    const wallet = this.store.getUserWallet(userIndex);
    const certificateId = this.store.getToken(tokenIndex);

    const isRequestable = await wallet.methods.isCertificateOwnershipRequestable(certificateId, passphrase);
    expect(isRequestable.isTrue).equal(false);
  });

Given('user{int} want to see certificate{int} details with passphrase {word}',
  async function (userIndex, tokenIndex, passphrase) {
    const wallet = this.store.getUserWallet(userIndex);
    const certificateId = this.store.getToken(tokenIndex);

    const certficiateDetails = await wallet.methods.getCertificate(certificateId, passphrase, { owner: true });
    expect(certficiateDetails).to.be.not.undefined;

    expect(certficiateDetails.owner).to.be.not.undefined;
  });

Given('user{int} can see its {int} certificates from getMyCertificates',
  async function (userIndex, numberOfCertificates) {
    const wallet = this.store.getUserWallet(userIndex);

    const certificates = await wallet.methods.getMyCertificates(
      { owner: true }
    );

    expect(certificates.length === numberOfCertificates).to.be.true;
    certificates.forEach(certficiateDetails => {
      expect(certficiateDetails.owner).to.be.not.undefined;
    });
  });

Given('user{int} makes certificate{int} {word} with passphrase {word}',
  async function (userIndex, tokenIndex, actionType, passphrase) {
    const wallet = this.store.getUserWallet(userIndex);
    const certificateId = this.store.getToken(tokenIndex);

    return wallet.methods.createCertificateRequestOwnershipLink(certificateId, passphrase);
  });

Given('user{int} can see its {int} certificates and {int} issuers from groupByIssuerCertificates',
  async function (userIndex, numberOfCertificates, numberOfBrands) {
    const wallet = this.store.getUserWallet(userIndex);

    const certificatesGroupBy = await wallet.methods.getMyCertificatesGroupByIssuer(
      { owner: true }
    );

    expect(Object.keys(certificatesGroupBy).length === numberOfBrands).to.be.true;
    const numberOfCertificatesFetched = Object.keys(certificatesGroupBy).reduce((acc, currKey) => {
      acc += certificatesGroupBy[currKey].length;

      return acc;
    }, 0);

    expect(numberOfCertificatesFetched === numberOfCertificates).to.be.true;
  });

Given('user{int} switch certificate{int} issuer message authorization to {string}',
  async function (userIndex, tokenIndex, value) {
    const wallet = this.store.getUserWallet(userIndex);
    const certificateId = this.store.getToken(tokenIndex);

    const { issuer } = await wallet.methods.getCertificate(certificateId, undefined, { issuer: true });
    const { address } = issuer.identity;

    await wallet.methods.setMessageAuthorizationFor(certificateId, address, JSON.parse(value));
  });

Given('user{int} certificate{int} issuer message authorization should be {string}',
  async function (userIndex, tokenIndex, value) {
    const wallet = this.store.getUserWallet(userIndex);
    const certificateId = this.store.getToken(tokenIndex);

    const { issuer, messageSenders } = await wallet.methods
      .getCertificate(certificateId, undefined, { issuer: true, messageSenders: true });

    const { address } = issuer.identity;

    expect(messageSenders[address] === JSON.parse(value)).to.be.true;
  });

Given('user{int} want to see certificateId {string} with passphrase {string}',
  async function (userIndex, certificateId, passphrase, table) {
    const wallet = this.store.getUserWallet(userIndex);

    const tableToQuery = (queryTable) => {
      return queryTable.reduce((acc, curr) => {
        const propName = curr[0];
        const value = curr[1];

        acc[propName] = JSON.parse(value);

        return acc;
      }, {});
    };

    const query = tableToQuery(table.rawTable);
    const verify = async (certificate:CertificateSummary, query) => {
      const keys = Object.keys(query);
      for (var i = 0; i < keys.length; i++) {
        const value = keys[i];
        expect(certificate[value], `${value} does not exist on query ${JSON.stringify(query)}`).to.be.not.undefined;
      }
    };

    const certificate = await wallet.methods.getCertificate(certificateId, undefined, query);

    verify(certificate, query);

    this.store.storeCertificateSummary(certificateId, certificate);
  });

Then('certificateId {string} {string} imprint should be {string}',
  async function (certificateId, contentType, expectedImprint) {
    const summary = this.store.getCertificateSummary(certificateId);
    let contentToBeVerified;

    if (contentType === 'content') {
      contentToBeVerified = summary.content.imprint;
    } else if (contentType === 'identity') {
      contentToBeVerified = summary.issuer.identity.imprint;
    } else {
      throw new Error('this type of content is not defined');
    }

    expect(contentToBeVerified === expectedImprint).to.be.true;
  });
