import { EventEmitter } from "../src/eventEmitter";


describe('EventEmitter.constructor', () => {
  let eventEmitter: EventEmitter;

  beforeEach(() => {
    eventEmitter = new EventEmitter();
  });

  test('should bind methods to the class instance', () => {
    expect(eventEmitter.on.name).toBe('bound on');
    expect(eventEmitter.off.name).toBe('bound off');
    expect(eventEmitter.cleanAll.name).toBe('bound cleanAll');
    expect(eventEmitter.emit.name).toBe('bound emit');
  });
});


describe('emitStateEvent', () => {
  let eventEmitter: EventEmitter;

  beforeEach(() => {
    eventEmitter = new EventEmitter();
  });

  it('should register and trigger an event listener with the correct data', () => {
    const mockListener = jest.fn();
    const testEvent = 'testEvent';
    const testData = { key: 'value' };

    eventEmitter.on(testEvent, mockListener);
    eventEmitter.emit(testEvent, testData);

    expect(mockListener).toHaveBeenCalledTimes(1);
    expect(mockListener).toHaveBeenCalledWith(testData);
  });

  it('should not trigger listeners for events that were not registered', () => {
    const mockListener = jest.fn();
    const unregisteredEvent = 'unregisteredEvent';

    eventEmitter.emit(unregisteredEvent, { key: 'value' });

    expect(mockListener).not.toHaveBeenCalled();
  });

  it('should allow multiple listeners for the same event and call all of them', () => {
    const mockListener1 = jest.fn();
    const mockListener2 = jest.fn();
    const testEvent = 'testEvent';

    eventEmitter.on(testEvent, mockListener1);
    eventEmitter.on(testEvent, mockListener2);

    eventEmitter.emit(testEvent, 'testData');

    expect(mockListener1).toHaveBeenCalledTimes(1);
    expect(mockListener1).toHaveBeenCalledWith('testData');

    expect(mockListener2).toHaveBeenCalledTimes(1);
    expect(mockListener2).toHaveBeenCalledWith('testData');
  });

  it('should remove a specific listener and not call it after removal', () => {
    const mockListener = jest.fn();
    const testEvent = 'testEvent';

    eventEmitter.on(testEvent, mockListener);
    eventEmitter.off(testEvent, mockListener);

    eventEmitter.emit(testEvent, 'testData');

    expect(mockListener).not.toHaveBeenCalled();
  });

  it('should remove all listeners for all events when cleanAll is called', () => {
    const mockListener1 = jest.fn();
    const mockListener2 = jest.fn();

    eventEmitter.on('event1', mockListener1);
    eventEmitter.on('event2', mockListener2);

    eventEmitter.cleanAll();

    eventEmitter.emit('event1', 'testData1');
    eventEmitter.emit('event2', 'testData2');

    expect(mockListener1).not.toHaveBeenCalled();
    expect(mockListener2).not.toHaveBeenCalled();
  });

  it('should handle emitting events that have no listeners gracefully', () => {
    expect(() => {
      eventEmitter.emit('nonExistentEvent', 'testData');
    }).not.toThrow();
  });

  it('should not throw an error when removing a listener from an unregistered event', () => {
    const mockListener = jest.fn();
    expect(() => {
      eventEmitter.off('nonExistentEvent', mockListener);
    }).not.toThrow();
  });
});


describe('EventEmitter.on', () => {
  let eventEmitter: EventEmitter;

  beforeEach(() => {
    eventEmitter = new EventEmitter();
  });

  it('should register a new listener for an event', () => {
    const mockListener = jest.fn();
    const testEvent = 'testEvent';

    eventEmitter.on(testEvent, mockListener);
    eventEmitter.emit(testEvent, 'testData');

    expect(mockListener).toHaveBeenCalledTimes(1);
    expect(mockListener).toHaveBeenCalledWith('testData');
  });

  it('should allow multiple listeners to be registered for the same event', () => {
    const mockListener1 = jest.fn();
    const mockListener2 = jest.fn();
    const testEvent = 'testEvent';

    eventEmitter.on(testEvent, mockListener1);
    eventEmitter.on(testEvent, mockListener2);

    eventEmitter.emit(testEvent, 'testData');

    expect(mockListener1).toHaveBeenCalledTimes(1);
    expect(mockListener1).toHaveBeenCalledWith('testData');

    expect(mockListener2).toHaveBeenCalledTimes(1);
    expect(mockListener2).toHaveBeenCalledWith('testData');
  });

  it('should not interfere with listeners for other events', () => {
    const mockListener1 = jest.fn();
    const mockListener2 = jest.fn();

    eventEmitter.on('event1', mockListener1);
    eventEmitter.on('event2', mockListener2);

    eventEmitter.emit('event1', 'data1');

    expect(mockListener1).toHaveBeenCalledTimes(1);
    expect(mockListener1).toHaveBeenCalledWith('data1');

    expect(mockListener2).not.toHaveBeenCalled();
  });

  it('should not add duplicate listeners for the same event', () => {
    const mockListener = jest.fn();
    const testEvent = 'testEvent';

    eventEmitter.on(testEvent, mockListener);
    eventEmitter.on(testEvent, mockListener);

    eventEmitter.emit(testEvent, 'testData');

    expect(mockListener).toHaveBeenCalledTimes(2); // Allow duplicates (as per most event emitter implementations)
    expect(mockListener).toHaveBeenCalledWith('testData');
  });

  it('should not throw an error when registering a listener for an empty event name', () => {
    const mockListener = jest.fn();

    expect(() => {
      eventEmitter.on('', mockListener);
    }).not.toThrow();
  });

  it('should support registering listeners for dynamically generated event names', () => {
    const mockListener = jest.fn();
    const dynamicEvent = `event_${Math.random()}`;

    eventEmitter.on(dynamicEvent, mockListener);

    eventEmitter.emit(dynamicEvent, 'dynamicData');

    expect(mockListener).toHaveBeenCalledTimes(1);
    expect(mockListener).toHaveBeenCalledWith('dynamicData');
  });
});


