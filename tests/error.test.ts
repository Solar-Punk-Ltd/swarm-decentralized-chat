import { SwarmChat } from "../src/core";
import { ErrorObject } from "../src/types";


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