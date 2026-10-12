import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const privacyPath = "/scenedeck-privacy.html";
const sceneButtons = ".scene-list button[data-scene]";

async function expectTheme(page, theme) {
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(page.locator("#theme-toggle")).toHaveAttribute(
    "aria-pressed",
    String(theme === "light"),
  );
  await expect(page.locator("#theme-toggle")).toHaveAccessibleName(
    `Switch to ${theme === "dark" ? "light" : "dark"} theme`,
  );
}

async function expectScene(page, scene) {
  const selected = page.locator(`${sceneButtons}[data-scene="${scene}"]`);
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator(`${sceneButtons}[aria-pressed="true"]`),
  ).toHaveCount(1);
  await expect(page.locator("#preview-scene")).toBeVisible();
  await expect(page.locator("#preview-scene")).toHaveText(scene);
  await expect(page.locator(".signal-stage")).toHaveAttribute(
    "data-scene",
    scene,
  );
  await expect(page.locator("#demo-command")).toHaveText(
    `$ obsctl scene ${scene}`,
  );
  await expect(page.locator("#demo-status")).toContainText(
    `Preview scene: ${scene}. This demo does not connect to OBS.`,
  );
}

test("mobile menu closes with Escape and returns focus to its trigger", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.locator("#menu-toggle");
  const nav = page.locator("#nav");
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(nav).toBeHidden();
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(nav).toBeVisible();
  await nav.locator("a").first().focus();
  await expect(nav.locator("a").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(nav).toBeHidden();
  await expect(menu).toBeFocused();
});

test("mobile navigation closes after following a section link", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.locator("#menu-toggle");
  const nav = page.locator("#nav");
  await menu.click();
  await expect(nav).toBeVisible();
  await nav.locator('a[href="#tools"]').click();
  await expect(page).toHaveURL(/#tools$/);
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(nav).toBeHidden();
  // Closing through a link must not leave the next toggle out of sync.
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(nav).toBeVisible();
});

test("privacy defaults to dark even with a light system preference", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(privacyPath);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Privacy Policy",
  );
  await expectTheme(page, "dark");
});

for (const theme of ["dark", "light"]) {
  test(`privacy inherits ${theme}, persists its toggle, and carries it back home`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expectTheme(page, "dark");
    if (theme === "light") await page.locator("#theme-toggle").click();
    await expectTheme(page, theme);
    await page.locator('footer a[href="scenedeck-privacy.html"]').click();
    await expect(page).toHaveURL(/\/scenedeck-privacy\.html$/);
    await expectTheme(page, theme);
    await page.reload();
    await expectTheme(page, theme);

    const nextTheme = theme === "dark" ? "light" : "dark";
    await page.locator("#theme-toggle").focus();
    await page.keyboard.press("Enter");
    await expectTheme(page, nextTheme);
    await page.reload();
    await expectTheme(page, nextTheme);
    await page.getByRole("link", { name: /Back to streaming tools/i }).click();
    await expect(page).toHaveURL(/\/(?:index\.html)?$/);
    await expectTheme(page, nextTheme);
    await expect(page.locator("#tool-grid .tool-row")).toHaveCount(8);
    await page.reload();
    await expectTheme(page, nextTheme);
    expect(errors).toEqual([]);
  });

  test(`privacy ${theme} theme has no automatically detectable WCAG A/AA violations`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem("worxbend-theme", value),
      theme,
    );
    await page.goto(privacyPath);
    await expectTheme(page, theme);
    await page.evaluate(() => document.fonts.ready);
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
  });
}

test("keyboard scene selection changes the visible preview and signal stage", async ({
  page,
}) => {
  await page.goto("/");
  await expectScene(page, "Gameplay");
  await page.locator(`${sceneButtons}[data-scene="Gameplay"]`).focus();
  for (const [key, scene] of [
    ["ArrowLeft", "Intro"],
    ["ArrowLeft", "BRB"],
    ["ArrowRight", "Intro"],
    ["End", "BRB"],
    ["Home", "Intro"],
    ["ArrowDown", "Gameplay"],
    ["ArrowUp", "Intro"],
  ]) {
    await page.keyboard.press(key);
    await expectScene(page, scene);
    await expect(
      page.locator(`${sceneButtons}[data-scene="${scene}"]`),
    ).toBeFocused();
  }
  for (const [key, scene] of [
    ["Enter", "Gameplay"],
    ["Space", "BRB"],
  ]) {
    await page.locator(`${sceneButtons}[data-scene="${scene}"]`).focus();
    await page.keyboard.press(key);
    await expectScene(page, scene);
  }
});

for (const path of ["/", privacyPath]) {
  test(`${path} disables computed transitions and animations with reduced motion`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    expect(
      await page.evaluate(
        () => matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
    ).toBe(true);
    await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto");
    const movingElements = await page.evaluate(() => {
      const moving = [];
      for (const element of document.querySelectorAll("*")) {
        for (const pseudo of [null, "::before", "::after"]) {
          const style = getComputedStyle(element, pseudo);
          const hasDuration = (value) =>
            value.split(",").some((duration) => parseFloat(duration) > 0);
          if (
            (style.transitionProperty !== "none" &&
              hasDuration(style.transitionDuration)) ||
            (style.animationName !== "none" &&
              hasDuration(style.animationDuration))
          ) {
            moving.push({
              element:
                element.id ||
                element.tagName + "." + element.getAttribute("class"),
              pseudo,
              transition: style.transition,
              animation: style.animation,
            });
          }
        }
      }
      return moving;
    });
    expect(movingElements).toEqual([]);
  });
}

test("home and its local interactions make no external runtime requests", async ({
  page,
  context,
  baseURL,
}) => {
  const origin = new URL(baseURL).origin;
  const externalRequests = [];
  const sockets = [];
  context.on("request", (request) => {
    const url = new URL(request.url());
    if (["http:", "https:"].includes(url.protocol) && url.origin !== origin)
      externalRequests.push({
        url: request.url(),
        type: request.resourceType(),
      });
  });
  page.on("websocket", (socket) => sockets.push(socket.url()));
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.locator("#theme-toggle").click();
  for (const button of await page.locator(sceneButtons).all())
    await button.click();
  await page.locator('[data-filter="chat"]').click();
  await page.locator('[data-filter="all"]').click();
  await page.locator('.map-node[data-node="scenedeck-android"]').click();
  for (const details of await page.locator("#tool-grid details").all()) {
    if ((await details.getAttribute("open")) === null)
      await details.locator("summary").click();
  }
  // Reveal lazy screenshots as well as eager assets, without following outbound links.
  for (const image of await page.locator("img:visible").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((node) => node.complete)).toBe(true);
  }
  await page.locator("footer").scrollIntoViewIfNeeded();
  await page.waitForLoadState("networkidle");
  expect(externalRequests).toEqual([]);
  expect(sockets, "the local preview must not connect to OBS").toEqual([]);
});
