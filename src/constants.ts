export const FIRST_SEGMENT_INDEX = '0000000000000000';

// Consensus ID is used for the Graffiti feed, that is handling user registration
export const CONSENSUS_ID = 'SwarmStream';

// Chat events, used together with getChatActions
export const EVENTS = {
    LOADING_INIT_USERS: 'loadingInitUsers',
    LOADING_USERS: 'loadingUsers',
    LOADING_REGISTRATION: 'loadingRegistration',
    RECEIVE_MESSAGE: 'receiveMessage',
    USER_REGISTERED: 'userRegistered',
    FEED_COMMIT_HASH: 'feedCommitHash',
    ERROR: 'errorEvent'
};

export const SECOND = 1000;
export const MINUTE = SECOND * 60;
export const HOUR = MINUTE * 60;

export const HEX_RADIX = 16;

export const ETH_ADDRESS_LENGTH = 42;
