const state = {
  view: localStorage.getItem("view") || "paired",
  filter: localStorage.getItem("azucena-filter") || "good",
  query: "",
};

const list = document.querySelector("#movesList");
const imageMovesList = document.querySelector("#imageMovesList");
const scanGrid = document.querySelector("#scanGrid");
const searchInput = document.querySelector("#searchInput");
const visibleCount = document.querySelector("#visibleCount");
const linkedCount = document.querySelector("#linkedCount");
const sectionTitle = document.querySelector("#sectionTitle");
const installButton = document.querySelector("#installButton");
const template = document.querySelector("#moveTemplate");
let deferredPrompt = null;
let openMove = null;

const FILTER_LABELS = {
  all: "ALL MOVES",
  safe: "SAFE ON BLOCK",
  plus: "PLUS ON BLOCK",
  good: "GOOD MOVES",
  fast: "FAST MOVES",
  evasive: "EVASIVE",
  tracking: "TRACKING",
  delayable: "DELAYABLE",
  stance: "STANCE",
  lows: "LOWS",
  chlaunch: "CH LAUNCHING",
  heat: "HEAT MOVES",
  combos: "COMBO",
};

if (!FILTER_LABELS[state.filter]) state.filter = "good";
if (state.view === "scans") state.filter = "combos";

const GOOD_MOVE_COMMANDS = new Set([
  "1",
  "1,1",
  "1,2",
  "4,1",
  "3,3",
  "f+4,4",
  "f+1+2",
  "df+1",
  "df+2",
  "df+4,1",
  "d+4,1",
  "db+3",
  "b+2",
  "b+3",
  "uf+1",
  "f,f,F+3,2",
  "ws1",
  "FC.df+4",
  "BT.3",
  "LIB.1,2",
  "LIB.2",
  "LIB.3",
  "d+1+3",
]);

const imageCards = SCAN_DATA.map((scan) => {
  const move = MOVE_DATA.find((candidate) => candidate.scan === scan.src);
  const isCombo = scan.id >= 41 || /combo/i.test(scan.label);
  return {
    scan,
    move,
    isCombo,
    label: move ? `${move.name || move.command} · ${move.command}` : scan.label,
  };
});

const comboCards = imageCards.filter((card) => card.isCombo);

function frameClass(value) {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) return "plus";
  if (trimmed.startsWith("-")) return "minus";
  return "neutral";
}

function numericFrame(value) {
  const match = String(value || "").match(/[+-]?\d+/);
  return match ? Number(match[0]) : null;
}

function startupFrame(value) {
  const match = String(value || "").match(/i(\d+)/i);
  return match ? Number(match[1]) : null;
}

function moveCategoryFlags(move) {
  const hitLevel = String(move.hit_level || "").trim().toLowerCase();
  const isThrow = !hitLevel.includes(",") && (hitLevel === "t" || hitLevel.startsWith("t("));
  const isCombo = /,/.test(String(move.command || ""));
  const block = numericFrame(move.block);

  return {
    combo: isCombo,
    throw: isThrow,
    unsafe: block !== null && block < -9,
    safe: block !== null && block <= 0 && block >= -9,
    plus: block !== null && block > 0,
  };
}

const CATEGORY_META = [
  { key: "combo", className: "cat-combo", label: "Guaranteed combo" },
  { key: "throw", className: "cat-throw", label: "Throw" },
  { key: "unsafe", className: "cat-unsafe", label: "Unsafe on block" },
  { key: "safe", className: "cat-safe", label: "Safe on block" },
  { key: "plus", className: "cat-plus", label: "Plus on block" },
];

function createCategoryDots(move) {
  const flags = moveCategoryFlags(move);
  const container = document.createElement("span");
  container.className = "category-dots";

  const activeLabels = [];
  CATEGORY_META.forEach(({ key, className, label }) => {
    const dot = document.createElement("i");
    dot.className = `dot ${className}`;
    if (flags[key]) {
      dot.classList.add("active");
      activeLabels.push(label);
    }
    container.appendChild(dot);
  });

  container.setAttribute("role", "img");
  container.setAttribute(
    "aria-label",
    activeLabels.length ? `Categories: ${activeLabels.join(", ")}` : "No matching categories"
  );

  return container;
}

