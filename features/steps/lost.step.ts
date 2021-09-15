import { Given } from '@cucumber/cucumber';
import { expect } from 'chai';

Given('user{int} looses certificate{int}', async function (
  userIndex, certificateIndex
) {
  const wallet = this.store.getUserWallet(userIndex);
  const certificateId = this.store.getToken(certificateIndex);

  await wallet.methods.setMissingStatus();
});

Given('user{int} retrieves certificate{int}', async function (
  userIndex, certificateIndex
) {
  const wallet = this.store.getUserWallet(userIndex);
  const certificateId = this.store.getToken(certificateIndex);

  await wallet.methods.unsetMissingStatus();
});

Given('user{int} can see certificate{int} lost status is {word}', async function (
  userIndex, certificateIndex, expectedValue
) {
  const wallet = this.store.getUserWallet(userIndex);
  const certificateId = this.store.getToken(certificateIndex);

  const value = await wallet.methods.isMissing();

  expect(value.toString() === expectedValue.toString()).to.be.true;
});
