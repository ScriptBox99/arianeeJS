import { TransactionObject } from '@arianee/arianee-abi/types/types';
import { get } from 'lodash';
import { injectable } from 'tsyringe';
import { ArianeeTokenId } from '../../../../models/ArianeeTokenId';
import { BlockchainEvent, EventContent } from '../../../../models/blockchainEvent';
import { blockchainEventsName } from '../../../../models/blockchainEventsName';
import { ExtendedBoolean } from '../../../../models/extendedBoolean';
import { QueryAndSearchParams } from '../../../../models/queryAndSearchParams.enum';
import { StoreNamespace } from '../../../../models/storeNamespace';
import { hydrateTokenParameters } from '../../../../models/transaction-parameters';
import { ArianeeHttpClient } from '../../../libs/arianeeHttpClient/arianeeHttpClient';
import { isSchemai18n } from '../../../libs/certificateVersion';
import { replaceLanguage } from '../../../libs/i18nSchemaLanguageManager/i18nSchemaLanguageManager';
import { isNullOrUndefined } from '../../../libs/isNullOrUndefined';
import { SimpleStore } from '../../../libs/simpleStore/simpleStore';
import { sortEvents } from '../../../libs/sortEvents';
import { CertificateSummaryBuilder } from '../../certificateSummary';
import { CertificateSummary, ConsolidatedCertificateRequest } from '../../certificateSummary/certificateSummary';
import { BatchService } from '../batchService/batchService';
import { CertificateAuthorizationService } from '../certificateAuthorizationService/certificateAuthorizationService';
import { CertificateDetails } from '../certificateDetailsService/certificatesDetailsService';
import { ConfigurationService } from '../configurationService/configurationService';
import { ContractService } from '../contractService/contractsService';
import { DiagnosisService } from '../diagnosisService/diagnosisService';
import { EventService } from '../eventService/eventsService';
import { GlobalConfigurationService } from '../globalConfigurationService/globalConfigurationService';
import { ArianeeAccessTokenService } from '../ArianeeAccessToken/ArianeeAccessTokenService';
import { UtilsService } from '../utilService/utilsService';
import { WalletService } from '../walletService/walletService';
import { Web3Service } from '../web3Service/web3Service';

@injectable()
export class CertificateService {
  constructor (
    private utils: UtilsService,
    private httpClient: ArianeeHttpClient,
    private configurationService: ConfigurationService,
    private contractService: ContractService,
    private certificateDetails: CertificateDetails,
    private walletService: WalletService,
    private eventService: EventService,
    private web3Service: Web3Service,
    private certificateAuthorizationService:CertificateAuthorizationService,
    private globalConfiguration: GlobalConfigurationService,
    private store:SimpleStore,
    private batchService:BatchService,
    private diagnosisService:DiagnosisService,
    private jwtProofService: ArianeeAccessTokenService
  ) {
  }

  public reserveCertificateId = async (certificateId?:number) => {
    if (certificateId) {
      const certificateIdIsAvailable = await this.isCertificateIdFree(certificateId);
      if (!certificateIdIsAvailable) {
        throw new Error(`Certificate id (${certificateId}) is not available`);
      }
    } else {
      certificateId = await this.getAvailableCertificateId();
    }

    const transcationObject = this.contractService.storeContract.methods.reserveToken(certificateId, this.walletService.address);

    try {
      var result = await transcationObject.send()
        .then(i => ({
          ...(<any>i),
          certificateId
        }));

      return result;
    } catch (e) {
      const diagnosis = await this.diagnosisService.diagnosis([
        this.diagnosisService.isStoreApprove(),
        this.diagnosisService.isPOACredit(),
        this.diagnosisService.isCertificateCredit()
      ], e);
      return Promise.reject(diagnosis);
    }
  }

  private getAvailableCertificateId = async ():Promise<number> => {
    const certificateId = this.utils.createUID();

    const isFree = await this.isCertificateIdFree(certificateId);

    if (isFree) {
      return certificateId;
    } else {
      return this.getAvailableCertificateId();
    }
  }

  private isCertificateIdFree = async (certificateId:number):Promise<boolean> => {
    try {
      await this.contractService.smartAssetContract.methods.ownerOf(certificateId).call();
      return false;
    } catch {
      return true;
    }
  }

