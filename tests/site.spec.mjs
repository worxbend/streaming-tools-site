import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("page loads with a complete catalogue and no application errors", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" ||
      (message.type() === "warning" && message.text().includes("[worxbend]"))
    )
      errors.push(message.text());
  });
  await page.goto("/");
  await expect(page).toHaveTitle(/worxbend/i);
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator("#tool-grid .tool-row")).toHaveCount(8);
  await expect(page.locator("#map-nodes .map-node")).toHaveCount(11);
  await expect(page.locator("#sel-name")).not.toBeEmpty();
  const brokenImages = await page
    .locator("img")
    .evaluateAll((images) =>
      images
        .filter(
          (image) =>
            !image.closest("details:not([open])") &&
            (!image.complete || image.naturalWidth === 0),
        )
        .map((image) => image.src),
    );
  expect(brokenImages).toEqual([]);
  expect(errors).toEqual([]);
});

test("theme preference survives navigation and reload", async ({ page }) => {
  await page.goto("/");
  const before = await page.locator("html").getAttribute("data-theme");
  await page.locator("#theme-toggle").click();
  const after = before === "dark" ? "light" : "dark";
  await expect(page.locator("html")).toHaveAttribute("data-theme", after);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", after);
});

test("map selection is keyboard operable and updates tool details", async ({
  page,
}) => {
  await page.goto("/");
  const node = page.locator('.map-node[data-node="obsctl"]');
  await node.focus();
  await page.keyboard.press("Enter");
  await expect(node).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#sel-name")).toHaveText("obsctl");
  await expect(page.locator('.map-node[aria-pressed="true"]')).toHaveCount(1);
});

test("tool categories filter the directory and restore all tools", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-filter="chat"]').click();
  const shown = page.locator("#tool-grid .tool-row:visible");
  await expect(shown).toHaveCount(2);
  await expect(shown).toContainText(["twi", "yc"]);
  await page.locator('[data-filter="all"]').click();
  await expect(shown).toHaveCount(8);
});

test("Android remote links to an APK and keeps its guide when enhanced", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-filter="control"]').click();
  await expect(page.locator("#tool-grid .tool-row:visible")).toHaveCount(4);
  const node = page.locator('.map-node[data-node="scenedeck-android"]');
  await node.click();
  await expect(page.locator("#sel-name")).toHaveText("SceneDeck Android");
  await expect(page.locator("#sel-connects")).toContainText(
    "Android phone / tablet",
  );
  await page.locator("#sel-install").click();
  const row = page.locator("#tool-scenedeck-android");
  await expect(row.locator("details")).toHaveAttribute("open", "");
  await expect(
    row.getByRole("link", { name: "Download Android APK" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/worxbend/scenedeck-android/releases/latest/download/scenedeck-android-release.apk",
  );
  await expect(row.locator(".copy-button")).toHaveCount(0);
  await expect(row.locator(".install-command")).toHaveCount(0);
  await expect(
    row.getByRole("heading", { name: "Install the Android app" }),
  ).toBeVisible();
  await expect(
    row.getByRole("heading", { name: "Connect to OBS" }),
  ).toBeVisible();
  await expect(row.locator(".app-screenshots img")).toHaveCount(3);
  for (const image of await row.locator(".app-screenshots img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((img) => img.complete && img.naturalWidth > 0))
      .toBe(true);
  }
  await row.getByRole("link", { name: "Read the full privacy policy" }).click();
  await expect(page).toHaveURL(/scenedeck-privacy\.html$/);
  await expect(page.locator("h1")).toHaveText("Privacy Policy");
});

test("content stays within narrow, tablet and desktop viewports", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    document.querySelectorAll("details").forEach((details) => {
      details.open = true;
    }),
  );
  for (const width of [320, 360, 390, 640, 768, 960, 1024, 1200, 1280, 1536]) {
    await page.setViewportSize({ width, height: 900 });
    const sizes = await page.evaluate(() => ({
      content: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(
      sizes.content,
      `horizontal overflow at ${width}px`,
    ).toBeLessThanOrEqual(sizes.viewport + 1);
  }
});

for (const theme of ["dark", "light"]) {
  test(`${theme} theme has no automatically detectable WCAG A/AA violations`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem("worxbend-theme", value),
      theme,
    );
    await page.goto("/");
    await page.locator("details").evaluateAll((details) =>
      details.forEach((detail) => {
        detail.open = true;
      }),
    );
    for (const selection of [null, "twi", "yc"]) {
      if (selection)
        await page.locator(`.map-node[data-node="${selection}"]`).click();
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        result.violations.map((violation) => ({
          id: violation.id,
          help: violation.help,
          nodes: violation.nodes.map((node) => ({
            target: node.target,
            failureSummary: node.failureSummary,
          })),
        })),
      ).toEqual([]);
    }
  });
}

