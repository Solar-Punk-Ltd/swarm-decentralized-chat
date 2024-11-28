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