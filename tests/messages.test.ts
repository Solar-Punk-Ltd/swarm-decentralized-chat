import { Wallet } from "ethers";
import { EVENTS } from "../src/constants";
import { SwarmChat } from "../src/core";
import { generateAlice, randomizeMessages, someMessages, userListWithNUsers } from "./fixtures";
import { BatchId, Reference } from "@ethersphere/bee-js";


describe('orderMessages (interface for external usage)', () => {
  let chat: SwarmChat;

  it('should call utils.orderMessages', async () => {
    chat = new SwarmChat();
    const utilsOrderMessagesSpy = jest.spyOn((chat as any).utils, 'orderMessages');
    const users = await userListWithNUsers(1);
    const origMessages = someMessages(users, 5);
    const randomMessages = randomizeMessages(origMessages);

    chat.orderMessages(randomMessages);

    expect(utilsOrderMessagesSpy).toHaveBeenCalledWith(randomMessages);
  });
});


describe('readMessagesForAll', () => {
  let chat: SwarmChat;

  beforeEach(() => {
    jest.resetAllMocks();

    chat = new SwarmChat();
  });

  it('should return if waitForProcessing is true', () => {
    const enqueueSpy = jest.spyOn((chat as any).messagesQueue, 'enqueue');
    const waitForProcessingSpy = jest.spyOn((chat as any).messagesQueue, 'waitForProcessing');
    waitForProcessingSpy.mockReturnValue(true);

    chat['readMessagesForAll']("example-topic");

    expect(enqueueSpy).not.toHaveBeenCalled();
  });

  it('should enqueue readMessage if waitForProcessing is false', async () => {
    const enqueueSpy = jest.spyOn((chat as any).messagesQueue, 'enqueue');
    const readMessageSpy = jest.spyOn((chat as any), 'readMessage');
    readMessageSpy.mockImplementation(() => { return null });
    const users = await userListWithNUsers(2);
    const waitForProcessingSpy = jest.spyOn((chat as any).messagesQueue, 'waitForProcessing');
    waitForProcessingSpy.mockResolvedValue(false);
    chat['users'] = users;

    const readMessagesForAllFn = chat['readMessagesForAll']("example-topic");
    await readMessagesForAllFn();

    expect(enqueueSpy).toHaveBeenCalledTimes(2);
    users.forEach(user => 
      expect(readMessageSpy).toHaveBeenCalledWith(user, "example-topic")
    );
  });
});


