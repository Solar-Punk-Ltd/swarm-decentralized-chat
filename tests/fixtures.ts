import { Signature, Wallet } from "ethers";
import { HOUR } from "../src/constants";
import { EthAddress } from "../src/types";


/**
 * Initializes `newlyRegisteredUsers` with the first N users (e.g., Alice, Bob, Carol, Dave, etc.).
 *
 * @param n Number of users to generate.
 * @returns A promise resolving to an array of user entries (newlyRegisteredUsers).
 */
export async function userListWithNUsers(n: number) {
  const HOUR = 60 * 60 * 1000; // Assuming HOUR constant is defined elsewhere
  const timestamps = Array.from({ length: n }, (_, i) => Date.now() - i * HOUR);
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