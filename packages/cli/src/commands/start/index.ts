import { Command } from "commander";

function startServer(): void {
  console.log("Starting Hermit server...");
}

export const command = new Command("start")
  .description("Start services")
  .action(startServer);
