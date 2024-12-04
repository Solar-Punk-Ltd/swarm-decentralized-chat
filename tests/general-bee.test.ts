import { BatchId, Bee, Reference } from "@ethersphere/bee-js";
import { SwarmChat } from "../src/core";
import { InformationSignal } from "@anythread/gsoc";

// Mock the InformationSignal class
jest.mock('@anythread/gsoc', () => ({
  InformationSignal: jest.fn().mockImplementation(() => ({
    write: jest.fn()
  }))
}));


describe('uploadObjectToBee', () => {
  let chat: SwarmChat;
  let mockBee: jest.Mocked<Bee>;
  let mockStamp: BatchId;
  let mockSerializedObject: string;

  beforeEach(() => {
    mockBee = {
      uploadData: jest.fn(),
    } as unknown as jest.Mocked<Bee>;

    mockStamp = 'mock-batch-id' as unknown as BatchId;

    chat = new SwarmChat();

    jest.spyOn(chat as any, 'handleError');
  });

  it('should call uploadData with correct parameters', async () => {
    const mockObject = { key: 'value' };
    const mockUploadResult = { reference: 'mock-reference' as Reference };
    const serializeGraffitiRecordSpy = jest.spyOn((chat as any).utils, 'serializeGraffitiRecord');
    
    // Capture the serialized object
    let capturedSerializedObject: string | undefined;
    serializeGraffitiRecordSpy.mockImplementation((obj) => {
      capturedSerializedObject = JSON.stringify(obj);
      return capturedSerializedObject;
    });
  
    mockBee.uploadData.mockResolvedValue(mockUploadResult);
  
    const result = await (chat as any).utils.uploadObjectToBee(mockBee, mockObject, mockStamp);
  
    expect(serializeGraffitiRecordSpy).toHaveBeenCalledWith(mockObject);
    expect(mockBee.uploadData).toHaveBeenCalledWith(
      mockStamp,
      capturedSerializedObject,
      { redundancyLevel: 4 }
    );
    expect(result).toEqual(mockUploadResult);
    expect((chat as any).handleError).not.toHaveBeenCalled();
  });

  it('should return null and call handleError if upload fails', async () => {
    const mockObject = { key: 'value' };
    const mockError = new Error('Upload failed');
    
    mockBee.uploadData.mockRejectedValue(mockError);

    const result = await (chat as any).utils.uploadObjectToBee(mockBee, mockObject, mockStamp);

    expect((chat as any).utils.serializeGraffitiRecord).toHaveBeenCalledWith(mockObject);
    expect(mockBee.uploadData).toHaveBeenCalledWith(
      mockStamp,
      mockSerializedObject,
      { redundancyLevel: 4 }
    );
    expect(result).toBeNull();
    expect((chat as any).handleError).toHaveBeenCalledWith({
      error: mockError,
      context: 'uploadObjectToBee',
      throw: false
    });
  });
});


describe('sendMessageToGSOC', () => {
  let chat: SwarmChat;
  let mockBee: jest.Mocked<Bee>;
  let mockStamp: BatchId;
  let mockInformationSignal: jest.Mocked<InformationSignal>;

  beforeEach(() => {
    mockBee = {
      uploadData: jest.fn(),
    } as unknown as jest.Mocked<Bee>;

    mockStamp = 'mock-batch-id' as unknown as BatchId;

    chat = new SwarmChat();

    jest.spyOn(chat as any, 'handleError');

    // Setup mock for InformationSignal
    mockInformationSignal = new InformationSignal(
      'http://mock-url', 
      { 
        postageBatchId: mockStamp, 
        consensus: {
          id: 'SwarmDecentralizedChat::test-topic',
          assertRecord: expect.any(Function)
        }
      }
    ) as jest.Mocked<InformationSignal>;
  });

  it('should call write method with correct parameters', async () => {
    const mockUploadedSoc = {} as any;
    const url = 'http://test-url';
    const topic = 'test-topic';
    const resourceId = '0x123' as any;
    const message = 'test-message';

    (mockInformationSignal.write as jest.Mock).mockResolvedValue(mockUploadedSoc);

    const result = await (chat as any).utils.sendMessageToGsoc(url, mockStamp, topic, resourceId, message);

    expect(InformationSignal).toHaveBeenCalledWith(url, {
      postageBatchId: mockStamp,
      consensus: {
        id: `SwarmDecentralizedChat::${topic}`,
        assertRecord: expect.any(Function)
      }
    });

    expect(mockInformationSignal.write).toHaveBeenCalledWith(message, resourceId);

    expect(result).toBe(mockUploadedSoc);
  });

  //it('should call write')

  //it('should throw error, if write fails')
});