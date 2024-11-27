import { SwarmChat } from "../src/core";
import { userListWithNUsers } from "./fixtures";


describe('adjustParameters', () => {
  let chat: SwarmChat;
  const topic = "test-topic";

  beforeEach(() => {
    chat = new SwarmChat();
  });

  it('should decrease max parallel request if average request time is greater than DECREASE_LIMIT', () => {
    const decreaseMaxSpy = jest.spyOn(chat['messagesQueue'], 'decreaseMax');
    
    chat['reqTimeAvg'].getAverage = jest.fn().mockReturnValue(chat['DECREASE_LIMIT'] + 1);
    
    (chat as any).adjustParameters(topic);

    expect(decreaseMaxSpy).toHaveBeenCalled();
  });

  it('should increase max parallel request if average request time is less than INCREASE_LIMIT', () => {
    const increaseMaxSpy = jest.spyOn(chat['messagesQueue'], 'increaseMax');
    
    chat['reqTimeAvg'].getAverage = jest.fn().mockReturnValue(chat['INCREASE_LIMIT'] - 1);
    
    (chat as any).adjustParameters(topic);

    expect(increaseMaxSpy).toHaveBeenCalledWith(chat['users'].length * 1);
  });

  it('should increase message fetch interval if average request time is greater than FETCH_INTERVAL_INCREASE_LIMIT', () => {
    const initialInterval = chat['mInterval'];
    const loggerInfoSpy = jest.spyOn(chat['logger'], 'info');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const setIntervalSpy = jest.spyOn(global, 'setInterval');

    chat['reqTimeAvg'].getAverage = jest.fn().mockReturnValue(chat['FETCH_INTERVAL_INCREASE_LIMIT'] + 1);
    
    chat['messageFetchClock'] = setInterval(() => console.log("hello world"), 500);
    (chat as any).adjustParameters(topic);

    expect(chat['mInterval']).toBe(initialInterval + chat['F_STEP']);
    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(setIntervalSpy).toHaveBeenCalled();
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining(`Increased message fetch interval to ${chat['mInterval']} ms`));
  });

  it('should decrease message fetch interval if average request time is less than FETCH_INTERVAL_DECREASE_LIMIT', () => {
    const initialInterval = chat['mInterval'];
    const loggerInfoSpy = jest.spyOn(chat['logger'], 'info');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const setIntervalSpy = jest.spyOn(global, 'setInterval');

    chat['reqTimeAvg'].getAverage = jest.fn().mockReturnValue(chat['FETCH_INTERVAL_DECREASE_LIMIT'] - 1);
    
    chat['messageFetchClock'] = setInterval(() => console.log("hello world"), 500);
    (chat as any).adjustParameters(topic);

    expect(chat['mInterval']).toBe(initialInterval - chat['F_STEP']);
    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(setIntervalSpy).toHaveBeenCalled();
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining(`Decreased message fetch interval to ${chat['mInterval'] - chat['F_STEP']} ms`));
  });
});


describe('getDiagnostics', () => {
  let chat: SwarmChat;
  
  beforeEach(() => {
    chat = new SwarmChat();
  });
  
  it('should return a diagnostic object with all expected properties', () => {
    const diagnostics = chat.getDiagnostics();
  
    expect(diagnostics).toHaveProperty('requestTimeAvg');
    expect(diagnostics).toHaveProperty('users');
    expect(diagnostics).toHaveProperty('currentMessageFetchInterval');
    expect(diagnostics).toHaveProperty('maxParallel');
    expect(diagnostics).toHaveProperty('userActivityTable');
    expect(diagnostics).toHaveProperty('newlyResigeredUsers');
    expect(diagnostics).toHaveProperty('requestCount');
    expect(diagnostics).toHaveProperty('userFetchClockExists');
    expect(diagnostics).toHaveProperty('messageFetchClockExists');
    expect(diagnostics).toHaveProperty('removeInactiveUsersInterval');
  });
  
  it('should correctly map internal state to diagnostic properties', async () => {
    const users = await userListWithNUsers(3); 
    chat['users'] = users;
    chat['mInterval'] = 500;
    chat['messagesQueue'].getMaxParallel = jest.fn().mockReturnValue(5);
    chat['userFetchClock'] = null;
    chat['messageFetchClock'] = {} as NodeJS.Timeout;
  
    const diagnostics = chat.getDiagnostics();
  
    expect(diagnostics.users).toBe(users);
    expect(diagnostics.currentMessageFetchInterval).toBe(500);
    expect(diagnostics.maxParallel).toBe(5);
    expect(diagnostics.userFetchClockExists).toBe(false);
    expect(diagnostics.messageFetchClockExists).toBe(true);
  });
});


