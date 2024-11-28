import pino from "pino";
import { ErrorObject } from "../src/types";
import { SwarmChatUtils } from "../src/utils";


describe('serializeGraffitiRecord', () => {
  let logger: pino.Logger;
  let mockHandleError: jest.Mock<void, [ErrorObject]>;
  let utils: SwarmChatUtils;

  beforeEach(() => {
    logger = pino({ level: 'silent' });

    mockHandleError = jest.fn((errObject: ErrorObject) => {
      logger.error(`Error in ${errObject.context}: ${errObject.error.message}`);
    });

    utils = new SwarmChatUtils(mockHandleError, logger);
  });

  it('should serialize a simple object to Uint8Array', () => {
    const record = { name: 'John Doe', age: 30 };
    const serialized = utils.serializeGraffitiRecord(record);
    
    expect(serialized).toBeInstanceOf(Uint8Array);
    
    const decoded = new TextDecoder().decode(serialized);
    expect(JSON.parse(decoded)).toEqual(record);
  });

  it('should handle nested objects', () => {
    const record = { 
      user: { 
        name: 'Jane Doe', 
        details: { 
          age: 25, 
          city: 'New York' 
        } 
      },
      active: true
    };
    const serialized = utils.serializeGraffitiRecord(record);
    
    expect(serialized).toBeInstanceOf(Uint8Array);
    
    const decoded = new TextDecoder().decode(serialized);
    expect(JSON.parse(decoded)).toEqual(record);
  });
});


describe('numberToFeedIndex', () => {
  let logger: pino.Logger;
  let mockHandleError: jest.Mock<void, [ErrorObject]>;
  let utils: SwarmChatUtils;

  beforeEach(() => {
    logger = pino({ level: 'silent' });

    mockHandleError = jest.fn((errObject: ErrorObject) => {
      logger.error(`Error in ${errObject.context}: ${errObject.error.message}`);
    });

    utils = new SwarmChatUtils(mockHandleError, logger);
  });

  it('should convert a positive number to the correct feed index', () => {
    const index = 42;
    const expectedHex = '000000000000002a'; // 42 in hexadecimal, padded to 8 bytes

    const result = utils.numberToFeedIndex(index);

    expect(result).toBe(expectedHex);
  });

  it('should convert zero to the correct feed index', () => {
    const index = 0;
    const expectedHex = '0000000000000000'; // 0 in hexadecimal, padded to 8 bytes

    const result = utils.numberToFeedIndex(index);

    expect(result).toBe(expectedHex);
  });

  it('should convert the maximum safe integer to the correct feed index', () => {
    const index = Number.MAX_SAFE_INTEGER;
    const expectedHex = '001fffffffffffff'; // MAX_SAFE_INTEGER in hexadecimal, padded to 8 bytes

    const result = utils.numberToFeedIndex(index);

    expect(result).toBe(expectedHex);
  });

  it('should handle large numbers within the range of a 32-bit integer', () => {
    const index = 2147483647; // 2^31 - 1, max 32-bit signed integer
    const expectedHex = '000000007fffffff'; // Corresponding hex representation

    const result = utils.numberToFeedIndex(index);

    expect(result).toBe(expectedHex);
  });
});