function isCounterHitLauncher(move) {
  const becomesAirborne = (value) => /\d+a\b/i.test(String(value || ""));
  const documentedLaunch = /launch\w*.*counter hit|counter hit.*launch/i.test(
    String(move.notes || "")
  );
  return (
    (becomesAirborne(move.counter_hit) && !becomesAirborne(move.hit)) ||
    documentedLaunch
  );
}

function noteText(text) {
  return String(text || "")
    .replace(/\*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesFilter(move) {
  const block = numericFrame(move.block);
  const notes = String(move.notes || "");

  if (state.filter === "safe") return block !== null && block >= -9;
  if (state.filter === "plus") return block !== null && block > 0;
  if (state.filter === "good") return GOOD_MOVE_COMMANDS.has(move.command);
  if (state.filter === "fast") {
    const startup = startupFrame(move.startup);
    return startup !== null && startup <= 13;
  }
  if (state.filter === "evasive") {
    return /high crush|low crush|evasive|parry|power crush|backswing|reversal/i.test(notes);
  }
  if (state.filter === "tracking") return /homing|tracking|tracks/i.test(notes);
  if (state.filter === "delayable") return /delay/i.test(notes);
  if (state.filter === "stance") {
    return /(^|\.)(LIB|BT|FC|SS)(\.|$)|^ws|^hFC/i.test(move.command);
  }
  if (state.filter === "lows") {
    return String(move.hit_level || "")
      .toLowerCase()
      .split(/[,\s]+/)
      .some((level) => level === "l" || level === "sl");
  }
  if (state.filter === "chlaunch") return isCounterHitLauncher(move);
  if (state.filter === "heat") {
    return /heat/i.test([move.command, move.name, move.notes].join(" "));
  }
  if (state.filter === "combos") return false;
  return true;
}

function matchesImageFilter(card) {
  return state.filter === "combos" && card.isCombo;
}

function matchesQuery(move) {
  if (!state.query) return true;
  const haystack = [
    move.command,
    move.name,
    move.hit_level,
    move.damage,
    move.startup,
    move.block,
    move.hit,
    move.counter_hit,
    move.notes,
  ].join(" ").toLowerCase();
  return haystack.includes(state.query.toLowerCase());
}

function matchesImageQuery(card) {
  if (!state.query) return true;
  if (!card.move) return card.label.toLowerCase().includes(state.query.toLowerCase());
  return matchesQuery(card.move);
}

function notationParts(command) {
  const parts = [];
  const pattern = /(\([^)]*\)|[A-Za-z]+|[1-4]|\+|,|~|:|\.|\*|\d+)/g;
  String(command || "").replace(pattern, (token) => {
    parts.push(token);
    return token;
  });
  return parts.length ? parts : [command];
}

function tokenInfo(token) {
  const lower = token.toLowerCase();
  const directions = {
    f: "right",
    b: "left",
    d: "down",
    u: "up",
    df: "down-right",
    db: "down-left",
    uf: "up-right",
    ub: "up-left",
    n: "N",
  };
  if (directions[lower]) {
    return {
      text: directions[lower],
      type: "direction",
      hold: /^[UDFB]{1,2}$/.test(token),
    };
  }
  if (/^[1-4]$/.test(token)) {
    return { text: token, type: "button-pad", buttons: [token] };
  }
  if (token === "+") return { text: token, type: "joiner" };
  return { text: token, type: "state" };
}

function notationSequence(command) {
  const connectors = {
    ",": "then",
    ".": "context",
    "~": "fast",
    ":": "just",
  };
  const steps = [];
  let tokens = [];
  let leading = "";

  const pushStep = () => {
    if (!tokens.length) return;
    steps.push({ leading, tokens });
    tokens = [];
    leading = "";
  };

  notationParts(command).forEach((token) => {
    if (connectors[token]) {
      pushStep();
      leading = connectors[token];
      return;
    }

    if (token === "*") {
      const previous = tokens.at(-1) || steps.at(-1)?.tokens.at(-1);
      if (previous) previous.forceHold = true;
      return;
    }

    tokens.push({ raw: token, forceHold: false });
  });
  pushStep();
  return steps;
}

function collapseSimultaneousButtons(tokens) {
  const collapsed = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const current = tokens[index];
    if (!/^[1-4]$/.test(current.raw)) {
      collapsed.push(current);
      continue;
    }

    const buttons = [current.raw];
    let forceHold = current.forceHold;
    let cursor = index;
    while (
      tokens[cursor + 1]?.raw === "+" &&
      /^[1-4]$/.test(tokens[cursor + 2]?.raw || "")
    ) {
      buttons.push(tokens[cursor + 2].raw);
      forceHold ||= tokens[cursor + 2].forceHold;
      cursor += 2;
    }

    if (buttons.length > 1) {
      collapsed.push({
        raw: buttons.join("+"),
        type: "button-pad",
        buttons,
        forceHold,
      });
      index = cursor;
      continue;
    }

    collapsed.push(current);
  }

  return collapsed;
}

