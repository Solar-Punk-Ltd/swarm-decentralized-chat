import pino from "pino";
import { EVENTS } from "../src/constants";
import { ErrorObject } from "../src/types";
import { SwarmChatUtils } from "../src/utils";


describe('SwarmChatUtils.constructor', () => {
  let logger: pino.Logger;
  let mockHandleError: jest.Mock<void, [ErrorObject]>;
  let utils: SwarmChatUtils;

  beforeEach(() => {
    logger = pino({ level: 'silent' });

    mockHandleError = jest.fn((errObject: ErrorObject) => {
      logger.error(`Error in ${errObject.context}: ${errObject.error.message}`);
    });
  });

  it('should create an instance of SwarmChatUtils', () => {
    utils = new SwarmChatUtils(mockHandleError, logger);

    expect(utils).toBeInstanceOf(SwarmChatUtils);
  });

  it('should correctly set the handleError method', () => {
    utils = new SwarmChatUtils(mockHandleError, logger);

    const testErrorObject: ErrorObject = {
      context: 'Test Context',
      error: new Error('Test Error'),
      throw: false
    };

    utils['handleError'](testErrorObject);

    expect(mockHandleError).toHaveBeenCalledWith(testErrorObject);
  });

  it('should correctly set the logger', () => {
    utils = new SwarmChatUtils(mockHandleError, logger);

    expect(utils['logger']).toBe(logger);
  });

  it('should accept different types of logger and error handler', () => {
    const customLogger = pino({ level: 'info' });
    const customErrorHandler = jest.fn((errObject: ErrorObject) => {
      console.error(`Custom error handler: ${errObject.context}`);
    });

    utils = new SwarmChatUtils(customErrorHandler, customLogger);

    expect(utils['logger']).toBe(customLogger);
    
    const testErrorObject: ErrorObject = {
      context: 'Custom Context',
      error: new Error('Custom Error'),
      throw: false
    };

    utils['handleError'](testErrorObject);
    expect(customErrorHandler).toHaveBeenCalledWith(testErrorObject);
  });

  it('should throw an error for invalid inputs', () => {
    expect(() => {
      new SwarmChatUtils(null as any, pino());
    }).toThrow(TypeError);
  
    expect(() => {
      new SwarmChatUtils(42 as any, pino());
    }).toThrow(TypeError);
  
    expect(() => {
      new SwarmChatUtils(() => {}, null as any);
    }).toThrow(TypeError);
  
    expect(() => {
      new SwarmChatUtils(() => {}, {} as any);
    }).toThrow(TypeError);
  });
});