import { ethers, Wallet } from "ethers";
import { SwarmChat } from "../src/core";
import { Bytes, EthAddress, MessageData, User, UserActivity, UserWithIndex } from "../src/types";
import { BatchId } from "@ethersphere/bee-js";
import { createMockActivityTable, userListWithNUsers } from "./fixtures";
import { EVENTS, MINUTE } from "../src/constants";

import { InformationSignal } from "@anythread/gsoc";
jest.mock('@anythread/gsoc', () => ({
  InformationSignal: jest.fn()
}));


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
  }, 25000);

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


describe('subscribeToGsoc', () => {
  let chat: SwarmChat;
  let mockInformationSignal: {
    subscribe: jest.Mock;
  };

  beforeEach(() => {
    chat = new SwarmChat();
    (InformationSignal as jest.Mock).mockClear();
    mockInformationSignal = {
      subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() })
    };
    (InformationSignal as jest.Mock).mockImplementation(() => mockInformationSignal);

    jest.spyOn(chat['logger'], 'info').mockImplementation();
    jest.spyOn(chat['logger'], 'debug').mockImplementation();
    jest.spyOn(chat as any, 'handleError').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should throw error if resourceId is not provided', () => {
    const url = 'http://test-url.com';
    const stamp = 'test-stamp';
    const topic = 'test-topic';
    const callback = jest.fn();

    expect(() => {
      (chat as any).utils.subscribeToGsoc(url, stamp, topic, null as any, callback);
    }).toThrow('Error in subscribeToGSOC');
  });

  it('should create InformationSignal with correct parameters', () => {
    const url = 'http://test-url.com';
    const stamp = '123456789abcdef';
    const topic = 'test-topic';
    const resourceId = '4a0f000000000000000000000000000000000000000000000000000000000000';
    const callback = jest.fn();

    const mockSubscribe = jest.fn().mockReturnValue({ unsubscribe: jest.fn() });
    (InformationSignal as jest.Mock).mockImplementation(() => ({
      subscribe: mockSubscribe
    }));

    (chat as any).utils.subscribeToGsoc(url, stamp, topic, resourceId, callback);

    expect(InformationSignal).toHaveBeenCalledWith(url, {
      postageBatchId: stamp,
      consensus: {
        id: `SwarmDecentralizedChat::${topic}`,
        assertRecord: expect.any(Function)
      }
    });
  });

  it('should call callback with correct parameters on message', () => {
    const url = 'http://test-url.com';
    const stamp = '123456789abcdef';
    const topic = 'test-topic';
    const resourceId = '4a0f000000000000000000000000000000000000000000000000000000000000';
    const callback = jest.fn();

    (chat as any).utils.subscribeToGsoc(url, stamp, topic, resourceId, callback);

    // Get the subscribe method and call its onMessage
    const subscribeMethod = mockInformationSignal.subscribe;
    const onMessageFn = subscribeMethod.mock.calls[0][0].onMessage;

    // Simulate receiving a message
    const testMessage = JSON.stringify({ username: 'testuser' });
    onMessageFn(testMessage);

    expect((chat as any).logger.info).toHaveBeenCalledWith('Registration object received, calling userRegisteredThroughGsoc');
    expect((chat as any).logger.debug).toHaveBeenCalledWith('gsoc message: ', testMessage);
    expect(callback).toHaveBeenCalledWith(topic, stamp, testMessage);
  });

  it('should return subscription object', () => {
    const url = 'http://test-url.com';
    const stamp = 'test-stamp';
    const topic = 'test-topic';
    const resourceId = '0x123';
    const callback = jest.fn();

    const result = (chat as any).utils.subscribeToGsoc(url, stamp, topic, resourceId, callback);

    expect(result).toEqual({ unsubscribe: expect.any(Function) });
  });
});


