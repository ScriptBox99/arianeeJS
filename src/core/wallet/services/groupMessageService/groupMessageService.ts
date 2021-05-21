import { get, range } from 'lodash';
import { injectable } from 'tsyringe';
import { ArianeeTokenId } from '../../../../models/ArianeeTokenId';
import { ExtendedBoolean } from '../../../../models/extendedBoolean';
import { StoreNamespace } from '../../../../models/storeNamespace';
import { ArianeeHttpClient } from '../../../libs/arianeeHttpClient/arianeeHttpClient';
import { isSchemai18n } from '../../../libs/certificateVersion';
import { replaceLanguage } from '../../../libs/i18nSchemaLanguageManager/i18nSchemaLanguageManager';
import { isNullOrUndefined } from '../../../libs/isNullOrUndefined';
import { SimpleStore } from '../../../libs/simpleStore/simpleStore';
import { ConsolidatedCertificateRequest, Message } from '../../certificateSummary/certificateSummary';
import { CertificateService } from '../certificateService/certificateService';
import { ConfigurationService } from '../configurationService/configurationService';
import { ContractService } from '../contractService/contractsService';
import { DiagnosisService } from '../diagnosisService/diagnosisService';
import { IdentityService } from '../identityService/identityService';
import { UtilsService } from '../utilService/utilsService';
import { WalletService } from '../walletService/walletService';

@injectable()
export class GroupMessageService {
  constructor (
        private identityService: IdentityService,
        private contractService: ContractService,
        private walletService: WalletService,
        private configurationService: ConfigurationService,
        private httpClient: ArianeeHttpClient,
        private utils: UtilsService,
        private diagnosisService: DiagnosisService,
        private store: SimpleStore,
        private certificateService: CertificateService
  ) {
  }

    public getGroupMessage = async (parameters: {
        certificateId: ArianeeTokenId,
        query?: ConsolidatedCertificateRequest,
        url?: string,
        forceRefresh?: boolean
    }): Promise<Message[]> => {
      const forceRefresh = parameters.forceRefresh || false;

      return this.store.get<Message[]>(StoreNamespace.groupMessage, parameters.certificateId, () => this.fetchMessages(parameters), forceRefresh);
    };

    /**
     * Fetch message and apply i18n
     * @param {{messageId: number; query?: ConsolidatedCertificateRequest; url?: string}} parameters
     * @returns {Promise<Message>}
     */
    public fetchMessages = async (parameters: {
        certificateId: ArianeeTokenId,
        query?: ConsolidatedCertificateRequest,
        url?: string
    }): Promise<Message[]> => {
      const { query } = parameters;
      const messagesSummary = await this.fetchRawMessage(parameters);

      return messagesSummary;
    };

    /**
     * Fetch message
     * @param {{messageId: number; query?: ConsolidatedCertificateRequest; url?: string}} parameters
     * @returns {Promise<Message>}
     */
    public fetchRawMessage = async (parameters: {
        certificateId: ArianeeTokenId,
        query?: ConsolidatedCertificateRequest,
        url?: string
    }): Promise<Message[]> => {
      const { certificateId, query } = parameters;
      const { content, issuer } = await this.certificateService
        .getCertificate(certificateId,
          undefined, {
            content: true,
            issuer: true
          });

      let messagesContentResult: Array<any>;
      const rpcURL = get(content, 'rpcEndpoint') || parameters.url;
      if (rpcURL) {
        const proof = await this.walletService.signProof(
          JSON.stringify({
            certificateId,
            timestamp: new Date()
          }),
          this.walletService.privateKey
        );

        const messageRPCResult = await this.httpClient.RPCCall(
          rpcURL,
          'group.readAllMessages',
          {
            certificateId,
            authentification: {
              hash: proof.messageHash,
              signature: proof.signature,
              message: proof.message
            }
          }
        );
        messagesContentResult = messageRPCResult.result;
      }

      const messageSentEvents = await this.contractService.messageContract.getPastEvents(
        'MessageSent',
        { fromBlock: 0, toBlock: 'latest', filter: { _tokenId: certificateId } }
      );

      const results = await Promise.all(Object.keys(messagesContentResult)
        .map(async (id) => {
          const messageCreationEvent = messageSentEvents
            .find(event => event.returnValues._messageId === id.toString());
          let creationDate = await this.utils.getTimestampFromBlock(messageCreationEvent.blockNumber);
          creationDate = parseInt(creationDate) * 1000;

          const message:Message = {
            messageId: id,
            timestamp: creationDate,
            issuer,
            to: undefined,
            from: undefined,
            isRead: undefined,
            certificateId,
            content: messagesContentResult[id]
          };
          return message;
        }));

      return results;
    };

    public getMyMessages = async (parameters?: {
        query?: ConsolidatedCertificateRequest,
        url?: string
    }) => {
      const nbMessages = await this.contractService.messageContract.methods.messageLengthByReceiver(this.walletService.address).call();

      const rangeOfMessage = range(0, +nbMessages);

      const messageIds = await Promise.all(rangeOfMessage
        .map(index => this.contractService.messageContract.methods.receiverToMessageIds(this.walletService.address, index)
          .call()));

      return Promise.all(messageIds.map(messageId => {
        return this.getMessage({ messageId: <unknown>messageId as number, ...parameters })
          .catch(d => undefined);
      }
      ));
    };
}
