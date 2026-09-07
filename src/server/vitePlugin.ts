import type { Plugin } from "vite";
import { handlePaypulseHttp } from "./http.js";

export function paypulseApiPlugin(): Plugin {
  return {
    name: "paypulse-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handlePaypulseHttp(req, res).then((handled) => {
          if (!handled) next();
        });
      });
    },
  };
}