describe('removeIdleUsers', () => {
  let chat: SwarmChat;

  beforeEach(() => {
    chat = new SwarmChat();
    jest.restoreAllMocks();
  });

  it('should return for new users', async () => {
    const getActiveUsersSpy = jest.spyOn((chat as any).utils, 'getActiveUsers');
    const writeUsersFeedCommitSpy = jest.spyOn(chat as any, 'writeUsersFeedCommit');
    const setUsersSpy = jest.spyOn(chat as any, 'setUsers');

    await chat['removeIdleUsers']("example-topic", "0x123" as EthAddress, "000" as BatchId);

    expect(getActiveUsersSpy).not.toHaveBeenCalled();
    expect(writeUsersFeedCommitSpy).not.toHaveBeenCalled();
    expect(setUsersSpy).not.toHaveBeenCalled();
  });

  it('should log warning message if removeIdleIsRunning is true', async () => {
    chat.changeLogLevel('warn');
    const loggerWarnSpy = jest.spyOn((chat as any).logger, 'warn');
    const getActiveUsersSpy = jest.spyOn((chat as any).utils, 'getActiveUsers');
    const writeUsersFeedCommitSpy = jest.spyOn(chat as any, 'writeUsersFeedCommit');
    const setUsersSpy = jest.spyOn(chat as any, 'setUsers');
    
    chat['removeIdleIsRunning'] = true;
    chat['reqCount'] = 33;
    await chat['removeIdleUsers']("example-topic", "0x123" as EthAddress, "000" as BatchId);

    expect(loggerWarnSpy).toHaveBeenCalledWith("Previous removeIdleUsers is still running");
    expect(getActiveUsersSpy).not.toHaveBeenCalled();
    expect(writeUsersFeedCommitSpy).not.toHaveBeenCalled();
    expect(setUsersSpy).not.toHaveBeenCalled();
  });

  it('should call getActiveUsers if reqCount is bigger than 32 and removeIdleIsRunning is false', async () => {
    const getActiveUsersSpy = jest.spyOn((chat as any).utils, 'getActiveUsers');
    chat['reqCount'] = 33;

    await chat['removeIdleUsers']("example-topic", "0x123" as EthAddress, "000" as BatchId);

    expect(getActiveUsersSpy).toHaveBeenCalled();
  });

  it('should return, if there are no active users and not in gateway mode (after writing UsersFeedCommit)', async () => {
    const getActiveUsersSpy = jest.spyOn((chat as any).utils, 'getActiveUsers');
    const writeUsersFeedCommitSpy = jest.spyOn(chat as any, 'writeUsersFeedCommit');
    const selectUsersFeedCommitWriterSpy = jest.spyOn((chat as any).utils, 'selectUsersFeedCommitWriter');
    const setUsersSpy = jest.spyOn(chat as any, 'setUsers');
    getActiveUsersSpy.mockReturnValue([]);

    chat['reqCount'] = 33;
    await chat['removeIdleUsers']("example-topic", "0x123" as EthAddress, "000" as BatchId);

    expect(getActiveUsersSpy).toHaveBeenCalled();
    expect(writeUsersFeedCommitSpy).toHaveBeenCalled();
    expect(selectUsersFeedCommitWriterSpy).not.toHaveBeenCalled();
    expect(setUsersSpy).not.toHaveBeenCalled();
  });

  it('should call selectUsersFeedCommitWriter if not in Gateway mode and there are active users', async () => {
    const getActiveUsersSpy = jest.spyOn((chat as any).utils, 'getActiveUsers');
    const writeUsersFeedCommitSpy = jest.spyOn(chat as any, 'writeUsersFeedCommit');
    const selectUsersFeedCommitWriterSpy = jest.spyOn((chat as any).utils, 'selectUsersFeedCommitWriter');
    const setUsersSpy = jest.spyOn(chat as any, 'setUsers');
    getActiveUsersSpy.mockReturnValue([{ address: '0x123', index: 1 }]);
    
    chat['reqCount'] = 33;
    await chat['removeIdleUsers']("example-topic", "0x123" as EthAddress, "000" as BatchId);

    expect(getActiveUsersSpy).toHaveBeenCalled();
    expect(writeUsersFeedCommitSpy).toHaveBeenCalled();
    expect(selectUsersFeedCommitWriterSpy).toHaveBeenCalled();
    expect(setUsersSpy).toHaveBeenCalled();
  });

  it('should throw error when in Gateway mode and not the gateway is running removeIdleUsers', async () => {
    const handleErrorSpy = jest.spyOn(chat as any, 'handleError');
    chat['gateway'] = "gatewayOverlayAddress";
    chat['reqCount'] = 33;

    await chat['removeIdleUsers']("example-topic", "0x123" as EthAddress, "000" as BatchId);

    expect(handleErrorSpy).toHaveBeenCalledWith({
      error: "Only Gateway should run  this function in gateway mode!",
      context: 'removeIdleUsers',
      throw: false
    });
  });

  it('should call writeUsersFeedCommit and setUsers when in Gateway mode and gateway is running removeIdleUsers', async () => {
    const getActiveUsersSpy = jest.spyOn((chat as any).utils, 'getActiveUsers');
    const writeUsersFeedCommitSpy = jest.spyOn(chat as any, 'writeUsersFeedCommit');
    const setUsersSpy = jest.spyOn(chat as any, 'setUsers');
    getActiveUsersSpy.mockReturnValue([{ address: '0x123', index: 1 }]);
    chat['gateway'] = "gatewayOverlayAddress";
    chat['reqCount'] = 33;
    chat['gsocSubscribtion'] = {
      close: jest.fn(),
      gsocAddress: "address" as unknown as Bytes<32>
    };

    await chat['removeIdleUsers']("example-topic", "0x123" as EthAddress, "000" as BatchId);

    expect(getActiveUsersSpy).toHaveReturnedWith([{ address: '0x123', index: 1 }]);
    expect(writeUsersFeedCommitSpy).toHaveBeenCalled();
    expect(setUsersSpy).toHaveBeenCalled();
  });
});