  private canCreateCertificateWithCertificateId = async (certificateId:number):Promise<boolean> => {
    try {
      const owner = await this.contractService.smartAssetContract.methods.ownerOf(certificateId).call();
      const imprint = await this.contractService.smartAssetContract.methods.tokenImprint(certificateId).call();
      const imprintIsEmpty = !imprint || imprint === '0x0000000000000000000000000000000000000000000000000000000000000000';
      const isOwner = owner === this.walletService.address;

      return imprintIsEmpty && isOwner;
    } catch {
      return true;
    }
  }

  private prepareHydrateToken = async (data: hydrateTokenParameters):Promise<hydrateTokenParameters> => {
    let {
      uri,
      hash,
      certificateId,
      passphrase,
      tokenRecoveryTimestamp,
      sameRequestOwnershipPassphrase,
      content
    } = data;

    if (certificateId) {
      const certificateIdIsAvailable = await this.canCreateCertificateWithCertificateId(certificateId);

      if (!certificateIdIsAvailable) {
        throw new Error(`Certificate id (${certificateId}) is not available`);
      }
    } else {
      certificateId = await this.getAvailableCertificateId();
    }

    const fiveYears = 60 * 60 * 24 * 365 * 5;
    const now = new Date();

    tokenRecoveryTimestamp =
      tokenRecoveryTimestamp ||
      Math.round(now.setDate(now.getDate()) / 1000) + fiveYears;

    sameRequestOwnershipPassphrase =
      sameRequestOwnershipPassphrase !== undefined
        ? sameRequestOwnershipPassphrase
        : true;

    passphrase = passphrase || this.utils.createPassphrase();

    const temporaryWallet = this.configurationService
      .walletFactory()
      .fromPassPhrase(passphrase);

    console.assert(
      !(hash && content),
      'you should choose between hash and certificate'
    );
    console.assert(
      !(isNullOrUndefined(hash) && isNullOrUndefined(content)),
      'you should pass at least on parameter'
    );

    if (content) {
      hash = await this.utils.calculateImprint(content);
    }

    return {
      uri,
      hash,
      certificateId,
      encryptedInitialKey: temporaryWallet.address,
      passphrase,
      tokenRecoveryTimestamp,
      sameRequestOwnershipPassphrase,
      content
    };
  };

  private hydrateTokenTransaction = (data:hydrateTokenParameters):TransactionObject<any> => {
    const {
      uri,
      hash,
      certificateId,
      encryptedInitialKey,
      tokenRecoveryTimestamp,
      sameRequestOwnershipPassphrase
    } = data;

    return this.contractService.storeContract.methods
      .hydrateToken(
        certificateId,
        hash,
        uri,
        encryptedInitialKey,
        tokenRecoveryTimestamp,
        sameRequestOwnershipPassphrase,
        this.configurationService.arianeeConfiguration.brandDataHubReward.address
      );
  }

  public createAndStoreCertificate=async (data:hydrateTokenParameters, arianeePrivacyGatewayURL?:string): Promise<{
  [key:string]:any;
  passphrase:string;
  certificateId: ArianeeTokenId;
  deepLink:string
}> => {
    const result = await this.customHydrateToken(data);
    await this.storeContentInRPCServer(result.certificateId, data.content, arianeePrivacyGatewayURL);
    return result;
  }

  public customHydrateToken = async (data: hydrateTokenParameters): Promise<{
    [key:string]:any;
    passphrase:string;
    certificateId: ArianeeTokenId;
    deepLink:string
  }> => {
    data.uri = data.uri || '';

    const preparedData = await this.prepareHydrateToken(data);
    const transcationObject = this.hydrateTokenTransaction(preparedData);
    try {
      var result = await transcationObject.send()
        .then(i => ({
          ...(<any>i),
          passphrase: preparedData.passphrase,
          certificateId: preparedData.certificateId,
          deepLink: this.utils.createLink(preparedData.certificateId, preparedData.passphrase)
        }));

      return result;
    } catch (e) {
      const diagnosis = await this.diagnosisService.diagnosis([
        this.diagnosisService.isStoreApprove(),
        this.diagnosisService.isPOACredit(),
        this.diagnosisService.isCertificateCredit(),
        this.diagnosisService.isCertificateIdExist(preparedData.certificateId)
      ], e);
      return Promise.reject(diagnosis);
    }
  }

  public customHydrateTokenBatch = async (datas:hydrateTokenParameters[]) => {
    datas.forEach(async (data) => {
      if (data) {
        const preparedData = await this.prepareHydrateToken(data);
        const transactionObject = await this.hydrateTokenTransaction(preparedData);
        this.batchService.addToBatch(transactionObject);
      }
    });

    return this.batchService.executeBatch();
  }

