import { injectable } from 'tsyringe';
import { JWTGeneric } from '../../../libs/JWTGeneric/JWTGeneric';
import { ConfigurationService } from '../configurationService/configurationService';
import { UtilsService } from '../utilService/utilsService';
import { WalletService } from '../walletService/walletService';

@injectable()
export class JWTService {
  constructor (private utilService: UtilsService, private walletService: WalletService, private configuration:ConfigurationService) {

  }

  public sign (payload): string {
    var exp = new Date();
    exp.setMinutes(exp.getMinutes() + 5);
    const enrichedPayload = {
      iss: this.walletService.address,
      scope: 'all',
      exp: exp.getTime(),
      iat: Date.now(),
      chain: this.configuration.arianeeConfiguration.networkName,
      ...payload
    };

    return this.JWTGenericFactory().setPayload(enrichedPayload).sign();
  }

  public decode<T = any> (JWT): T {
    return this.JWTGenericFactory()
      .setToken(JWT)
      .decode();
  }

  public isValidJWT (JWT: string, address: string): boolean {
    return this.JWTGenericFactory()
      .setToken(JWT)
      .verify(address);
  }

    private JWTGenericFactory = () => {
      const signer = (data) => this.utilService.signProof(data).signature;
      const decoder = (message, signature) => this.utilService.recover(message, signature);

      return new JWTGeneric(signer, decoder);
    };
}
