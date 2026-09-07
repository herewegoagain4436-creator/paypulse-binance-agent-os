import { createInterface } from "node:readline";
import { handleMcp } from "./rpc.js";

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const msg = JSON.parse(trimmed);
    const out = await handleMcp(msg);
    process.stdout.write(`${JSON.stringify(out)}\n`);
  } catch (e) {
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: e instanceof Error ? e.message : String(e) },
      })}\n`
    );
  }
});
