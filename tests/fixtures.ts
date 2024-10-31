import { BatchId } from "@ethersphere/bee-js";
import { SwarmChat } from "../src/core";
import { DEFAULT_TOPIC_ONE, STAMP } from "./config";
import pino from "pino";
import { SwarmChatUtils } from "../src/utils";
import { ErrorObject } from "../src/types";


/** Create a chat with default topic, not in Gateway Mode */
export async function createInitializedChat() {
    const chatInstance = new SwarmChat();
    const stamp = STAMP as unknown as BatchId;
    chatInstance.initChatRoom(DEFAULT_TOPIC_ONE, stamp);

    return chatInstance;
}

/** Create a chat with default topic, in Gateway Mode */
export async function createInitializedChatGatewayMode() {
    
}

/** Create SwarmChatUtils helper */
export function createUtils() {
    const utils = new SwarmChatUtils((errObject: ErrorObject) => {
        if (errObject.throw) {
            throw new Error(` Error in ${errObject.context}`);
          }
    }, pino());

    return utils;
}