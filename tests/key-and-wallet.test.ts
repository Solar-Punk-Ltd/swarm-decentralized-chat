import { Utils } from '@ethersphere/bee-js';
import { SwarmChat } from "../src/core";
import { utils, Wallet } from 'ethers';


describe('getConsensualPrivateKey', () => {
  let swarmChat: SwarmChat;

  beforeEach(() => {
    swarmChat = new SwarmChat();
  });

  it('should return bytes directly when input is a valid 64-character hex string', () => {
    const hexResource = 'a'.repeat(64);
    const expectedBytes = new Uint8Array([1, 2, 3]);

    const isHexStringSpy = jest.spyOn(Utils, 'isHexString').mockReturnValue(true);
    const hexToBytesSpy = jest.spyOn(Utils, 'hexToBytes').mockReturnValue(expectedBytes);

    const result = (swarmChat as any).utils.getConsensualPrivateKey(hexResource);

    expect(isHexStringSpy).toHaveBeenCalledWith(hexResource);
    expect(hexToBytesSpy).toHaveBeenCalledWith(hexResource);
    expect(result).toEqual(expectedBytes);

    isHexStringSpy.mockRestore();
    hexToBytesSpy.mockRestore();
  });
});


// Mock ethers utilities
jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'),
  utils: {
    ...jest.requireActual('ethers').utils,
    hexlify: jest.fn()
  },
  Wallet: jest.fn()
}));

describe('getGraffitiWallet', () => {
  let swarmChat: SwarmChat;

  beforeEach(() => {
    swarmChat = new SwarmChat();
    
    jest.clearAllMocks();
  });

  it('should create a wallet with hexlified private key', () => {
    const consensualPrivateKey = new Uint8Array([1, 2, 3, 4]);
    const hexlifiedPrivateKey = '0x01020304';
    const mockWallet = {} as Wallet;

    (utils.hexlify as jest.Mock).mockReturnValue(hexlifiedPrivateKey);
    (Wallet as unknown as jest.Mock).mockReturnValue(mockWallet);

    const result = (swarmChat as any).utils.getGraffitiWallet(consensualPrivateKey);

    expect(utils.hexlify).toHaveBeenCalledWith(consensualPrivateKey);
    expect(Wallet).toHaveBeenCalledWith(hexlifiedPrivateKey);
    expect(result).toBe(mockWallet);
  });
});
