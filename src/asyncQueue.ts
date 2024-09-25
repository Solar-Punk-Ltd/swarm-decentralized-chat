import pino from "pino";
import { FIRST_SEGMENT_INDEX, HEX_RADIX } from "./constants";
import { ErrorObject } from "./types";

// A promise queue, that will keep a specified max parallel request count
export class AsyncQueue {
  private waitable;
  private clearWaitTime;
  private index;
  private isProcessing = false;
  private inProgressCount = 0;
  private isWaiting = false;
  private queue: ((index?: string) => Promise<void>)[] = [];
  private maxParallel: number;

  private handleError: (errObject: ErrorObject) => void;
  private logger: pino.Logger;

  constructor(
    settings: { 
      index?: string; 
      waitable?: boolean; 
      clearWaitTime?: 
      number;
      max?: number
    } = {},
    handleError: (errObject: ErrorObject) => void,
    logger: pino.Logger
  ) {
    this.index = settings.index || FIRST_SEGMENT_INDEX;
    this.waitable = settings.waitable || false;
    this.clearWaitTime = settings.clearWaitTime || 100;
    this.maxParallel = settings.max || 5;

    this.handleError = handleError;
    this.logger = logger;
  }

  // Executes promises from the AsyncQueue, will execute maxParallel count parallel requests
  private async processQueue() {
    if (this.inProgressCount >= this.maxParallel) return;
    this.isProcessing = true;

    while (this.queue.length > 0 && this.inProgressCount <= this.maxParallel) {
      this.inProgressCount = this.inProgressCount+1;
      const promise = this.queue.shift()!;
      const action = () => promise();

      if (this.waitable) {
        try {
          await action();
          this.index = this.incrementHexString(this.index);
        } catch (error) {
          this.handleError({
            error: error as unknown as Error,
            context: 'Error processing promise',
            throw: false
          });
        } finally {
          this.inProgressCount = this.inProgressCount-1;
        }
      } else {
        action()
          .then(() => {
            this.index = this.incrementHexString(this.index);
          })
          .catch((error) => {
            this.handleError({
              error: error as unknown as Error,
              context: 'Error processing promise',
              throw: false
            });
          })
          .finally(() => {
            this.inProgressCount = this.inProgressCount-1;
          });
      }
    }

    this.isProcessing = false;
  }

  // Enqueue a promise into the AsyncQueue
  enqueue(promiseFunction: (index?: string) => Promise<any>) {
    this.queue.push(promiseFunction);
    this.processQueue();
  }

  // Increase the number of maximum parallel requests
  increaseMax(limit: number) {
    if (this.maxParallel+1 <= limit) {
      this.maxParallel++;
    }
    this.logger.info("Max parallel request set to ", this.maxParallel);
  }

  // Decrease the number of maximum parallel requests
  decreaseMax() {
    if (this.maxParallel > 1) {
      this.maxParallel--;
      this.logger.info("Max parallel request set to ", this.maxParallel);
    }
  }

  // Waits for in-progress promises, then clears the queue
  async clearQueue() {
    this.queue = [];
    while (this.isProcessing || this.inProgressCount > 0) {
      await this.sleep(this.clearWaitTime);
    }
  }

  //TODO need to understand this part
  async waitForProcessing() {
    if (this.isWaiting) return true;

    this.isWaiting = true;

    while (this.isProcessing || this.inProgressCount > 0) {
      await this.sleep(this.clearWaitTime);
    }

    this.isWaiting = false;
  }

  public getMaxParallel(): number {
    return this.maxParallel;
  }

  //---Was copied here for AsyncQueue---
  // TODO: Move the whole AsyncQueue to utils, but in a way, that it stays in this file
  // Increment hex string, default value is 1
  incrementHexString(hexString: string, i = 1n) {
    const num = BigInt('0x' + hexString);
    return (num + i).toString(HEX_RADIX).padStart(HEX_RADIX, '0');
  }
  sleep(delay: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, delay);
    });
  }
}