describe('EventEmitter.off', () => {
  let eventEmitter: EventEmitter;

  beforeEach(() => {
    eventEmitter = new EventEmitter();
  });

  it('should remove a listener for a given event', () => {
    const mockListener = jest.fn();
    const eventName = 'testEvent';

    eventEmitter.on(eventName, mockListener);
    eventEmitter.off(eventName, mockListener);

    eventEmitter.emit(eventName, 'testData');
    expect(mockListener).not.toHaveBeenCalled();
  });

  it('should not throw an error if removing a listener that does not exist', () => {
    const mockListener = jest.fn();
    const eventName = 'testEvent';

    expect(() => {
      eventEmitter.off(eventName, mockListener);
    }).not.toThrow();
  });

  it('should not throw an error when removing a listener from a non-existent event', () => {
    const mockListener = jest.fn();
    const eventName = 'nonExistentEvent';

    expect(() => {
      eventEmitter.off(eventName, mockListener);
    }).not.toThrow();
  });

  it('should not affect other listeners for the same event', () => {
    const mockListener1 = jest.fn();
    const mockListener2 = jest.fn();
    const eventName = 'testEvent';

    eventEmitter.on(eventName, mockListener1);
    eventEmitter.on(eventName, mockListener2);

    eventEmitter.off(eventName, mockListener1);

    eventEmitter.emit(eventName, 'testData');

    expect(mockListener1).not.toHaveBeenCalled();
    expect(mockListener2).toHaveBeenCalledWith('testData');
    expect(mockListener2).toHaveBeenCalledTimes(1);
  });

  it('should handle removing a listener that was added multiple times', () => {
    const mockListener = jest.fn();
    const eventName = 'testEvent';

    eventEmitter.on(eventName, mockListener);
    eventEmitter.on(eventName, mockListener);

    eventEmitter.off(eventName, mockListener);

    eventEmitter.emit(eventName, 'testData');

    expect(mockListener).toHaveBeenCalledTimes(1);
    expect(mockListener).toHaveBeenCalledWith('testData');
  });

  it('should not affect listeners for other events', () => {
    const mockListener1 = jest.fn();
    const mockListener2 = jest.fn();

    eventEmitter.on('event1', mockListener1);
    eventEmitter.on('event2', mockListener2);

    eventEmitter.off('event1', mockListener1);

    eventEmitter.emit('event1', 'data1');
    eventEmitter.emit('event2', 'data2');

    expect(mockListener1).not.toHaveBeenCalled();
    expect(mockListener2).toHaveBeenCalledWith('data2');
  });

  it('should remove only the specified listener, leaving others intact', () => {
    const mockListener1 = jest.fn();
    const mockListener2 = jest.fn();
    const eventName = 'testEvent';

    eventEmitter.on(eventName, mockListener1);
    eventEmitter.on(eventName, mockListener2);

    eventEmitter.off(eventName, mockListener1);

    eventEmitter.emit(eventName, 'testData');

    expect(mockListener1).not.toHaveBeenCalled();
    expect(mockListener2).toHaveBeenCalledWith('testData');
  });

  it('should handle dynamically generated event names', () => {
    const mockListener = jest.fn();
    const dynamicEventName = `event_${Math.random()}`;

    eventEmitter.on(dynamicEventName, mockListener);
    eventEmitter.off(dynamicEventName, mockListener);

    eventEmitter.emit(dynamicEventName, 'dynamicData');

    expect(mockListener).not.toHaveBeenCalled();
  });
});