describe('writeUsersFeedCommit', () => {
  let chat: SwarmChat;

  beforeEach(() => {
    chat = new SwarmChat();
    jest.resetAllMocks();
  });

  it('should log user was selected message, in info mode', () => {
    chat.changeLogLevel('info');
    const loggerInfoSpy = jest.spyOn((chat as any).logger, 'info');

    (chat as any).writeUsersFeedCommit("example-topic", "000" as BatchId, "0x123" as EthAddress);

    expect(loggerInfoSpy).toHaveBeenCalledWith("The user was selected for submitting the UsersFeedCommit! (removeIdleUsers)");
  });

  it('should call removeDuplicateUsers', () => {
    const removeDuplicateUsersSpy = jest.spyOn((chat as any).utils, 'removeDuplicateUsers');

    (chat as any).writeUsersFeedCommit("example-topic", "000" as BatchId, ["0x123" as EthAddress]);

    expect(removeDuplicateUsersSpy).toHaveBeenCalledWith(["0x123"]);
  });

  it('should call uploadObjectToBee', async () => {
    const uploadObjectToBeesSpy = jest.spyOn((chat as any).utils, 'uploadObjectToBee');

    (chat as any).writeUsersFeedCommit("example-topic", "000" as BatchId, ["0x123" as EthAddress]);

    expect(uploadObjectToBeesSpy).toHaveBeenCalled();
  });

  it('should throw error if uploadObjectToBee fails', async () => {
    const uploadObjectToBeeSpy = jest.spyOn((chat as any).utils, 'uploadObjectToBee');
    const handleErrorSpy = jest.spyOn((chat as any), 'handleError');
    uploadObjectToBeeSpy.mockReturnValue(null);

    await (chat as any).writeUsersFeedCommit("example-topic", "000" as BatchId, ["0x123" as EthAddress]);
    
    expect(handleErrorSpy).toHaveBeenCalledWith({
      error: Error("Could not upload user list to bee"),
      context: 'writeUsersFeedCommit',
      throw: false
    });
  });

  it('should call graffitiFeedWriterFromTopic', async () => {
    const graffitiFeedWriterFromTopicSpy = jest.spyOn((chat as any).utils, 'graffitiFeedWriterFromTopic');
    const uploadObjectToBeeSpy = jest.spyOn((chat as any).utils, 'uploadObjectToBee');
    uploadObjectToBeeSpy.mockReturnValue("SwarmRef");

    await (chat as any).writeUsersFeedCommit("example-topic", "000" as BatchId, ["0x123" as EthAddress]);

    expect(graffitiFeedWriterFromTopicSpy).toHaveBeenCalled();
  });

  it('should fetch feed index, if usersFeedIndex is falsy', async () => {
    chat.changeLogLevel('info');
    chat['usersFeedIndex'] = 0;
    const loggerInfoSpy = jest.spyOn((chat as any).logger, 'info');
    const hexStringToNumberSpy = jest.spyOn((chat as any).utils, 'hexStringToNumber');
    const uploadObjectToBeeSpy = jest.spyOn((chat as any).utils, 'uploadObjectToBee');
    const graffitiFeedWriterFromTopicSpy = jest.spyOn((chat as any).utils, 'graffitiFeedWriterFromTopic');
    uploadObjectToBeeSpy.mockReturnValue("SwarmRef");
    const mockFeedWriter = {
      upload: jest.fn().mockResolvedValue(undefined),
      download: jest.fn().mockResolvedValue({ feedIndexNext: '0x1' }),
    };
    graffitiFeedWriterFromTopicSpy.mockReturnValue(mockFeedWriter);

    await (chat as any).writeUsersFeedCommit("example-topic", "000" as BatchId, ["0x123" as EthAddress]);

    expect(loggerInfoSpy).toHaveBeenCalledWith("Fetching current index...");
    expect(hexStringToNumberSpy).toHaveBeenCalled();
  });

  it('should write UsersFeedCommit to feed', async () => {
    chat.changeLogLevel('info');
    chat['usersFeedIndex'] = 5;
    const loggerInfoSpy = jest.spyOn((chat as any).logger, 'info');
    const uploadObjectToBeeSpy = jest.spyOn((chat as any).utils, 'uploadObjectToBee');
    uploadObjectToBeeSpy.mockResolvedValue({ reference: 'mockSwarmRef' });
    const graffitiFeedWriterFromTopicSpy = jest.spyOn((chat as any).utils, 'graffitiFeedWriterFromTopic');
    const mockFeedWriter = {
      upload: jest.fn().mockResolvedValue(undefined),
      download: jest.fn().mockResolvedValue({ feedIndexNext: '0x1' }),
    };
    graffitiFeedWriterFromTopicSpy.mockReturnValue(mockFeedWriter);

    await (chat as any).writeUsersFeedCommit("example-topic", "000" as BatchId, ["0x123" as EthAddress]);

    expect(loggerInfoSpy).toHaveBeenLastCalledWith("Writing UsersFeedCommit to index ", 5);
    expect(mockFeedWriter.upload).toHaveBeenCalled();
  });
});


