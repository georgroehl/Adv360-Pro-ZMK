#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const keymapPath = join(repositoryRoot, "config", "adv360.keymap");
const layoutPath = join(repositoryRoot, "config", "info.json");
const outputPath = join(repositoryRoot, "assets", "keymap.svg");

const keymapSource = readFileSync(keymapPath, "utf8");
const physicalLayout = JSON.parse(readFileSync(layoutPath, "utf8")).layouts.LAYOUT.layout;

function matchingBrace(source, openingBrace) {
  let depth = 0;
  let quote = null;

  for (let index = openingBrace; index < source.length; index += 1) {
    const character = source[index];
    const previous = source[index - 1];

    if (quote) {
      if (character === quote && previous !== "\\") {
        quote = null;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  throw new Error("Unbalanced braces in keymap");
}

function directChildren(source, parentName) {
  const parentMatch = new RegExp(`\\b${parentName}\\s*\\{`).exec(source);
  if (!parentMatch) {
    throw new Error(`Could not find ${parentName} node`);
  }

  const parentOpen = source.indexOf("{", parentMatch.index);
  const parentClose = matchingBrace(source, parentOpen);
  const body = source.slice(parentOpen + 1, parentClose);
  const children = [];

  let index = 0;
  while (index < body.length) {
    const childMatch = /([A-Za-z_][A-Za-z0-9_]*)\s*\{/.exec(body.slice(index));
    if (!childMatch) {
      break;
    }

    const childName = childMatch[1];
    const childStart = index + childMatch.index;
    const childOpen = body.indexOf("{", childStart);
    const childClose = matchingBrace(body, childOpen);

    children.push({
      name: childName,
      body: body.slice(childOpen + 1, childClose),
    });
    index = childClose + 1;
  }

  return children;
}

function parseLayers() {
  const layers = new Map();

  for (const child of directChildren(keymapSource, "keymap")) {
    const displayName = /display-name\s*=\s*"([^"]+)"/.exec(child.body)?.[1];
    const bindingBlock = /bindings\s*=\s*<([\s\S]*?)>;/m.exec(child.body)?.[1];
    if (!displayName || !bindingBlock) {
      continue;
    }

    const withoutComments = bindingBlock
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/.*$/gm, " ");
    const bindings = withoutComments
      .split(/(?=&)/)
      .map((binding) => binding.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    if (bindings.length !== physicalLayout.length) {
      throw new Error(
        `${displayName} contains ${bindings.length} bindings; expected ${physicalLayout.length}`,
      );
    }

    layers.set(child.name, { displayName, bindings });
  }

  return layers;
}

const layers = parseLayers();

const keyLabels = {
  EQUAL: ["=", "⇧ +"],
  MINUS: ["−", "⇧ _"],
  TAB: ["Tab", ""],
  ESC: ["Esc", ""],
  ESCAPE: ["Esc", ""],
  BSLH: ["\\", "⇧ |"],
  SEMI: [";", "⇧ :"],
  SQT: ["'", '⇧ "'],
  LSHFT: ["Shift", ""],
  RSHFT: ["Shift", ""],
  GRAVE: ["`", "⇧ ~"],
  LEFT_BRACKET: ["[", "⇧ {"],
  RIGHT_BRACKET: ["]", "⇧ }"],
  LBKT: ["[", "⇧ {"],
  RBKT: ["]", "⇧ }"],
  BSPC: ["Backspace", ""],
  DEL: ["Delete", ""],
  HOME: ["Home", ""],
  END: ["End", ""],
  PG_UP: ["Page ↑", ""],
  PG_DN: ["Page ↓", ""],
  ENTER: ["Enter", ""],
  SPACE: ["Space", ""],
  LEFT: ["←", ""],
  RIGHT: ["→", ""],
  UP: ["↑", ""],
  UP_ARROW: ["↑", ""],
  DOWN: ["↓", ""],
  COMMA: [",", "⇧ <"],
  DOT: [".", "⇧ >"],
  FSLH: ["/", "⇧ ?"],
  CAPS: ["Caps", ""],
  C_VOLUME_UP: ["Volume +", ""],
  C_VOLUME_DOWN: ["Volume −", ""],
  KP_NUM: ["Num Lock", ""],
  KP_EQUAL: ["KP =", ""],
  KP_DIVIDE: ["KP /", ""],
  KP_MULTIPLY: ["KP ×", ""],
  KP_MINUS: ["KP −", ""],
  KP_PLUS: ["KP +", ""],
  KP_ENTER: ["KP Enter", ""],
  KP_DOT: ["KP .", ""],
};

const shiftedDigits = {
  N0: ")",
  N1: "!",
  N2: "@",
  N3: "#",
  N4: "$",
  N5: "%",
  N6: "^",
  N7: "&",
  N8: "*",
  N9: "(",
};

const accentBehaviors = {
  mac_a_umlaut: ["ä", "⇧ Ä"],
  windows_a_umlaut: ["ä", "⇧ Ä"],
  mac_o_umlaut: ["ö", "⇧ Ö"],
  windows_o_umlaut: ["ö", "⇧ Ö"],
  mac_u_umlaut: ["ü", "⇧ Ü"],
  windows_u_umlaut: ["ü", "⇧ Ü"],
  mac_sharp_s: ["ß", "⇧ SS"],
  windows_sharp_s: ["ß", "⇧ SS"],
  mac_e_acute: ["é", "⇧ É"],
  windows_e_acute: ["é", "⇧ É"],
  mac_n_tilde: ["ñ", "⇧ Ñ"],
  windows_n_tilde: ["ñ", "⇧ Ñ"],
  mac_c_cedilla: ["ç", "⇧ Ç"],
  windows_c_cedilla: ["ç", "⇧ Ç"],
  mac_acute_umlaut_dead: ["´", "⇧ ¨ · compose"],
  windows_acute_umlaut_dead: ["´", "⇧ ¨ · compose"],
  mac_grave_tilde_dead: ["`", "⇧ ~ · compose"],
  windows_grave_tilde_dead: ["`", "⇧ ~ · compose"],
  mac_circumflex_dead: ["^", "compose"],
  windows_circumflex_dead: ["^", "compose"],
};

function keyPressLabel(code, context) {
  const isWindows = context === "windows";

  if (keyLabels[code]) {
    return { main: keyLabels[code][0], sub: keyLabels[code][1], type: "key" };
  }

  if (/^[A-Z]$/.test(code)) {
    return { main: code, sub: "", type: "key" };
  }

  if (/^N[0-9]$/.test(code)) {
    return { main: code.slice(1), sub: `⇧ ${shiftedDigits[code]}`, type: "key" };
  }

  if (/^F([1-9]|1[0-2])$/.test(code)) {
    return { main: code, sub: "", type: "function" };
  }

  if (/^KP_N[0-9]$/.test(code)) {
    return { main: `KP ${code.slice(4)}`, sub: "", type: "keypad" };
  }

  if (code === "LCTRL" || code === "RCTRL") {
    return { main: "Ctrl", sub: code.startsWith("R") ? "right" : "left", type: "modifier" };
  }

  if (code === "LGUI" || code === "RGUI") {
    return {
      main: isWindows ? "Win" : "⌘",
      sub: code.startsWith("R") ? "right" : "left",
      type: "modifier",
    };
  }

  if (code === "LALT" || code === "LEFT_ALT") {
    return { main: isWindows ? "Alt" : "⌥", sub: "left", type: "modifier" };
  }

  if (code === "RALT") {
    return { main: isWindows ? "AltGr" : "⌥", sub: "right", type: "modifier" };
  }

  if (code === "LA(LG(LCTRL))") {
    return {
      main: isWindows ? "Ctrl+Alt+Win" : "⌃⌥⌘",
      sub: "shortcut",
      type: "system",
    };
  }

  return { main: code.replaceAll("_", " "), sub: "", type: "key" };
}

function bindingLabel(binding, context) {
  if (binding === "&none") {
    return { main: "", sub: "", type: "unused" };
  }

  if (binding === "&trans") {
    return { main: "BASE", sub: "transparent", type: "transparent" };
  }

  if (binding.startsWith("&kp ")) {
    return keyPressLabel(binding.slice(4), context);
  }

  const behavior = binding.slice(1).split(" ")[0];
  if (accentBehaviors[behavior]) {
    return {
      main: accentBehaviors[behavior][0],
      sub: accentBehaviors[behavior][1],
      type: "accent",
    };
  }

  if (binding === "&win_quote_literal") {
    return { main: "'", sub: '⇧ " · literal', type: "accent" };
  }

  if (binding === "&win_grave_tilde_literal") {
    return { main: "`", sub: "⇧ ~ · literal", type: "accent" };
  }

  if (binding === "&win_six_caret_literal") {
    return { main: "6", sub: "⇧ ^ · literal", type: "accent" };
  }

  if (binding === "&select_mac") {
    return { main: "Mac", sub: "Bluetooth 1", type: "profile" };
  }

  if (binding === "&select_windows") {
    return { main: "Windows", sub: "Bluetooth 2", type: "profile" };
  }

  const bluetoothProfile = /^&bt BT_SEL ([0-4])$/.exec(binding);
  if (bluetoothProfile) {
    return {
      main: `BT ${Number(bluetoothProfile[1]) + 1}`,
      sub: "select profile",
      type: "profile",
    };
  }

  if (binding === "&bt BT_CLR") {
    return { main: "Clear BT", sub: "current profile", type: "danger" };
  }

  if (binding.startsWith("&tog ")) {
    return { main: "Keypad", sub: "toggle", type: "layer" };
  }

  if (binding === "&mo LAYER_MOD") {
    return { main: "Mod", sub: "hold", type: "layer" };
  }

  if (binding === "&mo MAC_FN" || binding === "&mo WINDOWS_FN") {
    return { main: "Fn", sub: "hold", type: "layer" };
  }

  if (binding === "&bootloader") {
    return { main: "Boot", sub: "flash mode", type: "danger" };
  }

  if (binding === "&studio_unlock") {
    return { main: "Studio", sub: "unused", type: "system" };
  }

  if (binding === "&stp STP_BAT") {
    return { main: "Battery", sub: "status", type: "system" };
  }

  if (binding === "&macro_ver") {
    return { main: "Version", sub: "type firmware", type: "system" };
  }

  if (binding === "&bl BL_TOG") {
    return { main: "Keys", sub: "light toggle", type: "system" };
  }

  if (binding === "&rgb_ug RGB_TOG") {
    return { main: "Glow", sub: "RGB toggle", type: "system" };
  }

  if (binding === "&bl BL_INC") {
    return { main: "Light +", sub: "", type: "system" };
  }

  if (binding === "&bl BL_DEC") {
    return { main: "Light −", sub: "", type: "system" };
  }

  return {
    main: binding.replace(/^&/, "").replaceAll("_", " "),
    sub: "",
    type: "system",
  };
}

const panels = [
  {
    layer: "default_layer",
    context: "mac",
    title: "macOS · BASE",
    subtitle: "Bluetooth profile 1 · ABC input source",
  },
  {
    layer: "windows",
    context: "windows",
    title: "WINDOWS · BASE",
    subtitle: "Bluetooth profile 2 · US-International · physical Command/Windows ↔ Control",
  },
  {
    layer: "keypad",
    context: "mac",
    title: "KEYPAD",
    subtitle: "Toggle with Keypad · transparent keys follow the active OS base",
  },
  {
    layer: "mac_fn",
    context: "mac",
    title: "FN · INTERNATIONAL",
    subtitle: "Hold either outer Fn key · visible output is identical on macOS and Windows",
  },
  {
    layer: "mod",
    context: "mac",
    title: "MOD · PROFILES & SYSTEM",
    subtitle: "Hold Mod · 1 selects Mac · 2 selects Windows",
  },
];

for (const panel of panels) {
  if (!layers.has(panel.layer)) {
    throw new Error(`Missing keymap layer: ${panel.layer}`);
  }
}

const macFn = layers.get("mac_fn").bindings.map((binding) => bindingLabel(binding, "mac"));
const windowsFn = layers
  .get("windows_fn")
  .bindings.map((binding) => bindingLabel(binding, "windows"));

for (let index = 0; index < macFn.length; index += 1) {
  const macVisible = JSON.stringify(macFn[index]);
  const windowsVisible = JSON.stringify(windowsFn[index]);
  if (macVisible !== windowsVisible) {
    throw new Error(
      `Mac and Windows Fn layers differ visually at key ${index}: ${macVisible} != ${windowsVisible}`,
    );
  }
}

const palette = {
  page: "#07090c",
  panel: "#0e1319",
  panelBorder: "#25303a",
  case: "#050607",
  caseEdge: "#343b42",
  key: "#252c33",
  keyEdge: "#525c65",
  text: "#f4f7fa",
  muted: "#97a4ae",
  orange: "#f5a623",
  blue: "#65b9ff",
  red: "#ff6b64",
};

const keyStyles = {
  key: ["#252c33", "#56616b", palette.text],
  function: ["#26323d", "#58768d", "#d8efff"],
  keypad: ["#23372f", "#4b7a66", "#dffbed"],
  modifier: ["#26364b", "#5279a2", "#d9edff"],
  layer: ["#4a351b", "#be7e24", "#fff0cf"],
  accent: ["#4b291f", "#d66f42", "#fff0e7"],
  profile: ["#183a48", "#3e94b0", "#dff8ff"],
  system: ["#302c42", "#70689b", "#eeebff"],
  danger: ["#452222", "#ad5454", "#ffe5e5"],
  transparent: ["#111820", "#28343d", "#677782"],
  unused: ["#0c1116", "#1b242b", "#34414a"],
};

const unit = 73;
const keyGap = 6;
const boardX = 86;
const boardY = 104;
const panelX = 32;
const panelWidth = 1485;
const panelHeight = 702;
const topHeight = 190;
const footerHeight = 78;
const posterWidth = panelWidth + panelX * 2;
const posterHeight = topHeight + panels.length * panelHeight + footerHeight;

function xml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fontSize(label, width) {
  let preferred = 11;
  if (label.length <= 2) preferred = 25;
  else if (label.length <= 5) preferred = 19;
  else if (label.length <= 8) preferred = 16;
  else if (label.length <= 12) preferred = 13;

  return Math.max(8.5, Math.min(preferred, width / Math.max(label.length * 0.59, 1)));
}

function keyboardCase(yOffset) {
  const x = boardX;
  const y = yOffset + boardY;
  const scale = unit;

  const leftPath = [
    `M ${x - 19} ${y - 22}`,
    `H ${x + 6.65 * scale}`,
    `Q ${x + 7.0 * scale} ${y - 22} ${x + 7.18 * scale} ${y + 0.22 * scale}`,
    `L ${x + 9.0 * scale} ${y + 4.1 * scale}`,
    `V ${y + 7.68 * scale}`,
    `Q ${x + 9.0 * scale} ${y + 7.98 * scale} ${x + 8.7 * scale} ${y + 7.98 * scale}`,
    `H ${x + 5.05 * scale}`,
    `Q ${x + 4.78 * scale} ${y + 7.98 * scale} ${x + 4.7 * scale} ${y + 7.7 * scale}`,
    `L ${x + 4.34 * scale} ${y + 5.22 * scale}`,
    `H ${x - 19}`,
    `Q ${x - 38} ${y + 5.22 * scale} ${x - 38} ${y + 4.95 * scale}`,
    `V ${y + 0.05 * scale}`,
    `Q ${x - 38} ${y - 22} ${x - 19} ${y - 22}`,
    "Z",
  ].join(" ");

  const rightPath = [
    `M ${x + 11.35 * scale} ${y - 22}`,
    `H ${x + 18.25 * scale}`,
    `Q ${x + 18.52 * scale} ${y - 22} ${x + 18.52 * scale} ${y + 0.05 * scale}`,
    `V ${y + 4.95 * scale}`,
    `Q ${x + 18.52 * scale} ${y + 5.22 * scale} ${x + 18.25 * scale} ${y + 5.22 * scale}`,
    `H ${x + 13.66 * scale}`,
    `L ${x + 13.3 * scale} ${y + 7.7 * scale}`,
    `Q ${x + 13.22 * scale} ${y + 7.98 * scale} ${x + 12.95 * scale} ${y + 7.98 * scale}`,
    `H ${x + 9.3 * scale}`,
    `Q ${x + 9.0 * scale} ${y + 7.98 * scale} ${x + 9.0 * scale} ${y + 7.68 * scale}`,
    `V ${y + 4.1 * scale}`,
    `L ${x + 10.82 * scale} ${y + 0.22 * scale}`,
    `Q ${x + 11.0 * scale} ${y - 22} ${x + 11.35 * scale} ${y - 22}`,
    "Z",
  ].join(" ");

  return `
    <path d="${leftPath}" class="keyboard-case"/>
    <path d="${rightPath}" class="keyboard-case"/>
  `;
}

function renderKey(position, label, yOffset, index) {
  const x = boardX + position.x * unit;
  const y = yOffset + boardY + position.y * unit;
  const width = (position.w ?? 1) * unit - keyGap;
  const height = (position.h ?? 1) * unit - keyGap;
  const rotation = position.r ?? 0;
  const rotationX = boardX + (position.rx ?? 0) * unit;
  const rotationY = yOffset + boardY + (position.ry ?? 0) * unit;
  const transform = rotation
    ? ` transform="rotate(${rotation} ${rotationX} ${rotationY})"`
    : "";
  const [fill, stroke, textColor] = keyStyles[label.type] ?? keyStyles.system;
  const primaryY = y + height / 2 + (label.sub ? -2 : 7);
  const secondaryY = y + height - 13;
  const primarySize = fontSize(label.main, width - 8);
  const secondarySize = Math.max(
    7.5,
    Math.min(10.5, (width - 8) / Math.max(label.sub.length * 0.54, 1)),
  );

  return `
    <g${transform} data-key-position="${index}">
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10"
            fill="${fill}" stroke="${stroke}" stroke-width="2" filter="url(#key-shadow)"/>
      ${
        label.main
          ? `<text x="${x + width / 2}" y="${primaryY}" text-anchor="middle"
                   fill="${textColor}" font-size="${primarySize}" font-weight="650">${xml(label.main)}</text>`
          : ""
      }
      ${
        label.sub
          ? `<text x="${x + width / 2}" y="${secondaryY}" text-anchor="middle"
                   fill="${label.type === "transparent" ? "#596873" : palette.muted}"
                   font-size="${secondarySize}" font-weight="520">${xml(label.sub)}</text>`
          : ""
      }
    </g>
  `;
}

function renderPanel(panel, panelIndex) {
  const y = topHeight + panelIndex * panelHeight;
  const layer = layers.get(panel.layer);
  const keys = layer.bindings
    .map((binding, index) =>
      renderKey(physicalLayout[index], bindingLabel(binding, panel.context), y, index),
    )
    .join("");

  return `
    <g id="${panel.layer}">
      <rect x="${panelX}" y="${y + 10}" width="${panelWidth}" height="${panelHeight - 20}"
            rx="24" fill="${palette.panel}" stroke="${palette.panelBorder}" stroke-width="2"/>
      <rect x="${panelX + 24}" y="${y + 30}" width="6" height="42" rx="3" fill="${palette.orange}"/>
      <text x="${panelX + 48}" y="${y + 53}" class="panel-title">${xml(panel.title)}</text>
      <text x="${panelX + 48}" y="${y + 75}" class="panel-subtitle">${xml(panel.subtitle)}</text>
      ${keyboardCase(y)}
      ${keys}
    </g>
  `;
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by bin/render_keymap.mjs from config/adv360.keymap and config/info.json. -->
<svg xmlns="http://www.w3.org/2000/svg" width="${posterWidth}" height="${posterHeight}"
     viewBox="0 0 ${posterWidth} ${posterHeight}" role="img"
     aria-labelledby="title description">
  <title id="title">Kinesis Advantage360 Pro personal keymap</title>
  <desc id="description">macOS, Windows, keypad, international function, and system layers.</desc>
  <defs>
    <filter id="key-shadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="3" stdDeviation="2.2" flood-color="#000000" flood-opacity="0.72"/>
    </filter>
    <linearGradient id="page-gradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0b0f14"/>
      <stop offset="100%" stop-color="#050608"/>
    </linearGradient>
    <style>
      text {
        font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .hero-kicker {
        fill: ${palette.orange};
        font-size: 16px;
        font-weight: 750;
        letter-spacing: 3px;
      }
      .hero-title {
        fill: ${palette.text};
        font-size: 42px;
        font-weight: 760;
        letter-spacing: -0.5px;
      }
      .hero-subtitle {
        fill: ${palette.muted};
        font-size: 17px;
        font-weight: 480;
      }
      .panel-title {
        fill: ${palette.text};
        font-size: 20px;
        font-weight: 760;
        letter-spacing: 1.2px;
      }
      .panel-subtitle {
        fill: ${palette.muted};
        font-size: 13px;
        font-weight: 500;
      }
      .keyboard-case {
        fill: ${palette.case};
        stroke: ${palette.caseEdge};
        stroke-width: 2.5;
      }
      .footer {
        fill: #63717c;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 13px;
      }
    </style>
  </defs>

  <rect width="${posterWidth}" height="${posterHeight}" fill="url(#page-gradient)"/>
  <text x="52" y="54" class="hero-kicker">ADVANTAGE360 PRO · PERSONAL FIRMWARE</text>
  <text x="52" y="105" class="hero-title">Georg’s macOS + Windows keymap</text>
  <text x="52" y="139" class="hero-subtitle">
    Exact physical geometry · International characters in firmware · Five Bluetooth profiles
  </text>

  <g transform="translate(1035 53)">
    <rect x="0" y="0" width="18" height="18" rx="5" fill="${keyStyles.accent[0]}" stroke="${keyStyles.accent[1]}"/>
    <text x="27" y="14" fill="${palette.muted}" font-size="12">international / literal</text>
    <rect x="174" y="0" width="18" height="18" rx="5" fill="${keyStyles.modifier[0]}" stroke="${keyStyles.modifier[1]}"/>
    <text x="201" y="14" fill="${palette.muted}" font-size="12">modifier</text>
    <rect x="280" y="0" width="18" height="18" rx="5" fill="${keyStyles.layer[0]}" stroke="${keyStyles.layer[1]}"/>
    <text x="307" y="14" fill="${palette.muted}" font-size="12">layer</text>
  </g>

  ${panels.map(renderPanel).join("")}

  <text x="${posterWidth / 2}" y="${posterHeight - 32}" text-anchor="middle" class="footer">
    Generated from config/adv360.keymap · Rebuild with: node bin/render_keymap.mjs
  </text>
</svg>
`;

writeFileSync(outputPath, svg.replace(/[ \t]+$/gm, ""));
console.log(`Rendered ${outputPath}`);
