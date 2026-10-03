import { cp, mkdir, rm, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "_site");
await rm(output, { recursive: true, force: true });
await mkdir(output);
for (const file of [
  "index.html",
  "scenedeck-privacy.html",
  "favicon.svg",
  "assets",
  ".nojekyll",
  "google44cddf06bf7e8cfb.html",
]) {
  await cp(path.join(root, file), path.join(output, file), { recursive: true });
}
for (const file of ["CNAME", "robots.txt", "sitemap.xml", "404.html"]) {
  if (
    await access(path.join(root, file)).then(
      () => true,
      () => false,
    )
  ) {
    await cp(path.join(root, file), path.join(output, file));
  }
}
console.log("Built _site from an explicit public-file allowlist.");
