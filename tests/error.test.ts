import { SwarmChat } from "../src/core";
import { ErrorObject } from "../src/types";
import pino from 'pino';
import { SwarmChatUtils } from "../src/utils";


describe('handleError', () => {
  let chat: SwarmChat;
  let mockLogger: { 
    error: jest.MockedFunction<(message: string) => void> 
  };
  let mockEmitter: { 
    emit: jest.MockedFunction<(event: string, data: any) => void> 
  };

  beforeEach(() => {
    mockLogger = {
      error: jest.fn()
    };

    mockEmitter = {
      emit: jest.fn()
    };

    chat = new SwarmChat();
    chat['logger'] = mockLogger as any;
    chat['emitter'] = mockEmitter as any;
  });

  it('should log the error with context and message', () => {
    const errObject = {
      context: 'test-context',
      error: new Error('Test error message'),
      throw: false
    };

    chat['handleError'](errObject);

    expect(mockLogger.error).toHaveBeenCalledWith(
      `Error in ${errObject.context}: ${errObject.error.message}`
    );
  });

  it('should not throw an error when throw is false', () => {
    const errObject = {
      context: 'test-context',
      error: new Error('Test error message'),
      throw: false
    };

    expect(() => chat['handleError'](errObject)).not.toThrow();
  });

  it('should throw an error when throw is true', () => {
    const errObject = {
      context: 'test-context',
      error: new Error('Test error message'),
      throw: true
    } as ErrorObject;

    expect(() => chat['handleError'](errObject)).toThrow(
      `Error in ${errObject.context}`
    );
  });
});


describe('changeLogLevel', () => {
  let chat: SwarmChat;
  let mockHandleError: jest.MockedFunction<typeof chat['handleError']>;
  let mockPino: jest.MockedFunction<typeof pino>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockHandleError = jest.fn();
    chat = new SwarmChat();
    chat['handleError'] = mockHandleError;

    mockPino = jest.requireMock('pino') as jest.MockedFunction<typeof pino>;
  });

  it('should handle invalid log levels', () => {
    const invalidLogLevels = ['INVALID', 'log', 'critical', '', null, undefined];

    invalidLogLevels.forEach((level) => {
      chat.changeLogLevel(level as any);

      expect(mockHandleError).toHaveBeenCalledWith({
        error: expect.any(Error),
        context: 'changeLogLevel',
        throw: false,
      });
      expect(mockPino).not.toHaveBeenCalled();

      jest.clearAllMocks();
    });
  });
});


describe('isNotFoundError', () => {
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

  it('should return true if error stack includes "404"', () => {
    const error = { stack: 'Some error occurred: 404', message: 'Error message' };
    expect(utils.isNotFoundError(error)).toBe(true);
  });

  it('should return true if error message includes "Not Found"', () => {
    const error = { stack: 'Some error stack', message: 'Not Found' };
    expect(utils.isNotFoundError(error)).toBe(true);
  });

  it('should return true if error message includes "404"', () => {
    const error = { stack: 'Some error stack', message: '404 - Not Found' };
    expect(utils.isNotFoundError(error)).toBe(true);
  });

  it('should return false if error does not include "404" or "Not Found"', () => {
    const error = { stack: 'Some error stack', message: 'Some other error' };
    expect(utils.isNotFoundError(error)).toBe(false);
  });
});