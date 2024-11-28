import pino from "pino";
import { ErrorObject, EthAddress } from "../src/types";
import { SwarmChatUtils } from "../src/utils";
import { Bee, FeedReader } from "@ethersphere/bee-js";


describe('serializeGraffitiRecord', () => {
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

  it('should serialize a simple object to Uint8Array', () => {
    const record = { name: 'John Doe', age: 30 };
    const serialized = utils.serializeGraffitiRecord(record);
    
    expect(serialized).toBeInstanceOf(Uint8Array);
    
    const decoded = new TextDecoder().decode(serialized);
    expect(JSON.parse(decoded)).toEqual(record);
  });

  it('should handle nested objects', () => {
    const record = { 
      user: { 
        name: 'Jane Doe', 
        details: { 
          age: 25, 
          city: 'New York' 
        } 
      },
      active: true
    };
    const serialized = utils.serializeGraffitiRecord(record);
    
    expect(serialized).toBeInstanceOf(Uint8Array);
    
    const decoded = new TextDecoder().decode(serialized);
    expect(JSON.parse(decoded)).toEqual(record);
  });
});


describe('numberToFeedIndex', () => {
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

  it('should convert a positive number to the correct feed index', () => {
    const index = 42;
    const expectedHex = '000000000000002a'; // 42 in hexadecimal, padded to 8 bytes

    const result = utils.numberToFeedIndex(index);

    expect(result).toBe(expectedHex);
  });

  it('should convert zero to the correct feed index', () => {
    const index = 0;
    const expectedHex = '0000000000000000'; // 0 in hexadecimal, padded to 8 bytes

    const result = utils.numberToFeedIndex(index);

    expect(result).toBe(expectedHex);
  });

  it('should handle large numbers within the range of a 32-bit integer', () => {
    const index = 2147483647; // 2^31 - 1, max 32-bit signed integer
    const expectedHex = '000000007fffffff'; // Corresponding hex representation

    const result = utils.numberToFeedIndex(index);

    expect(result).toBe(expectedHex);
  });
});


describe('fetchUsersFeedAtIndex', () => {
  let mockBee: jest.Mocked<Bee>;
  let mockFeedReader: jest.Mocked<FeedReader>;
  let mockHandleError: jest.Mock<void, [ErrorObject]>;
  let utils: SwarmChatUtils;

  beforeEach(() => {
    mockBee = {
      downloadData: jest.fn(),
    } as unknown as jest.Mocked<Bee>;

    mockFeedReader = {
      download: jest.fn(),
    } as unknown as jest.Mocked<FeedReader>;

    mockHandleError = jest.fn();

    utils = new SwarmChatUtils(mockHandleError, console as unknown as pino.Logger);
  });

  it('should fetch data at a specific index', async () => {
    const mockData = { json: jest.fn().mockReturnValue({ key: 'value' }) };
    const mockFeedEntry = { reference: 'mockReference', feedIndexNext: '00000002' };
    const index = 1;

    mockFeedReader.download.mockResolvedValue(mockFeedEntry as any);
    mockBee.downloadData.mockResolvedValue(mockData as any);

    const result = await utils.fetchUsersFeedAtIndex(mockBee, mockFeedReader, index);

    expect(mockFeedReader.download).toHaveBeenCalledWith({ index });
    expect(mockBee.downloadData).toHaveBeenCalledWith('mockReference');
    expect(result).toEqual({
      feedCommit: { key: 'value' },
      nextIndex: 2,
    });
  });

  it('should fetch the last index when index is undefined', async () => {
    const mockData = { json: jest.fn().mockReturnValue({ key: 'value' }) };
    const mockFeedEntry = { reference: 'mockReference', feedIndexNext: '00000002' };

    mockFeedReader.download.mockResolvedValue(mockFeedEntry as any);
    mockBee.downloadData.mockResolvedValue(mockData as any);

    const result = await utils.fetchUsersFeedAtIndex(mockBee, mockFeedReader, undefined);

    expect(mockFeedReader.download).toHaveBeenCalledWith({ index: undefined });
    expect(mockBee.downloadData).toHaveBeenCalledWith('mockReference');
    expect(result).toEqual({
      feedCommit: { key: 'value' },
      nextIndex: 2,
    });
  });

  it('should return null and handle errors if index is negative', async () => {
    const index = -1;

    const result = await utils.fetchUsersFeedAtIndex(mockBee, mockFeedReader, index);

    expect(mockHandleError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'fetchUsersFeedAtIndex',
        error: expect.any(String),
      })
    );
    expect(result).toBeNull();
    expect(mockFeedReader.download).not.toHaveBeenCalled();
    expect(mockBee.downloadData).not.toHaveBeenCalled();
  });

  it('should return null and handle errors on download failure', async () => {
    const index = 1;
    mockFeedReader.download.mockRejectedValue(new Error('Download failed'));

    const result = await utils.fetchUsersFeedAtIndex(mockBee, mockFeedReader, index);

    expect(mockHandleError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'fetchUsersFeedAtIndex',
        error: expect.any(Error),
      })
    );
    expect(result).toBeNull();
    expect(mockFeedReader.download).toHaveBeenCalledWith({ index });
    expect(mockBee.downloadData).not.toHaveBeenCalled();
  });

  it('should return null and handle errors on data download failure', async () => {
    const mockFeedEntry = { reference: 'mockReference', feedIndexNext: '00000002' };
    const index = 1;

    mockFeedReader.download.mockResolvedValue(mockFeedEntry as any);
    mockBee.downloadData.mockRejectedValue(new Error('Data download failed'));

    const result = await utils.fetchUsersFeedAtIndex(mockBee, mockFeedReader, index);

    expect(mockHandleError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'fetchUsersFeedAtIndex',
        error: expect.any(Error),
      })
    );
    expect(result).toBeNull();
    expect(mockFeedReader.download).toHaveBeenCalledWith({ index });
    expect(mockBee.downloadData).toHaveBeenCalledWith('mockReference');
  });

  it('should handle a feed entry without a next index', async () => {
    const mockData = { json: jest.fn().mockReturnValue({ key: 'value' }) };
    const mockFeedEntry = { reference: 'mockReference', feedIndexNext: undefined };
    const index = 1;

    mockFeedReader.download.mockResolvedValue(mockFeedEntry as any);
    mockBee.downloadData.mockResolvedValue(mockData as any);

    const result = await utils.fetchUsersFeedAtIndex(mockBee, mockFeedReader, index);

    expect(result).toEqual({
      feedCommit: { key: 'value' },
      nextIndex: NaN,
    });
  });
});


