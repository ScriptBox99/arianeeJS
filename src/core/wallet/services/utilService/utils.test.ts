import { NETWORK } from '../../../..';
import { ConfigurationService } from '../configurationService/configurationService';
import { UtilsService } from './utilsService';

describe('UTILS', () => {
  describe('readLink', () => {
    test('it should return passphrase and certificateId from link', () => {
      const configurationServiceStub: ConfigurationService = <ConfigurationService>{
        arianeeConfiguration: {
          deepLink: 'test.arian.ee',
          networkName: 'arianeetestnet'
        },
        supportedConfigurations: {
          arianeetestnet: {
            deepLink: 'test.arian.ee'
          }
        }
      };

      const utils = new UtilsService(undefined, configurationServiceStub, undefined);

      const certificateId = 1314;
      const passphrase = 'mypassaezfkzn';
      const linkObject = utils.readLink(
        `https://test.arian.ee/${certificateId},${passphrase}`
      );
      expect(linkObject).toEqual({
        certificateId: certificateId,
        passphrase,
        method: 'requestOwnership'
      });
    });

    test('it should return passphrase and certificateId from link and proof method', () => {
      const configurationServiceStub: ConfigurationService = <ConfigurationService>{
        arianeeConfiguration: {
          deepLink: 'test.arian.ee',
          networkName: 'arianeetestnet'
        },
        supportedConfigurations: {
          arianeetestnet: {
            deepLink: 'test.arian.ee'
          }
        }
      };
      const utils = new UtilsService(undefined, configurationServiceStub, undefined);

      const certificateId = 1314;
      const passphrase = 'mypassaezfkzn';
      const linkObject = utils.readLink(
        `https://test.arian.ee/proof/${certificateId},${passphrase}`
      );
      expect(linkObject).toEqual({
        certificateId: certificateId,
        passphrase,
        method: 'proof'
      });
    });

    test('readlink should be linked with createLink', () => {
      const configurationServiceStub: ConfigurationService = <ConfigurationService>{
        arianeeConfiguration: {
          deepLink: 'test.arian.ee',
          networkName: 'arianeetestnet'
        },
        supportedConfigurations: {
          arianeetestnet: {
            deepLink: 'test.arian.ee'
          }
        }
      };
      const utils = new UtilsService(undefined, configurationServiceStub, undefined);

      const certificateId = 1314;
      const passphrase = 'mypassaezfkzn';
      const linkObject = utils.createLink(certificateId, passphrase);

      expect(linkObject.certificateId).toBe(certificateId);
      expect(linkObject.passphrase).toBe(passphrase);

      const transform2 = utils.readLink(linkObject.link);

      expect(transform2.certificateId).toBe(certificateId);
      expect(transform2.passphrase).toBe(passphrase);
    });
  });

  describe('isRightEnvironement', () => {
    test('it should return true if same chain as current wallet', () => {
      const configurationService = new ConfigurationService();

      configurationService.arianeeConfiguration =
          configurationService.supportedConfigurations[NETWORK.arianeeTestnet] as any;

      const supportedDeepLink = configurationService.supportedConfigurations[NETWORK.arianeeTestnet].deepLink;

      const utils = new UtilsService(undefined, configurationService, undefined);

      expect(utils.isRightChain(supportedDeepLink)).toBe(true);
    });

    describe('it should throw an error if wrong chain as current wallet', () => {
      test('>with a supported chain', () => {
        const configurationService = new ConfigurationService();

        configurationService.arianeeConfiguration =
            configurationService.supportedConfigurations[NETWORK.arianeeTestnet] as any;

        const supportedDeepLink = configurationService.supportedConfigurations[NETWORK.mainnet].deepLink;

        const utils = new UtilsService(undefined, configurationService, undefined);

        try {
          utils.isRightChain(supportedDeepLink);
          expect(true).toBe(false);
        } catch (err) {
          expect(err.chain).toBe(NETWORK.mainnet);
          expect(err.message).toBeDefined();
          expect(true).toBe(true);
        }
      });

      test('>with a NOT supported chain', () => {
        const configurationService = new ConfigurationService();

        configurationService.arianeeConfiguration =
            configurationService.supportedConfigurations[NETWORK.arianeeTestnet] as any;

        const supportedDeepLink = configurationService.supportedConfigurations[NETWORK.mainnet].deepLink;

        const utils = new UtilsService(undefined, configurationService, undefined);

        try {
          utils.isRightChain('unsupportedHost');
          expect(true).toBe(false);
        } catch (err) {
          expect(err.chain).toBeUndefined();
          expect(err.message).toBeDefined();
          expect(true).toBe(true);
        }
      });
    });
  });

  describe('urlParse', () => {
    const utils = new UtilsService(undefined, undefined, undefined);

    test('it should parse complicated url', () => {
      const myURL =
        'http://username:password@localhost:257/deploy/?asd=asd#asd';

      const url = new URL(myURL);
      const parsedURL = utils.simplifiedParsedURL(myURL);

      expect(parsedURL.hostname).toBe(url.hostname);
      expect(parsedURL.hash).toBe(url.hash);
      expect(parsedURL.pathname).toBe(url.pathname);
      expect(parsedURL.port).toBe(url.port);
      expect(parsedURL.protocol).toBe(url.protocol);
      expect(parsedURL.search).toBe(url.search);
    });

    test('it should parse classic arianee url', () => {
      const myURL = 'https://test.arian.ee/722377,ivrsesj4c4nd';

      const parsedURL = utils.simplifiedParsedURL(myURL);
      const url = new URL(myURL);

      expect(parsedURL.hostname).toBe(url.hostname);
      expect(parsedURL.pathname).toBe(url.pathname);
      expect(parsedURL.protocol).toBe(url.protocol);
    });
  });

  describe('find chain from hostname', () => {
    const configurationService = new ConfigurationService();
    const utils = new UtilsService(undefined, configurationService, undefined);

    test('it find for existing main network', () => {
      Object.keys(configurationService.supportedConfigurations)
        .forEach(network => {
          const deepLinkValue = configurationService.supportedConfigurations[network].deepLink;
          const chain = utils.findChainFromHostname(deepLinkValue);
          expect(chain).toBe(network);
        });
    });

    test('it find for existing alternative network', () => {
      const configurationService = new ConfigurationService();
      const utils = new UtilsService(undefined, configurationService, undefined);
      configurationService.supportedConfigurations = {
        [NETWORK.arianeeTestnet]: {
          faucetUrl: '',
          alternativeDeeplink: ['firstDeeplink'],
          deepLink: 'adeeplink'
        },
        [NETWORK.mainnet]: {
          faucetUrl: '',
          alternativeDeeplink: ['mainnetfirstDeeplink'],
          deepLink: 'mainnetdeeplink'
        }
      } as any;

      const deepLinkValue = configurationService.supportedConfigurations[NETWORK.arianeeTestnet].alternativeDeeplink[0];
      const chain = utils.findChainFromHostname(deepLinkValue);
      expect(chain).toBe(NETWORK.arianeeTestnet);
    });

    test('it should return undefined for non existing network in configuration', () => {
      const chain = utils.findChainFromHostname('noKnowndeepLinkValue');
      expect(chain).toBeUndefined();
    });
  });

  describe('add queryParams', () => {
    test('should be able to add queryParams', () => {
      const expectedValue = 'http://www.myexample.com/?myKey=myvalue';
      const resultURL = UtilsService.addQueryParmas('http://www.myexample.com',
        [{ key: 'myKey', value: 'myvalue' }]);

      expect(resultURL).toBe(expectedValue);
    });

    test('should be able to add multiple queryParams', () => {
      const expectedValue = 'http://www.myexample.com/?myKey=myvalue&myKey1=myvalue&myKey2=myvalue';
      const resultURL = UtilsService.addQueryParmas('http://www.myexample.com',
        [
          { key: 'myKey', value: 'myvalue' },
          { key: 'myKey1', value: 'myvalue' },
          { key: 'myKey2', value: 'myvalue' }
        ]);

      expect(resultURL).toBe(expectedValue);
    });
    test('should be able to add same queryParams (override it)', () => {
      const expectedValue = 'http://www.myexample.com/?myKey=myvalue&myKey2=myvalue';
      const resultURL = UtilsService.addQueryParmas('http://www.myexample.com?myKey=oldvalue',
        [
          { key: 'myKey', value: 'myvalue' },
          { key: 'myKey2', value: 'myvalue' }
        ]);

      expect(resultURL).toBe(expectedValue);
    });
  });

  describe('timestampIsMoreRecentThan', () => {
    const utils = new UtilsService(undefined, undefined, undefined);
    test('it should return true if timestamp is recent', () => {
      const testTimestamp = Math.round((new Date().valueOf() - 3000) / 1000); // now - 3 secondes (in seconds)
      const isRecent = utils.timestampIsMoreRecentThan(testTimestamp, 300); // test if timestamp is > (now - 3 minutes)

      expect(isRecent).toBe(true);
    });

    test('it should return false if timestamp is old', () => {
      const testTimestamp = Math.round(
        (new Date().valueOf() - 24 * 60 * 60 * 1000) / 1000
      ); // now - 1 day (in seconds)
      const isRecent = utils.timestampIsMoreRecentThan(testTimestamp, 300); // test if timestamp is > (now - 3 minutes)

      expect(isRecent).toBe(false);
    });
  });
});
