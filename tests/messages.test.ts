import { SwarmChat } from "../src/core";
import { randomizeMessages, someMessages, userListWithNUsers } from "./fixtures";


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