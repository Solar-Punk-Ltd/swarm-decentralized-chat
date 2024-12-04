import { BatchId, Bee, Reference } from "@ethersphere/bee-js";
import { SwarmChat } from "../src/core";
import { InformationSignal } from "@anythread/gsoc";

// Mock the InformationSignal class
jest.mock('@anythread/gsoc', () => ({
  InformationSignal: jest.fn().mockImplementation(() => ({
    write: jest.fn(),
    mineResourceId: jest.fn().mockReturnValue({
      resourceId: new Uint8Array([1, 2, 3, 4])
    }),
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
    const handleErrorSpy = jest.spyOn((chat as any).utils, 'handleError');
    const serializeGraffitiRecordSpy = jest.spyOn((chat as any).utils, 'serializeGraffitiRecord');
    
    mockBee.uploadData.mockRejectedValue(mockError);
  
    const result = await (chat as any).utils.uploadObjectToBee(mockBee, mockObject, mockStamp);
  
    expect(serializeGraffitiRecordSpy).toHaveBeenCalledWith(mockObject);
    expect(mockBee.uploadData).toHaveBeenCalledWith(
      mockStamp,
      serializeGraffitiRecordSpy.mock.results[0].value,
      { redundancyLevel: 4 }
    );
    expect(result).toBeNull();
    expect(handleErrorSpy).toHaveBeenCalledWith({
      error: mockError,
      context: 'uploadObjectToBee',
      throw: false
    });
  });
});


describe('sendMessageToGsoc', () => {
  let chat: SwarmChat;
  
  beforeEach(() => {
    const mockWrite = jest.fn().mockResolvedValue({ some: 'uploadedSOC' });
    
    jest.mock('@anythread/gsoc', () => ({
      InformationSignal: jest.fn().mockImplementation(() => ({
        write: mockWrite
      }))
    }));
    
    chat = new SwarmChat();
  });

  it('should successfully send message to GSOC', async () => {
    const url = "http://example.com";
    const stamp = "batch123";
    const topic = "test-topic";
    const resourceId = '0x12345';
    const message = "Test message";

    const InformationSignal = require('@anythread/gsoc').InformationSignal;

    await (chat as any).utils.sendMessageToGsoc(url, stamp, topic, resourceId, message);

    expect(InformationSignal).toHaveBeenCalledWith(url, {
      postageBatchId: stamp,
      consensus: {
        id: `SwarmDecentralizedChat::${topic}`,
        assertRecord: expect.any(Function)
      }
    });

    const mockWrite = InformationSignal.mock.results[0].value.write;
    expect(mockWrite).toHaveBeenCalledWith(message, resourceId);
  });
});


describe('mineResourceId', () => {
  let chat: SwarmChat;
  
  const mockHexToBytes = jest.fn().mockReturnValue(new Uint8Array([5, 6, 7, 8]));
  const mockBytesToHex = jest.fn().mockReturnValue('0x12345');
  const mockHandleError = jest.fn().mockImplementation((errObject) => {
    if (errObject.throw) {
      console.error(`Error in ${errObject.context}`, errObject.error);
    }
  });

  beforeEach(() => {
    jest.mock('@anythread/gsoc', () => ({
      InformationSignal: jest.fn().mockImplementation((url, options) => {
        return {
          
        };
      })
    }));
    
    chat = new SwarmChat();
    
    (chat as any).hexToBytes = mockHexToBytes;
    (chat as any).bytesToHex = mockBytesToHex;
    (chat as any).handleError = mockHandleError;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  it('should call mineResourceId and return hex resource ID', async () => {
    const url = "http://example.com";
    const stamp = "batch123";
    const gateway = "deadbeaf";
    const topic = "test-topic";

    const InformationSignal = require('@anythread/gsoc').InformationSignal;

    const result = await (chat as any).utils.mineResourceId(url, stamp, gateway, topic);

    expect(InformationSignal).toHaveBeenCalledWith(url, {
      postageBatchId: stamp,
      consensus: {
        id: `SwarmDecentralizedChat::${topic}`,
        assertRecord: expect.any(Function)
      }
    });

    expect(result).toBe('01020304');
  });
});