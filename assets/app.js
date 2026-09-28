/* Small, dependency-free enhancements for the streaming tools directory. */
(function () {
  "use strict";

  const data = window.STREAMING_TOOLS || {};
  const query = (selector, root = document) => root.querySelector(selector);
  const all = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));
  const setText = (selector, value) => {
    const element = query(selector);
    if (element) element.textContent = value || "";
  };
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function link(text, href) {
    const node = element("a", "", text);
    node.href = href;
    return node;
  }

  const themeButton = query("#theme-toggle");
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    if (themeButton) {
      themeButton.setAttribute("aria-pressed", String(theme === "light"));
      themeButton.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
      );
      const label = query("[data-theme-label]", themeButton);
      if (label)
        label.textContent = theme === "dark" ? "Light mode" : "Dark mode";
      themeButton.title =
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
    }
  }
  let savedTheme = "dark";
  try {
    savedTheme =
      localStorage.getItem("worxbend-theme") === "light" ? "light" : "dark";
  } catch (_) {
    /* Storage can be disabled. */
  }
  applyTheme(savedTheme);
  if (themeButton)
    themeButton.addEventListener("click", () => {
      const theme =
        document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(theme);
      try {
        localStorage.setItem("worxbend-theme", theme);
      } catch (_) {
        /* Theme still works for this page. */
      }
    });

  const mapButtons = all("#map-nodes .map-node");
  function selectNode(id) {
    const tool = data[id];
    if (!tool) return;
    mapButtons.forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.node === id)),
    );
    const stage = query("#map-stage");
    if (stage) stage.dataset.selected = id;
    setText("#sel-name", tool.name);
    setText("#sel-kind", tool.kind);
    setText("#sel-desc", tool.short || tool.desc);
    setText("#sel-connects", tool.connects);
    const install = query("#sel-install");
    if (install) {
      install.hidden = !tool.installs || tool.installs.length === 0;
      install.href = "#tool-" + id;
    }
  }
  mapButtons.forEach((button) =>
    button.addEventListener("click", () => selectNode(button.dataset.node)),
  );
  const initialNode =
    mapButtons.find(
      (button) => button.getAttribute("aria-pressed") === "true",
    ) || mapButtons[0];
  if (initialNode) selectNode(initialNode.dataset.node);

  let copySequence = 0;
  async function copyCommand(command, pre, button) {
    const sequence = ++copySequence;
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(command);
      if (sequence === copySequence)
        setText("#copy-status", "Installation command copied to clipboard.");
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = "Copy command";
      }, 2200);
    } catch (_) {
      pre.focus();
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(pre);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      if (sequence === copySequence)
        setText(
          "#copy-status",
          "Clipboard access is unavailable. The command is selected; press Ctrl+C or Command+C to copy, or use your device’s Copy action.",
        );
    }
  }

  function populateDetails(row) {
    const tool = data[row.dataset.tool];
    const content = query(".install-content", row);
    if (!tool || !content || content.dataset.populated) return;
    content.dataset.populated = "true";
    content.replaceChildren();
    content.append(element("p", "install-description", tool.desc));
    const chips = element("ul", "detail-chips");
    (tool.detailChips || []).forEach((text) =>
      chips.append(element("li", "chip", text)),
    );
    content.append(chips);
    (tool.installs || []).forEach((install) => {
      const block = element("div", "install-block");
      block.append(element("p", "install-label", install.tag));
      const pre = element("pre", "install-command");
      pre.tabIndex = 0;
      pre.setAttribute(
        "aria-label",
        tool.name + " installation command: " + install.tag,
      );
      pre.append(element("code", "", install.cmd));
      block.append(pre);
      const copy = element("button", "copy-button", "Copy command");
      copy.type = "button";
      copy.setAttribute(
        "aria-label",
        "Copy " + tool.name + " " + install.tag + " installation command",
      );
      copy.addEventListener("click", () => copyCommand(install.cmd, pre, copy));
      block.append(copy);
      const links = element("div", "install-links");
      if (install.inspect)
        links.append(link("Inspect installer ↗", install.inspect));
      if (install.alt) links.append(link(install.alt.text, install.alt.href));
      if (links.childElementCount) block.append(links);
      content.append(block);
    });
    const links = element("div", "project-links");
    if (tool.repo) links.append(link("Source on GitHub ↗", tool.repo));
    if (tool.site) links.append(link("Project website ↗", tool.site));
    content.append(links);
  }

  const rows = all(".tool-row[data-tool]");
  rows.forEach((row) => {
    const details = query(".tool-details", row);
    if (!details) return;
    // Preparing content before interaction preserves native details behavior.
    populateDetails(row);
  });

  const filters = all("[data-filter]");
  function filterTools(category) {
    if (!["all", "control", "monitor", "chat", "live"].includes(category))
      return;
    filters.forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.filter === category),
      ),
    );
    let visible = 0;
    rows.forEach((row) => {
      row.hidden = category !== "all" && row.dataset.category !== category;
      if (!row.hidden) visible += 1;
    });
    setText("#tool-count", visible + (visible === 1 ? " tool" : " tools"));
  }
  filters.forEach((button) =>
    button.addEventListener("click", () => filterTools(button.dataset.filter)),
  );
  filterTools("all");

  function revealHash() {
    let id;
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch (_) {
      return;
    }
    if (!id.startsWith("tool-")) return;
    const row = document.getElementById(id);
    if (!row || !rows.includes(row)) return;
    filterTools("all");
    const details = query(".tool-details", row);
    if (details) details.open = true;
    // The target may have been hidden when the browser first resolved its hash.
    row.scrollIntoView({ block: "start", behavior: "instant" });
  }
  window.addEventListener("hashchange", revealHash);
  revealHash();
  document.addEventListener("click", (event) => {
    const anchor = event.target.closest('a[href^="#tool-"]');
    if (anchor && anchor.hash === window.location.hash) revealHash();
  });

  const scenes = all("[data-scene]");
  function selectScene(name) {
    if (!scenes.some((button) => button.dataset.scene === name)) return;
    scenes.forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.scene === name),
      ),
    );
    setText("#demo-command", "$ obsctl scene " + name);
    setText(
      "#demo-status",
      "Preview scene: " + name + ". This demo does not connect to OBS.",
    );
  }
  scenes.forEach((button, index) => {
    button.addEventListener("click", () => selectScene(button.dataset.scene));
    button.addEventListener("keydown", (event) => {
      let next;
      if (event.key === "ArrowRight" || event.key === "ArrowDown")
        next = (index + 1) % scenes.length;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp")
        next = (index - 1 + scenes.length) % scenes.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = scenes.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      scenes[next].focus();
      selectScene(scenes[next].dataset.scene);
    });
  });
  const initialScene =
    scenes.find((button) => button.getAttribute("aria-pressed") === "true") ||
    scenes[0];
  if (initialScene) selectScene(initialScene.dataset.scene);

  const menuButton = query("#menu-toggle");
  const nav = query("#nav");
  function closeMenu() {
    if (menuButton) menuButton.setAttribute("aria-expanded", "false");
    if (nav) nav.classList.remove("is-open");
  }
  if (menuButton && nav) {
    menuButton.addEventListener("click", () => {
      const open = menuButton.getAttribute("aria-expanded") !== "true";
      menuButton.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("is-open", open);
    });
    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        menuButton.getAttribute("aria-expanded") === "true"
      ) {
        closeMenu();
        menuButton.focus();
      }
    });
  }
})();
