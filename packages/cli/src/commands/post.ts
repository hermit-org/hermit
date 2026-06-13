import { Command } from "commander";
import type { Post } from "@hermit/types";
import { clamp } from "@hermit/utils";

function printPost(): void {
  const post: Post = {
    id: "post-1",
    title: "Hello Hermit",
    content: "Bun workspaces monorepo.",
  };

  const score = clamp(95, 0, 100);
  console.log("Server post:", post, "score:", score);
}

export const command = new Command("post")
  .description("Print a sample post")
  .action(printPost);
