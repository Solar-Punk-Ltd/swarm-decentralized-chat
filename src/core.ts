import { BatchId, Bee, Reference } from '@ethersphere/bee-js';
import { ethers, Signature } from 'ethers';
import pino from 'pino';
import pinoPretty from 'pino-pretty';

import { 
  generateGraffitiFeedMetadata,
  generateUserOwnedFeedId, 
  getActiveUsers, 
  getLatestFeedIndex, 
  graffitiFeedReaderFromTopic, 
  graffitiFeedWriterFromTopic, 
  isNotFoundError, 
  removeDuplicateUsers, 
  retryAwaitableAsync, 
  RunningAverage, 
  selectUsersFeedCommitWriter, 
  uploadObjectToBee, 
  validateUserObject 
} from './utils';
import { EventEmitter } from './eventEmitter';
import { AsyncQueue } from './asyncQueue';

import { 
  ChatSettings,
  ErrorObject,
  EthAddress, 
  MessageData, 
  ParticipantDetails, 
  User, 
  UserActivity, 
  UsersFeedCommit, 
  UserWithIndex
} from './types';

import { EVENTS, HEX_RADIX, MINUTE, SECOND } from './constants';

/**
 * Swarm Decentralized Chat
 */
export class SwarmChat {
  /** Variables that will be constant for this SwarmChat instance */
  private USERS_FEED_TIMEOUT: number;                                       // Timeout when writing UsersFeedCommit
  private REMOVE_INACTIVE_USERS_INTERVAL = 1 * MINUTE;
  private IDLE_TIME = 1 * MINUTE;                                           // User will be removed from readMessage loop after this time, until rejoin
  private USER_LIMIT = 20;                                                  // Maximum active users

  private USER_UPDATE_INTERVAL = 8 * SECOND;                                // User-side user update interval

  private MAX_TIMEOUT = 1200;                                               // Max timeout in ms
  private INCREASE_LIMIT = 400;                                             // When to increase max parallel request count (avg request time in ms)
  private DECREASE_LIMIT = 800;                                             // When to decrease max parallel request count (avg request time in ms)

  private FETCH_INTERVAL_INCREASE_LIMIT = 1000;                             // Lower the frequency of message fetch
  private FETCH_INTERVAL_DECREASE_LIMIT = 800;                              // Higher frequency for message fetch
  private MESSAGE_FETCH_MIN = 300;                                          // Lowest message fetch frequency (ms)
  private MESSAGE_FETCH_MAX = 8 * SECOND;                                   // Highest message fetch frequency (ms)
  private F_STEP = 100;                                                     // Message fetch step (ms)

  /** Actual variables, like Bee instance, messages, analytics, user list, etc */
  private bee = new Bee('http://localhost:1633');
  private emitter = new EventEmitter();
  private messages: MessageData[] = [];
  private reqTimeAvg = new RunningAverage(1000);
  private usersQueue: AsyncQueue = new AsyncQueue({ indexed: false, waitable: true, max: 1 });
  private messagesQueue: AsyncQueue = new AsyncQueue({ indexed: false, waitable: true, max: 4 });
  private users: UserWithIndex[] = [];
  private usersLoading = false;
  private usersFeedIndex: number = 0;                                       // Will be overwritten on user-side, by initUsers
  private ownIndex: number = -2;
  private removeIdleUsersInterval: NodeJS.Timeout | null = null;            // Streamer-side interval, for idle user removing
  private userFetchInterval: NodeJS.Timeout | null = null;                  // User-side interval, for user fetching (object created by setInterval)
  private messageFetchInterval: NodeJS.Timeout | null = null;               // User-side interval, for message fetching (object created by setInterval)
  private mInterval: number = this.MESSAGE_FETCH_MIN * 3;                   // We initialize message fetch interval to higher than min, we don't know network conditions yet
  private messagesIndex = 0;
  private removeIdleIsRunning = false;                                      // Avoid race conditions
  private userActivityTable: UserActivity = {};                             // Used to remove inactive users
  private newlyResigeredUsers: UserWithIndex[] = [];                        // keep track of fresh users
  private reqCount = 0;                                                     // Diagnostics only
  private prettyStream = pinoPretty({                                       // Colorizing capability for logger
    colorize: true,
    translateTime: 'SYS:standard',
    ignore: "pid,hostname"
  });
  private logger = pino(this.prettyStream);                                 // Logger. Levels: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent"
  
  
  private eventStates: Record<string, boolean> = {                          // Which operation is in progress, if any
    loadingInitUsers: false,
    loadingUsers: false,
    loadingRegistration: false,
  };

