import { SwarmChat } from '../src/core';
import { EVENTS, MINUTE, SECOND } from '../src/constants';
import { Bee } from '@ethersphere/bee-js';
import { EventEmitter } from '../src/eventEmitter';


describe('SwarmChat initialization and configuration (constructor)', () => {
  it('constructor should create SwarmChat instance', async () => {
    const chatInstance = new SwarmChat();
    expect(chatInstance).toBeInstanceOf(SwarmChat);
  });
  
  it('constructor should create chat instance with proper configuration', async () => {
    const chat = new SwarmChat({
        idleTime: 7 * MINUTE,
        messageCheckInterval: 3000,
        messageFetchMin: 500,
        userUpdateInterval: 9000
    });
    
    expect(chat.getDiagnostics().maxParallel).toBe(4);
    expect(chat.getIdleConst()).toBe(7*MINUTE);
    expect(chat.getMessageCheckInterval()).toBe(3000);
    expect(chat.getUserCount()).toBe(0);
    expect(chat.getUserUpdateIntervalConst()).toBe(9000);
  });

  it('constructor should use default values when no settings provided', async () => {
    const chat = new SwarmChat();
    
    expect(chat.getIdleConst()).toBe(1 * MINUTE);
    expect(chat.getMessageCheckInterval()).toBe(900);
    expect(chat.getUserUpdateIntervalConst()).toBe(8 * SECOND);
    expect(chat.getDiagnostics().maxParallel).toBe(4);
  });

  it('constructor should accept custom Bee instance', async () => {
    const customBee = new Bee('http://custom-url:1633');
    const chat = new SwarmChat({}, customBee);
    
    expect(chat.getBeeInstance()).toBe(customBee);
  });

  it('constructor should accept custom EventEmitter', async () => {
    const customEmitter = new EventEmitter();
    const chat = new SwarmChat({}, undefined, customEmitter);
    
    const actions = chat.getChatActions();
    expect(actions.on).toBe(customEmitter.on);
    expect(actions.off).toBe(customEmitter.off);
  });

  it('constructor should initialize with gateway settings', async () => {
    const chat = new SwarmChat({
      gateway: "custom-gateway-123",
      gsocResourceId: "resource-id-123"
    });
    
    expect(chat.getGateway()).toBe("custom-gateway-123");
    expect(chat.getGsocResourceId()).toBe("resource-id-123");
  });
});


describe('getChatActions', () => {
  it('should give back on and off event handlers', async () => {
    const chat = new SwarmChat();
    const { on, off } = chat.getChatActions();

    expect(on).toBeInstanceOf(Function);
    expect(off).toBeInstanceOf(Function);
  });

  it('should return working event handlers', async () => {
    const chat = new SwarmChat();
    const { on, off } = chat.getChatActions();
    
    const mockHandler = jest.fn();
    const eventName = EVENTS.LOADING_INIT_USERS;
    
    on(eventName, mockHandler);
    chat.initUsers('test-topic')
    expect(mockHandler).toHaveBeenCalledWith(true);
  });

  it('should allow multiple subscribers to the same event', () => {
    const chat = new SwarmChat();
    const { on } = chat.getChatActions();
    const listener1 = jest.fn();
    const listener2 = jest.fn();
    
    on(EVENTS.LOADING_INIT_USERS, listener1);
    on(EVENTS.LOADING_INIT_USERS, listener2);
    
    chat.initUsers('test-topic');
    
    expect(listener1).toHaveBeenCalledWith(true);
    expect(listener2).toHaveBeenCalledWith(true);
  });

  it('should allow unsubscribing specific listeners', () => {
    const chat = new SwarmChat();
    const { on, off } = chat.getChatActions();
    const listener1 = jest.fn();
    const listener2 = jest.fn();
    
    on(EVENTS.LOADING_INIT_USERS, listener1);
    on(EVENTS.LOADING_INIT_USERS, listener2);
    
    // Unsubscribe only the first listener
    off(EVENTS.LOADING_INIT_USERS, listener1);
    
    chat.initUsers('test-topic');
    
    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).toHaveBeenCalledWith(true);
  });

  it('should handle unsubscribing from non-existent events', () => {
    const chat = new SwarmChat();
    const { off } = chat.getChatActions();
    const listener = jest.fn();
    
    expect(() => off('nonExistentEvent', listener)).not.toThrow();
  });

  it('should handle unsubscribing non-existent listener', () => {
    const chat = new SwarmChat();
    const { on, off } = chat.getChatActions();
    const listener1 = jest.fn();
    const listener2 = jest.fn();
    
    on(EVENTS.LOADING_INIT_USERS, listener1);
    
    expect(() => off(EVENTS.LOADING_INIT_USERS, listener2)).not.toThrow();
    
    chat.initUsers('test-topic');
    expect(listener1).toHaveBeenCalledWith(true);
  });

  it('should maintain separate event lists for different instances', () => {
    const chat1 = new SwarmChat();
    const chat2 = new SwarmChat();
    const listener1 = jest.fn();
    const listener2 = jest.fn();
    
    chat1.getChatActions().on(EVENTS.LOADING_INIT_USERS, listener1);
    chat2.getChatActions().on(EVENTS.LOADING_INIT_USERS, listener2);
    
    chat1.initUsers('test-topic');
    
    expect(listener1).toHaveBeenCalledWith(true);
    expect(listener2).not.toHaveBeenCalled();
  });
});