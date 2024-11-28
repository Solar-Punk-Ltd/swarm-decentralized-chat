import { AsyncQueue } from "../src/asyncQueue";
import pino from "pino";
import { FIRST_SEGMENT_INDEX } from "../src/constants";

describe('AsyncQueue.constructor', () => {
  let mockHandleError: jest.Mock<void, [any]>;
  let logger: pino.Logger;

  beforeEach(() => {
    mockHandleError = jest.fn();
    logger = pino({ level: 'silent' });
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
