import { SwarmChat } from "../src/core";
import { EVENTS } from "../src/constants";


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


describe('startUserFetchProcess', () => {
  let chat: SwarmChat;

  beforeEach(() => {
    chat = new SwarmChat();
  });

  afterEach(() => {
    jest.useRealTimers();
    chat.stopUserFetchProcess();
  });

  it('should periodically fetch user data', () => {
    jest.useFakeTimers();
    const tryUserFetchSpy = jest.spyOn(chat as any, 'tryUserFetch');
    
    chat.startUserFetchProcess('some-topic');
    
    // Fast-forward time by one interval
    jest.advanceTimersByTime(chat['USER_UPDATE_INTERVAL']);
    
    expect(tryUserFetchSpy).toHaveBeenCalledWith('some-topic');
    expect(tryUserFetchSpy).toHaveBeenCalledTimes(1);
    
    // Fast-forward by another interval to ensure it keeps running
    jest.advanceTimersByTime(chat['USER_UPDATE_INTERVAL']);
    expect(tryUserFetchSpy).toHaveBeenCalledTimes(2);
  });

  it('should clear previous interval when called multiple times', () => {
    jest.useFakeTimers();
    const tryUserFetchSpy = jest.spyOn(chat as any, 'tryUserFetch');
    
    chat.startUserFetchProcess('topic-1');
    chat.startUserFetchProcess('topic-2');
    
    jest.advanceTimersByTime(chat['USER_UPDATE_INTERVAL']);
    
    expect(tryUserFetchSpy).toHaveBeenCalledWith('topic-2');
    expect(tryUserFetchSpy).not.toHaveBeenCalledWith('topic-1');
    expect(tryUserFetchSpy).toHaveBeenCalledTimes(1);
  });
});