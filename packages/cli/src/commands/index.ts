import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { Command } from "commander";

async function scanCommandsDir(dir: string): Promise<Command[]> {
  const commands: Command[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      let parent: Command | undefined;

      try {
        const mod = await import(join(fullPath, "index.ts"));
        if (mod.command instanceof Command) {
          parent = mod.command;
        }
      } catch {
        // no index.ts
      }

      if (!parent) {
        parent = new Command(entry.name);
      }

      const children = await scanCommandsDir(fullPath);
      for (const child of children) {
        parent.addCommand(child);
      }

      commands.push(parent);
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".ts") &&
      entry.name !== "index.ts"
    ) {
      const mod = await import(fullPath);
      if (mod.command instanceof Command) {
        commands.push(mod.command);
      }
    }
  }

  return commands;
}

export async function loadCommands(program: Command): Promise<void> {
  const commands = await scanCommandsDir(import.meta.dir);
  for (const cmd of commands) {
    program.addCommand(cmd);
  }
}
