import { BatchId } from "@ethersphere/bee-js";
import { SwarmChat } from "./core";
import { Wallet } from "ethers";
import { ErrorObject, EthAddress, MessageData } from "./types";
import { SwarmChatUtils } from "./utils";
import pino from "pino";

const roomId = "layer-2sT";
const stamp = "84b83885ae1e25899f7f3a51f4c585c1bbbaa6eb8ba6004d16888c200e3c02c5" as unknown as BatchId;
const wallet = Wallet.createRandom();
const address = wallet.address as unknown as EthAddress;
const nickName = "Alice";
const utils = createUtils();
let nonce = 0;
let registeredOnce = false;

async function runTest() {
    console.info("My name: ", nickName);
    console.info("My address: ", address);

    const chat = new SwarmChat({
        url: "http://161.97.125.121:1733",
        gateway: "86d2154575a43f3bf9922d9c52f0a63daca1cf352d57ef2b5027e38bc8d8f272",
        gsocResourceId: "4a0f000000000000000000000000000000000000000000000000000000000000",
        logLevel: "error",
    });

    chat.startMessageFetchProcess(roomId);
    chat.startUserFetchProcess(roomId);
    chat.initUsers(roomId);

    
    do {
        await chat.registerUser(roomId, {
            participant: wallet.address as unknown as EthAddress,
            key: wallet.privateKey,
            nickName,
            stamp
        });

        console.info("Is Registered: ", chat.isRegistered(address));
        if (chat.isRegistered(address) === false && registeredOnce) console.warn("WARNING! SOMEHOW WE LOST OUR REGISTERED STATUS!")
        if (chat.isRegistered(address)) registeredOnce = true;
        
        await chat.sendMessage(address, roomId, generateMessageObj(nonce, address, nickName), stamp, wallet.privateKey);
        await utils.sleep(5*1000);
        nonce++;
    } while (nonce < 20);
}

/** Create SwarmChatUtils helper */
function createUtils() {
    const utils = new SwarmChatUtils((errObject: ErrorObject) => {
        if (errObject.throw) {
            throw new Error(` Error in ${errObject.context}`);
          }
    }, pino());

    return utils;
}

function randomThreadId() {
    const randomPart = Math.random().toString(36).substr(2, 9);
    const timestampPart = Date.now().toString(36);
  
    return `${timestampPart}-${randomPart}`;
}
  

function generateMessageObj(text: any, address: EthAddress, username: string) {
    const json = {
        text: `Message ${text} at ${new Date()}`,
        threadId: null,
        messageId: randomThreadId(),
        parent: null,
    }
    
    let msgObj: MessageData = {
        message: JSON.stringify(json),
        username,
        address,
        timestamp: Date.now()
    };

    return msgObj;
}

runTest();