  // Constructor, static variables will get value here
  constructor(settings: ChatSettings = {}, beeInstance?: Bee, eventEmitter?: EventEmitter) {
    this.bee = this.bee = beeInstance || new Bee(settings.url || 'http://localhost:1633');
    this.emitter = eventEmitter || new EventEmitter();
    
    this.USERS_FEED_TIMEOUT = settings.usersFeedTimeout || 8 * SECOND;                      // Can adjust UsersFeedCommit write timeout, but higher values might cause SocketHangUp in Bee
    this.REMOVE_INACTIVE_USERS_INTERVAL = settings.removeInactiveInterval || 1 * MINUTE;    // How often run removeIdleUsers
    this.IDLE_TIME = settings.idleTime || 1 * MINUTE;                                       // Can adjust idle time, after that, usser is inactive (messages not polled)
    this.USER_LIMIT = settings.userLimit || 20;                                             // Overwrites IDLE_TIME, maximum active users

    this.USER_UPDATE_INTERVAL = settings.userUpdateInterval || 8 * SECOND;                  // Burnt-in value of user update interval (will not change)

    this.MAX_TIMEOUT = settings.maxTimeout || 1200;                                         // Max timeout for read message, if too low, won't be able to read messages. Higher values will slow down the chat
    this.INCREASE_LIMIT = settings.maxParallelIncreaseLimit || 400;                         // Below this, max parallel request count of the messageQueue is increased 
    this.DECREASE_LIMIT = settings.maxParallelDecreaseLimit || 800;                         // Above this, max parallel request count of the messageQueue is decreased

    this.FETCH_INTERVAL_INCREASE_LIMIT = settings.fetchIntervalIncreaseLimit || 1000;       // Above this, message fetch interval is increased (lower frequency)
    this.FETCH_INTERVAL_DECREASE_LIMIT = settings.fetchIntervalDecreaseLimit || 800;        // Below this, message fetch interval is decreased (higher frequency)
    this.MESSAGE_FETCH_MIN = settings.messageFetchMin || 300;                               // Lowest possible value for message fetch interval
    this.MESSAGE_FETCH_MAX = settings.messageFetchMax || 8 * SECOND;                        // Highest possible value for message fetch interval
    this.F_STEP = settings.fStep || 100;                                                    // When interval is changed, it is changed by this value
    
    this.logger = pino({ level: settings.logLevel || "warn" }, this.prettyStream);          // Logger can be set to "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent"
  }

  // Should be used on front end, to be able to start chat, listen to events
  getChatActions() {
    return {
      startFetchingForNewUsers: this.enqueueUserFetch,
      startLoadingNewMessages: this.readMessagesForAll,
      on: this.emitter.on,
      off: this.emitter.off,
    };
  }

  // Creates the Users feed, which is necesarry for user registration, and to handle idle users
  // Should be called from outside the library, for example React
  public async initChatRoom(topic: string, stamp: BatchId) {
    try {
      const { consensusHash, graffitiSigner } = generateGraffitiFeedMetadata(topic);
      await this.bee.createFeedManifest(stamp, 'sequence', consensusHash, graffitiSigner.address);

    } catch (error) {
      this.handleError({
        error: error as unknown as Error,
        context: `Could not create Users feed!`,
        throw: true
      });
    }
  }

  // startUserFetchProcess will periodically read the Users feed
  // Should be called from outside the library, for example React
  public startUserFetchProcess(topic: string) {
    if (this.userFetchInterval) {
      clearInterval(this.userFetchInterval);
    }
    this.userFetchInterval = setInterval(this.enqueueUserFetch(topic), this.USER_UPDATE_INTERVAL);
  }

