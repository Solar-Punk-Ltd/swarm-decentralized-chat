import { SwarmChat } from '../src/core';
import { EVENTS, MINUTE, SECOND } from '../src/constants';
import { BatchId, Bee } from '@ethersphere/bee-js';
import { EventEmitter } from '../src/eventEmitter';
import { UsersFeedCommit } from '../src/types';
import { userListWithNUsers } from './fixtures';


describe('SwarmChat initialization and configuration (constructor)', () => {
  it('constructor should create SwarmChat instance', async () => {
    const chatInstance = new SwarmChat();
    expect(chatInstance).toBeInstanceOf(SwarmChat);
  });
  
  it('constructor should create chat instance with proper configuration', async () => {
    const chat = new SwarmChat({
        idleTime: 7 * MINUTE,
        messageCheckInterval: 3000,
        messageFetchMin: 500,
        userUpdateInterval: 9000
    });
    
    expect(chat.getDiagnostics().maxParallel).toBe(4);
    expect(chat.getIdleConst()).toBe(7*MINUTE);
    expect(chat.getMessageCheckInterval()).toBe(3000);
    expect(chat.getUserCount()).toBe(0);
    expect(chat.getUserUpdateIntervalConst()).toBe(9000);
  });

  it('constructor should use default values when no settings provided', async () => {
    const chat = new SwarmChat();
    
    expect(chat.getIdleConst()).toBe(10 * MINUTE);
    expect(chat.getMessageCheckInterval()).toBe(900);
    expect(chat.getUserUpdateIntervalConst()).toBe(8 * SECOND);
    expect(chat.getDiagnostics().maxParallel).toBe(4);
  });

  it('constructor should accept custom Bee instance', async () => {
    const customBee = new Bee('http://custom-url:1633');
    const chat = new SwarmChat({}, customBee);
    
    expect(chat.getBeeInstance()).toBe(customBee);
  });

  it('constructor should accept custom EventEmitter', async () => {
    const customEmitter = new EventEmitter();
    const chat = new SwarmChat({}, undefined, customEmitter);
    
    const actions = chat.getChatActions();
    expect(actions.on).toBe(customEmitter.on);
    expect(actions.off).toBe(customEmitter.off);
  });

  it('constructor should initialize with gateway settings', async () => {
    const chat = new SwarmChat({
      gateway: "custom-gateway-123",
      gsocResourceId: "resource-id-123"
    });
    
    expect(chat.getGateway()).toBe("custom-gateway-123");
    expect(chat.getGsocResourceId()).toBe("resource-id-123");
  });
});


describe('changeBeeUrl', () => {
  it('should change the bee url', () => {
    const chat = new SwarmChat();
    chat.changeBeeUrl("http://new-url.com:1633");

    expect(chat.getBeeInstance().url).toBe("http://new-url.com:1633");
  });
});


