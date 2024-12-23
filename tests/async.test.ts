import { AsyncQueue } from "../src/asyncQueue";
import pino from "pino";
import { FIRST_SEGMENT_INDEX } from "../src/constants";
import { ErrorObject } from "../src/types";

describe('AsyncQueue.constructor', () => {
  let mockHandleError: jest.Mock<void, [any]>;
  let logger: pino.Logger;

  beforeEach(() => {
    mockHandleError = jest.fn();
    logger = pino({ level: 'silent' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize with default settings when no parameters are passed', () => {
    const queue = new AsyncQueue({}, mockHandleError, logger);

    expect(queue).toHaveProperty('index', FIRST_SEGMENT_INDEX);
    expect(queue).toHaveProperty('waitable', false);
    expect(queue).toHaveProperty('clearWaitTime', 100);
    expect(queue).toHaveProperty('maxParallel', 5);
    expect(queue).toHaveProperty('queue', []);
    expect(queue).toHaveProperty('isProcessing', false);
    expect(queue).toHaveProperty('inProgressCount', 0);
    expect(queue).toHaveProperty('isWaiting', false);
  });

  it('should initialize with custom settings when parameters are provided', () => {
    const customSettings = {
      index: '00000001',
      waitable: true,
      clearWaitTime: 200,
      max: 10,
    };
    const queue = new AsyncQueue(customSettings, mockHandleError, logger);

    expect(queue).toHaveProperty('index', '00000001');
    expect(queue).toHaveProperty('waitable', true);
    expect(queue).toHaveProperty('clearWaitTime', 200);
    expect(queue).toHaveProperty('maxParallel', 10);
  });

  it('should set handleError and logger correctly', () => {
    const queue = new AsyncQueue({}, mockHandleError, logger);

    // Private properties can be tested indirectly if needed
    // For example, enqueue calls handleError in some cases
    expect(queue).toHaveProperty('handleError', mockHandleError);
    expect(queue).toHaveProperty('logger', logger);
  });

  it('should fall back to default values for undefined settings', () => {
    const queue = new AsyncQueue({ index: undefined, waitable: undefined, clearWaitTime: undefined, max: undefined }, mockHandleError, logger);

    expect(queue).toHaveProperty('index', FIRST_SEGMENT_INDEX);
    expect(queue).toHaveProperty('waitable', false);
    expect(queue).toHaveProperty('clearWaitTime', 100);
    expect(queue).toHaveProperty('maxParallel', 5);
  });
});


describe('AsyncQueue.processQueue', () => {
  let mockHandleError: jest.Mock<void, [any]>;
  let logger: pino.Logger;
  let asyncQueue: AsyncQueue;

  beforeEach(() => {
    mockHandleError = jest.fn();
    logger = pino({ level: 'silent' });
    asyncQueue = new AsyncQueue({}, mockHandleError, logger);
  });

  it('should process promises in the queue successfully', async () => {
    const mockPromise = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    asyncQueue.enqueue(() => mockPromise());
    asyncQueue.enqueue(() => mockPromise());

    // Wait for the queue to process
    await asyncQueue.waitForProcessing();

    expect(mockPromise).toHaveBeenCalledTimes(2);

    expect(asyncQueue['inProgressCount']).toBe(0);
    expect(asyncQueue).toHaveProperty('isProcessing', false);
  }, 25000);
});


describe('AsyncQueue.enqueue', () => {
  let mockHandleError: jest.Mock<void, [ErrorObject]>;
  let logger: pino.Logger;
  let asyncQueue: AsyncQueue;

  beforeEach(() => {
    mockHandleError = jest.fn();
    logger = pino({ level: 'silent' });
    asyncQueue = new AsyncQueue({}, mockHandleError, logger);
  });

  it('should add a promise to the queue and process it', async () => {
    const mockPromise = jest.fn().mockResolvedValue(null);

    asyncQueue.enqueue(() => mockPromise());

    await asyncQueue.waitForProcessing();

    expect(mockPromise).toHaveBeenCalledTimes(1);
    expect(asyncQueue).toHaveProperty('queue', []);
    expect(asyncQueue).toHaveProperty('inProgressCount', 0);
  });

  it('should process promises in the order they are enqueued', async () => {
    const results: string[] = [];
    const promise1 = jest.fn().mockImplementation(() => {
      results.push('first');
      return Promise.resolve();
    });
    const promise2 = jest.fn().mockImplementation(() => {
      results.push('second');
      return Promise.resolve();
    });

    asyncQueue.enqueue(() => promise1());
    asyncQueue.enqueue(() => promise2());

    await asyncQueue.waitForProcessing();

    expect(results).toEqual(['first', 'second']);
    expect(asyncQueue).toHaveProperty('queue', []);
    expect(asyncQueue).toHaveProperty('inProgressCount', 0);
  });

  it('should respect maxParallel limit', async () => {
    asyncQueue = new AsyncQueue({ max: 2 }, mockHandleError, logger); // Set maxParallel to 2
  
    const mockPromise = jest.fn().mockImplementation(() =>
      new Promise((resolve) => setTimeout(resolve, 50)) // Simulate asynchronous work
    );
  
    asyncQueue.enqueue(() => mockPromise());
    asyncQueue.enqueue(() => mockPromise());
    asyncQueue.enqueue(() => mockPromise()); // Exceeds maxParallel limit
  
    // Wait long enough for all promises to resolve
    await asyncQueue.waitForProcessing();
  
    expect(mockPromise).toHaveBeenCalledTimes(2);
  
    expect(asyncQueue['inProgressCount']).toBe(0);
  });

  it('should increment index on successful promise completion', async () => {
    const mockPromise = jest.fn().mockResolvedValue(null);
    const initialIndex = asyncQueue['index'];

    asyncQueue.enqueue(() => mockPromise());

    await asyncQueue.waitForProcessing();

    expect(asyncQueue['index']).not.toBe(initialIndex);
    expect(mockPromise).toHaveBeenCalledTimes(1);
  });

  it('should handle promise rejection and call handleError', async () => {
    const mockError = new Error("Test error");
    const mockPromise = jest.fn().mockRejectedValue(mockError);

    asyncQueue.enqueue(() => mockPromise());

    await asyncQueue.waitForProcessing();

    expect(mockHandleError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: mockError,
        context: 'Error processing promise',
        throw: false,
      })
    );
    expect(mockPromise).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple enqueues and process all promises', async () => {
    const mockPromise1 = jest.fn().mockResolvedValue(null);
    const mockPromise2 = jest.fn().mockResolvedValue(null);

    asyncQueue.enqueue(() => mockPromise1());
    asyncQueue.enqueue(() => mockPromise2());

    await asyncQueue.waitForProcessing();

    expect(mockPromise1).toHaveBeenCalledTimes(1);
    expect(mockPromise2).toHaveBeenCalledTimes(1);
    expect(asyncQueue).toHaveProperty('queue', []);
  });

  it('should not crash if an empty function is enqueued', async () => {
    const emptyFunction = jest.fn().mockResolvedValue(null);

    asyncQueue.enqueue(emptyFunction);

    await asyncQueue.waitForProcessing();

    expect(emptyFunction).toHaveBeenCalledTimes(1);
  });

  it('should process promises when waitable is true', async () => {
    asyncQueue = new AsyncQueue({ waitable: true }, mockHandleError, logger);

    const mockPromise = jest.fn().mockResolvedValue(null);

    asyncQueue.enqueue(() => mockPromise());

    await asyncQueue.waitForProcessing();

    expect(mockPromise).toHaveBeenCalledTimes(1);
  });
});