  public storeContentInRPCServer =async (certificateId:ArianeeTokenId, content, arianeePrivacyGatewayURL?:string) => {
    arianeePrivacyGatewayURL = arianeePrivacyGatewayURL || this.configurationService.arianeeConfiguration.defaultArianeePrivacyGateway;
    if (!arianeePrivacyGatewayURL) {
      throw new Error('You need to specify an Arianee Privacy Gateway URL');
    }

    return this.httpClient.RPCCall(arianeePrivacyGatewayURL, 'certificate.create', { certificateId: certificateId, json: content });
  }

  private customRequestTokenFactory = (certificateId, passphrase) => {
    const temporaryWallet = this.configurationService
      .walletFactory()
      .fromPassPhrase(passphrase);

    const proof = this.utils.signProofForRequestToken(
      certificateId,
      this.walletService.address,
      temporaryWallet.privateKey
    );

    return this.contractService.storeContract.methods.requestToken(
      certificateId,
      proof.messageHash,
      false,
      this.configurationService.arianeeConfiguration.brandDataHubReward.address,
      proof.signature
    );
  }

  public isCertificateOwnershipRequestable = async (
    certificateId,
    passphrase
  ): Promise<ExtendedBoolean> => {
    try {
      await this.customRequestTokenFactory(certificateId, passphrase).call();

      return {
        isTrue: true,
        code: 'certicate.requestable',
        message: 'certificate is requestable'
      };
    } catch (err) {
      return {
        isTrue: false,
        code: 'certicate.notrequestable',
        message: 'certificate is not requestable'
      };
    }
  }

  /**
   * Get certificate from Arianee Access Token
   * example: getCertificateFromArianeeAccessToken(eyJ0eXAiOiJK...restOfYourJWT)
   * @param Arianee Access Token
   * @param query
   */
  public getCertificateFromArianeeAccessToken = (arianeeAccessToken: string, query?: ConsolidatedCertificateRequest) => {
    const { payload: { subId } } = this.jwtProofService.decodeArianeeAccessToken(arianeeAccessToken);

    const queryWithJWT = {
      ...query
    };
    queryWithJWT.advanced = {
      ...queryWithJWT.advanced,
      arianeeProofToken: arianeeAccessToken
    };

    return this.getCertificate(subId, undefined, queryWithJWT);
  };

  /**
   * Get certificate from certificateId and passphrase.
   * @param certificateId
   * @param passphrase
   * @param query
   */
  public getCertificate = async <CertificateType=any, IdentityType=any>(
    certificateId: ArianeeTokenId,
    passphrase?: string,
    query?: ConsolidatedCertificateRequest
  ): Promise<CertificateSummary<CertificateType, IdentityType>> => {
    query = this.globalConfiguration.getMergedQuery(query);

    const response = new CertificateSummaryBuilder();
    response.setCertificateId(certificateId);

    const requestQueue = [];

    if (query.content) {
      const contentDetails = this.certificateDetails.getCertificateContent(
        {
          certificateId,
          passphrase,
          query
        }
      ).then((certificateContent) => {
        response.setContent(
          certificateContent.data,
          certificateContent.isAuthentic,
          certificateContent.imprint
        );
      });

      requestQueue.push(
        contentDetails
      );
    }

    if (query.owner) {
      requestQueue.push(
        this.certificateDetails.getCertificateOwner(certificateId)
          .then(owner => response.setOwner(owner, this.walletService.address)));
    }

    if (query.issuer) {
      const issuerDetails = this.certificateDetails.getCertificateIssuer({
        certificateId,
        query
      })
        .then(identityDetails => {
          response.setIssuer(
            identityDetails.isAuthentic,
            identityDetails.isApproved,
            identityDetails.imprint,
            identityDetails
          );
        });
      requestQueue.push(issuerDetails);
    }

    if (query.messageSenders) {
      const messageSenders = this.certificateAuthorizationService.getMessageSenders({ certificateId, query })
        .then(messageSenders => response.setMessageSenders(messageSenders));

      requestQueue.push(messageSenders);
    }

    if (query.isRequestable) {
      const isRequestable = this.isCertificateOwnershipRequestable(certificateId, passphrase).then(
        isRequestable => response.setIsRequestable(isRequestable.isTrue)
      );
      requestQueue.push(isRequestable);
    }

    if (query.events) {
      const eventsDetails = this.eventService.getCertificateTransferEvents({ certificateId, query }).then(events => {
        response.setEvents(events);
      });
      requestQueue.push(eventsDetails);
    }

    if (query.arianeeEvents) {
      const arianeeEvents = this.eventService.getCertificateArianeeEvents<EventContent, IdentityType>({
        certificateId, passphrase, query
      }).then(events => {
        response.setArianeeEvents(events);
      });
      requestQueue.push(arianeeEvents);
    }

    try {
      await Promise.all(requestQueue);
    } catch (err) {
      console.error(err);
    }

    const summary = response.build();

    if (get(query, 'advanced.languages') &&
        get(summary, 'content.data') &&
        isSchemai18n(summary.content.data)) {
      return replaceLanguage(summary, query.advanced.languages) as any;
    } else {
      return summary;
    }
  }

