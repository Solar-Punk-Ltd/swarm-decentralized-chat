import { BatchId } from "@ethersphere/bee-js";
import { SwarmChat } from "./core";
import { Wallet } from "ethers";
import { EthAddress, MessageData } from "./types";

const roomId = "layer-2sT";
const stamp = "84b83885ae1e25899f7f3a51f4c585c1bbbaa6eb8ba6004d16888c200e3c02c5" as unknown as BatchId;
const wallet = Wallet.createRandom();
const address = wallet.address as unknown as EthAddress;
const nickName = "Tester0";


async function runTest() {
    const chat = new SwarmChat({
        url: "http://161.97.125.121:1733",
        gateway: "86d2154575a43f3bf9922d9c52f0a63daca1cf352d57ef2b5027e38bc8d8f272",
        gsocResourceId: "50aebeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        logLevel: "info",
    });

    chat.startMessageFetchProcess(roomId);
    chat.startUserFetchProcess(roomId);

    chat.registerUser(roomId, {
        participant: wallet.address as unknown as EthAddress,
        key: wallet.privateKey,
        nickName,
        stamp
    });

    chat.sendMessage(address, roomId, generateMessageObj(address, nickName), stamp, wallet.privateKey)
}

function randomThreadId() {
    const randomPart = Math.random().toString(36).substr(2, 9);
    const timestampPart = Date.now().toString(36);
  
    return `${timestampPart}-${randomPart}`;
}
  

function generateMessageObj(address: EthAddress, username: string) {
    const json = {
        text: `Message at ${Date.UTC}`,
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