describe('readMessage', () => {
  let chat: SwarmChat;
  const topic = "swarm-topic";

  beforeEach(() => {
    jest.resetAllMocks();

    chat = new SwarmChat();
  });

  it('should call generateUserOwnedFeedId and makeFeedTopic', async () => {
    const alice = await generateAlice();
    const generateUserOwnedFeedIdSpy = jest.spyOn((chat as any).utils, 'generateUserOwnedFeedId');
    const makeFeedTopicSpy = jest.spyOn((chat as any).bee, 'makeFeedTopic');
    const readMessageSpy = jest.spyOn((chat as any), 'readMessage');

    await (chat as any).readMessage(alice, topic);

    expect(generateUserOwnedFeedIdSpy).toHaveBeenCalledWith(topic, alice.address);
    expect(makeFeedTopicSpy).toHaveBeenCalledWith("swarm-topic_EthercastChat_0x683E8486b1b9bCa5f28cC65129B26f3c6bec4a35");
  });

  it('should call getLatestFeedIndex if index is -1', async () => {
    const alice = await generateAlice();
    alice.index = -1;
    const getLatestFeedIndexSpy = jest.spyOn((chat as any).utils, 'getLatestFeedIndex');

    await (chat as any).readMessage(alice, topic);

    expect(getLatestFeedIndexSpy).toHaveBeenCalledWith(chat['bee'], "51c7697d0930d6efba914cdfe9ddc3edcc19eb0db416a89460ac3c0c52566599", alice.address);
  });

  it('should not call getLatestFeedIndex if index is not -1', async () => {
    const alice = await generateAlice();
    const getLatestFeedIndexSpy = jest.spyOn((chat as any).utils, 'getLatestFeedIndex');

    await (chat as any).readMessage(alice, topic);

    expect(getLatestFeedIndexSpy).not.toHaveBeenCalled();
  });

  it('should call adjustParamerets', async () => {
    const alice = await generateAlice();
    const adjustParametersSpy = jest.spyOn(chat as any, 'adjustParameters');

    await (chat as any).readMessage(alice, topic);

    expect(adjustParametersSpy).toHaveBeenCalled();
  });

  it('should create feedReader', async () => {
    const alice = await generateAlice();
    const makeFeedReaderSpy = jest.fn().mockImplementation(() => ({
      download: (index: number) => { return { reference: "SwarmReference" }}
    }));
    chat['bee'].makeFeedReader = makeFeedReaderSpy;

    await (chat as any).readMessage(alice, topic);

    expect(makeFeedReaderSpy).toHaveBeenCalled();
  });

  it('should call downloadData', async () => {
    const alice = await generateAlice();
    const makeFeedReaderSpy = jest.fn().mockImplementation(() => ({
      download: (index: number) => { return { reference: "SwarmReference" }}
    }));
    const downloadDataSpy = jest.fn().mockImplementation(() => null);
    chat['bee'].makeFeedReader = makeFeedReaderSpy;
    chat['bee'].downloadData = downloadDataSpy;

    await (chat as any).readMessage(alice, topic);

    expect(makeFeedReaderSpy).toHaveBeenCalled();
  });

  it('should validateMessageData', async () => {
    const alice = await generateAlice();
    const message = someMessages([alice], 1)[0];
    const makeFeedReaderSpy = jest.fn().mockImplementation(() => ({
      download: (index: number) => { return { reference: "SwarmReference" }}
    }));
    const downloadDataSpy = jest.fn().mockImplementation((input) => "json");
    const textDecoderMock = {
      decode: jest.fn().mockReturnValue(JSON.stringify(message))
    };
    global.TextDecoder = jest.fn(() => textDecoderMock) as any;
    const jsonParseSpy = jest.spyOn(JSON, 'parse').mockImplementation(() => message);
    const validateMessageDataSpy = jest.spyOn((chat as any).utils, 'validateMessageData');

    chat['bee'].makeFeedReader = makeFeedReaderSpy;
    chat['bee'].downloadData = downloadDataSpy;

    await (chat as any).readMessage(alice, topic);

    expect(jsonParseSpy).toHaveBeenCalled()
    expect(validateMessageDataSpy).toHaveBeenCalledWith(message);
  });

  it('should not add message to messages array if timestamp is too old', async () => {
    const alice = await generateAlice();
    const message = someMessages([alice], 1)[0];
    message.timestamp = Date.now() - (chat['IDLE_TIME'] * 3); // Make message very old
    
    const makeFeedReaderSpy = jest.fn().mockImplementation(() => ({
      download: (index: number) => { return { reference: "SwarmReference" }}
    }));
    const downloadDataSpy = jest.fn().mockImplementation(() => 
      new TextEncoder().encode(JSON.stringify(message))
    );

    chat['bee'].makeFeedReader = makeFeedReaderSpy;
    chat['bee'].downloadData = downloadDataSpy;

    const initialMessagesLength = chat['messages'].length;
    await (chat as any).readMessage(alice, topic);

    expect(chat['messages'].length).toBe(initialMessagesLength);
  });

  it('should handle timeout error', async () => {
    const alice = await generateAlice();
    const loggerInfoSpy = jest.spyOn(chat['logger'], 'info');
    
    const makeFeedReaderSpy = jest.fn().mockImplementation(() => ({
      download: () => { 
        throw new Error('timeout exceeded');
      }
    }));

    chat['bee'].makeFeedReader = makeFeedReaderSpy;

    await (chat as any).readMessage(alice, topic);

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining(`Timeout of ${chat['MAX_TIMEOUT']} exceeded`));
  });

  it('should increment read fails for non-not-found errors', async () => {
    const alice = await generateAlice();
    const testError = new Error('Some random error');
    
    const makeFeedReaderSpy = jest.fn().mockImplementation(() => ({
      download: () => { 
        throw testError;
      }
    }));

    chat['bee'].makeFeedReader = makeFeedReaderSpy;
    chat['userActivityTable'][alice.address] = { readFails: 0, timestamp: Date.now() };

    const isNotFoundErrorSpy = jest.spyOn(chat['utils'], 'isNotFoundError').mockReturnValue(false);
    const handleErrorSpy = jest.spyOn(chat as any, 'handleError');

    await (chat as any).readMessage(alice, topic);

    expect(chat['userActivityTable'][alice.address].readFails).toBe(1);
    expect(handleErrorSpy).toHaveBeenCalledWith({
      error: testError,
      context: 'readMessage',
      throw: false
    });
  });

  it('should not increment read fails for not-found errors', async () => {
    const alice = await generateAlice();
    const notFoundError = new Error('Not found');
    
    const makeFeedReaderSpy = jest.fn().mockImplementation(() => ({
      download: () => { 
        throw notFoundError;
      }
    }));

    chat['bee'].makeFeedReader = makeFeedReaderSpy;
    chat['userActivityTable'][alice.address] = { readFails: 0, timestamp: Date.now() };

    const isNotFoundErrorSpy = jest.spyOn(chat['utils'], 'isNotFoundError').mockReturnValue(true);

    await (chat as any).readMessage(alice, topic);

    expect(chat['userActivityTable'][alice.address].readFails).toBe(0);
  });
});


