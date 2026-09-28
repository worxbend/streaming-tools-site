import http from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = await realpath(
  fileURLToPath(
    new URL(
      process.argv.includes("--built") ? "../_site/" : "../",
      import.meta.url,
    ),
  ),
);
const port = Number(process.env.PORT || 4173);
const basePath = (process.env.BASE_PATH || "").replace(/\/$/, "");
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".json": "application/json",
};
http
  .createServer(async (request, response) => {
    try {
      let pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      );
      if (basePath && !pathname.startsWith(basePath + "/")) {
        response.writeHead(404).end("Not found");
        return;
      }
      pathname = pathname.slice(basePath.length);
      let file = path.resolve(root, "." + pathname);
      if ((await stat(file)).isDirectory())
        file = path.join(file, "index.html");
      file = await realpath(file);
      if (
        !file.startsWith(root + path.sep) ||
        path
          .relative(root, file)
          .split(path.sep)
          .some((part) => part.startsWith("."))
      ) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const data = await readFile(file);
      response.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(data);
    } catch {
      response.writeHead(404).end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`Local site: http://127.0.0.1:${port}`),
  );
