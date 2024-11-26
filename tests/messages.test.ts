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