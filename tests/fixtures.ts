import { Signature, Wallet } from "ethers";
import { HOUR, MINUTE, SECOND } from "../src/constants";
import { EthAddress, MessageData, User, UserActivity, UserWithIndex } from "../src/types";


/**
 * Initializes `newlyRegisteredUsers` with the first N users (e.g., Alice, Bob, Carol, Dave, etc.).
 *
 * @param n Number of users to generate.
 * @returns A promise resolving to an array of user entries (newlyRegisteredUsers).
 */
export async function userListWithNUsers(n: number) {
  const HOUR = 60 * 60 * 1000;
  const timestamps = Array.from({ length: n }, (_, i) => Date.now() - i * MINUTE);
  const wallets = Array.from({ length: n }, () => Wallet.createRandom());
  const usernames = generateAlphabeticalNames(n);
  const addresses = wallets.map((wallet) => wallet.address as EthAddress);

  const users = await Promise.all(
    usernames.map(async (username, index) => ({
      index,
      username,
      address: addresses[index],
      timestamp: timestamps[index],
      signature: (await wallets[index].signMessage(
        JSON.stringify({
          username,
          address: addresses[index],
          timestamp: timestamps[index],
        })
      )) as unknown as Signature,
    }))
  );

  return users;
}

/**
 * Generates a list of names in alphabetical order, starting with "Alice", "Bob", "Carol", etc.
 *
 * @param n Number of names to generate.
 * @returns Array of generated names.
 */
function generateAlphabeticalNames(n: number): string[] {
  const baseNames = ["Alice", "Bob", "Carol", "Dave", "Eve", "Frank", "Grace", "Heidi", "Ivan", "Judy"];
  const names: string[] = [];
  for (let i = 0; i < n; i++) {
    names.push(baseNames[i % baseNames.length] + (i >= baseNames.length ? ` ${Math.floor(i / baseNames.length)}` : ""));
  }
  return names;
}

export function createMockActivityTable(users: User[], timestamps: number[] = []): UserActivity {
  return users.reduce((acc, user, index) => {
    // If timestamps array is provided, use the value from the array; otherwise, use the user's timestamp
    const userTimestamp = timestamps[index] || user.timestamp;
    
    acc[user.address] = {
      timestamp: userTimestamp,
      readFails: 0
    };
    return acc;
  }, {} as UserActivity);
}

export function someMessages(users: UserWithIndex[], n: number): MessageData[] {
  const resultArr: MessageData[] = [];

  for (let i = 0; i < n; i++) {
    const k = i % users.length; // Round-robin selection of users
    const msg: MessageData = {
      message: `Message ${i}`,
      username: users[k].username,
      address: users[k].address,
      timestamp: Date.now()
    };

    resultArr.push(msg);
  }

  return resultArr;
}

export function randomizeMessages(messages: MessageData[]): MessageData[] {
  // Fisher-Yates shuffle
  for (let i = messages.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [messages[i], messages[j]] = [messages[j], messages[i]];
  }

  return messages;
}