function createConnector(kind) {
  const connector = document.createElement("span");
  connector.className = `input-connector connector-${kind}`;

  const labels = {
    then: { symbol: ">", label: "" },
    context: { symbol: "·", label: "" },
    fast: { symbol: "~", label: "FAST" },
    just: { symbol: ":", label: "JUST" },
  };
  const detail = labels[kind];

  if (detail.label) {
    const label = document.createElement("small");
    label.textContent = detail.label;
    connector.appendChild(label);
  }

  const symbol = document.createElement("b");
  symbol.textContent = detail.symbol;
  connector.appendChild(symbol);
  return connector;
}

function createToken(part, modifier = "") {
  const info = part.type === "button-pad" ? part : tokenInfo(part.raw);
  const isHeld = Boolean(info.hold || part.forceHold);
  const span = document.createElement("span");
  span.className = `input-token ${info.type}`;
  if (isHeld) span.classList.add("held-input");
  if (modifier) span.classList.add(`modifier-${modifier}`);

  if (info.type === "button-pad") {
    const activeButtons = info.buttons || [info.button];
    span.setAttribute(
      "aria-label",
      `button ${activeButtons.join(" and ")}${isHeld ? ", hold" : ""}`
    );
    for (const button of ["1", "2", "3", "4"]) {
      const dot = document.createElement("i");
      const active = activeButtons.includes(button);
      dot.className = `pad-dot p${button}${active ? " active" : ""}`;
      dot.textContent = active ? button : "";
      span.appendChild(dot);
    }
  } else if (info.type === "direction" && info.text !== "N") {
    span.classList.add(`dir-${info.text}`);
    const arrow = document.createElement("i");
    arrow.className = "tekken-arrow";
    span.appendChild(arrow);
    span.setAttribute("aria-label", `${info.text}${isHeld ? ", hold" : ""}`);
  } else {
    span.textContent = info.text;
  }

  if (isHeld && ["button-pad", "direction"].includes(info.type)) {
    const badge = document.createElement("small");
    badge.className = "hold-badge";
    badge.textContent = "HOLD";
    span.appendChild(badge);
  }

  return span;
}

