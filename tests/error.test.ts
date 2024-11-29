import { SwarmChat } from "../src/core";
import { ErrorObject } from "../src/types";
import pino from 'pino';


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