import { Signature, Wallet } from "ethers";
import { SwarmChat } from "../src/core";
import { EthAddress } from "../src/types";
import { BatchId } from "@ethersphere/bee-js";
import { HOUR } from "../src/constants";
import { initializeNewlyRegisteredWith3Users } from "./fixtures";


describe('startActivityAnalyses', () => {
  let chat: SwarmChat;

  beforeEach(() => {
    chat = new SwarmChat();
    jest.useRealTimers();
  });

  it('should periodically call removeIdleUsers', () => {
    jest.useFakeTimers();
    const removeIdleUsersSpy = jest.spyOn(chat as any, 'removeIdleUsers');
    const topic = 'example-topic';
    const ownAddress = Wallet.createRandom().address as EthAddress;
    const stamp = "000" as BatchId

    (chat as any).startActivityAnalyzes(topic, ownAddress, stamp);
    jest.advanceTimersByTime(chat.getDiagnostics().removeInactiveUsersInterval);

    expect(removeIdleUsersSpy).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(chat.getDiagnostics().removeInactiveUsersInterval);
    expect(removeIdleUsersSpy).toHaveBeenCalledTimes(2);
  });
});


describe('updateUserActivityAtRegistration', () => {
  let chat: SwarmChat;
  
  beforeEach(() => {
    chat = new SwarmChat();
    
    jest.useRealTimers();
  });

  it('should add the new users to the userActivityTable', async () => {
    let loggerInfoSpy = jest.spyOn(chat['logger'], 'info');
    const newUsers = await initializeNewlyRegisteredWith3Users()
    chat['newlyRegisteredUsers'] = newUsers;

    (chat as any).updateUserActivityAtRegistration();

    // Test all users were added correctly
    newUsers.forEach(user => {
      const activityEntry = chat.getDiagnostics().userActivityTable[user.address];
      expect(activityEntry).toEqual({
        timestamp: user.timestamp,
        readFails: 0
      });
    });

    // Verify logging
    expect(loggerInfoSpy).toHaveBeenCalledTimes(3);
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining(`New user registered. Inserting ${newUsers[0].timestamp} to ${newUsers[0].address}`)
    );
  });

  it('should update the timestamp when user re-registers', async () => {
    const newUsers = await initializeNewlyRegisteredWith3Users()
    chat['newlyRegisteredUsers'] = newUsers;

    (chat as any).updateUserActivityAtRegistration();

    expect(chat.getDiagnostics().userActivityTable[newUsers[0].address].timestamp).toBe(newUsers[0].timestamp);

    const now = Date.now()
    chat['newlyRegisteredUsers'][0].timestamp = now;
    (chat as any).updateUserActivityAtRegistration();

    expect(chat.getDiagnostics().userActivityTable[newUsers[0].address].timestamp).toBe(now);
  });

  it('should handle empty newlyRegisteredUsers array', () => {
    chat['newlyRegisteredUsers'] = [];
    
    (chat as any).updateUserActivityAtRegistration();
    
    expect(Object.keys(chat.getDiagnostics().userActivityTable)).toHaveLength(0);
  });

  it('should handle errors gracefully', async () => {
    const handleErrorSpy = jest.spyOn(chat as any, 'handleError');
    const error = new Error('Test error');
    
    chat['newlyRegisteredUsers'] = undefined as any;

    (chat as any).updateUserActivityAtRegistration();

    expect(handleErrorSpy).toHaveBeenCalledWith({
      error: expect.any(Error),
      context: 'updateUserActivityAtRegistration',
      throw: false
    });
  });
});