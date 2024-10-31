import { BatchId, Bee } from "@ethersphere/bee-js";
import { SwarmChat } from "../src/core";
import { DEFAULT_TOPIC_ONE, STAMP, URL } from "./config";
import { createInitializedChat, createUtils } from "./fixtures";
import { SwarmChatUtils } from "../src/utils";
import pino from "pino";
import { ErrorObject } from "../src/types";


describe('Core functionalities (chat room creation, registration, message sending', () => {
    let chat: SwarmChat | null = null;
    let utils: SwarmChatUtils | null = null;

    beforeEach(async () => {
        chat = await createInitializedChat();
        utils = createUtils();
    });

    it('should initialize the chat', async () => {
        if (!utils) return;
        const topic = DEFAULT_TOPIC_ONE;
        const stamp = STAMP as unknown as BatchId;

        const chatInstance = new SwarmChat();
        const spyInit = jest.spyOn(chatInstance, 'initChatRoom');
        await chatInstance.initChatRoom(topic, stamp);
        
        expect(spyInit).toHaveBeenCalledWith(topic, stamp);
        expect(chatInstance.getGsocAddress()).toBe(null);
    });

    it('should initialize the chat in Gateway Mode', async () => {
        if (!utils) return;
        const topic = DEFAULT_TOPIC_ONE;
        const stamp = STAMP as unknown as BatchId;

        const chatInstance = new SwarmChat({
            gateway: "86d2154575a43f3bf9922d9c52f0a63daca1cf352d57ef2b5027e38bc8d8f272"
        });
        const spyInit = jest.spyOn(chatInstance, 'initChatRoom');
        await chatInstance.initChatRoom(topic, stamp);

        expect(spyInit).toHaveBeenCalledWith(topic, stamp);
        expect(chatInstance.getGsocAddress()).toBeTruthy();
    });

});