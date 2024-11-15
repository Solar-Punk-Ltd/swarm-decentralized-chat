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