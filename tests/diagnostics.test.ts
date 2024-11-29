import pino from "pino";
import { SwarmChat } from "../src/core";
import { RunningAverage } from "../src/utils";
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


describe('sleep', () => {
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


describe('assertHexString', () => {
  let chat = new SwarmChat();

  it('should pass for a valid hexadecimal string with the correct length', () => {
    expect(() => {
      (chat as any).utils.assertHexString('1a2b3c', 6);
    }).not.toThrow();
  });

  it('should pass for a valid hexadecimal string without specifying length', () => {
    expect(() => {
      (chat as any).utils.assertHexString('1a2b3c');
    }).not.toThrow();
  });

  it('should throw an error for a string with 0x prefix', () => {
    expect(() => {
      (chat as any).utils.assertHexString('0x1a2b3c');
    }).toThrow(TypeError);
    expect(() => {
      (chat as any).utils.assertHexString('0x1a2b3c');
    }).toThrow(/not valid non prefixed hex string \(has 0x prefix\)/);
  });

  it('should throw an error for a string with invalid characters', () => {
    expect(() => {
      (chat as any).utils.assertHexString('1a2z3c');
    }).toThrow(TypeError);
    expect(() => {
      (chat as any).utils.assertHexString('1a2z3c');
    }).toThrow(/not valid hex string/);
  });

  it('should throw an error for a string of incorrect length', () => {
    expect(() => {
      (chat as any).utils.assertHexString('1a2b3c', 4);
    }).toThrow(TypeError);
    expect(() => {
      (chat as any).utils.assertHexString('1a2b3c', 4);
    }).toThrow(/not valid hex string of length 4/);
  });

  it('should throw an error for non-string inputs', () => {
    expect(() => {
      (chat as any).utils.assertHexString(12345);
    }).toThrow(TypeError);
    expect(() => {
      (chat as any).utils.assertHexString(null);
    }).toThrow(TypeError);
    expect(() => {
      (chat as any).utils.assertHexString(undefined);
    }).toThrow(TypeError);
    expect(() => {
      (chat as any).utils.assertHexString({});
    }).toThrow(TypeError);
    expect(() => {
      (chat as any).utils.assertHexString([]);
    }).toThrow(TypeError);
  });

  it('should include the custom name in the error message', () => {
    expect(() => {
      (chat as any).utils.assertHexString('1a2z3c', undefined, 'customName');
    }).toThrow(/customName not valid hex string/);

    expect(() => {
      (chat as any).utils.assertHexString('0x1a2b3c', undefined, 'customName');
    }).toThrow(/customName not valid non prefixed hex string/);
  });
});


describe('hexToBytes', () => {
  let chat = new SwarmChat();

  it('should convert a valid hexadecimal string to a byte array', () => {
    const hexString = '1a2b3c4d';
    const expectedBytes = new Uint8Array([0x1a, 0x2b, 0x3c, 0x4d]);

    const result = (chat as any).utils.hexToBytes(hexString);

    expect(result).toEqual(expectedBytes);
  });

  it('should throw an error for a string with invalid characters', () => {
    const invalidHex = '1a2z3c';

    expect(() => {
      (chat as any).utils.hexToBytes(invalidHex);
    }).toThrow(/not valid hex string/);
  });

  it('should throw an error for a string with 0x prefix', () => {
    const prefixedHex = '0x1a2b3c';

    expect(() => {
      (chat as any).utils.hexToBytes(prefixedHex);
    }).toThrow(/not valid non prefixed hex string/);
  });

  it('should handle a large valid hexadecimal string', () => {
    const hexString = 'a'.repeat(64); // 32 bytes
    const expectedBytes = new Uint8Array(
      Array(32).fill(0xaa) // 'aa' in hex is 170 in decimal
    );

    const result = (chat as any).utils.hexToBytes(hexString);

    expect(result).toEqual(expectedBytes);
  });

  it('should call assertHexString to validate input', () => {
    const hexString = '1a2b3c4d';
    const assertHexStringSpy = jest.spyOn((chat as any).utils, 'assertHexString');

    (chat as any).utils.hexToBytes(hexString);

    expect(assertHexStringSpy).toHaveBeenCalledWith(hexString);
  });
});


describe('bytesToHex', () => {
  let chat = new SwarmChat();

  it('should convert a byte array to a valid hex string', () => {
    const bytes = new Uint8Array([0x1a, 0x2b, 0x3c, 0x4d]);
    const expectedHex = '1a2b3c4d';

    const result = (chat as any).utils.bytesToHex(bytes);

    expect(result).toBe(expectedHex);
  });

  it('should handle an empty byte array', () => {
    const bytes = new Uint8Array([]);
    const expectedHex = '';

    const result = (chat as any).utils.bytesToHex(bytes);

    expect(result).toBe(expectedHex);
  });

  it('should throw an error if the resulting hex string does not match the expected length', () => {
    const bytes = new Uint8Array([0x1a, 0x2b, 0x3c, 0x4d]);
    const expectedLength = 6;

    expect(() => {
      (chat as any).utils.bytesToHex(bytes, expectedLength);
    }).toThrow(
      `Resulting HexString does not have expected length ${expectedLength}: 1a2b3c4d`
    );
  });

  it('should not throw an error if the resulting hex string matches the expected length', () => {
    const bytes = new Uint8Array([0x1a, 0x2b, 0x3c, 0x4d]);
    const expectedLength = 8;

    expect(() => {
      (chat as any).utils.bytesToHex(bytes, expectedLength);
    }).not.toThrow();
  });

  it('should handle a large byte array', () => {
    const bytes = new Uint8Array(Array(32).fill(0xaa));
    const expectedHex = 'aa'.repeat(32);

    const result = (chat as any).utils.bytesToHex(bytes);

    expect(result).toBe(expectedHex);
  });

  it('should convert a byte array with values from 0 to 255', () => {
    const bytes = new Uint8Array([0x00, 0x7f, 0x80, 0xff]);
    const expectedHex = '007f80ff';

    const result = (chat as any).utils.bytesToHex(bytes);

    expect(result).toBe(expectedHex);
  });

  it('should pad single-digit hex values with a leading zero', () => {
    const bytes = new Uint8Array([0x1, 0xa]);
    const expectedHex = '010a';

    const result = (chat as any).utils.bytesToHex(bytes);

    expect(result).toBe(expectedHex);
  });
});


describe('RunningAverage.addValue', () => {
  let logger: pino.Logger;

  beforeEach(() => {
    logger = pino({ level: 'silent' });
  });

  it('should add new value to the array', () => {
    let avg = new RunningAverage(50, logger);

    expect(avg['values'].length).toBe(0);
    avg.addValue(3);
    expect(avg['values'].length).toBe(1);
    expect(avg['values'][0]).toBe(3);
  });

  it('should maintain the maximum size of the array', () => {
    const maxSize = 3;
    let avg = new RunningAverage(maxSize, logger);

    avg.addValue(1);
    avg.addValue(2);
    avg.addValue(3);
    avg.addValue(4);

    expect(avg['values'].length).toBe(maxSize);
    expect(avg['values']).toEqual([2, 3, 4]);
  });

  it('should correctly update the sum when adding values', () => {
    let avg = new RunningAverage(50, logger);

    avg.addValue(10);
    expect(avg['sum']).toBe(10);

    avg.addValue(20);
    expect(avg['sum']).toBe(30);
  });

  it('should correctly update the sum when removing oldest value', () => {
    const maxSize = 3;
    let avg = new RunningAverage(maxSize, logger);

    avg.addValue(10);
    avg.addValue(20);
    avg.addValue(30);
    avg.addValue(40);

    expect(avg['values']).toEqual([20, 30, 40]);
    expect(avg['sum']).toBe(90);
  });

  it('should handle adding multiple values up to max size', () => {
    const maxSize = 5;
    let avg = new RunningAverage(maxSize, logger);

    for (let i = 1; i <= 5; i++) {
      avg.addValue(i * 10);
    }

    expect(avg['values'].length).toBe(maxSize);
    expect(avg['values']).toEqual([10, 20, 30, 40, 50]);
    expect(avg['sum']).toBe(150);
  });

  it('should call logger.info with the current average', () => {
    const loggerInfoSpy = jest.spyOn(logger, 'info');
    
    let avg = new RunningAverage(50, logger);
    avg.addValue(100);

    expect(loggerInfoSpy).toHaveBeenCalledWith(`Current average:  100`);

    loggerInfoSpy.mockRestore();
  });
});


describe('RunningAverage.getAverage', () => {
  let logger: pino.Logger;

  beforeEach(() => {
    logger = pino({ level: 'silent' });
  });

  it('should return 200 when no values have been added', () => {
    const avg = new RunningAverage(50, logger);
    expect(avg.getAverage()).toBe(200);
  });

  it('should calculate the average of a single value', () => {
    const avg = new RunningAverage(50, logger);
    avg.addValue(100);
    expect(avg.getAverage()).toBe(100);
  });

  it('should calculate the average of multiple values', () => {
    const avg = new RunningAverage(50, logger);
    avg.addValue(10);
    avg.addValue(20);
    avg.addValue(30);
    expect(avg.getAverage()).toBe(20);
  });

  it('should maintain correct average when max size is reached', () => {
    const maxSize = 3;
    const avg = new RunningAverage(maxSize, logger);
    
    avg.addValue(10);
    avg.addValue(20);
    avg.addValue(30);
    avg.addValue(40);

    // Expected average of [20, 30, 40]
    expect(avg.getAverage()).toBe(30);
  });

  it('should handle adding values beyond the max size', () => {
    const maxSize = 3;
    const avg = new RunningAverage(maxSize, logger);
    
    avg.addValue(10);
    avg.addValue(20);
    avg.addValue(30);
    avg.addValue(40);
    avg.addValue(50);
    avg.addValue(60);

    // Expected average of the last 3 values
    expect(avg.getAverage()).toBe(50);
  });

  it('should work with decimal values', () => {
    const avg = new RunningAverage(50, logger);
    avg.addValue(10.5);
    avg.addValue(20.5);
    avg.addValue(30.5);
    expect(avg.getAverage()).toBe(20.5);
  });

  it('should handle large numbers of values within max size', () => {
    const maxSize = 10;
    const avg = new RunningAverage(maxSize, logger);
    
    for (let i = 1; i <= 10; i++) {
      avg.addValue(i * 10);
    }

    expect(avg.getAverage()).toBe(55);
  });
});


describe('generateHash', () => {
  let chat: SwarmChat;

  beforeEach(() => {
    chat = new SwarmChat();
  });

  it('should generate a SHA-256 hash from the input string', async () => {
    const seedString = 'test-seed';
    const expectedHash = 'd63cd08d82aa4eb48e0cc64fb466e909bfc3879664c5caa8d8cdeda73c044190';

    const hash = await (chat as any).utils['generateHash'](seedString);

    expect(hash).toBe(expectedHash);
  });

  it('should handle empty strings correctly', async () => {
    const seedString = '';
    const expectedHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    const hash = await (chat as any).utils['generateHash'](seedString);

    expect(hash).toBe(expectedHash);
  });

  it('should generate different hashes for different input strings', async () => {
    const seedString1 = 'string1';
    const seedString2 = 'string2';

    const hash1 = await (chat as any).utils['generateHash'](seedString1);
    const hash2 = await (chat as any).utils['generateHash'](seedString2);

    expect(hash1).not.toBe(hash2);
  });
});