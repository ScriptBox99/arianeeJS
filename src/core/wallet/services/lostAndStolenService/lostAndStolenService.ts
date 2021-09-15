import { injectable } from 'tsyringe';
import { ArianeeTokenId } from '../../../../models/ArianeeTokenId';
import { ContractService } from '../contractService/contractsService';

@injectable()
export class LostAndStolenService {
  constructor (private contractService: ContractService) {
  }

  /**
     * Set missing status of specific smartasset
     * @param {ArianeeTokenId} arianeeId
     * @returns {<void>}
     */
  public setMissingStatus (arianeeId: ArianeeTokenId) {
    return this.contractService.lostContract.methods.setMissingStatus(arianeeId.toString()).send();
  }

    /**
     * Unset missing status of specific smartasset
     * @param {ArianeeTokenId} arianeeId
     * @returns {<void>}
     */
    public unsetMissingStatus = (arianeeId: ArianeeTokenId): Promise<any> => this.contractService.lostContract.methods.unsetMissingStatus(arianeeId.toString()).send();

    /**
     * Set stolen status of specific smartasset
     * @param {ArianeeTokenId} arianeeId
     * @returns {<void>}
     */
    public setStolenStatus = (arianeeId: ArianeeTokenId): Promise<any> => this.contractService.lostContract.methods.setStolenStatus(arianeeId.toString()).send();

    /**
     * Unset missing status of specific smartasset
     * @param {ArianeeTokenId} arianeeId
     * @returns {<void>}
     */
    public unsetStolenStatus = (arianeeId: ArianeeTokenId): Promise<any> => this.contractService.lostContract.methods.unsetStolenStatus(arianeeId.toString()).send();

    /**
     * Check missing status of specific smartasset
     * @param {ArianeeTokenId} arianeeId
     * @returns {Promise<boolean>}
     */
    public isMissing = (arianeeId: ArianeeTokenId): Promise<boolean> => this.contractService.lostContract.methods.isMissing(arianeeId.toString()).call();

    /**
     * Check stolen status of specific smartasset
     * @param {ArianeeTokenId} arianeeId
     * @returns {Promise<boolean>}
     */
    public isStolen = (arianeeId: ArianeeTokenId): Promise<boolean> => this.contractService.lostContract.methods.isStolen(arianeeId.toString()).call();
}
