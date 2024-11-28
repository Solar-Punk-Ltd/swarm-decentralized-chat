import { Utils } from '@ethersphere/bee-js';
import { SwarmChat } from "../src/core";


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