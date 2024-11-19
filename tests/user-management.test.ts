import { Wallet } from "ethers";
import { SwarmChat } from "../src/core";
import { EthAddress, MessageData, User, UserActivity, UserWithIndex } from "../src/types";
import { BatchId } from "@ethersphere/bee-js";
import { createMockActivityTable, userListWithNUsers } from "./fixtures";
import { EVENTS, MINUTE } from "../src/constants";


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
  });

  it('should add the new users to the userActivityTable', async () => {
    let loggerInfoSpy = jest.spyOn(chat['logger'], 'info');
    const newUsers = await userListWithNUsers(3)
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
    const newUsers = await userListWithNUsers(3)
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
    
    chat['newlyRegisteredUsers'] = undefined as any;

    (chat as any).updateUserActivityAtRegistration();

    expect(handleErrorSpy).toHaveBeenCalledWith({
      error: expect.any(Error),
      context: 'updateUserActivityAtRegistration',
      throw: false
    });
  });
});


describe('updateUserActivityAtNewMessage', () => {
  it('should update the timestamp when new message is received', async () => {
    let chat = new SwarmChat();
    let users = await userListWithNUsers(3);

    for (let i = 0; i < users.length; i++) {
      chat['userActivityTable'][users[i].address] = {
        timestamp: users[i].timestamp,
        readFails: 0
      }
    }

    const now = Date.now();
    const message: MessageData = {
      message: "Alice says Hi!",
      username: users[0].username,
      address: users[0].address,
      timestamp: now
    };
    (chat as any).updateUserActivityAtNewMessage(message);

    expect(chat.getDiagnostics().userActivityTable[users[0].address].timestamp).toBe(now);
    expect(chat.getDiagnostics().userActivityTable[users[0].address].readFails).toBe(0);
  });

  it('should handle multiple sequential updates for same user', async () => {
    let chat = new SwarmChat();
    let users = await userListWithNUsers(3);
    
    const timestamps = [Date.now(), Date.now() + 100, Date.now() + 200];
    
    for (const timestamp of timestamps) {
      const message: MessageData = {
        message: `Message at ${timestamp}`,
        username: users[0].username,
        address: users[0].address,
        timestamp: timestamp
      };
      
      (chat as any).updateUserActivityAtNewMessage(message);
      
      const activity = chat.getDiagnostics().userActivityTable[users[0].address];
      expect(activity.timestamp).toBe(timestamp);
      expect(activity.readFails).toBe(0);
    }
  });
});