describe('AsyncQueue.increaseMax', () => {
  let asyncQueue: AsyncQueue;
  let mockHandleError: jest.Mock;

  beforeEach(() => {
    mockHandleError = jest.fn();
    const logger = pino({ level: 'silent' });
    asyncQueue = new AsyncQueue({ max: 5 }, mockHandleError, logger); // Start with maxParallel = 5
  });

  it('should increase maxParallel by 1 if within the limit', () => {
    asyncQueue.increaseMax(10);
    expect(asyncQueue.getMaxParallel()).toBe(6);

    asyncQueue.increaseMax(10);
    expect(asyncQueue.getMaxParallel()).toBe(7);
  });

  it('should not increase maxParallel beyond the limit', () => {
    asyncQueue.increaseMax(6);
    expect(asyncQueue.getMaxParallel()).toBe(6);

    asyncQueue.increaseMax(6);
    expect(asyncQueue.getMaxParallel()).toBe(6);
  });
});


describe('AsyncQueue.decreaseMax', () => {
  let asyncQueue: AsyncQueue;
  let mockHandleError: jest.Mock;

  beforeEach(() => {
    mockHandleError = jest.fn();
    const logger = pino({ level: 'silent' });
    asyncQueue = new AsyncQueue({ max: 5 }, mockHandleError, logger);
  });

  it('should decrease maxParallel by 1 if greater than 1', () => {
    asyncQueue.decreaseMax();
    expect(asyncQueue.getMaxParallel()).toBe(4);

    asyncQueue.decreaseMax();
    expect(asyncQueue.getMaxParallel()).toBe(3);
  });

  it('should not decrease maxParallel below 1', () => {
    asyncQueue = new AsyncQueue({ max: 1 }, mockHandleError, pino({ level: 'silent' }));
    asyncQueue.decreaseMax();
    expect(asyncQueue.getMaxParallel()).toBe(1);
  });
});