  // stopUserFetchProcess clears the interval, that periodically reads the Users feed
  // Should be called from outside the library, for example React
  public stopUserFetchProcess() {
    if (this.userFetchInterval) {
      clearInterval(this.userFetchInterval);
      this.userFetchInterval = null;
    }
  }

  // startMessageFetchProcess will periodically read next message, for all active users
  // Should be called from outside the library, for example React
  public startMessageFetchProcess(topic: string) {
    if (this.messageFetchInterval) {
      clearInterval(this.messageFetchInterval);
    }
    this.messageFetchInterval = setInterval(this.readMessagesForAll(topic), this.mInterval);
  }

  // clears the interval, that periodically reads messages for all active users
  // Should be called from outside the library, for example React
  public stopMessageFetchProcess() {
    if (this.messageFetchInterval) {
      clearInterval(this.messageFetchInterval);
      this.messageFetchInterval = null;
    }
  }

  // Initializes the users object, when starting the application
  // Should be called from outside the library, for example React
  public async initUsers(topic: string, ownAddress: EthAddress, stamp: BatchId) {
    try {
      this.emitStateEvent(EVENTS.LOADING_INIT_USERS, true);

      const feedReader = graffitiFeedReaderFromTopic(this.bee, topic);
      let aggregatedList: UserWithIndex[] = [];

      const feedEntry = await feedReader.download();
      this.usersFeedIndex = parseInt(feedEntry.feedIndexNext, HEX_RADIX);

      // Go back, until we find an overwrite commit
      for (let i = this.usersFeedIndex-1; i >= 0 ; i--) {
        const feedEntry = await feedReader.download({ index: i});
        const data = await this.bee.downloadData(feedEntry.reference);
        const objectFromFeed = data.json() as unknown as UsersFeedCommit;
        const validUsers = objectFromFeed.users.filter((user) => validateUserObject(user, this.handleError));
        if (objectFromFeed.overwrite) {                             // They will have index that was already written to the object by Activity Analysis writer
          const usersBatch: UserWithIndex[] = validUsers as unknown as UserWithIndex[];
          aggregatedList = [...aggregatedList, ...usersBatch];
          //TODO either quit, or check just the previous message
          // because that might be a registration, that was not recorded yet, in overwrite commit message
          // We could go back until we find a timestamp, that has lower timestamp than now-IDLE
          break;
        } else {                                                    // These do not have index, but we can initialize them to 0
          const userTopicString = generateUserOwnedFeedId(topic, validUsers[0].address);
          const res = await getLatestFeedIndex(this.bee, this.bee.makeFeedTopic(userTopicString), validUsers[0].address);

          const newUser =  { 
            ...validUsers[0], 
            index: res.latestIndex
          };
          
          aggregatedList = [...aggregatedList, newUser];
        }
      }

      await this.setUsers(aggregatedList);

    } catch (error) {
      this.handleError({
        error: error as unknown as Error,
        context: `initUsers`,
        throw: true
      });
    } finally {
      this.emitStateEvent(EVENTS.LOADING_INIT_USERS, false);
    }
  }

  // Checks if a given Ethereum address is registered or not
  // Should be called from outside the library, for example React
  public isRegistered(userAddress: EthAddress): boolean {
    const findResult = this.users.findIndex((user) => user.address === userAddress);

    if (findResult === -1) return false;
    else return true;
  }

