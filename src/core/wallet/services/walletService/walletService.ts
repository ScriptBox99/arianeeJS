import Common from '@ethereumjs/common';
import { Transaction as Tx } from '@ethereumjs/tx';
import { injectable } from 'tsyringe';
import { Transaction } from 'web3-core';
import { ConfigurationService } from '../configurationService/configurationService';
import { Web3Service } from '../web3Service/web3Service';

@injectable()
export class WalletService {
  public userCustomSign: (data: string) => Promise<{ message: string, messageHash: string, signature: string }>;

  public account;
  public userCustomSendTransaction: (transaction:Transaction) => Promise<any>;

  constructor (private web3Service: Web3Service, private configurationService:ConfigurationService) {
  }

  public get customSendTransaction () {
    return async (transaction) => {
      const result = await this.userCustomSendTransaction(transaction);
      return {
        message: 'message sent through custom send transaction method',
        ...result,
        ...transaction
      };
    };
  }

  public get privateKeyBuffer (): Buffer {
    return Buffer.from(
      this.privateKey.substring(2),
      'hex'
    );
  }

  public isRemoteAccount () {
    return this.privateKey === undefined && this.address && this.userCustomSign === undefined;
  }

  private customCommon= Common.forCustomChain(
    'mainnet',
    {
      name: this.configurationService.arianeeConfiguration.networkName,
      chainId: this.configurationService.arianeeConfiguration.chainId
    },
    'istanbul'
  );

  public signTransaction = async (transaction: Transaction): Promise<{ rawTransaction:string, transactionHash:string }> => {
    const tx = Tx.fromTxData(transaction, { common: this.customCommon }).serialize().toString('hex');
    const { signature, messageHash } = await this.sign(tx);
    return { rawTransaction: signature, transactionHash: messageHash };
  };

  public async signProof (data: string, privateKey = this.privateKey): Promise<{ message: string, messageHash: string, signature: string }> {
    return this.sign(data, privateKey);
  }

  public async sign (data: string, privateKey = this.privateKey): Promise<{ message: string, messageHash: string, signature: string }> {
    let signature;
    let messageHash;
    let message = data;

    if (privateKey) {
      let decodedTx;
      try {
        decodedTx = Tx.fromSerializedTx(Buffer.from(data, 'hex'), { common: this.customCommon });
      } catch (e) {
      }
      let signObject;
      if (decodedTx) {
        message = JSON.stringify(decodedTx.toJSON());
        signature = '0x' + decodedTx.sign(Buffer.from(privateKey.substring(2), 'hex')).serialize().toString('hex');
        messageHash = data;
      } else {
        signObject = this.web3Service.web3.eth.accounts.sign(<string>data, privateKey);
        signature = signObject.signature;
        messageHash = signObject.messageHash;
      }
    } else if (this.isRemoteAccount()) {
      signature = await this.web3Service.web3.eth.personal.sign(<string>data, this.address);
      messageHash = this.web3Service.web3.eth.accounts.hashMessage(data);
    } else if (this.userCustomSign) {
      return this.userCustomSign(data);
    } else {
      throw new Error('There is no signing account');
    }

    return { message, signature, messageHash };
  }

  public get address (): string {
    return this.account.address;
  }

  public get privateKey (): string {
    return this.account.privateKey;
  }

  public isCustomSendTransaction ():boolean {
    return this.userCustomSendTransaction !== undefined;
  }
}
