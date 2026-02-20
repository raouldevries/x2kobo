import { createServer } from "http";
import chalk from "chalk";
import { handleRequest } from "../server/handler.js";

export interface ServeOptions {
  port: number;
  useChrome?: boolean;
}

export async function serve(options: ServeOptions): Promise<void> {
  const { port, useChrome } = options;

  const server = createServer((req, res) => {
    handleRequest(req, res, { useChrome }).catch(() => {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    });
  });

  server.listen(port, () => {
    console.log("");
    console.log(chalk.bold("x2kobo server running"));
    console.log("");
    console.log(`  Web UI:   ${chalk.cyan(`http://localhost:${port}`)}`);
    console.log(`  API:      ${chalk.cyan(`http://localhost:${port}/api/convert`)}`);
    console.log("");
    console.log(chalk.dim("  Press Ctrl+C to stop"));
    console.log("");
    console.log(chalk.dim("  Usage from iOS/Android Shortcuts or curl:"));
    console.log(chalk.dim(`    curl -X POST http://localhost:${port}/api/convert \\`));
    console.log(chalk.dim(`      -H "Content-Type: application/json" \\`));
    console.log(chalk.dim(`      -d '{"url": "https://x.com/user/article/..."}'`));
    console.log("");
  });
}
