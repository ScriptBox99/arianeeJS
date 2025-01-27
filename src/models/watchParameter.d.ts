import { Contract } from 'web3-eth-contract';

export interface WatchParameter{
  contract:Contract,
  filter:{[key:string]:string},
  blockchainEvent: string,
  eventNames:string[]
}