describe('AsyncQueue.clearQueue', () => {
  let asyncQueue: AsyncQueue;
  let logger: pino.Logger;
  let handleError: jest.Mock;

  beforeEach(() => {
    handleError = jest.fn();
    logger = pino({ level: 'silent' });
    asyncQueue = new AsyncQueue({}, handleError, logger);
  });

  it('should clear the queue immediately if no tasks are in progress', async () => {
    asyncQueue.enqueue(() => Promise.resolve());
    asyncQueue['queue'] = [jest.fn(), jest.fn(), jest.fn()];
    asyncQueue['inProgressCount'] = 0;
    asyncQueue['isProcessing'] = false;

    await asyncQueue.clearQueue();

    expect(asyncQueue['queue']).toEqual([]);
  });

  it('should wait for in-progress tasks to finish before clearing', async () => {
    // Create a deferred promise that we can manually control
    let taskResolved = false;
    const slowTask = () => new Promise<void>((resolve) => {
      setTimeout(() => {
        taskResolved = true;
        resolve();
      }, 50);
    });

    asyncQueue.enqueue(slowTask);

    const clearQueuePromise = asyncQueue.clearQueue();

    expect(asyncQueue['queue'].length).toBe(0);

    await clearQueuePromise;

    expect(taskResolved).toBe(true);
  });
});


describe('AsyncQueue.waitForProcessing', () => {
  let asyncQueue: AsyncQueue;
  let logger: pino.Logger;
  let handleError: jest.Mock;

  beforeEach(() => {
    handleError = jest.fn();
    logger = pino({ level: 'silent' });
    asyncQueue = new AsyncQueue({}, handleError, logger);
  });

  it('should resolve immediately if no tasks are in progress', async () => {
    asyncQueue['isProcessing'] = false;
    asyncQueue['inProgressCount'] = 0;

    const startTime = Date.now();
    await asyncQueue.waitForProcessing();
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(50);
  });
});


describe('AsyncQueue.incrementHexString', () => {
  let asyncQueue: AsyncQueue;
  let logger: pino.Logger;
  let handleError: jest.Mock;

  beforeEach(() => {
    handleError = jest.fn();
    logger = pino({ level: 'silent' });
    asyncQueue = new AsyncQueue({}, handleError, logger);
  });

  it('should increment a simple hex string by default', () => {
    expect(asyncQueue.incrementHexString('a')).toBe('000000000000000b');
    expect(asyncQueue.incrementHexString('f')).toBe('0000000000000010');
  });

  it('should increment a multi-character hex string', () => {
    expect(asyncQueue.incrementHexString('ff')).toBe('0000000000000100');
    expect(asyncQueue.incrementHexString('123')).toBe('0000000000000124');
  });

  it('should increment by a specified amount', () => {
    expect(asyncQueue.incrementHexString('a', 2n)).toBe('000000000000000c');
    expect(asyncQueue.incrementHexString('ff', 3n)).toBe('0000000000000102');
  });

  it('should increment zero correctly', () => {
    expect(asyncQueue.incrementHexString('0')).toBe('0000000000000001');
    expect(asyncQueue.incrementHexString('00')).toBe('0000000000000001');
  });
});


describe('AsyncQueue.sleep', () => {
  let asyncQueue: AsyncQueue;
  let logger: pino.Logger;
  let handleError: jest.Mock;

  beforeEach(() => {
    handleError = jest.fn();
    logger = pino({ level: 'silent' });
    asyncQueue = new AsyncQueue({}, handleError, logger);
  });

  it('should return a Promise', () => {
    const sleepPromise = asyncQueue.sleep(1000);
    expect(sleepPromise).toBeInstanceOf(Promise);
  });

  it('should resolve after the specified delay', async () => {
    jest.useFakeTimers();
    const mockCallback = jest.fn();
    
    const sleepPromise = asyncQueue.sleep(1000).then(mockCallback);
    
    expect(mockCallback).not.toHaveBeenCalled();
    
    jest.advanceTimersByTime(999);
    expect(mockCallback).not.toHaveBeenCalled();
    
    jest.advanceTimersByTime(1);
    
    await sleepPromise;
    
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('should work with different delay times', async () => {
    jest.useFakeTimers();
    const delays = [0, 100, 500, 1000];
    
    for (const delay of delays) {
      const mockCallback = jest.fn();
      
      const sleepPromise = asyncQueue.sleep(delay).then(mockCallback);
      
      jest.advanceTimersByTime(delay);
      
      await sleepPromise;
      
      expect(mockCallback).toHaveBeenCalledTimes(1);
    }
  });

  it('should handle very short delays', async () => {
    jest.useFakeTimers();
    const mockCallback = jest.fn();
    
    const sleepPromise = asyncQueue.sleep(0).then(mockCallback);
    
    jest.advanceTimersByTime(0);
    
    await sleepPromise;
    
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });
});