describe('sendMessage', () => {
  let chat: SwarmChat;
  const topic = "swarm-chat-topic";
  const stamp = "valid-stamp" as BatchId;
  
  beforeEach(() => {
    chat = new SwarmChat();
  });
  
  it('should throw private key is missing error when private key is missing', async () => {
    const alice = await generateAlice();
    const wallet = new Wallet("0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae3d8e226e01fdf99");
    const message = someMessages([alice], 1)[0];
    const handleErrorSpy = jest.spyOn(chat as any, 'handleError');

    chat.sendMessage(alice.address, topic, message, stamp, "");

    expect(handleErrorSpy).toHaveBeenCalledWith(expect.objectContaining({
      error: "Private key is missing"
    }));
  });

  it('should call generateUserOwnedFeedId and makeFeedTopic', async () => {
    const alice = await generateAlice();
    const wallet = new Wallet("0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae3d8e226e01fdf99");
    const message = someMessages([alice], 1)[0];
    const generateUserOwnedFeedIdSpy = jest.spyOn((chat as any).utils, 'generateUserOwnedFeedId');
    const makeFeedTopicSpy = jest.spyOn((chat as any).bee, 'makeFeedTopic');

    await chat.sendMessage(alice.address, topic, message, stamp, wallet.privateKey);

    expect(generateUserOwnedFeedIdSpy).toHaveBeenCalledWith(topic, alice.address);
    expect(makeFeedTopicSpy).toHaveBeenCalledWith("swarm-chat-topic_EthercastChat_0x683E8486b1b9bCa5f28cC65129B26f3c6bec4a35");
  });

  it('should call getLatestFeedIndex if ownIndex is -2', async () => {
    const alice = await generateAlice();
    const wallet = new Wallet("0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae3d8e226e01fdf99");
    const message = someMessages([alice], 1)[0];
    const getLatestFeedIndexSpy = jest.spyOn((chat as any).utils, 'getLatestFeedIndex');

    await chat.sendMessage(alice.address, topic, message, stamp, wallet.privateKey);
    
    expect(getLatestFeedIndexSpy).toHaveBeenCalled();
  });
  
  it('should call uploadObjectToBee', async () => {
    const alice = await generateAlice();
    const wallet = new Wallet("0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae3d8e226e01fdf99");
    const message = someMessages([alice], 1)[0];
    const uploadObjectToBeeSpy = jest.spyOn((chat as any).utils, 'uploadObjectToBee');

    chat['ownIndex'] = 0;
    await chat.sendMessage(alice.address, topic, message, stamp, wallet.privateKey);

    expect(uploadObjectToBeeSpy).toHaveBeenCalledWith(chat['bee'], message, stamp);
  });

  it('should throw Could not upload message if msgData is falsy', async () => {
    const alice = await generateAlice();
    const wallet = new Wallet("0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae3d8e226e01fdf99");
    const message = someMessages([alice], 1)[0];
    const uploadObjectToBeeSpy = jest.spyOn((chat as any).utils, 'uploadObjectToBee');
    uploadObjectToBeeSpy.mockImplementation(() => false);
    const handleErrorSpy = jest.spyOn(chat as any, 'handleError');

    chat['ownIndex'] = 0;
    await chat.sendMessage(alice.address, topic, message, stamp, wallet.privateKey);

    expect(handleErrorSpy).toHaveBeenCalledWith({
      error: "Could not upload message data to bee",
      context: `sendMessage, index: 0, message: ${message.message}`,
      throw: false
    });
  });

  it('should upload the reference to the feed', async () => {
    const alice = await generateAlice();
    const wallet = new Wallet("0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae3d8e226e01fdf99");
    const message = someMessages([alice], 1)[0];
    const uploadObjectToBeeSpy = jest.spyOn((chat as any).utils, 'uploadObjectToBee');
    uploadObjectToBeeSpy.mockImplementation(() => "SwarmRef");
    const uploadSpy = jest.fn().mockReturnValue("SwarmRef");
    const makeFeedWriterSpy = jest.fn().mockImplementation(() => ({
      upload: uploadSpy
    }));

    chat['bee'].makeFeedWriter = makeFeedWriterSpy;
    chat['ownIndex'] = 0;
    await chat.sendMessage(alice.address, topic, message, stamp, wallet.privateKey);

    expect(uploadSpy).toHaveBeenCalled();
  });

  it('should increment ownIndex', async () => {
    const alice = await generateAlice();
    const wallet = new Wallet("0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae3d8e226e01fdf99");
    const message = someMessages([alice], 1)[0];
    const uploadObjectToBeeSpy = jest.spyOn((chat as any).utils, 'uploadObjectToBee');
    uploadObjectToBeeSpy.mockImplementation(() => "SwarmRef");
    const uploadSpy = jest.fn().mockReturnValue("SwarmRef");
    const makeFeedWriterSpy = jest.fn().mockImplementation(() => ({
      upload: uploadSpy
    }));

    chat['bee'].makeFeedWriter = makeFeedWriterSpy;
    chat['ownIndex'] = 0;
    await chat.sendMessage(alice.address, topic, message, stamp, wallet.privateKey);

    expect(chat['ownIndex']).toBe(1);
  });
});