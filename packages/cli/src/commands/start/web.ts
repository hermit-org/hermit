import { Command } from "commander";

function startWeb(): void {
  console.log("Starting Hermit web server on http://localhost:3000");
}

export const command = new Command("web")
  .description("Start the web server")
  .action(startWeb);