  // Registers the user for chat, will create a UsersFeedCommit object, and will write it to the Users feed
  // Should be called from outside the library, for example React
  public async registerUser(topic: string, { participant, key, stamp, nickName: username }: ParticipantDetails) {
    try {
      this.emitStateEvent(EVENTS.LOADING_REGISTRATION, true);
    
      const wallet = new ethers.Wallet(key);
      const address = wallet.address as EthAddress;
      
      if (address.toLowerCase() !== participant.toLowerCase()) {
        throw new Error('The provided address does not match the address derived from the private key');
      }

      this.startActivityAnalyzes(topic, address, stamp as BatchId);                  // Every User is doing Activity Analysis, and one of them is selected to write the UsersFeed

      const alreadyRegistered = this.users.find((user) => user.address === participant);

      if (alreadyRegistered) {
        this.logger.info('User already registered');
        return;
      }

      const timestamp = Date.now();
      const signature = (await wallet.signMessage(
        JSON.stringify({ username, address, timestamp }),
      )) as unknown as Signature;

      const newUser: User = {
        address,
        username,
        timestamp,
        signature,
      };

      if (!validateUserObject(newUser, this.handleError)) {
        throw new Error('User object validation failed');
      }

      const uploadObject: UsersFeedCommit = {
        users: [newUser],
        overwrite: false
      }

      const userRef = await uploadObjectToBee(this.bee, uploadObject, stamp as any, this.handleError);
      if (!userRef) throw new Error('Could not upload user to bee');

      const feedWriter = graffitiFeedWriterFromTopic(this.bee, topic);

      try {
        await feedWriter.upload(stamp, userRef.reference);
      } catch (error) {
        if (isNotFoundError(error)) {
          await feedWriter.upload(stamp, userRef.reference, { index: 0 });
        }
      }
    } catch (error) {
      this.handleError({
        error: error as unknown as Error,
        context: `registerUser`,
        throw: false
      });
    } finally {
      this.emitStateEvent(EVENTS.LOADING_REGISTRATION, false);
    }
  }

  // Every User is doing Activity Analysis, and one of them is selected to write the UsersFeed
  private async startActivityAnalyzes(topic: string, ownAddress: EthAddress, stamp: BatchId) {
    try {
      this.logger.info("Starting Activity Analysis...");
      this.removeIdleUsersInterval = setInterval(() => this.removeIdleUsers(topic, ownAddress, stamp), this.REMOVE_INACTIVE_USERS_INTERVAL);

    } catch (error) {
      this.handleError({
        error: error as unknown as Error,
        context: `startActivityAnalyzes`,
        throw: false
      });
    }
  }

  // Used for Activity Analysis, creates or updates entry in the activity table
  private async updateUserActivityAtRegistration() {
    try {
      
      for (let i = 0; i < this.newlyResigeredUsers.length; i++) {
        const address = this.newlyResigeredUsers[i].address;
        this.logger.info(`New user registered. Inserting ${this.newlyResigeredUsers[i].timestamp} to ${address}`);
        if (this.userActivityTable[address])                                    // Update entry
          this.userActivityTable[address].timestamp = this.newlyResigeredUsers[i].timestamp;
        else                                                                    // Create new entry
          this.userActivityTable[address] = {
            timestamp: this.newlyResigeredUsers[i].timestamp,
            readFails: 0
          }
      }

      this.logger.trace(`User Activity Table:  ${this.userActivityTable}`);

    } catch (error) {
      this.handleError({
        error: error as unknown as Error,
        context: `updateUserActivityAtRegistration`,
        throw: false
      });
    }
  }

  // Used for Activity Analysis, saves last message timestamp into activity table
  private async updateUserActivityAtNewMessage(theNewMessage: MessageData) {
    try {
      this.logger.trace(`New message (updateUserActivityAtNewMessage):  ${theNewMessage}`);

      this.userActivityTable[theNewMessage.address] = {
        timestamp: theNewMessage.timestamp,
        readFails: 0
      }

      this.logger.trace(`User Activity Table (new message received):  ${this.userActivityTable}`);

    } catch (error) {
      this.handleError({
        error: error as unknown as Error,
        context: `updateUserActivityAtNewMessage`,
        throw: false
      });
    }
  }

