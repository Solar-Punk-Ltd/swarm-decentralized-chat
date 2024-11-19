import { Wallet } from "ethers";
import { SwarmChat } from "../src/core";
import { EthAddress } from "../src/types";
import { BatchId } from "@ethersphere/bee-js";


describe('startActivityAnalyses', () => {
  let chat: SwarmChat;

  beforeEach(() => {
    chat = new SwarmChat();
  });

  it('should periodically call removeIdleUsers', () => {
    jest.useFakeTimers();
    const removeIdleUsersSpy = jest.spyOn(chat as any, 'removeIdleUsers');
    const topic = 'example-topic';
    const ownAddress = Wallet.createRandom().address as EthAddress;
    const stamp = "000" as BatchId

    (chat as any).startActivityAnalyzes(topic, ownAddress, stamp);
    jest.advanceTimersByTime(chat.getDiagnostics().removeInactiveUsersInterval);

    expect(removeIdleUsersSpy).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(chat.getDiagnostics().removeInactiveUsersInterval);
    expect(removeIdleUsersSpy).toHaveBeenCalledTimes(2);
  });
});