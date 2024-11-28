import { BatchId, Bee, Reference } from "@ethersphere/bee-js";
import { SwarmChat } from "../src/core";


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
    
    mockBee.uploadData.mockResolvedValue(mockUploadResult);

    const result = await (chat as any).utils.uploadObjectToBee(mockBee, mockObject, mockStamp);

    expect(serializeGraffitiRecordSpy).toHaveBeenCalledWith(mockObject);
    expect(mockBee.uploadData).toHaveBeenCalledWith(
      mockStamp,
      mockSerializedObject,
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