describe('getLatestFeedIndex', () => {
  let mockBee: jest.Mocked<Bee>;
  let mockFeedReader: jest.Mocked<FeedReader>;
  let mockUtils: SwarmChatUtils;

  beforeEach(() => {
    mockBee = {
      makeFeedReader: jest.fn(),
    } as unknown as jest.Mocked<Bee>;

    mockFeedReader = {
      download: jest.fn(),
    } as unknown as jest.Mocked<FeedReader>;

    mockUtils = new SwarmChatUtils(jest.fn(), console as unknown as pino.Logger);

    mockBee.makeFeedReader.mockReturnValue(mockFeedReader);
  });

  it('should return latestIndex and nextIndex on successful download', async () => {
    const topic = 'testTopic';
    const address = '0x1234567890abcdef';
    const mockFeedEntry = {
      feedIndex: '00000001',
      feedIndexNext: '00000002',
    };

    mockFeedReader.download.mockResolvedValue(mockFeedEntry as any);

    const result = await mockUtils.getLatestFeedIndex(mockBee, topic, address as EthAddress);

    expect(mockBee.makeFeedReader).toHaveBeenCalledWith('sequence', topic, address);
    expect(mockFeedReader.download).toHaveBeenCalled();
    expect(result).toEqual({ latestIndex: 1, nextIndex: 2 });
  });

  it('should return {latestIndex: -1, nextIndex: 0} if feed not found', async () => {
    const topic = 'testTopic';
    const address = '0x1234567890abcdef';

    const notFoundError = new Error('Not Found');
    mockFeedReader.download.mockRejectedValue(notFoundError);
    jest.spyOn(mockUtils, 'isNotFoundError').mockReturnValue(true);

    const result = await mockUtils.getLatestFeedIndex(mockBee, topic, address as EthAddress);

    expect(mockBee.makeFeedReader).toHaveBeenCalledWith('sequence', topic, address);
    expect(mockFeedReader.download).toHaveBeenCalled();
    expect(mockUtils.isNotFoundError).toHaveBeenCalledWith(notFoundError);
    expect(result).toEqual({ latestIndex: -1, nextIndex: 0 });
  });

  it('should throw an error if an unexpected error occurs', async () => {
    const topic = 'testTopic';
    const address = '0x1234567890abcdef';

    const unexpectedError = new Error('Unexpected error');
    mockFeedReader.download.mockRejectedValue(unexpectedError);
    jest.spyOn(mockUtils, 'isNotFoundError').mockReturnValue(false);

    await expect(mockUtils.getLatestFeedIndex(mockBee, topic, address as EthAddress)).rejects.toThrow('Unexpected error');

    expect(mockBee.makeFeedReader).toHaveBeenCalledWith('sequence', topic, address);
    expect(mockFeedReader.download).toHaveBeenCalled();
    expect(mockUtils.isNotFoundError).toHaveBeenCalledWith(unexpectedError);
  });
});
