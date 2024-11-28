import pino from "pino";
import { ErrorObject } from "../src/types";
import { SwarmChatUtils } from "../src/utils";


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