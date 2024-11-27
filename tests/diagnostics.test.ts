import { SwarmChat } from "../src/core";


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