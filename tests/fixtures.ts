import { Signature, Wallet } from "ethers";
import { HOUR } from "../src/constants";
import { EthAddress } from "../src/types";


/**
 * Initializes `newlyRegisteredUsers` with Alice, Bob, and Carol.
 *
 * @returns A promise resolving to an array of user entries (newlyRegisteredUsers).
 */
export async function initializeNewlyRegisteredWith3Users() {
    const timestamps = [Date.now() - 1 * HOUR, Date.now() - 2 * HOUR, Date.now()];
    const wallets = [Wallet.createRandom(), Wallet.createRandom(), Wallet.createRandom()];
    const usernames = ["Alice", "Bob", "Carol"];
    const addresses = wallets.map((wallet) => wallet.address as EthAddress);
  
    const users = await Promise.all(
      usernames.map(async (username, index) => ({
        index: 0,
        username,
        address: addresses[index],
        timestamp: timestamps[index],
        signature: (await wallets[index].signMessage(
          JSON.stringify({
            username,
            addres: addresses[index],
            timestamp: timestamps[index],
          })
        )) as unknown as Signature,
      }))
    );
  
    return users;
  }