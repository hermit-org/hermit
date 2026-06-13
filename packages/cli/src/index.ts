#!/usr/bin/env bun
import { Command } from "commander";
import pkg from "../package.json";
import { loadCommands } from "./commands";

const { version } = pkg;

const program = new Command();

program
  .name("hermit")
  .description("Hermit CLI")
  .version(version);

await loadCommands(program);

program.parse();
