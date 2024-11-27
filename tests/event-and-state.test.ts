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