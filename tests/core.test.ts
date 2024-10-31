import { SwarmChat } from '../src/core';
import { BatchId, Bee } from '@ethersphere/bee-js';

const STAMP = '490f79912ea2c4050d577144d126279d767a05200dfc590a1496c14c678a9939';
const URL = 'http://localhost:1633'


describe('SwarmChat', () => {
  let chat: SwarmChat;
  const beeInstance = new Bee(URL);
  
  const topic = 'test-topic';
  const stamp = STAMP as unknown as BatchId;

  beforeEach(() => {
    chat = new SwarmChat({}, beeInstance);
  });

  it('should initialize chat room without errors', async () => {
    const spyInit = jest.spyOn(chat, 'initChatRoom');
    await chat.initChatRoom(topic, stamp);
    expect(spyInit).toHaveBeenCalledWith(topic, stamp);
    spyInit.mockRestore();
  });
});