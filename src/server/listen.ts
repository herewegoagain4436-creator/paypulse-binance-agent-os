import { createServer } from "node:http";
import { envNum } from "../core/env.js";
import { handlePaypulseHttp } from "./http.js";

const port = envNum("PAYPULSE_PORT", 8787);

const server = createServer((req, res) => {
  void handlePaypulseHttp(req, res).then((handled) => {
    if (!handled) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
    }
  });
});

server.listen(port, () => {
  console.log(`PayPulse x402 seller + API on http://127.0.0.1:${port}`);
  console.log(`  GET  /svc/market-brief   → HTTP 402`);
  console.log(`  GET  /api/snapshot`);
  console.log(`  POST /api/demo`);
  console.log(`  POST /mcp`);
});