function createInputStrip(command) {
  const strip = document.createElement("span");
  strip.className = "input-strip";
  strip.setAttribute("role", "img");
  strip.setAttribute("aria-label", `Generated input image for ${command}`);
  notationSequence(command).forEach((step) => {
    const unit = document.createElement("span");
    unit.className = "command-unit";

    if (step.leading) unit.appendChild(createConnector(step.leading));

    const stepNode = document.createElement("span");
    stepNode.className = "input-step";
    if (step.leading === "fast" || step.leading === "just") {
      stepNode.classList.add(`step-${step.leading}`);
    }

    const tokens = collapseSimultaneousButtons(step.tokens);
    const actionable = tokens
      .map((part, index) => ({ part, index }))
      .filter(({ part }) => ["direction", "button-pad"].includes(
        part.type || tokenInfo(part.raw).type
      ));
    const targetIndex = actionable.at(-1)?.index;

    tokens.forEach((part, index) => {
      const modifier = index === targetIndex && ["fast", "just"].includes(step.leading)
        ? step.leading
        : "";
      stepNode.appendChild(createToken(part, modifier));
    });

    unit.appendChild(stepNode);
    strip.appendChild(unit);
  });
  return strip;
}

function setMoveExpanded(card, expanded) {
  const summary = card.querySelector(".move-summary");
  const details = card.querySelector(".move-details");
  card.classList.toggle("expanded", expanded);
  summary.setAttribute("aria-expanded", String(expanded));
  details.hidden = !expanded;
}

function renderMove(move) {
  const node = template.content.firstElementChild.cloneNode(true);
  const scanPane = node.querySelector(".scan-pane");
  const command = node.querySelector(".command");
  const summary = node.querySelector(".move-summary");
  const details = node.querySelector(".move-details");
  const detailsId = `move-details-${move.id}`;

  details.id = detailsId;
  summary.setAttribute("aria-controls", detailsId);

  const moveName = node.querySelector(".move-name");
  moveName.textContent = move.name || "";
  moveName.hidden = !move.name;
  command.textContent = move.command;

  const moveTitleCopy = node.querySelector(".move-title-copy");
  moveTitleCopy.appendChild(createCategoryDots(move));
  node.querySelector(".startup").textContent = move.startup || "-";
  node.querySelector(".block").textContent = move.block || "-";
  node.querySelector(".hit").textContent = move.hit || "-";
  node.querySelector(".counter-hit").textContent = move.counter_hit || "-";
  node.querySelector(".hitline").textContent = `${move.hit_level || "-"} hit level · ${move.damage || "-"} damage`;
  node.querySelector(".notes").textContent = noteText(move.notes);

  for (const selector of [".block", ".hit", ".counter-hit"]) {
    const el = node.querySelector(selector);
    el.classList.add(frameClass(el.textContent));
  }

  const inputStrip = createInputStrip(move.command);
  scanPane.appendChild(inputStrip);
  scanPane.classList.add("has-image");

  if (state.view === "notation") {
    scanPane.hidden = true;
  }

  summary.addEventListener("click", () => {
    const willOpen = !node.classList.contains("expanded");
    if (openMove && openMove !== node) setMoveExpanded(openMove, false);
    setMoveExpanded(node, willOpen);
    openMove = willOpen ? node : null;
  });

  return node;
}

function renderComboImages(container, cards) {
  container.innerHTML = "";
  const fragment = document.createDocumentFragment();
  cards.forEach(({ scan }) => {
    const tile = document.createElement("article");
    tile.className = "scan-tile";
    const image = document.createElement("img");
    image.src = scan.src;
    image.loading = "lazy";
    image.alt = scan.label || "Azucena combo";
    tile.appendChild(image);
    fragment.appendChild(tile);
  });
  container.appendChild(fragment);
  return cards.length;
}

function renderScans() {
  return renderComboImages(scanGrid, comboCards);
}

function renderImageMoves() {
  const cards = comboCards.filter(matchesImageFilter).filter(matchesImageQuery);
  return renderComboImages(imageMovesList, cards);
}