  // Every user is taking part in removeIdleUsers (Activity Analysis), but only one of them will be selected, for writting the Users feed 
  // This selection is pseudo-random, and it should select the same user in every app instance
  private async removeIdleUsers(topic: string, ownAddress: EthAddress, stamp: BatchId) {
    try {
      this.logger.debug(`UserActivity table inside removeIdleUsers:  ${this.userActivityTable}`);
      if (this.removeIdleIsRunning) {
        this.logger.warn("Previous removeIdleUsers is still running");
        //TODO debug this
        // we could do some statistics about how slow is this node, so it will select it with less chance
        return;
      }
      this.removeIdleIsRunning = true;
      
      const activeUsers = getActiveUsers(this.users, this.userActivityTable, this.IDLE_TIME, this.USER_LIMIT, this.logger);

      if (activeUsers.length === 0) {
        this.logger.info("There are no active users, Activity Analysis will continue when a user registers.");
        await this.writeUsersFeedCommit(topic, stamp, activeUsers);
        if (this.removeIdleUsersInterval) clearInterval(this.removeIdleUsersInterval);
        this.removeIdleIsRunning = false;
        return;
      }

      const selectedUser = selectUsersFeedCommitWriter(activeUsers, this.emitStateEvent, this.logger);

      if (selectedUser === ownAddress) {
        await this.writeUsersFeedCommit(topic, stamp, activeUsers);
      }
      
      this.removeIdleIsRunning = false;

    } catch (error) {
      this.removeIdleIsRunning = false;
      this.handleError({
        error: error as unknown as Error,
        context: `removeIdleUsers`,
        throw: false
      });
    }
  }

  // Write a UsersFeedCommit to the Users feed, which might remove some inactive users from the readMessagesForAll loop
  private async writeUsersFeedCommit(topic: string, stamp: BatchId, activeUsers: UserWithIndex[]) {
    try {
      this.logger.info("The user was selected for submitting the UsersFeedCommit! (removeIdleUsers)");
      const uploadObject: UsersFeedCommit = {
        users: activeUsers as UserWithIndex[],
        overwrite: true
      }
      const userRef = await uploadObjectToBee(this.bee, uploadObject, stamp as any, this.handleError);
      if (!userRef) throw new Error('Could not upload user list to bee');

      const feedWriter = graffitiFeedWriterFromTopic(this.bee, topic, { timeout: this.USERS_FEED_TIMEOUT });

      await feedWriter.upload(stamp, userRef.reference);
      this.logger.debug("Upload was successful!")    

    } catch (error) {
      this.handleError({
        error: error as unknown as Error,
        context: `writeUsersFeedCommit`,
        throw: false
      });
    }
  }

  // Adds a getNewUsers to the usersQueue, which will fetch new users
  private enqueueUserFetch(topic: string) {
    return () => this.usersQueue.enqueue(
      (index) => this.getNewUsers(topic), 
      this.logger
    );
  }

