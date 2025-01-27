import { NETWORK } from '../../../..';
import { ConfigurationService } from '../configurationService/configurationService';
import { UtilsService } from './utilsService';

describe('UtilsService', () => {
  describe('readLink', () => {
    test('it should return passphrase and certificateId from link', () => {
      const configurationServiceStub: ConfigurationService = <ConfigurationService>{
        arianeeConfiguration: {
          deepLink: 'test.arian.ee',
          networkName: 'arianeetestnet',
          alternativeDeeplink: []
        },
        supportedConfigurations: {
          arianeetestnet: {
            deepLink: 'test.arian.ee',
            alternativeDeeplink: []
          }
        }
      };

      const utils = new UtilsService(undefined, configurationServiceStub, undefined, undefined, undefined);

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
          networkName: 'arianeetestnet',
          alternativeDeeplink: []
        },
        supportedConfigurations: {
          arianeetestnet: {
            deepLink: 'test.arian.ee',
            alternativeDeeplink: []
          }
        }
      };
      const utils = new UtilsService(undefined, configurationServiceStub, undefined, undefined, undefined);

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
          alternativeDeeplink: [],
          networkName: 'arianeetestnet'
        },
        supportedConfigurations: {
          arianeetestnet: {
            deepLink: 'test.arian.ee'
          }
        }
      };
      const utils = new UtilsService(undefined, configurationServiceStub, undefined, undefined, undefined);

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

  describe('isRightChain', () => {
    test('it should return true if same chain as current wallet', () => {
      const configurationService = new ConfigurationService();

      configurationService.arianeeConfiguration =
          configurationService.supportedConfigurations[NETWORK.arianeeTestnet] as any;

      const supportedDeepLink = configurationService.supportedConfigurations[NETWORK.arianeeTestnet].deepLink;

      const utils = new UtilsService(undefined, configurationService, undefined, undefined, undefined);

      expect(utils.isRightChain(supportedDeepLink)).toBe(true);
    });

    describe('it should throw an error if wrong chain as current wallet', () => {
      test('>with a supported chain', () => {
        const configurationService = new ConfigurationService();

        configurationService.arianeeConfiguration =
            configurationService.supportedConfigurations[NETWORK.arianeeTestnet] as any;

        const supportedDeepLink = configurationService.supportedConfigurations[NETWORK.mainnet].deepLink;

        const utils = new UtilsService(undefined, configurationService, undefined, undefined, undefined);

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

        const utils = new UtilsService(undefined, configurationService, undefined, undefined, undefined);

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
    const utils = new UtilsService(undefined, undefined, undefined, undefined, undefined);

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
    test('it find for supported main network', () => {
      const configurationService = new ConfigurationService();
      const utils = new UtilsService(undefined, configurationService, undefined, undefined, undefined);

      configurationService.arianeeConfiguration = {
        deepLink: 'myCustomDeepLink',
        alternativeDeeplink: [],
        networkName: NETWORK.mainnet
      } as any;

      Object.keys(configurationService.supportedConfigurations)
        .forEach(network => {
          const deepLinkValue = configurationService.supportedConfigurations[network].deepLink;
          const chain = utils.findChainFromHostname(deepLinkValue);
          expect(chain).toBe(network);
        });
    });

    test('it find for supported alternative network', () => {
      const configurationService = new ConfigurationService();
      const utils = new UtilsService(undefined, configurationService, undefined, undefined, undefined);
      configurationService.supportedConfigurations = {
        [NETWORK.arianeeTestnet]: {
          faucetUrl: '',
          networkName: 'arianeeTestnet',
          alternativeDeeplink: ['firstDeeplink'],
          deepLink: 'adeeplink'
        },
        [NETWORK.mainnet]: {
          faucetUrl: '',
          networkName: 'mainnet',
          alternativeDeeplink: ['mainnetfirstDeeplink'],
          deepLink: 'mainnetdeeplink'
        }
      } as any;

      configurationService.arianeeConfiguration = {
        deepLink: 'myCustomDeepLink',
        alternativeDeeplink: [],
        networkName: NETWORK.mainnet
      } as any;

      const deepLinkValue = configurationService.supportedConfigurations[NETWORK.arianeeTestnet].alternativeDeeplink[0];
      const chain = utils.findChainFromHostname(deepLinkValue);
      expect(chain).toBe(NETWORK.arianeeTestnet);
    });

    test('it should return undefined for non existing network in configuration', () => {
      const configurationService = new ConfigurationService();
      const utils = new UtilsService(undefined, configurationService, undefined, undefined, undefined);

      configurationService.arianeeConfiguration = {
        deepLink: 'myCustomDeepLink',
        alternativeDeeplink: [],
        networkName: NETWORK.mainnet
      } as any;

      const chain = utils.findChainFromHostname('noKnowndeepLinkValue');
      expect(chain).toBeUndefined();
    });

    test('it should find network of current config if deeplink has been modified', () => {
      const configurationService = new ConfigurationService();
      const utils = new UtilsService(undefined, configurationService, undefined, undefined, undefined);
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

      configurationService.arianeeConfiguration = {
        deepLink: 'myCustomDeepLink',
        alternativeDeeplink: [],
        networkName: NETWORK.mainnet
      } as any;

      const deepLinkValue = configurationService.arianeeConfiguration.deepLink;
      const chain = utils.findChainFromHostname(deepLinkValue);
      expect(chain).toBe(NETWORK.mainnet);
    });
  });

  describe('timestampIsMoreRecentThan', () => {
    const utils = new UtilsService(undefined, undefined, undefined, undefined, undefined);
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

  describe('calculateImprint', () => {
    test('it should return string', async (done) => {
      const schema = {
        $id: 'https://cert.arianee.org/version1/ArianeeProductCertificate-i18n.json',
        $schema: 'https://cert.arianee.org/version1/ArianeeProductCertificate-i18n.json',
        title: 'Arianee Certificate',
        type: 'object',
        properties: {
          $schema: {
            title: '$schema',
            type: 'string'
          },
          title: {
            type: 'string'
          }
        }
      };

      const utils = new UtilsService(undefined, undefined, undefined, {
        fetch: () => Promise.resolve(schema)
      } as any, undefined);

      const imprint = await utils.calculateImprint({
        $schema: 'http://monurl.com',
        title: 'mon titre'
      });

      expect(imprint).toBe('0x0147503548d3f6656c9380fc1634aa6a07fdb9543104ad9a5fe740fcb6d05468');
      done();
    });
  });
});
