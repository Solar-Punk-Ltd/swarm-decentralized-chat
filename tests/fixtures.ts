import { BatchId } from "@ethersphere/bee-js";
import { SwarmChat } from "../src/core";
import { DEFAULT_TOPIC_ONE, STAMP } from "./config";


export async function createInitializedChat() {
    const chatInstance = new SwarmChat();
    const stamp = STAMP as unknown as BatchId;
    chatInstance.initChatRoom(DEFAULT_TOPIC_ONE, stamp);
}