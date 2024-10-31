import { SwarmChat } from '../src/core';
import { BatchId, Bee } from '@ethersphere/bee-js';
import { STAMP, URL } from './config';
import { MINUTE } from '../src/constants';


describe('SwarmChat initialization and configuration', () => {

  it('should create SwarmChat instance with default', async () => {
    const chatInstance = new SwarmChat();
    expect(chatInstance).toBeInstanceOf(SwarmChat);
  });
  
  it('should create chat instance with proper configuration', async () => {
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

  it('should give back on and off event handlers', async () => {
    const chat = new SwarmChat();
    const { on, off } = chat.getChatActions();

    expect(on).toBeInstanceOf(Function);
    expect(off).toBeInstanceOf(Function);
  });

});