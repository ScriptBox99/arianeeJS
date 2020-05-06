import { Cert } from '@0xcert/cert';
import { singleton } from 'tsyringe';
import { Sign, SignedTransaction } from 'web3-core';
import { NETWORK } from '../../../..';
import { ConfigurationService } from '../configurationService/configurationService';
import { Web3Service } from '../web3Service/web3Service';

import { WalletService } from '../walletService/walletService';
import { BDHAPIService } from '../BDHAPIService/BDHAPIService';
@singleton()
export class UtilsService {
  constructor (
    private web3Service: Web3Service,
    private configurationService: ConfigurationService,
    private walletService: WalletService
  ) {
    this.bdhVaultService = new BDHAPIService(walletService, this);
  }

  private bdhVaultService:BDHAPIService;

  private get web3 () {
    return this.web3Service.web3;
  }

  public signProofForRequestToken (
    certificateId: number,
    addressNextOwner: string,
    privateKeyPreviousOwner: string
  ) {
    const data = this.web3.utils.keccak256(
      this.web3.eth.abi.encodeParameters(
        ['uint', 'address'],
        [certificateId, addressNextOwner]
      )
    );

    return this.signProof(data, privateKeyPreviousOwner);
  }

  /**
   * Append query params to a url. it keeps already there queryParams and overide if key already present
   * @param url: url to append
   * @param queryParams: array of key, value object
   */
  public static addQueryParmas = (url, queryParams: { key: string, value: any }[]) => {
    const urlInstance = new URL(url);

    queryParams.forEach(queryParam => {
      const { key, value } = queryParam;
      if (urlInstance.searchParams.has(key)) {
        urlInstance.searchParams.set(key, value);
      } else {
        urlInstance.searchParams.append(key, value);
      }
    });

    return urlInstance.href;
  };

  public signProofForRpc (certificateId: number, privateKey: string) {
    const message = {
      certificateId: certificateId,
      timestamp: new Date()
    };

    return this.signProof(JSON.stringify(message), privateKey);
  }

  public simplifiedParsedURL (url: string) {
    const m = url.match(
      /^(([^:/?#]+:)?(?:\/\/((?:([^/?#:]*):([^/?#:]*)@)?([^/?#:]*)(?::([^/?#:]*))?)))?([^?#]*)(\?[^#]*)?(#.*)?$/
    );
    const r = {
      hash: m[10] || '',
      hostname: m[6] || '',
      pathname: m[8] || (m[1] ? '/' : ''),
      port: m[7] || '',
      protocol: m[2] || '',
      search: m[9] || '',
      username: m[4] || '',
      password: m[5] || ''
    };

    return m && r;
  }

  public createUID ():number {
    return Math.ceil(Math.random() * 10000000);
  }

  public createPassphrase () {
    return (
      Math.random()
        .toString(36)
        .substring(2, 8) +
      Math.random()
        .toString(36)
        .substring(2, 8)
    );
  }

  public signProof (data: string | Array<any>, privateKey: string):Sign {
    return this.web3.eth.accounts.sign(<string>data, privateKey);
  }

  public async cert (schema, data): Promise<string> {
    const cert = new Cert({
      schema: schema
    });

    const cleanData = this.cleanObject(data);

    const certif = await cert.imprint(cleanData);

    return '0x' + certif;
  }

  private cleanObject (obj: any) {
    for (const propName in obj) {
      if (
        obj[propName] &&
        obj[propName].constructor === Array &&
        obj[propName].length === 0
      ) {
        delete obj[propName];
      }
    }

    return obj;
  }

  /**
   * Function. Pass a deeplink hostname, and find the right network according to configuration
   * @param hostname
   * @returns {NETWORK} network name of this deeplink hostname. If no network associated with this hostname, it returns
   * undefined
   */
  public findChainFromHostname (hostname):NETWORK {
    const networkConfigurations = this.configurationService.supportedConfigurations;
    const networks = Object.keys(this.configurationService.supportedConfigurations) as Array<NETWORK>;

    return networks.find(key => {
      if (networkConfigurations[key].deepLink === hostname) {
        return true;
      } else if (networkConfigurations[key].alternativeDeeplink &&
          networkConfigurations[key].alternativeDeeplink.length > 0) {
        return networkConfigurations[key].alternativeDeeplink.includes(hostname);
      } else {
        return false;
      }
    });
  }

  /**
   * Function. Pass a deeplink hostname.
   * @param hostname
   * @returns {true} it return true if arianeejs is initiated on the right network otherwise it thrown an error
   * with the most likely chainName
   */
  public isRightChain (hostname: string):boolean {
    const rightChain = this.findChainFromHostname(hostname);
    if (rightChain) {
      const currentNetworkName = this.configurationService.arianeeConfiguration.networkName;
      if (rightChain === currentNetworkName) {
        return true;
      }
    }

    const error = new Error('You are not in the right chain');
    error.message = 'You are not in the right chain';
    (error as any).chain = rightChain;
    throw error;
  }

  public createLink (
    certificateId: number,
    passphrase: string,
    suffix?: string
  ): { certificateId: number; passphrase: string; link: string } {
    let link = `https://${this.configurationService.arianeeConfiguration.deepLink}`;

    if (suffix) {
      link = link + '/' + suffix;
    }

    link = link + `/${certificateId},${passphrase}`;

    return {
      certificateId: certificateId,
      passphrase: passphrase,
      link
    };
  }

  public readLink (link) {
    const url = this.simplifiedParsedURL(link);

    this.isRightChain(url.hostname);

    const methodUrl = url.pathname.split('/');

    const pathName = methodUrl[methodUrl.length - 1];

    const certificateId = parseInt(pathName.split(',')[0]);
    const passphrase = pathName.split(',')[1];

    let method = 'requestOwnership';

    if (methodUrl.length > 2) method = methodUrl[1];

    return {
      method: method,
      certificateId: certificateId,
      passphrase
    };
  }

  public timestampIsMoreRecentThan= UtilsService.timestampIsMoreRecentThan;

  public static timestampIsMoreRecentThan (timestamp, seconds) {
    const date = new Date().valueOf();
    const minTime = date - seconds * 1000;

    return timestamp > minTime / 1000;
  }

  public async getTimestampFromBlock (blockNumber) {
    const block = await this.web3Service.web3.eth.getBlock(
      blockNumber
    );
    return block.timestamp;
  }

  public async signTransaction (encodeABI, contractAddress, overrideNonce?, transaction?):Promise<SignedTransaction> {
    const nonce = overrideNonce || await this.web3.eth.getTransactionCount(
      this.walletService.address,
      'pending'
    );

    const defaultTransaction = {
      nonce,
      chainId: this.configurationService.arianeeConfiguration.chainId,
      from: this.walletService.address,
      data: encodeABI,
      to: contractAddress,
      gas: this.configurationService.arianeeConfiguration.transactionOptions.gas,
      gasPrice: this.configurationService.arianeeConfiguration.transactionOptions.gasPrice
    };

    const mergedTransaction = { ...defaultTransaction, ...transaction };

    const signTransaction:Promise<any> = this.walletService.isBdhVault()
      ? this.bdhVaultService.signTransaction(mergedTransaction)
      : this.walletService.account.signTransaction(mergedTransaction);

    return signTransaction;
  }
}