describe('tryUserFetch', () => {
  it('should not start getNewUsers if userFetchIsRunning is true', () => {
    const chat = new SwarmChat();
    const topic = 'test-topic';
    const getNewUsersSpy = jest.spyOn(chat as any, 'getNewUsers');
    
    (chat as any).userFetchIsRunning = true;
    (chat as any).tryUserFetch(topic);
    
    expect(getNewUsersSpy).not.toHaveBeenCalled();
    
    getNewUsersSpy.mockRestore();
  });

  it('should start getNewUsers if userFetchIsRunning is false', () => {
    const chat = new SwarmChat();
    const topic = 'test-topic';
    const getNewUsersSpy = jest.spyOn(chat as any, 'getNewUsers');
    const consoleSpy = jest.spyOn(console, 'info');
    
    (chat as any).userFetchIsRunning = false;
    (chat as any).tryUserFetch(topic);
    
    expect(getNewUsersSpy).toHaveBeenCalledWith(topic);
    expect(consoleSpy).not.toHaveBeenCalled();
    
    getNewUsersSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('should write log if log level is info', () => {
    const chat = new SwarmChat({ prettier: true, logLevel: 'info' });
    const topic = 'test-topic';
    const consoleSpy = jest.spyOn((chat as any).logger, 'info');
    
    (chat as any).userFetchIsRunning = true;
    (chat as any).tryUserFetch(topic);
    
    expect(consoleSpy).toHaveBeenCalledWith('Previous getNewUsers is still running');
    consoleSpy.mockRestore();
  });
});


describe('setUsers', () => {
  let chat: SwarmChat;

  beforeEach(() => {
    chat = new SwarmChat();
  });

  it('should set users and update loading flag when usersLoading is false', () => {
    const newUsers = [{ address: '0x123', index: 1 }, { address: '0x456', index: 2 }];
    chat['usersLoading'] = false;

    (chat as any).setUsers(newUsers);

    expect(chat['users']).toEqual(newUsers);
    expect(chat['usersLoading']).toBe(false);
  });

  it('should avoid hot loop when usersLoading is true initially', () => {
    const newUsers = [{ address: '0x123', index: 1 }];
    chat['usersLoading'] = true;

    const setUsersSpy = jest.spyOn(chat as any, 'setUsers');

    (chat as any).setUsers(newUsers);

    expect(setUsersSpy).toHaveBeenCalledTimes(1);
    expect(chat['users']).not.toEqual(newUsers);
    expect(chat['usersLoading']).toBe(true);
  });
});


describe('validateUserObject', () => {
  let chat: SwarmChat;
  let handleErrorSpy: jest.SpyInstance;
  let validateUserSpy: jest.SpyInstance;

  beforeEach(() => {
    chat = new SwarmChat();
    handleErrorSpy = jest.spyOn((chat as any).utils, 'handleError');
    validateUserSpy = jest.spyOn((chat as any).utils, 'validateUserObject');
  });

  afterEach(() => {
    handleErrorSpy.mockRestore();
    validateUserSpy.mockRestore();
  });

  it('should validate property types', () => {
    const invalidUsername = { username: 3, address: "0x123", timestamp: 123, signature: "signature" };
    const invalidAddress = { username: "Alice", address: false, timestamp: 123, signature: "signature" };
    const invalidTimestamp = { username: "Alice", address: "0x123", timestamp: "123", signature: "signature" };
    const invalidSignatureType = { username: "Alice", address: "0x123", timestamp: 123, signature: 42 };

    (chat as any).utils.validateUserObject(invalidUsername);
    expect(handleErrorSpy).toHaveBeenCalledWith({
      error: "username should be a string",
      context: 'This User object is not correct',
      throw: false
    });
    handleErrorSpy.mockClear();

    (chat as any).utils.validateUserObject(invalidAddress);
    expect(handleErrorSpy).toHaveBeenCalledWith({
      error: "address should be a string",
      context: 'This User object is not correct',
      throw: false
    });
    handleErrorSpy.mockClear();

    (chat as any).utils.validateUserObject(invalidTimestamp);
    expect(handleErrorSpy).toHaveBeenCalledWith({
      error: "timestamp should be number",
      context: 'This User object is not correct',
      throw: false
    });
    handleErrorSpy.mockClear();

    (chat as any).utils.validateUserObject(invalidSignatureType);
    expect(handleErrorSpy).toHaveBeenCalledWith({
      error: "signature should be a string",
      context: 'This User object is not correct',
      throw: false
    });

    expect(validateUserSpy).toHaveLastReturnedWith(false);

    handleErrorSpy.mockRestore();
  });

  it('should not contain extra properties',  () => {
    const extraProperty = { username: "Alice", address: "0x123", timestamp: 123, signature: "signature", notAllowedExtraProperty: "rabbit" };

    (chat as any).utils.validateUserObject(extraProperty);
    
    expect(handleErrorSpy).toHaveBeenCalledWith({
      error: "Unexpected properties found: notAllowedExtraProperty",
      context: 'This User object is not correct',
      throw: false
    });

    expect(validateUserSpy).toHaveLastReturnedWith(false);
  });

  it('should validate signature', () => {
    const invalidSignature = { 
      username: "Alice",
      address: "0x123",
      timestamp: 123,
      signature: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb1b" };

    (chat as any).utils.validateUserObject(invalidSignature);

    expect(handleErrorSpy).toHaveBeenCalledWith({
      error: "Signature verification failed!",
      context: 'This User object is not correct',
      throw: false
    });

    expect(validateUserSpy).toHaveLastReturnedWith(false);
  });

  it('should accept correct user object', async () => {
    const username = "Alice";
    const wallet = Wallet.createRandom();
    const address = wallet.address;
    const timestamp = Date.now();
    const signature = await wallet.signMessage(
      JSON.stringify({ username, address, timestamp })
    );

    const userObject = {
      username,
      address,
      timestamp,
      signature
    };

    (chat as any).utils.validateUserObject(userObject);

    expect(validateUserSpy).toHaveLastReturnedWith(true);
  });
});


describe('removeDuplicateUsers', () => {
  let chat: SwarmChat;

  beforeEach(() => {
    chat = new SwarmChat();
  });

  it('should remove duplicate users and keep the latest one by timestamp', () => {
    const users = [
      { address: "0x123", username: "Alice", timestamp: 100, index: 1 },
      { address: "0x123", username: "Alice", timestamp: 200, index: 2 },
      { address: "0x456", username: "Bob", timestamp: 150, index: 1 }
    ];

    const result = (chat as any).utils.removeDuplicateUsers(users);

    expect(result).toEqual([
      { address: "0x123", username: "Alice", timestamp: 200, index: 2 },
      { address: "0x456", username: "Bob", timestamp: 150, index: 1 }
    ]);
  });

  it('should keep the one with the higher index if timestamps are the same', () => {
    const users = [
      { address: "0x123", username: "Alice", timestamp: 100, index: 1 },
      { address: "0x123", username: "Alice", timestamp: 100, index: 2 },
      { address: "0x456", username: "Bob", timestamp: 150, index: 1 }
    ];

    const result = (chat as any).utils.removeDuplicateUsers(users);

    expect(result).toEqual([
      { address: "0x123", username: "Alice", timestamp: 100, index: 2 },
      { address: "0x456", username: "Bob", timestamp: 150, index: 1 }
    ]);
  });

  it('should return the same array if there are no duplicate addresses', () => {
    const users = [
      { address: "0x123", username: "Alice", timestamp: 100, index: 1 },
      { address: "0x456", username: "Bob", timestamp: 150, index: 1 },
      { address: "0x789", username: "Carol", timestamp: 200, index: 1 }
    ];

    const result = (chat as any).utils.removeDuplicateUsers(users);

    expect(result).toEqual(users);
  });

  it('should return an empty array if input is empty', () => {
    const users: UserWithIndex[] = [];

    const result = (chat as any).utils.removeDuplicateUsers(users);

    expect(result).toEqual([]);
  });

  it('should handle multiple duplicates and keep the correct entries', () => {
    const users = [
      { address: "0x123", username: "Alice", timestamp: 100, index: 1 },
      { address: "0x123", username: "Alice", timestamp: 200, index: 2 },
      { address: "0x456", username: "Bob", timestamp: 150, index: 1 },
      { address: "0x456", username: "Bob", timestamp: 150, index: 3 },
      { address: "0x789", username: "Carol", timestamp: 300, index: 1 }
    ];

    const result = (chat as any).utils.removeDuplicateUsers(users);

    expect(result).toEqual([
      { address: "0x123", username: "Alice", timestamp: 200, index: 2 },
      { address: "0x456", username: "Bob", timestamp: 150, index: 3 },
      { address: "0x789", username: "Carol", timestamp: 300, index: 1 }
    ]);
  });

  it('should keep only one user if all entries are duplicates', () => {
    const users = [
      { address: "0x123", username: "Alice", timestamp: 100, index: 1 },
      { address: "0x123", username: "Alice", timestamp: 200, index: 2 },
      { address: "0x123", username: "Alice", timestamp: 150, index: 3 }
    ];

    const result = (chat as any).utils.removeDuplicateUsers(users);

    expect(result).toEqual([
      { address: "0x123", username: "Alice", timestamp: 200, index: 2 }
    ]);
  });
});


describe('selectUsersFeedCommitWriter', () => {
  let chat: SwarmChat;
  let mockEmitStateEvent: jest.Mock;

  beforeEach(() => {
    chat = new SwarmChat();
    mockEmitStateEvent = jest.fn();
  });

  it('should select a user when minimum number of users is met', async () => {
    const activeUsers = await userListWithNUsers(3);
    
    const selectedAddress = await (chat as any).utils.selectUsersFeedCommitWriter(activeUsers, mockEmitStateEvent);
    
    expect(activeUsers.some(user => user.address === selectedAddress)).toBe(true);
    expect(mockEmitStateEvent).toHaveBeenCalledWith(EVENTS.FEED_COMMIT_HASH, expect.any(String));
  });

  it('should always select the same user for same input', async () => {
    const activeUsers = await userListWithNUsers(5);
    
    const firstSelection = await (chat as any).utils.selectUsersFeedCommitWriter(activeUsers, mockEmitStateEvent);
    const secondSelection = await (chat as any).utils.selectUsersFeedCommitWriter(activeUsers, mockEmitStateEvent);
    
    expect(firstSelection).toBe(secondSelection);
  }, 25000);

  it('should select from top 30% of users', async () => {
    const activeUsers = await userListWithNUsers(10);
    
    const selectedAddress = await (chat as any).utils.selectUsersFeedCommitWriter(activeUsers, mockEmitStateEvent);
    const expectedUsers = activeUsers.slice(0, 3);
    
    expect(expectedUsers.some(user => user.address === selectedAddress)).toBe(true);
  }, 25000);

  it('should select at least one user even with small user count', async () => {
    const activeUsers = await userListWithNUsers(1);
    
    const selectedAddress = await (chat as any).utils.selectUsersFeedCommitWriter(activeUsers, mockEmitStateEvent);
    
    expect(selectedAddress).toBe(activeUsers[0].address);
  }, 25000);

  it('should handle empty user list', async () => {
    await expect((chat as any).utils.selectUsersFeedCommitWriter([], mockEmitStateEvent))
      .rejects.toThrow();
  });
});


describe('getActiveUsers', () => {
  let chat: SwarmChat;

  beforeEach(() => {
    chat = new SwarmChat();
  });

  it('should return all users within idle time', async () => {
    const now = Date.now();
    const users = await userListWithNUsers(3);
    const userActivityTable = createMockActivityTable(users, [
      now - 1000,
      now - 1000,
      now - 1000 
    ]);
    const idleTime = 2000;

    const activeUsers = (chat as any).utils.getActiveUsers(users, userActivityTable, idleTime);

    expect(activeUsers.length).toBe(3);
  });

  it('should filter out users beyond idle time', async () => {
    const now = Date.now();
    const users = await userListWithNUsers(3);
    const userActivityTable = createMockActivityTable(users, [
      now - 3000,  // idle user
      now - 1000,  // recent user
      now - 2500   // idle user
    ]);
    const idleTime = 2000;

    const activeUsers = (chat as any).utils.getActiveUsers(users, userActivityTable, idleTime);

    expect(activeUsers.length).toBe(1);
    expect(activeUsers[0].address).toBe(users[1].address);
  });

  it('should handle missing activity table entries', async () => {
    const now = Date.now();
    const users = await userListWithNUsers(3);
    const userActivityTable: UserActivity = {};
    const idleTime = 10 * MINUTE;

    const activeUsers: User[] = (chat as any).utils.getActiveUsers(users, userActivityTable, idleTime);

    expect(activeUsers.length).toBe(3);
    expect(activeUsers.every(user => 
      userActivityTable[user.address] && 
      userActivityTable[user.address].timestamp === now
    )).toBe(true);
  });

  it('should return empty array if no users are active', async () => {
    const now = Date.now();
    const users = await userListWithNUsers(3);
    const userActivityTable = createMockActivityTable(users, [
      now - 5000,  // idle user
      now - 6000,  // very idle user
      now - 7000   // extremely idle user
    ]);
    const idleTime = 2000;

    const activeUsers = (chat as any).utils.getActiveUsers(users, userActivityTable, idleTime);

    expect(activeUsers.length).toBe(0);
  });
});