describe('initChatRoom', () => {
  let chat: SwarmChat;
  const mockBee = {
    url: 'http://test-bee-url.com',
    createFeedManifest: jest.fn()
  };
  const mockUtils = {
    generateGraffitiFeedMetadata: jest.fn(),
    mineResourceId: jest.fn(),
    subscribeToGsoc: jest.fn()
  };
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUtils.generateGraffitiFeedMetadata.mockReturnValue({
      consensusHash: 'mockConsensusHash',
      graffitiSigner: { address: 'mockAddress' }
    });

    mockUtils.mineResourceId.mockResolvedValue('mockResourceId');
    mockUtils.subscribeToGsoc.mockReturnValue({ unsubscribe: jest.fn() });

    chat = new SwarmChat();
    chat['bee'] = mockBee as any;
    chat['utils'] = mockUtils as any;
    chat['logger'] = mockLogger as any;
    chat['userRegisteredThroughGsoc'] = jest.fn();
  });
  
  it('should create feed manifest', async () => {
    const stamp = "valid-stamp" as BatchId;
    const topic = "test-topic";
    const expectedConsensusHash = "mockConsensusHash";
    const expectedAddress = "mockAddress";

    await chat.initChatRoom(topic, stamp);

    expect(mockUtils.generateGraffitiFeedMetadata).toHaveBeenCalledWith(topic);
    expect(mockBee.createFeedManifest).toHaveBeenCalledWith(
      stamp,
      'sequence',
      expectedConsensusHash,
      expectedAddress
    );
  });

  it('should set gsocResourceId when in gateway mode (this.gateway is not null)', async () => {
    const stamp = "example-stamp" as BatchId;
    const topic = "example-topic";
    const expectedResourceId = "mockResourceId";
    
    // Enable gateway mode
    chat['gateway'] = "gatewayOverlayAddress";

    await chat.initChatRoom(topic, stamp);

    expect(mockUtils.mineResourceId).toHaveBeenCalledWith(
      mockBee.url,
      stamp,
      chat['gateway'],
      topic
    );
    expect(chat['gsocResourceId']).toBe(expectedResourceId);
    expect(mockLogger.info).toHaveBeenCalledWith(`resource ID: ${expectedResourceId}`);
  });

  it('should set gsocSubscribtion when in gateway mode (this.gateway is not null)', async () => {
    const stamp = "valid-stamp" as BatchId;
    const topic = "test-topic";
    const expectedResourceId = "mockResourceId";
    const mockSubscription = { unsubscribe: jest.fn() };
    
    // Enable gateway mode
    chat['gateway'] = "gatewayOverlayAddress";
    mockUtils.subscribeToGsoc.mockReturnValue(mockSubscription);

    await chat.initChatRoom(topic, stamp);

    expect(mockUtils.subscribeToGsoc).toHaveBeenCalledWith(
      mockBee.url,
      stamp,
      topic,
      expectedResourceId,
      expect.any(Function)
    );
    expect(chat['gsocSubscribtion']).toBe(mockSubscription);
  });

  it('should not set gsoc related properties when gateway is null', async () => {
    const stamp = "example-stamp" as BatchId;
    const topic = "example-topic";

    await chat.initChatRoom(topic, stamp);

    expect(mockUtils.mineResourceId).not.toHaveBeenCalled();
    expect(mockUtils.subscribeToGsoc).not.toHaveBeenCalled();
    expect(chat['gsocResourceId']).toBe("");
    expect(chat['gsocSubscribtion']).toBeNull();
  });

  it('should handle error when mineResourceId returns null', async () => {
    const stamp = "example-stamp" as BatchId;
    const topic = "example-topic";
    const handleErrorSpy = jest.spyOn(chat as any, 'handleError');
    
    // Enable gateway mode and mock mineResourceId to return null
    chat['gateway'] = "gatewayOverlayAddress";
    mockUtils.mineResourceId.mockResolvedValue(null);

    try {
      await chat.initChatRoom(topic, stamp);
    } catch (error) {
      expect(handleErrorSpy).toHaveBeenCalledWith({
        error: "Could not create resource ID!",
        context: 'Could not create Users feed!',
        throw: true
      });
    }
  });
});