describe('sleep function', () => {
  let chat = new SwarmChat();
  jest.useFakeTimers();

  afterEach(() => {
    jest.clearAllTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('should return a Promise', () => {
    const sleepPromise = chat['utils'].sleep(1000);
    expect(sleepPromise).toBeInstanceOf(Promise);
  });

  it('should resolve after the specified delay', async () => {
    const mockCallback = jest.fn();
    
    const sleepPromise = chat['utils'].sleep(1000).then(mockCallback);
    
    expect(mockCallback).not.toHaveBeenCalled();
    
    jest.advanceTimersByTime(999);
    expect(mockCallback).not.toHaveBeenCalled();
    
    jest.advanceTimersByTime(1);
    
    await sleepPromise;
    
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('should work with different delay times', async () => {
    const delays = [0, 100, 500, 1000];
    
    for (const delay of delays) {
      const mockCallback = jest.fn();
      
      const sleepPromise = chat['utils'].sleep(delay).then(mockCallback);
      
      jest.advanceTimersByTime(delay);
      
      await sleepPromise;
      
      expect(mockCallback).toHaveBeenCalledTimes(1);
    }
  });

  it('should handle very short delays', async () => {
    const mockCallback = jest.fn();
    
    const sleepPromise = chat['utils'].sleep(0).then(mockCallback);
    
    jest.advanceTimersByTime(0);
    
    await sleepPromise;
    
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });
});


describe('incrementHexString', () => {
  let chat: SwarmChat;

  beforeEach(() => {
    chat = new SwarmChat();
  });

  it('should increment a simple hex string by default', () => {
    expect(chat['utils'].incrementHexString('a')).toBe('000000000000000b');
    expect(chat['utils'].incrementHexString('f')).toBe('0000000000000010');
  });

  it('should increment a multi-character hex string', () => {
    expect(chat['utils'].incrementHexString('ff')).toBe('0000000000000100');
    expect(chat['utils'].incrementHexString('123')).toBe('0000000000000124');
  });

  it('should increment by a specified amount', () => {
    expect(chat['utils'].incrementHexString('a', 2n)).toBe('000000000000000c');
    expect(chat['utils'].incrementHexString('ff', 3n)).toBe('0000000000000102');
  });

  it('should increment zero correctly', () => {
    expect(chat['utils'].incrementHexString('0')).toBe('0000000000000001');
    expect(chat['utils'].incrementHexString('00')).toBe('0000000000000001');
  });
});


describe('hexStringToNumber', () => {
  let chat: SwarmChat;

  beforeEach(() => {
    chat = new SwarmChat();
  });

  it('should convert lowercase hex string to number', () => {
    expect(chat['utils'].hexStringToNumber('a5')).toBe(165);
  });

  it('should convert uppercase hex string to number', () => {
    expect(chat['utils'].hexStringToNumber('A5')).toBe(165);
  });

  it('should convert zero hex string to number', () => {
    expect(chat['utils'].hexStringToNumber('0')).toBe(0);
  });
});


describe('isHexString', () => {
  let chat = new SwarmChat();

  it('should return true for a valid hexadecimal string with matching length', () => {
    const result = (chat as any).utils.isHexString('a1b2c3', 6);
    expect(result).toBe(true);
  });

  it('should return true for a valid hexadecimal string when length is not specified', () => {
    const result = (chat as any).utils.isHexString('deadbeef');
    expect(result).toBe(true);
  });

  it('should return false for a string with non-hexadecimal characters', () => {
    const result = (chat as any).utils.isHexString('xyz123');
    expect(result).toBe(false);
  });

  it('should return false for a valid hexadecimal string with incorrect length', () => {
    const result = (chat as any).utils.isHexString('a1b2c3', 4);
    expect(result).toBe(false);
  });

  it('should return false for non-string inputs', () => {
    expect((chat as any).utils.isHexString(12345)).toBe(false);
    expect((chat as any).utils.isHexString(null)).toBe(false);
    expect((chat as any).utils.isHexString(undefined)).toBe(false);
    expect((chat as any).utils.isHexString({})).toBe(false);
    expect((chat as any).utils.isHexString([])).toBe(false);
  });
});


describe('isPrefixedHexString', () => {
  let chat = new SwarmChat();

  it('should return true for a valid hexadecimal string with 0x prefix', () => {
    const result = (chat as any).utils.isPrefixedHexString('0x1a2b3c');
    expect(result).toBe(true);
  });

  it('should return false for a valid hexadecimal string without 0x prefix', () => {
    const result = (chat as any).utils.isPrefixedHexString('1a2b3c');
    expect(result).toBe(false);
  });

  it('should return false for a string with invalid characters but with 0x prefix', () => {
    const result = (chat as any).utils.isPrefixedHexString('0x123zxy');
    expect(result).toBe(false);
  });

  it('should return false for non-string inputs', () => {
    expect((chat as any).utils.isPrefixedHexString(12345)).toBe(false);
    expect((chat as any).utils.isPrefixedHexString(null)).toBe(false);
    expect((chat as any).utils.isPrefixedHexString(undefined)).toBe(false);
    expect((chat as any).utils.isPrefixedHexString({})).toBe(false);
    expect((chat as any).utils.isPrefixedHexString([])).toBe(false);
  });

  it('should return false for an empty string', () => {
    const result = (chat as any).utils.isPrefixedHexString('');
    expect(result).toBe(false);
  });

  it('should return false for improperly prefixed string (e.g., "0x" only)', () => {
    const result = (chat as any).utils.isPrefixedHexString('0x');
    expect(result).toBe(false);
  });
});