describe('getNewUsers', () => {
  let chat: SwarmChat;
  let mockBee: any;
  let mockUtils: any;
  let mockLogger: any;

  beforeEach(() => {
    jest.resetAllMocks();
    mockBee = {
      downloadData: jest.fn()
    };

    mockUtils = {
      graffitiFeedReaderFromTopic: jest.fn().mockReturnValue({
        download: jest.fn()
      }),
      validateUserObject: jest.fn().mockReturnValue(true),
      removeDuplicateUsers: jest.fn((users) => users),
      isNotFoundError: jest.fn().mockReturnValue(false)
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn()
    };

    chat = new SwarmChat();
    
    (chat as any).bee = mockBee;
    (chat as any).utils = mockUtils;
    (chat as any).logger = mockLogger;

  });

  it('should call graffitiFeedReaderFromTopic', async () => {
    const topic = "example-topic";
    const mockFeedReader = {
      download: jest.fn().mockResolvedValue({ reference: 'mock-reference' })
    };
    mockUtils.graffitiFeedReaderFromTopic.mockReturnValue(mockFeedReader);

    mockBee.downloadData.mockResolvedValue({
      json: jest.fn().mockReturnValue({
        users: [],
        overwrite: false
      })
    });

    await chat.getNewUsers(topic);

    expect(mockUtils.graffitiFeedReaderFromTopic).toHaveBeenCalledWith(mockBee, topic);
  });

  it('should handle registration of a new user', async () => {
    const newUser = (await userListWithNUsers(1))[0];
    const mockFeedEntry = { reference: 'SwarmReference' };
    const mockEmitStateEvent = jest.spyOn(chat as any, 'emitStateEvent');

    const mockFeedReader = {
      download: jest.fn().mockResolvedValue(mockFeedEntry)
    };
    mockUtils.graffitiFeedReaderFromTopic.mockReturnValue(mockFeedReader);

    mockBee.downloadData.mockResolvedValue({
      json: jest.fn().mockReturnValue({
        users: [newUser],
        overwrite: false
      })
    });

    await chat.getNewUsers("test-topic");

    expect(mockEmitStateEvent).toHaveBeenCalledWith(EVENTS.LOADING_USERS, true);
    expect(mockEmitStateEvent).toHaveBeenCalledWith(EVENTS.USER_REGISTERED, newUser.username);
    expect(mockEmitStateEvent).toHaveBeenCalledWith(EVENTS.LOADING_USERS, false);

    expect((chat as any).newlyRegisteredUsers).toHaveLength(1);
    expect((chat as any).newlyRegisteredUsers[0]).toMatchObject({
      ...newUser,
      index: -1
    });
  });

  it('should handle overwrite scenario', async () => {
    const users = await userListWithNUsers(2);
    const mockFeedEntry = { reference: 'SwarmReference' };

    const mockFeedReader = {
      download: jest.fn().mockResolvedValue(mockFeedEntry)
    };
    mockUtils.graffitiFeedReaderFromTopic.mockReturnValue(mockFeedReader);

    mockBee.downloadData.mockResolvedValue({
      json: jest.fn().mockReturnValue({
        users,
        overwrite: true
      })
    });

    await chat.getNewUsers("test-topic");

    expect(mockUtils.removeDuplicateUsers).toHaveBeenCalled();
    expect((chat as any).newlyRegisteredUsers).toHaveLength(0);
  });

  it('should handle timeout error', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const timeoutError = new Error('timeout occurred');

    const mockFeedReader = {
      download: jest.fn().mockRejectedValue(timeoutError)
    };
    mockUtils.graffitiFeedReaderFromTopic.mockReturnValue(mockFeedReader);

    await chat.getNewUsers("test-topic");

    expect(consoleErrorSpy).toHaveBeenCalledWith("timeout error");
    expect(chat['userFetchIsRunning']).toBe(false);

    consoleErrorSpy.mockRestore();
  });

  it('should handle not found error', async () => {
    const notFoundError = new Error('Not found');
    mockUtils.isNotFoundError.mockReturnValue(true);

    const mockFeedReader = {
      download: jest.fn().mockRejectedValue(notFoundError)
    };
    mockUtils.graffitiFeedReaderFromTopic.mockReturnValue(mockFeedReader);

    await chat.getNewUsers("test-topic");

    expect(chat['userFetchIsRunning']).toBe(false);
    expect(mockUtils.isNotFoundError).toHaveBeenCalledWith(notFoundError);
  });

  it('should increment usersFeedIndex after successful download', async () => {
    const initialIndex = chat['usersFeedIndex'];
    const mockFeedEntry = { reference: 'SwarmReference' };

    const mockFeedReader = {
      download: jest.fn().mockResolvedValue(mockFeedEntry)
    };
    mockUtils.graffitiFeedReaderFromTopic.mockReturnValue(mockFeedReader);

    mockBee.downloadData.mockResolvedValue({
      json: jest.fn().mockReturnValue({
        users: [],
        overwrite: true
      })
    });

    await chat.getNewUsers("test-topic");

    expect(chat['usersFeedIndex']).toBe(initialIndex + 1);
  });
});


