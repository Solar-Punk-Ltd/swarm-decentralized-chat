import pino from "pino";
import { ErrorObject, EthAddress } from "../src/types";
import { SwarmChatUtils } from "../src/utils";
import { Bee, FeedWriter, Utils } from "@ethersphere/bee-js";
import { Wallet } from "ethers";
import { CONSENSUS_ID } from "../src/constants";


describe('generateUsersFeedId', () => {
  let logger: pino.Logger;
  let mockHandleError: jest.Mock<void, [ErrorObject]>;
  let utils: SwarmChatUtils;

  beforeEach(() => {
    logger = pino({ level: 'silent' });

    mockHandleError = jest.fn((errObject: ErrorObject) => {
      logger.error(`Error in ${errObject.context}: ${errObject.error.message}`);
    });

    utils = new SwarmChatUtils(mockHandleError, logger);
  });

  it('should generate correct UsersFeedId, based on topic', () => {
    const topic = "testTopic";
    const expectedFeedId = `${topic}_EthercastChat_Users`;

    const generatedFeedId = utils.generateUsersFeedId(topic);

    expect(generatedFeedId).toBe(expectedFeedId);
  });
});


describe('generateUserOwnedFeedId', () => {
  let logger: pino.Logger;
  let mockHandleError: jest.Mock<void, [ErrorObject]>;
  let utils: SwarmChatUtils;
  
  beforeEach(() => {
    logger = pino({ level: 'silent' });
  
    mockHandleError = jest.fn((errObject: ErrorObject) => {
      logger.error(`Error in ${errObject.context}: ${errObject.error.message}`);
    });
  
    utils = new SwarmChatUtils(mockHandleError, logger);
  });

  it('should generate correct UserOwnedFeedId based on topic and user address', () => {
    const topic = 'testTopic';
    const userAddress = '0x1234567890123456789012345678901234567890' as EthAddress;
    const expectedFeedId = `${topic}_EthercastChat_${userAddress}`;

    const generatedFeedId = utils.generateUserOwnedFeedId(topic, userAddress);

    expect(generatedFeedId).toBe(expectedFeedId);
  });
});


/*describe('graffitiFeedWriterFromTopic', () => {
  let logger: pino.Logger;
  let mockHandleError: jest.Mock<void, [ErrorObject]>;
  let utils: SwarmChatUtils;
  let mockBee: jest.Mocked<Bee>;
  
  beforeEach(() => {
    logger = pino({ level: 'silent' });
  
    mockHandleError = jest.fn((errObject: ErrorObject) => {
      logger.error(`Error in ${errObject.context}: ${errObject.error.message}`);
    });
  
    utils = new SwarmChatUtils(mockHandleError, logger);

    mockBee = {
      makeFeedWriter: jest.fn()
    } as unknown as jest.Mocked<Bee>;

    jest.spyOn(utils, 'generateGraffitiFeedMetadata');
  });

  it('should create a feed writer with correct parameters for a given topic', () => {
    const topic = 'test-topic';
    const mockFeedWriter = {} as ReturnType<Bee['makeFeedWriter']>;
    
    mockBee.makeFeedWriter.mockReturnValue(mockFeedWriter);

    const resultFeedWriter = utils.graffitiFeedWriterFromTopic(mockBee, topic);

    expect(utils.generateGraffitiFeedMetadata).toHaveBeenCalledWith(topic);
    expect(true).toBe("this-unit-test-is-not-done")
  });
});*/


//graffitiFeedReaderFromTopic


describe('generateGraffitiFeedMetadata', () => {
  let logger: pino.Logger;
  let mockHandleError: jest.Mock<void, [ErrorObject]>;
  let utils: SwarmChatUtils;
  
  const topic = 'test-topic';
  const privateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

  beforeEach(() => {
    logger = pino({ level: 'silent' });

    mockHandleError = jest.fn((errObject: ErrorObject) => {
      logger.error(`Error in ${errObject.context}: ${errObject.error.message}`);
    });

    jest.spyOn(SwarmChatUtils.prototype, 'generateUsersFeedId');
    jest.spyOn(SwarmChatUtils.prototype, 'getConsensualPrivateKey');
    jest.spyOn(SwarmChatUtils.prototype, 'getGraffitiWallet');

    utils = new SwarmChatUtils(mockHandleError, logger);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should generate graffiti feed metadata correctly', async () => {
    const mockRoomId = 'mock-room-id';
    (utils.generateUsersFeedId as jest.Mock).mockReturnValue(mockRoomId);
    
    const mockWallet = new Wallet(privateKey);
    (utils.getConsensualPrivateKey as jest.Mock).mockReturnValue(privateKey);
    (utils.getGraffitiWallet as jest.Mock).mockReturnValue(mockWallet);

    const keccak256HashSpy = jest.spyOn(Utils, 'keccak256Hash');
    const hexToBytessSpy = jest.spyOn(Utils, 'hexToBytes');

    const result = utils.generateGraffitiFeedMetadata(topic);

    expect(utils.generateUsersFeedId).toHaveBeenCalledWith(topic);
    expect(utils.getConsensualPrivateKey).toHaveBeenCalledWith(mockRoomId);
    expect(utils.getGraffitiWallet).toHaveBeenCalledWith(privateKey);

    expect(keccak256HashSpy).toHaveBeenCalledWith(CONSENSUS_ID);
    
    expect(result.consensusHash).toBeDefined();
    expect(result.graffitiSigner).toBeDefined();
    expect(result.graffitiSigner.address).toBeDefined();
    expect(result.graffitiSigner.sign).toBeDefined();

    expect(hexToBytessSpy).toHaveBeenCalledWith(mockWallet.address.slice(2));
  });

  it('should handle different topics correctly', () => {
    const topics = ['topic1', 'another-topic', ''];
    
    topics.forEach(topic => {
      const result = utils.generateGraffitiFeedMetadata(topic);
      
      expect(result.consensusHash).toBeDefined();
      expect(result.graffitiSigner).toBeDefined();
    });
  });

  it('should handle potential errors gracefully', () => {
    (utils.generateUsersFeedId as jest.Mock).mockImplementation(() => {
      throw new Error('Feed ID generation failed');
    });

    expect(() => {
      utils.generateGraffitiFeedMetadata(topic);
    }).toThrow('Feed ID generation failed');
  });
});