test("essential introduction and navigation remain available without JavaScript", async ({
  browser,
  viewport,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport,
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4174/");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator("#tool-grid .tool-row")).toHaveCount(8);
  await expect(page.locator("#nav a").first()).toBeVisible();
  await page.locator('#nav a[href="#tools"]').click();
  await expect(page).toHaveURL(/#tools$/);
  await page.locator("#tool-grid .tool-row").first().locator("summary").click();
  await expect(
    page.locator("#tool-grid .tool-row").first().locator(".tool-details"),
  ).toHaveAttribute("open", "");
  const android = page.locator("#tool-scenedeck-android");
  await android.locator("summary").click();
  await expect(
    android.getByRole("link", { name: "Download Android APK" }),
  ).toBeVisible();
  await expect(
    android.getByRole("heading", { name: "Install the Android app" }),
  ).toBeVisible();
  await expect(
    android.getByRole("heading", { name: "Connect to OBS" }),
  ).toBeVisible();
  await context.close();
});

test("theme and catalogue still work when local storage is blocked", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
  });
  await page.goto("/");
  await page.locator("#theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.locator('[data-filter="monitor"]').click();
  await expect(page.locator("#tool-grid .tool-row:visible")).toHaveCount(1);
});

test("direct installation links open their details and override an incompatible filter", async ({
  page,
}) => {
  await page.goto("/#tool-obsctl");
  await expect(page.locator("#tool-obsctl .tool-details")).toHaveAttribute(
    "open",
    "",
  );
  await page.locator('[data-filter="chat"]').click();
  await page.locator('.map-node[data-node="obsctl"]').click();
  await page.locator("#sel-install").click();
  await expect(page.locator("#tool-obsctl")).toBeVisible();
  await expect(page.locator("#tool-obsctl .tool-details")).toHaveAttribute(
    "open",
    "",
  );
  await expect(page.locator('[data-filter="all"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("copy command writes the exact installation command", async ({
  page,
  context,
  browserName,
}) => {
  if (browserName === "chromium")
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  else
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async (text) => {
            window.copiedCommand = text;
          },
        },
      });
    });
  await page.goto("/#tool-obsctl");
  const installation = page.locator("#tool-obsctl .install-block").first();
  const expected = await installation.locator("code").textContent();
  await installation.locator(".copy-button").click();
  await expect(page.locator("#copy-status")).toContainText("copied");
  const actual =
    browserName === "chromium"
      ? await page.evaluate(() => navigator.clipboard.readText())
      : await page.evaluate(() => window.copiedCommand);
  expect(actual).toBe(expected);
});

test("blocked clipboard selects the command and explains manual copying", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: () => Promise.reject(new Error("Clipboard blocked")),
      },
    });
  });
  await page.goto("/#tool-obsctl");
  const installation = page.locator("#tool-obsctl .install-block").first();
  const expected = await installation.locator("code").textContent();
  await installation.locator(".copy-button").click();
  await expect(page.locator("#copy-status")).toContainText("selected");
  await expect(installation.locator("pre")).toBeFocused();
  expect(await page.evaluate(() => window.getSelection().toString())).toBe(
    expected,
  );
});

test("scene preview supports keyboard selection", async ({ page }) => {
  await page.goto("/");
  const scenes = page.locator("[data-scene]");
  await scenes.first().focus();
  await page.keyboard.press("ArrowRight");
  const selected = scenes.nth(1);
  await expect(selected).toBeFocused();
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#demo-command")).toHaveText(
    "$ obsctl scene " + (await selected.getAttribute("data-scene")),
  );
  await expect(page.locator("#demo-status")).toContainText(
    "This demo does not connect to OBS.",
  );
  await page.keyboard.press("ArrowDown");
  await expect(scenes.nth(2)).toBeFocused();
  await expect(scenes.nth(2)).toHaveAttribute("aria-pressed", "true");
});

test("repeated installation links reopen a closed disclosure at the same hash", async ({
  page,
}) => {
  await page.goto("/#tool-obsctl");
  const details = page.locator("#tool-obsctl .tool-details");
  await details.locator("summary").click();
  await expect(details).not.toHaveAttribute("open", "");
  await page.locator('.map-node[data-node="obsctl"]').click();
  await page.locator("#sel-install").click();
  await expect(details).toHaveAttribute("open", "");
  await expect(details.locator(".install-content")).toBeVisible();
});

test("the Pages project subpath loads scripts, styles and both local fonts", async ({
  page,
}) => {
  const assets = [];
  page.on("response", (response) => {
    if (response.url().includes("/assets/"))
      assets.push({ url: response.url(), status: response.status() });
  });
  await page.goto("http://127.0.0.1:4175/streaming-tools-site/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("h1")).toBeVisible();
  await page.locator('[data-filter="chat"]').click();
  await expect(page.locator("#tool-grid .tool-row:visible")).toHaveCount(2);
  expect(assets.length).toBeGreaterThanOrEqual(5);
  expect(
    assets.every(
      (asset) =>
        asset.status === 200 &&
        asset.url.includes("/streaming-tools-site/assets/"),
    ),
  ).toBe(true);
  const fonts = await page.evaluate(() =>
    Array.from(document.fonts).map((font) => ({
      family: font.family.replaceAll('"', ""),
      status: font.status,
    })),
  );
  expect(fonts).toEqual(
    expect.arrayContaining([
      { family: "Inter", status: "loaded" },
      { family: "JetBrains Mono", status: "loaded" },
    ]),
  );
});

test("expanded installations use the directory width without page overflow", async ({
  page,
}) => {
  await page.goto("/");
  const row = page.locator("#tool-obsctl");
  await row.locator("summary").click();
  const panel = row.locator(".install-content");
  await expect(panel).toBeVisible();
  const rowBounds = await row.boundingBox();
  const panelBounds = await panel.boundingBox();
  expect(panelBounds.width).toBeGreaterThan(rowBounds.width * 0.8);
  const sizes = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport + 1);
});