describe('userRegisteredThroughGsoc', () => {
  let chat: SwarmChat;
  const topic = "exampleTopic";
  const stamp = "exampleStamp";

  beforeEach(() => {
    jest.resetAllMocks();

    chat = new SwarmChat();

  });

  it('should add a new user when not already registered', async () => {
    const isRegisteredSpy = jest.spyOn(chat, 'isRegistered').mockReturnValue(false);
    const writeUsersFeedCommitSpy = jest.spyOn(chat as any, 'writeUsersFeedCommit');
    const setUsersSpy = jest.spyOn(chat as any, 'setUsers');
    const updateUserActivitySpy = jest.spyOn(chat as any, 'updateUserActivityAtRegistration');

    const user = (await userListWithNUsers(1))[0];
    const gsocMessage = JSON.stringify(user);

    (chat as any).userRegisteredThroughGsoc(topic, stamp, gsocMessage);

    expect(isRegisteredSpy).toHaveBeenCalledWith(user.address);
    expect(writeUsersFeedCommitSpy).toHaveBeenCalledWith(topic, stamp, expect.any(Array));
    expect(setUsersSpy).toHaveBeenCalledWith(expect.any(Array));
    expect(updateUserActivitySpy).toHaveBeenCalled();

    expect(writeUsersFeedCommitSpy.mock.calls[0][2]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ...user,
          index: -1
        })
      ])
    );
  });

  it('should not add a user that is already registered', async () => {
    const isRegisteredSpy = jest.spyOn(chat, 'isRegistered').mockReturnValue(true);
    const writeUsersFeedCommitSpy = jest.spyOn(chat as any, 'writeUsersFeedCommit');
    const setUsersSpy = jest.spyOn(chat as any, 'setUsers');
    const updateUserActivitySpy = jest.spyOn(chat as any, 'updateUserActivityAtRegistration');

    const mockUser = (await userListWithNUsers(1))[0];
    const gsocMessage = JSON.stringify(mockUser);

    (chat as any).userRegisteredThroughGsoc(topic, stamp, gsocMessage);

    expect(isRegisteredSpy).toHaveBeenCalledWith(mockUser.address);
    expect(writeUsersFeedCommitSpy).not.toHaveBeenCalled();
    expect(setUsersSpy).not.toHaveBeenCalled();
    expect(updateUserActivitySpy).toHaveBeenCalled();
  });

  it('should handle invalid JSON gracefully', () => {
    const handleErrorSpy = jest.spyOn(chat as any, 'handleError');

    const invalidGsocMessage = '{invalid json}';

    (chat as any).userRegisteredThroughGsoc(topic, stamp, invalidGsocMessage);

    expect(handleErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'userRegisteredThroughGsoc',
        throw: false
      })
    );
  });

  it('should handle missing user properties', () => {
    const handleErrorSpy = jest.spyOn(chat as any, 'handleError');

    const incompleteUser = { someProperty: 'value' };
    const gsocMessage = JSON.stringify(incompleteUser);

    (chat as any).userRegisteredThroughGsoc(topic, stamp, gsocMessage);

    expect(handleErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'userRegisteredThroughGsoc',
        throw: false
      })
    );
  });
});