  /**
   * Get all certificate ids owned by this wallet
   */
  public getMyCertificateIds =async ():Promise<ArianeeTokenId[]> => {
    const numberOfCertificates = await this.contractService.smartAssetContract.methods
      .balanceOf(this.walletService.address)
      .call();

    const rangeOfIndex = [];

    for (let i = 0; i < <any>numberOfCertificates; i++) {
      rangeOfIndex.push(i);
    }

    // Fetch certificateIds of certificate with index
    return Promise.all(
      rangeOfIndex.map(index =>
        this.contractService.smartAssetContract.methods
          .tokenOfOwnerByIndex(this.walletService.address, index)
          .call()
      )
    );
  }

  public getMyCertificates = async (
    query?: ConsolidatedCertificateRequest,
    verifyOwnership?:boolean
  ): Promise<CertificateSummary[]> => {
    // Fetch number of certificates this user owns
    const certificateIds = await this.store.get<ArianeeTokenId[]>(StoreNamespace.certificateIds, this.walletService.address, () => this.getMyCertificateIds(), verifyOwnership);

    // Fetch details of each certificate
    const results = await Promise.all(
      certificateIds.map(certificateId =>
        this.getCertificate(certificateId, undefined, query)
      )
    );

    return results.reverse();
  }

  public getMyCertificatesGroupByIssuer = async (query?: ConsolidatedCertificateRequest)
    : Promise<{ [key: string]: CertificateSummary[] }> => {
    const certificates = await this.getMyCertificates(query);

    const groupByIssuerCertificates = certificates
      .reduce<{ [key: string]: CertificateSummary[] }>((accumulator, currentValue) => {
        const issuerAddress = currentValue.issuer.identity.address;
        if (!Object.prototype.hasOwnProperty.call(accumulator, issuerAddress)) {
          accumulator[issuerAddress] = [];
        }
        accumulator[issuerAddress].push(currentValue);

        return accumulator;
      }, {});

    return groupByIssuerCertificates;
  }

  public createCertificateRequestOwnershipLink = async (
    certificateId: number,
    passphrase?: string
  ) => {
    if (!passphrase) {
      passphrase = this.utils.createPassphrase();
    }
    await this.setPassphrase(certificateId, passphrase, 1);

    return this.utils.createLink(certificateId, passphrase);
  }

  private async setPassphrase (
    certificateId: number,
    passphrase: string,
    type: number
  ) {
    const temporaryWallet = this.configurationService
      .walletFactory()
      .fromPassPhrase(passphrase);

    return this.contractService.smartAssetContract.methods
      .addTokenAccess(certificateId, temporaryWallet.address, true, type)
      .send();
  }

  // Ajouter une passphrase à un token
  //  this.smartAssetContract.methods.addTokenAccess()

  public getCertificateFromLink = (link: string, query?: ConsolidatedCertificateRequest) => {
    const { certificateId, passphrase } = this.utils.readLink(link);

    return this.getCertificate(certificateId, passphrase, query);
  }

  public customRequestToken = async (
    certificateId: number,
    passphrase: string
  ) => this.customRequestTokenFactory(certificateId, passphrase).send();

  public destroyCertificate =(certificateId:ArianeeTokenId):Promise<any> => {
    return this.contractService.smartAssetContract.methods
      .transferFrom(
        this.walletService.address,
        '0x000000000000000000000000000000000000dead',
        certificateId)
      .send();
  }

  public recoverCertificate =(certificateId:ArianeeTokenId):Promise<any> => {
    return this.contractService.smartAssetContract.methods
      .recoverTokenToIssuer(certificateId)
      .send();
  }
}