describe('initUsers', () => {
  let chat: SwarmChat;
  let mockBee = {};
  let mockUtils = {
    graffitiFeedReaderFromTopic: jest.fn(),
    fetchUsersFeedAtIndex: jest.fn(),
    validateUserObject: jest.fn().mockImplementation(() => true),
    removeDuplicateUsers: jest.fn().mockImplementation(users => users)
  };
  let mockLogger = {
    debug: jest.fn(),
    error: jest.fn()
  };
  
  beforeEach(() => {
    chat = new SwarmChat();

    mockBee = {};
    mockUtils = {
      graffitiFeedReaderFromTopic: jest.fn(),
      fetchUsersFeedAtIndex: jest.fn(),
      validateUserObject: jest.fn().mockImplementation(() => true),
      removeDuplicateUsers: jest.fn().mockImplementation(users => users)
    };
    mockLogger = {
      debug: jest.fn(),
      error: jest.fn()
    };

    chat['bee'] = mockBee as any;
    chat['utils'] = mockUtils as any;
    chat['logger'] = mockLogger as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it('should initialize the users successfully with overwrite commit', async () => {
    const mockUsers = await userListWithNUsers(2);
    const emitStateEventSpy = jest.spyOn(chat as any, 'emitStateEvent');
    const setUsersSpy = jest.spyOn(chat as any, 'setUsers');

    mockUtils.fetchUsersFeedAtIndex
      .mockResolvedValue({
        feedCommit: { users: mockUsers, overwrite: true } as UsersFeedCommit,
        nextIndex: 1
      });

    await chat.initUsers('hello-42');

    expect(emitStateEventSpy).toHaveBeenCalledWith(EVENTS.LOADING_INIT_USERS, true);
    expect(setUsersSpy).toHaveBeenCalled();
    expect(emitStateEventSpy).toHaveBeenCalledWith(EVENTS.LOADING_INIT_USERS, false);
  }, 25000);

  it('should handle registration of new users within threshold time', async () => {
    const now = Date.now();
    const users = await userListWithNUsers(4);
    const setUsersSpy = jest.spyOn(chat as any, 'setUsers');
    const mockOverwriteUsers = [ users[0], users[1] ];
    const mockNewUser = users[2];
    mockNewUser.timestamp = now - 2 * MINUTE;                  // This is above the threshold, the loop should exit
    const mockOldUser = users[3];
    mockOldUser.timestamp = now - 3 * MINUTE;

    mockUtils.fetchUsersFeedAtIndex
      .mockResolvedValueOnce({
        feedCommit: { users: mockOverwriteUsers, overwrite: true },
        nextIndex: 3
      })
      .mockResolvedValueOnce({
        feedCommit: { users: [mockNewUser], overwrite: false },
        nextIndex: 2
      })
      .mockResolvedValueOnce({
        feedCommit: { users: [mockOldUser], overwrite: false },
        nextIndex: 1
      });

    await chat.initUsers('testTopic');

    expect(setUsersSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ username: "Alice" }),
        expect.objectContaining({ username: "Bob" }),
        expect.objectContaining({ username: "Carol", index: -1 }),
        expect.not.objectContaining({ username: "Dave", index: -1})
      ])
    );
  });

  it('should stop processing in gateway mode after overwrite commit', async () => {
    chat['gateway'] = "gatewayOverlayAddress";
    const setUsersSpy = jest.spyOn(chat as any, 'setUsers');
    const users = await userListWithNUsers(4);
    const mockOverwriteUsers = [ users[0], users[1] ];
    const now = Date.now();
    const mockNewUser = users[2];
    mockNewUser.timestamp = now - 2 * MINUTE;

    mockUtils.fetchUsersFeedAtIndex
      .mockResolvedValueOnce({
        feedCommit: { users: mockOverwriteUsers, overwrite: true },
        nextIndex: 3
      })
      .mockResolvedValueOnce({
        feedCommit: { users: [mockNewUser], overwrite: false },
        nextIndex: 2
      });

    await chat.initUsers('testTopic');

    expect(mockUtils.fetchUsersFeedAtIndex).toHaveBeenCalledTimes(1);
    expect(setUsersSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ username: "Alice" }),
        expect.objectContaining({ username: "Bob" }),
        expect.not.objectContaining({ username: "Carol" })
      ])
    );
  });

  it('should handle invalid users by filtering them out', async () => {
    const setUsersSpy = jest.spyOn(chat as any, 'setUsers');
    const mockUsers = [
      { username: 'valid', timestamp: Date.now() },
      { username: 'invalid', timestamp: Date.now() }
    ];

    mockUtils.validateUserObject
      .mockImplementation(user => user.username === 'valid');

    mockUtils.fetchUsersFeedAtIndex
      .mockResolvedValueOnce({
        feedCommit: { users: mockUsers, overwrite: true },
        nextIndex: 1
      });

    await chat.initUsers('testTopic');

    expect(setUsersSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ username: 'valid' })
      ])
    );
    expect(setUsersSpy).toHaveBeenCalledWith(
      expect.not.arrayContaining([
        expect.objectContaining({ username: 'invalid' })
      ])
    );
  });

  it('should remove duplicate users', async () => {
    const setUsersSpy = jest.spyOn(chat as any, 'setUsers');
    const mockUsers = [
      { username: 'user1', timestamp: Date.now() },
      { username: 'user1', timestamp: Date.now() - 1000 }
    ];

    mockUtils.fetchUsersFeedAtIndex
      .mockResolvedValueOnce({
        feedCommit: { users: mockUsers, overwrite: true },
        nextIndex: 1
      });

    mockUtils.removeDuplicateUsers.mockImplementation(users => [users[0]]);

    await chat.initUsers('testTopic');

    expect(mockUtils.removeDuplicateUsers).toHaveBeenCalled();
    expect(setUsersSpy).toHaveBeenCalledWith([mockUsers[0]]);
  });
});