function render() {
  openMove = null;
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.filter);
  });

  const moves = MOVE_DATA.filter(matchesFilter).filter(matchesQuery);
  linkedCount.textContent = comboCards.length;
  sectionTitle.textContent = state.view === "scans"
    ? FILTER_LABELS.combos
    : FILTER_LABELS[state.filter] || FILTER_LABELS.all;

  list.hidden = state.view === "scans";
  imageMovesList.hidden = state.view === "notation";
  scanGrid.hidden = state.view !== "scans";

  if (state.view === "scans") {
    renderScans();
    imageMovesList.innerHTML = "";
    visibleCount.textContent = comboCards.length;
    return;
  }

  list.innerHTML = "";
  const fragment = document.createDocumentFragment();
  if (state.view === "notation") {
    moves.forEach((move) => fragment.appendChild(renderMove(move)));
    list.appendChild(fragment);
    imageMovesList.innerHTML = "";
    visibleCount.textContent = moves.length;
    return;
  }

  imageMovesList.innerHTML = "";
  const imageCount = state.filter === "combos" ? renderImageMoves() : 0;
  moves.forEach((move) => fragment.appendChild(renderMove(move)));
  list.appendChild(fragment);
  visibleCount.textContent = imageCount + list.children.length;
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    if (state.view === "scans") {
      state.filter = "combos";
    } else if (state.filter === "combos") {
      state.filter = "good";
    }
    localStorage.setItem("view", state.view);
    localStorage.setItem("azucena-filter", state.filter);
    render();
  });
});

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    if (state.filter === "combos") {
      state.view = "scans";
    } else if (state.view === "scans") {
      state.view = "paired";
    }
    localStorage.setItem("view", state.view);
    localStorage.setItem("azucena-filter", state.filter);
    render();
  });
});

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value.trim();
  render();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
});

const downloadPdfButton = document.querySelector("#downloadPdfButton");

function pdfNoteLines(text) {
  return String(text || "")
    .split("*")
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildMovelistPdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFillColor(18, 24, 38);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  doc.setTextColor(246, 195, 88);
  doc.setFontSize(30);
  doc.text("Azucena Book", 40, 90);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("Tekken 8 movelist — frame data reference", 40, 120);
  doc.setFontSize(10);
  doc.text(
    "Source patch 3.02.01 · Generated " + new Date().toLocaleDateString(),
    40,
    140
  );

  doc.addPage();

  const rows = MOVE_DATA.map((move) => [
    move.command || "-",
    move.name || "-",
    move.hit_level || "-",
    move.damage || "-",
    move.startup || "-",
    move.block || "-",
    move.hit || "-",
    move.counter_hit || "-",
    pdfNoteLines(move.notes).join("\n") || "-",
  ]);

  doc.autoTable({
    head: [["Command", "Name", "Lvl", "Dmg", "Start", "Block", "Hit", "CH", "Notes"]],
    body: rows,
    startY: 30,
    theme: "grid",
    styles: {
      fontSize: 7.5,
      cellPadding: 4,
      valign: "top",
      lineColor: [210, 210, 210],
      lineWidth: 0.4,
    },
    headStyles: {
      fillColor: [246, 195, 88],
      textColor: [18, 24, 38],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [246, 248, 250] },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 110 },
      2: { cellWidth: 28 },
      3: { cellWidth: 34 },
      4: { cellWidth: 34 },
      5: { cellWidth: 34 },
      6: { cellWidth: 34 },
      7: { cellWidth: 34 },
      8: { cellWidth: "auto" },
    },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `Azucena Book — page ${doc.internal.getNumberOfPages()}`,
        pageWidth - 140,
        pageHeight - 20
      );
    },
  });

  doc.save("Azucena-Book-Movelist.pdf");
}

if (downloadPdfButton) {
  downloadPdfButton.addEventListener("click", () => {
    if (!window.jspdf) {
      window.alert("The PDF generator hasn't finished loading yet. Check your connection and try again in a moment.");
      return;
    }
    const label = downloadPdfButton.querySelector("strong");
    const originalText = label.textContent;
    label.textContent = "Generating…";
    downloadPdfButton.disabled = true;
    setTimeout(() => {
      try {
        buildMovelistPdf();
      } catch (error) {
        console.error("PDF generation failed", error);
        window.alert("Sorry, the PDF could not be generated.");
      } finally {
        label.textContent = originalText;
        downloadPdfButton.disabled = false;
      }
    }, 30);
  });
}

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("service-worker.js?v=11");
}

render();
