import { Command } from "commander";
import { createPendingPair } from "../lib/pairing";

async function pairAction(): Promise<void> {
  const { code, token } = await createPendingPair();

  console.log("Hermit pairing initiated.");
  console.log("");
  console.log(`Pairing code : ${code}`);
  console.log(`Bearer token : ${token}`);
  console.log("");
  console.log(
    "Enter the pairing code in the Hermit mobile app to authorize this gateway.",
  );
  console.log("This code expires in 5 minutes.");
}

export const command = new Command("pair")
  .description("Generate a pairing code for a mobile client")
  .action(pairAction);
