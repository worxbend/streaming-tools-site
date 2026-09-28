import { readFile, stat, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Script } from "node:vm";
import { parse } from "parse5";

const root = fileURLToPath(new URL("../", import.meta.url));
const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};
const html = await readFile(path.join(root, "index.html"), "utf8");
const document = parse(html);
const nodes = [];
function walk(node) {
  if (node.tagName) nodes.push(node);
  for (const child of node.childNodes || []) walk(child);
}
walk(document);
const attr = (node, name) =>
  node.attrs?.find((item) => item.name === name)?.value;
const ids = nodes.map((node) => attr(node, "id")).filter(Boolean);
assert(ids.length === new Set(ids).size, "HTML contains duplicate IDs.");
assert(
  nodes.filter((node) => node.tagName === "h1").length === 1,
  "Exactly one H1 is required.",
);
assert(
  attr(
    nodes.find((node) => node.tagName === "html"),
    "lang",
  ),
  "HTML must declare its language.",
);
assert(
  nodes.some((node) => node.tagName === "main"),
  "A main landmark is required.",
);
assert(
  nodes.some(
    (node) =>
      node.tagName === "meta" &&
      attr(node, "name") === "description" &&
      attr(node, "content"),
  ),
  "A meta description is required.",
);
for (const node of nodes) {
  if (node.tagName === "img")
    assert(
      attr(node, "alt") !== undefined,
      "Every image needs alt text (empty for decoration).",
    );
  if (node.tagName === "button")
    assert(attr(node, "type"), "Every button must declare its type.");
  const reference = attr(node, "src") || attr(node, "href");
  if (reference && !/^(?:[a-z]+:|\/\/)/i.test(reference)) {
    if (reference.startsWith("#")) {
      if (reference.length > 1)
        assert(
          ids.includes(reference.slice(1)),
          `Missing anchor target: ${reference}`,
        );
    } else {
      const local = reference.split(/[?#]/)[0];
      assert(
        !local.startsWith("/"),
        `Root-relative asset breaks project Pages: ${local}`,
      );
      const exists = await stat(path.resolve(root, local)).then(
        () => true,
        () => false,
      );
      assert(exists, `Missing local asset: ${local}`);
    }
  }
  if (
    node.tagName === "script" &&
    !attr(node, "src") &&
    !["application/ld+json", "importmap"].includes(attr(node, "type"))
  ) {
    try {
      new Script(node.childNodes.map((child) => child.value || "").join(""));
    } catch (error) {
      failures.push(`Inline script syntax: ${error.message}`);
    }
  }
}
async function checkScripts(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await checkScripts(file);
    else if (file.endsWith(".js")) {
      const result = spawnSync(process.execPath, ["--check", file], {
        encoding: "utf8",
      });
      assert(
        result.status === 0,
        `JavaScript syntax: ${path.relative(root, file)}\n${result.stderr}`,
      );
    }
  }
}
await checkScripts(path.join(root, "assets"));
const dataWindow = {};
new Script(
  await readFile(path.join(root, "assets/data.js"), "utf8"),
).runInNewContext({ window: dataWindow }, { timeout: 1000 });
const catalogue = dataWindow.STREAMING_TOOLS;
const rows = nodes.filter((node) => attr(node, "data-tool"));
const toolKeys = Object.keys(catalogue).filter(
  (key) => catalogue[key].category,
);
assert(
  rows.length === toolKeys.length,
  "Static catalogue and data contain different numbers of tools.",
);
function descendants(node) {
  return (node?.childNodes || []).flatMap((child) => [
    child,
    ...descendants(child),
  ]);
}
function textContent(node) {
  return (node?.value || (node?.childNodes || []).map(textContent).join(" "))
    .replace(/\s+/g, " ")
    .trim();
}
for (const row of rows) {
  const key = attr(row, "data-tool");
  const data = catalogue[key];
  assert(data, `Unknown static catalogue tool: ${key}`);
  if (!data) continue;
  const children = descendants(row);
  const heading = children.find((node) => attr(node, "class") === "tool-name");
  const headingBlock = children.find(
    (node) => attr(node, "class") === "tool-heading",
  );
  const description = descendants(headingBlock).find(
    (node) => attr(node, "class") === "tool-description",
  );
  const language = children.find(
    (node) => attr(node, "class") === "tool-language",
  );
  assert(
    attr(row, "data-category") === data.category,
    `${key}: category differs between HTML and data.`,
  );
  assert(
    textContent(heading) === data.name,
    `${key}: name differs between HTML and data.`,
  );
  assert(
    textContent(description) === data.short,
    `${key}: description differs between HTML and data.`,
  );
  assert(
    textContent(language) === data.detailChips[0],
    `${key}: language differs between HTML and data.`,
  );
}

if (failures.length) {
  console.error(failures.map((message) => `✗ ${message}`).join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Static validation passed: ${nodes.length} HTML elements, local links, accessibility basics and JavaScript syntax.`,
  );