  // Reads the Users feed, and changes the users object, accordingly
  private async getNewUsers(topic: string) {
    try {
      this.emitStateEvent(EVENTS.LOADING_USERS, true);
    
      const feedReader = graffitiFeedReaderFromTopic(this.bee, topic);
      const feedEntry = await feedReader.download({ index: this.usersFeedIndex });
    
      const data = await this.bee.downloadData(feedEntry.reference);
      const objectFromFeed = data.json() as unknown as UsersFeedCommit;
      this.logger.debug(`New UsersFeedCommit received!  ${objectFromFeed}`)
    
      const validUsers = objectFromFeed.users.filter((user) => validateUserObject(user, this.handleError));

      let newUsers: UserWithIndex[] = [];
      if (!objectFromFeed.overwrite) {
        // Registration
        newUsers = [...this.users];
        const userTopicString = generateUserOwnedFeedId(topic, validUsers[0].address);
        const res = await getLatestFeedIndex(this.bee, this.bee.makeFeedTopic(userTopicString), validUsers[0].address);
        const theNewUser = {
          ...validUsers[0],
          index: res.latestIndex
        };
        newUsers.push(theNewUser);
        this.newlyResigeredUsers.push(theNewUser);
        this.emitStateEvent(EVENTS.USER_REGISTERED, validUsers[0].username);
      } else {
        // Overwrite
        newUsers = removeDuplicateUsers([...this.newlyResigeredUsers, ...validUsers as unknown as UserWithIndex[]]);
        this.newlyResigeredUsers = [];
      }
    
      await this.setUsers(removeDuplicateUsers(newUsers));
      this.usersFeedIndex++;                                                                       // We assume that download was successful. Next time we are checking next index.
    
      // update userActivityTable
      this.updateUserActivityAtRegistration();
      this.emitStateEvent(EVENTS.LOADING_USERS, false);
      
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("timeout")) {
          this.logger.info(`Timeout exceeded.`);
          this.reqTimeAvg.addValue(this.MAX_TIMEOUT, this.logger);
        } else {
          if (!isNotFoundError(error)) {
            this.handleError({
              error: error as unknown as Error,
              context: `getNewUsers`,
              throw: false
            });
          }
        }
      }
    }
  }

  // Goes through the users object, and enqueues a readMessage for each assumably active user
  private readMessagesForAll(topic: string) {
    return async () => {
      const isWaiting = await this.messagesQueue.waitForProcessing();
      if (isWaiting) {
        return;
      }

      for (const user of this.users) {
        this.reqCount++;
        this.logger.trace(`Request enqueued. Total request count: ${this.reqCount}`);
        this.messagesQueue.enqueue(() => this.readMessage(user, topic), this.logger);
      }
    };
  }

  // Reads one message, from a user's own feed
  private async readMessage(user: UserWithIndex, rawTopic: string) {
    try {
      const chatID = generateUserOwnedFeedId(rawTopic, user.address);
      const topic = this.bee.makeFeedTopic(chatID);
    
      let currIndex = user.index;
      if (user.index === -1) {
        this.logger.info("No index found! (user.index in readMessage)");
        const { latestIndex, nextIndex } = await getLatestFeedIndex(this.bee, topic, user.address);
        currIndex = latestIndex === -1 ? nextIndex : latestIndex;
      }
    
      this.adjustParamerets(rawTopic)

      // We measure the request time with the first Bee API request, with the second request, we do not do this, because it is very similar
      const feedReader = this.bee.makeFeedReader('sequence', topic, user.address, { timeout: this.MAX_TIMEOUT });
      const start = Date.now();
      const recordPointer = await feedReader.download({ index: currIndex });
      const end = Date.now();
      this.reqTimeAvg.addValue(end-start, this.logger);
      

      // We download the actual message data
      const data = await this.bee.downloadData(recordPointer.reference);
      const messageData = JSON.parse(new TextDecoder().decode(data)) as MessageData;
    
      //const newUsers = users.map((u) => (u.address === user.address ? { ...u, index: currIndex + 1 } : u));
      const uIndex = this.users.findIndex((u) => (u.address === user.address));
      const newUsers = this.users;
      if (newUsers[uIndex]) newUsers[uIndex].index = currIndex + 1;         // If this User was dropped, we won't increment it's index, but Streamer will
      await this.setUsers(newUsers);
    
      // If the message is relatively new, we insert it to messages array, otherwise, we drop it
      if (messageData.timestamp + this.IDLE_TIME*2 > Date.now()) {
        this.messages.push(messageData);
        // Update userActivityTable
        this.updateUserActivityAtNewMessage(messageData);
        this.messagesIndex++;
      }
    
      // TODO - discuss with the team
      /*if (messages.length > 300) {
        messages.shift();
      }*/
    
      this.emitter.emit(EVENTS.RECEIVE_MESSAGE, this.messages);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("timeout")) {
          //TODO decide between 'warn' and 'info'
          this.logger.info(`Timeout of ${this.MAX_TIMEOUT} exceeded for readMessage.`);
        } else {
          if (!isNotFoundError(error)) {
            if (this.userActivityTable[user.address]) this.userActivityTable[user.address].readFails++;                  // We increment read fail count
            this.handleError({
              error: error as unknown as Error,
              context: `readMessage`,
              throw: false
            });
          }
        }
      }
    }
  }

  // Adjusts maxParallel and message fetch interval
  //TODO this might be an utils function, but we need to pass a lot of paramerers, and in the other direction as well (return)
  private adjustParamerets(topic: string) {
    // Adjust max parallel request count, based on avg request time, which indicates, how much the node is overloaded
    if (this.reqTimeAvg.getAverage() > this.DECREASE_LIMIT) this.messagesQueue.decreaseMax(this.logger);
    if (this.reqTimeAvg.getAverage() < this.INCREASE_LIMIT) this.messagesQueue.increaseMax(this.users.length * 1, this.logger);

    // Adjust message fetch interval
    if (this.reqTimeAvg.getAverage() > this.FETCH_INTERVAL_INCREASE_LIMIT) {
      if (this.mInterval + this.F_STEP <= this.MESSAGE_FETCH_MAX) {
        this.mInterval = this.mInterval + this.F_STEP;
        if (this.messageFetchInterval) clearInterval(this.messageFetchInterval);
        this.messageFetchInterval = setInterval(this.readMessagesForAll(topic), this.mInterval);
        this.logger.info(`Increased message fetch interval to ${this.mInterval} ms`);
      }
    }
    if (this.reqTimeAvg.getAverage() < this.FETCH_INTERVAL_DECREASE_LIMIT) {
      if (this.mInterval - this.F_STEP > this.MESSAGE_FETCH_MIN) {
        this.mInterval = this.mInterval - this.F_STEP;
        if (this.messageFetchInterval) clearInterval(this.messageFetchInterval);
        this.messageFetchInterval = setInterval(this.readMessagesForAll(topic), this.mInterval);
        this.logger.info(`Decreased message fetch interval to ${this.mInterval-this.F_STEP} ms`);
      }
    }
  }

  // Sends a message to the user's own feed
  public async sendMessage(
    address: EthAddress,
    topic: string,
    messageObj: MessageData,
    stamp: BatchId,
    privateKey: string,
  ): Promise<Reference | undefined> {
    try {
      if (!privateKey) throw 'Private key is missing';

      const feedID = generateUserOwnedFeedId(topic, address);
      const feedTopicHex = this.bee.makeFeedTopic(feedID);

      if (this.ownIndex === -2) {
        const { nextIndex } = await getLatestFeedIndex(this.bee, feedTopicHex, address);
        this.ownIndex = nextIndex;
      }

      const msgData = await uploadObjectToBee(this.bee, messageObj, stamp, this.handleError);
      if (!msgData) throw 'Could not upload message data to bee';

      const feedWriter = this.bee.makeFeedWriter('sequence', feedTopicHex, privateKey);
      const ref = await feedWriter.upload(stamp, msgData.reference, { index: this.ownIndex });
      this.ownIndex++;

      return ref;
    } catch (error) {
      this.handleError({
        error: error as unknown as Error,
        context: `sendMessage, index: ${this.ownIndex}, message: ${messageObj.message}`,
        throw: false
      });
    }
  }

  // Writes the users object, will avoid collision with other write operation
  private async setUsers(newUsers: UserWithIndex[]) {
    return retryAwaitableAsync(async () => {
      if (this.usersLoading) {
        throw new Error('Users are still loading');
      }
      this.usersLoading = true;
      this.users = newUsers;
      this.usersLoading = false;
    }, undefined, undefined, this.logger);
  }

  // Emit event about state change
  private emitStateEvent(event: string, value: any) {
    if (this.eventStates[event] !== value) {
      this.eventStates[event] = value;
      this.emitter.emit(event, value);
    }
  }

  public getUserCount() {
    return this.users.length;
  }

  private handleError(errObject: ErrorObject) {
    this.logger.error(`Error in ${errObject.context}: ${errObject.error.message}`);
    this.emitter.emit(EVENTS.ERROR, errObject);
    if (errObject.throw) {
      throw new Error(` Error in ${errObject.context}`);
    }
  }

  public changeLogLevel(newLogLevel: string) {
    const possibleLevels = ["fatal", "error", "warn", "info", "debug", "trace", "silent"];

    if (!possibleLevels.includes(newLogLevel)) {
      this.handleError({
        error: new Error("The provided log level does not exist"),
        context: 'changeLogLevel',
        throw: false
      });
      return;
    }

    this.logger = pino({ level: newLogLevel})
  }
}



const x = new SwarmChat()
const { on } = x.getChatActions()
on(EVENTS.ERROR, (error) => {

})