describe('host', () => {
  let chat: SwarmChat;
  const topic = 'test-room';
  const stamp = '123' as BatchId;
  const mockIdentity = {
    address: '0x1234567890123456789012345678901234567890' as EthAddress
  };

  
  beforeEach(() => {
    jest.resetAllMocks();
    
    chat = new SwarmChat();
    
    chat['initChatRoom'] = jest.fn().mockResolvedValue(undefined);
    chat['startMessageFetchProcess'] = jest.fn();
    chat['startActivityAnalyzes'] = jest.fn();
    chat['handleError'] = jest.fn();
    chat['utils'].sleep = jest.fn().mockResolvedValue(undefined);
    
    jest.mock('ethers', () => ({
      Wallet: {
        createRandom: jest.fn(() => ({
          address: '0x1234567890123456789012345678901234567890'
        }))
      }
    }));
  });

  it('should call initChatRoom with proper parameters', () => {
    const initChatRoomSpy = jest.spyOn(chat as any, 'initChatRoom');
  
    chat.host(topic, stamp);

    chat.stop();
  
    expect(initChatRoomSpy).toHaveBeenCalledWith(topic, stamp);
  });

  it('should call startMessageFetchProcess', async () => {
    const startMessageFetchProcessSpy = jest.spyOn(chat as any, 'startMessageFetchProcess');

    chat.host(topic, stamp);

    await chat['utils'].sleep(50);

    chat.stop();

    expect(startMessageFetchProcessSpy).toHaveBeenCalled();
  });

  it('should call startActivityAnalyzes', async () => {
    const startActivityAnalyzesSpy = jest.spyOn(chat as any, 'startActivityAnalyzes');

    chat.host(topic, stamp);

    await chat['utils'].sleep(50);

    chat.stop();

    expect(startActivityAnalyzesSpy).toHaveBeenCalled();
  });

  it('should create a random wallet', async () => {
    const createRandomSpy = jest.spyOn(ethers.Wallet, 'createRandom');

    chat.host(topic, stamp);
    await chat['utils'].sleep(50);
    chat.stop();

    expect(createRandomSpy).toHaveBeenCalled();
  });
});