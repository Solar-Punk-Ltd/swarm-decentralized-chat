import { Signature } from "ethers";
import { ETH_ADDRESS_LENGTH } from "./constants";
import { PrettyStream } from "pino-pretty";

// Needed for EthAddress
type FlavoredType<Type, Name> = Type & {
    __tag__?: Name;
};
type HexString<Length extends number = number> = FlavoredType<string & {
    readonly length: Length;
}, 'HexString'>;

// Used for GSOC
export interface Bytes<Length extends number> extends Uint8Array {
    readonly length: Length
}
/*export type HexString<Length extends number = number> = FlavoredType<
  string & {
    readonly length: Length
  },
  'HexString'
>*/
export type PrefixedHexString = FlavoredType<string, 'PrefixedHexString'>

export interface GsocSubscribtion {
    close: () => void;
    gsocAddress: Bytes<32>;
}

// This is a hex string of specific length (42)
export type EthAddress = HexString<typeof ETH_ADDRESS_LENGTH>;

// TODO: should be renamed, probably to UserDetails or UserWithKey. Or, it should be merged with other objects
// Client-side user details, includes private key, and stamp
export interface ParticipantDetails {
    nickName: string;
    participant: EthAddress;
    key: string;
    stamp: string;
}

// Message object, contains the message, nickname that is not unique, an Ethereum address, and timestamp
export interface MessageData {
    message: string;
    username: string;
    address: EthAddress;
    timestamp: number;
}

// This is the object that is uploaded to the Graffiti-feed (Users feed)
export interface User {
    username: string;
    address: EthAddress;
    timestamp: number;
    signature: Signature;
}

// UserActivity shows last message timestamp for each user
export interface UserActivity {
    [address: EthAddress]: {
        timestamp: number,
        readFails: number                   // how many times read failed for this user
    };
}

// IdleMs shows how much was a user idle, in ms
export interface IdleMs {
    [address: EthAddress]: number;
}

// This object will be pushed to the Users feed
export interface UsersFeedCommit {
    users: User[];
    overwrite: boolean;
}

// Response of fetchUsersFeedAtIndex
export interface UsersFeedResponse {
    feedCommit: UsersFeedCommit;
    nextIndex: number;
}
  
export interface UserWithIndex extends User {
    index: number;
}

// Where we use it, it is string. Will be used to create SHA hash
export type Sha3Message = string | number[] | ArrayBuffer | Uint8Array;

// SwarmChat settings (for constructor)
export interface ChatSettings {
    url?: string;                               // Bee url with port
    gateway?: string;                           // Overlay address of the gateway
    gsocResourceId?: HexString<number>;         // this is a string
    prettier?: boolean                          // enable prettier lib
    usersFeedTimeout?: number;                  // ms
    removeInactiveInterval?: number;            // ms
    idleTime?: number;                          // ms
    userLimit?: number;                         // Max active users
    messageCheckInterval?: number;              // ms
    userUpdateInterval?: number;                // ms
    maxTimeout?: number;                        // ms, max timeout for readMessage
    maxParallelIncreaseLimit?: number;          // ms
    maxParallelDecreaseLimit?: number;          // ms
    fetchIntervalIncreaseLimit?: number;        // ms
    fetchIntervalDecreaseLimit?: number;        // ms
    messageFetchMin?: number;                   // ms
    messageFetchMax?: number;                   // ms
    fStep?: number;                             // ms, messageFetch limit steps
    logLevel?: string                           // "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent"
}

// Error object that we send in catch blocks
export interface ErrorObject {
    error: Error;
    context: string;
    throw: boolean;
}