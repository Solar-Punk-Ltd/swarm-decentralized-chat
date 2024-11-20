import { SwarmChat } from '../src/core';
import { MINUTE, SECOND } from '../src/constants';
import { BatchId, Bee } from '@ethersphere/bee-js';
import { EventEmitter } from '../src/eventEmitter';


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