import { container } from 'tsyringe';
import * as conf from '../../configurations'; // eslint-disable-line import/no-duplicates
import { appConfig } from '../../configurations'; // eslint-disable-line import/no-duplicates
import { NETWORK, networkURL } from '../../models/networkConfiguration';
import { ArianeeHttpClient } from '../libs/arianeeHttpClient/arianeeHttpClient';
import { Store } from '../libs/simpleStore/store';
import { ArianeeWalletBuilder } from '../wallet/walletBuilder';
import { ProtocolConfigurationBuilder } from './protocolConfigurationBuilder/protocolConfigurationBuilder';
import { GlobalConfigurationService } from '../wallet/services/globalConfigurationService/globalConfigurationService';
import { ConsolidatedCertificateRequest } from '../wallet/certificateSummary/certificateSummary';

export class Arianee {
  public globalConfigurationService: GlobalConfigurationService;

  constructor () {
    this.globalConfigurationService = container.resolve(GlobalConfigurationService);
  }

  public async init (
    networkName: NETWORK = NETWORK.testnet
  ): Promise<ArianeeWalletBuilder> {
    const url = networkURL[networkName];

    const addressesResult = await ArianeeHttpClient.fetch(url).catch(err => console.error(`${url} not working`));

    const protocolConfigurationBuilder = new ProtocolConfigurationBuilder();

    Object.keys(addressesResult.contractAdresses).forEach(contractName => {
      const contractAddress = addressesResult.contractAdresses[contractName];
      try {
        protocolConfigurationBuilder.setSmartContractConfiguration(
          contractName,
          conf[contractName],
          contractAddress
        );
      } catch (e) {
        console.error(`this contract is not working ${contractName}`);
      }
    });

    const { deepLink, faucetUrl } = appConfig[networkName];

    protocolConfigurationBuilder.setDeepLink(deepLink);
    protocolConfigurationBuilder.setFaucetUrl(faucetUrl);

    protocolConfigurationBuilder.setWeb3HttpProvider(
      addressesResult.httpProvider,
      addressesResult.chainId
    );

    return protocolConfigurationBuilder.build();
  }

  /**
   * @deprecated this method has been renamed init.
   */
  public setCache (storageObject: any)
    : Arianee {
    console.error('setCache method does not exist anymore. Please use setStore');

    return this;
  }

  public setDefaultQuery (value: ConsolidatedCertificateRequest) {
    this.globalConfigurationService.setDefaultQuery(value);
    return this;
  }

  public setStore (storageObject: { getStoreItem: (storeKey: string) => Promise<any>, hasItem: (storeKey: string) => Promise<boolean>, setStoreItem: (keyl: string, value: any) => Promise<any> }) {
    container.register(Store, { useValue: storageObject });

    return this;
  }

  /**
   * @deprecated this method has been renamed init.
   */
  public connectToProtocol = (args?) => this.init(args);
}
