const $ = (selector) => document.querySelector(selector);

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}
const escapeHtml = escapeHTML;

// Strip letter counts from crossword clues, e.g. (8 letters), (5,7), (6), [5 letters]
function stripLetterCounts(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\s*[\(\[]\s*\d+(?:[\s,\/-]+\d+)*\s*(?:-?letters?|-?words?|-?chars?|-?characters?)?\s*[\)\]]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// =========================================================
// 1. CURRICULUM CATALOGUE (6 Domains · 40 Categories)
// =========================================================
const CURRICULUM_CATALOG = [
  {
    domain: "Domain A — Economics",
    categories: [
      { name: "Economic Fundamentals", topics: "Scarcity, resources, needs, wants, utility" },
      { name: "Goods & Services", topics: "Tangible goods, intangible goods, consumer goods, capital goods" },
      { name: "Factors of Production", topics: "Land, labour, capital, entrepreneurship" },
      { name: "Demand & Supply", topics: "Law of demand, law of supply, equilibrium" },
      { name: "Economic Systems", topics: "Capitalism, socialism, mixed economy, command economy" },
      { name: "Market Structures", topics: "Monopoly, oligopoly, perfect competition" },
      { name: "Economic Indicators", topics: "GDP, inflation, deflation, unemployment" },
      { name: "Business Cycles", topics: "Recession, depression, expansion, recovery" },
      { name: "Economic Policies", topics: "Fiscal policy, monetary policy, taxation" },
      { name: "International Economics", topics: "Imports, exports, tariffs, globalisation" }
    ]
  },
  {
    domain: "Domain B — Business Fundamentals",
    categories: [
      { name: "Business Terminology", topics: "Assets, liabilities, stakeholders, enterprise" },
      { name: "Business Organisation", topics: "Sole proprietorship, partnership, corporation" },
      { name: "Business Functions", topics: "Production, distribution, administration" },
      { name: "Business Ownership", topics: "Private, public, cooperative, franchise" },
      { name: "Business Environment", topics: "Internal, external, micro and macro environments" }
    ]
  },
  {
    domain: "Domain C — Marketing & Commerce",
    categories: [
      { name: "Marketing Fundamentals", topics: "Marketing mix, segmentation, positioning" },
      { name: "Pricing Terminology", topics: "Skimming, penetration, bundling, discounts" },
      { name: "Branding & Advertising", topics: "Brand identity, promotion, campaigns" },
      { name: "Consumer Behaviour", topics: "Consumer, buyer, customer, utility" },
      { name: "Retail & Distribution", topics: "Wholesaler, retailer, distributor, intermediary" },
      { name: "Sales Terminology", topics: "Prospecting, conversion, upselling, negotiation" }
    ]
  },
  {
    domain: "Domain D — Entrepreneurship & Startups",
    categories: [
      { name: "Entrepreneurship", topics: "Entrepreneur, intrapreneur, innovation" },
      { name: "Startup Terminology", topics: "MVP, prototype, validation, scalability" },
      { name: "Business Models", topics: "B2B, B2C, subscription, marketplace" },
      { name: "Startup Funding", topics: "Angel investor, venture capital, equity" },
      { name: "Business Strategy", topics: "SWOT, competitive advantage, diversification" },
      { name: "Innovation", topics: "Design thinking, disruption, ideation" }
    ]
  },
  {
    domain: "Domain E — Business Management",
    categories: [
      { name: "Management Fundamentals", topics: "Planning, organising, directing, controlling" },
      { name: "Human Resources", topics: "Recruitment, retention, compensation" },
      { name: "Leadership", topics: "Delegation, motivation, organisational culture" },
      { name: "Operations", topics: "Inventory, procurement, logistics" },
      { name: "Finance Terminology", topics: "Revenue, profit, cash flow, working capital" },
      { name: "Accounting Concepts", topics: "Balance sheet, assets, depreciation" },
      { name: "Business Communication", topics: "Negotiation, persuasion, stakeholder communication" }
    ]
  },
  {
    domain: "Domain F — Indian Business & NEC",
    categories: [
      { name: "Indian Economy", topics: "RBI, GDP, inflation, monetary policy" },
      { name: "Indian Business Ecosystem", topics: "MSME, Startup India, DPIIT" },
      { name: "Government Schemes", topics: "MUDRA, Stand-Up India, PMEGP" },
      { name: "Entrepreneurship Competitions", topics: "NEC, pitching, business plans, innovation challenges" },
      { name: "Social Entrepreneurship", topics: "Social impact, sustainability, inclusive business" },
      { name: "Business Ethics & Law", topics: "CSR, intellectual property, compliance" }
    ]
  }
];


// Helper to look up Domain for a Category from CURRICULUM_CATALOG or DB config
function getDomainForCategory(catName) {
  if (!catName || typeof catName !== "string") return "";
  const query = catName.trim().toLowerCase();

  // 1. Check database-backed configuration cached in browser memory
  if (state.curriculumConfig && Array.isArray(state.curriculumConfig.categories)) {
    const match = state.curriculumConfig.categories.find(
      c => (c.category_name || "").trim().toLowerCase() === query
    );
    if (match && match.domain_name) {
      return match.domain_name.replace(/^Domain\s+[A-Z]\s*[-—]\s*/i, "").trim();
    }
  }

  // 2. Fallback to hardcoded catalogue
  for (const group of CURRICULUM_CATALOG) {
    if (group.categories.some(c => c.name.toLowerCase() === query)) {
      return group.domain.replace(/^Domain\s+[A-Z]\s*[-—]\s*/i, "").trim();
    }
  }
  return "";
}

const QUESTION_TYPE_TITLES = {
  definition_to_term: "DEFINITION TO TERM",
  term_to_definition: "TERM TO DEFINITION",
  fill_in_the_blank: "FILL IN THE BLANK",
  concept_identification: "CONCEPT IDENTIFICATION",
  difference_identification: "DIFFERENCE IDENTIFICATION",
  similar_terms: "SIMILAR TERMS",
  classification: "CLASSIFICATION",
  odd_one_out: "ODD ONE OUT",
  scenario_identification: "SCENARIO IDENTIFICATION",
  concept_association: "CONCEPT ASSOCIATION",
  acronym_recognition: "ACRONYM RECOGNITION",
  statement_based: "STATEMENT-BASED MCQ",
  cause_and_effect: "CAUSE AND EFFECT",
  crossword_clue: "CROSSWORD CLUE INTERPRETATION",
  crossword_clue_interpretation: "CROSSWORD CLUE INTERPRETATION",
  indirect_definition: "INDIRECT DEFINITION",
  case_study: "CASE STUDY QUESTION",
  // Aliases for compatibility
  definition_meaning: "DEFINITION TO TERM",
  synonym_crossword_clue: "CROSSWORD CLUE INTERPRETATION",
  cryptic_style_wordplay: "CROSSWORD CLUE INTERPRETATION",
  acronym_abbreviation: "ACRONYM RECOGNITION",
  contrast_distinction: "DIFFERENCE IDENTIFICATION",
  real_world_application: "SCENARIO IDENTIFICATION",
  crossword_indicator_recognition: "CROSSWORD CLUE INTERPRETATION",
  historical_origin_etymology: "CONCEPT IDENTIFICATION",
  collocation_phrase_completion: "FILL IN THE BLANK",
  letter_pattern_grid_fit: "CROSSWORD CLUE INTERPRETATION",
  double_definition: "CROSSWORD CLUE INTERPRETATION"
};

// =========================================================
// 2. STARTER SEED PACKS (Instant Offline Learning)
// =========================================================
const STARTER_SEED_SETS = [
  {
    id: 101,
    title: "Basic Economic Concepts",
    batch_title: "Basic Economic Concepts",
    domain: "Economics",
    category: "Economic Fundamentals",
    subcategory: "Scarcity, resources, needs, wants, utility",
    difficulty: "beginner",
    batch: 1,
    total_batches: 4,
    status: "active",
    is_completed: false,
    attempts: {},
    questions: [
      {
        id: "ECO-EF-001",
        type: "definition_to_term",
        concept: "Scarcity",
        question: "What is the term for the fundamental economic condition in which resources are limited but human wants are virtually unlimited?",
        options: ["Abundance", "Scarcity", "Equilibrium", "Utility"],
        answer: "Scarcity",
        explanation: "Scarcity is the core problem of economics. Because physical resources, time and labour are finite while human desire is boundless, choices and allocation decisions must be made.",
        crossword_clue: "Condition of limited resources in relation to unlimited wants",
        deeper_prompt: "Explain scarcity, its importance in economics, opportunity cost and common crossword clues associated with scarcity."
      },
      {
        id: "ECO-EF-002",
        type: "definition_to_term",
        concept: "Tangible Goods",
        question: "What is the economic term for physical products that can be seen, touched and held, such as furniture, machinery, clothing or books?",
        options: ["Intangible goods", "Tangible goods", "Consumer resources", "Economic services"],
        answer: "Tangible goods",
        explanation: "Tangible goods possess material existence and physical dimensions. They can be stored, shipped and inventoried, contrasting directly with services which are intangible.",
        crossword_clue: "Physical products that can be seen or touched",
        deeper_prompt: "Explain tangible and intangible goods, their differences, examples and common crossword clues."
      },
      {
        id: "ECO-EF-003",
        type: "concept_identification",
        concept: "Opportunity Cost",
        question: "When a company chooses to invest surplus capital into research instead of paying a dividend, the foregone dividend represents which economic concept?",
        options: ["Sunk cost", "Marginal cost", "Opportunity cost", "Fixed cost"],
        answer: "Opportunity cost",
        explanation: "Opportunity cost is the value of the next best alternative given up whenever a decision is made. In business and personal decisions, every choice carries an implied trade-off.",
        crossword_clue: "The value of the road not taken in economic choice",
        deeper_prompt: "Explain opportunity cost in business decision-making and provide 5 crossword clues that hint at it."
      },
      {
        id: "ECO-EF-004",
        type: "odd_one_out",
        concept: "Factors of Production",
        question: "Classical economics defines four primary factors of production. Which of the following is NOT one of these four fundamental factors?",
        options: ["Land", "Labour", "Money", "Capital"],
        answer: "Money",
        explanation: "The four factors of production are Land (natural resources), Labour (human effort), Capital (man-made tools/machinery) and Entrepreneurship. Financial currency or money is a medium of exchange, not a direct production factor.",
        crossword_clue: "Resource needed to generate goods and services",
        deeper_prompt: "Describe the four factors of production with real-world examples and crossword clues for each."
      },
      {
        id: "ECO-EF-005",
        type: "crossword_clue_interpretation",
        concept: "Mixed Economy",
        question: "Crossword Clue: 'System combining private enterprise with government intervention and welfare safeguards'. Which term solves this clue?",
        options: ["Command Economy", "Market Economy", "Mixed Economy", "Feudal Economy"],
        answer: "Mixed Economy",
        explanation: "A mixed economy blends market forces of supply and demand with state regulation, public utilities, and social welfare programmes. Most modern democracies operate as mixed economies.",
        crossword_clue: "Economy combining private enterprise with state regulation",
        deeper_prompt: "Explain how mixed economies differ from pure capitalism and command economies, and how this appears in crossword puzzles."
      },
      {
        id: "ECO-EF-006",
        type: "term_to_definition",
        concept: "Utility",
        question: "In economics, how is the term 'Utility' defined?",
        options: [
          "The monthly bill paid for electricity and water",
          "The total satisfaction or usefulness derived from consuming a good or service",
          "The scrap value of machinery after depreciation",
          "The legal ownership rights to intellectual property"
        ],
        answer: "The total satisfaction or usefulness derived from consuming a good or service",
        explanation: "Economic utility measures the satisfaction, pleasure, or practical value a consumer experiences from consuming a product. Concepts like 'diminishing marginal utility' explain why demand curves slope downward.",
        crossword_clue: "Economic measure of satisfaction from consumption",
        deeper_prompt: "Explain economic utility and marginal utility with real-world examples and crossword clues."
      }
    ]
  },
  {
    id: 102,
    title: "Core Business Terminology",
    category: "Business Terminology",
    subcategory: "Assets, liabilities, stakeholders, enterprise",
    difficulty: "beginner",
    batch: 1,
    total_batches: 3,
    status: "active",
    is_completed: false,
    attempts: {},
    questions: [
      {
        id: "BUS-BT-001",
        type: "definition_to_term",
        concept: "Asset",
        question: "What is the financial term for any valuable resource owned or controlled by a business expected to generate future economic benefits?",
        options: ["Liability", "Asset", "Expense", "Dividend"],
        answer: "Asset",
        explanation: "Assets include both tangible items (cash, inventory, property, equipment) and intangible rights (patents, trademarks, brand value). On a balance sheet, Assets = Liabilities + Equity.",
        crossword_clue: "Valuable resource owned by a company",
        deeper_prompt: "Explain current vs non-current assets and provide common balance sheet crossword clues."
      },
      {
        id: "BUS-BT-002",
        type: "definition_to_term",
        concept: "Liability",
        question: "What is the term for a company's debts or financial obligations arising from past transactions, payable in money, goods or services?",
        options: ["Revenue", "Liability", "Surplus", "Collateral"],
        answer: "Liability",
        explanation: "Liabilities represent obligations owed to outside parties, such as bank loans, accounts payable to suppliers, and accrued wages. They are settled over time through transfers of economic benefit.",
        crossword_clue: "A financial debt or legal obligation owed to others",
        deeper_prompt: "Discuss short-term vs long-term liabilities and how liabilities appear in crossword puzzles."
      },
      {
        id: "BUS-BT-003",
        type: "concept_identification",
        concept: "Stakeholder",
        question: "Employees, customers, suppliers, shareholders and the local community all have an interest in a company's operations. What umbrella term describes them?",
        options: ["Bondholders", "Arbitrageurs", "Stakeholders", "Underwriters"],
        answer: "Stakeholders",
        explanation: "A stakeholder is anyone affected by or having a legitimate stake in an enterprise's activities. Unlike shareholders (who own financial equity), stakeholders encompass the broader ecosystem.",
        crossword_clue: "Party with an interest in an organisation's success",
        deeper_prompt: "Compare shareholders and stakeholders with examples, corporate governance principles and crossword clues."
      },
      {
        id: "BUS-BT-004",
        type: "difference_identification",
        concept: "Revenue vs Profit",
        question: "What is the essential distinction between 'Revenue' and 'Profit' in corporate finance?",
        options: [
          "Revenue is net earnings; profit is gross sales before deductions",
          "Revenue is total income generated from sales; profit is what remains after deducting all expenses",
          "Revenue applies only to non-profit entities; profit applies to commercial firms",
          "Revenue represents cash in the bank; profit represents outstanding receivables"
        ],
        answer: "Revenue is total income generated from sales; profit is what remains after deducting all expenses",
        explanation: "Revenue (the top line) measures gross cash inflows from trading. Profit (the bottom line) deducts cost of goods sold, operating expenses, taxes and debt interest from revenue.",
        crossword_clue: "The bottom line after subtracting expenses from income",
        deeper_prompt: "Explain gross profit vs operating profit vs net profit, with crossword clues."
      }
    ]
  }
];

// =========================================================
// 3. APPLICATION STATE & STORAGE
// =========================================================
const STORAGE_KEY = "cluewise_crossword_sets_v2";

const state = {
  user: { id: "local", name: "Learner" },
  sets: [],
  activeSet: null,
  questionIndex: 0,
  view: "library",
  returnView: "library",
  category: "all",
  search: "",
  openFolders: new Set(["Economic Fundamentals", "Business Terminology"])
};

function getStorageKey(userId = state.user?.id) {
  return userId ? `cluewise_sets_user_${userId}` : STORAGE_KEY;
}

function loadStoredSets(userId = state.user?.id) {
  try {
    const key = getStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Could not read local storage:", e);
  }
  // Fallback to starter seed packs for new or guest accounts
  const initial = STARTER_SEED_SETS.map((s) => ({ ...s, attempts: {} }));
  saveStoredSets(initial, userId);
  return initial;
}

function saveStoredSets(sets, userId = state.user?.id) {
  try {
    const key = getStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(sets || []));
  } catch (e) {
    console.error("Could not write local storage:", e);
  }
}

async function api(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  let body = options.body;
  if (body && typeof body !== "string") {
    body = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }
  try {
    const response = await fetch(url, { ...options, body, headers, credentials: "same-origin", cache: "no-store" });
    const text = await response.text();
    let data = {};
    try { data = JSON.parse(text); } catch { data = {}; }
    if (!response.ok) {
      const error = new Error(data.error || (response.status ? `Request failed (${response.status})` : "Network request failed."));
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (err) {
    // If backend is not running or offline, propagate error gracefully
    throw err;
  }
}



let toastTimer;
function toast(message) {
  const element = $("#toast");
  if (!element) return;
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("show"), 2600);
}

// =========================================================
// 4. VIEW & NAVIGATION CONTROLLERS
// =========================================================
function openSidebar() {
  const isMobile = window.innerWidth <= 700;
  if (isMobile) {
    const sidebar = document.getElementById("mainSidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    if (sidebar) sidebar.classList.add("open");
    if (backdrop) backdrop.classList.add("active");
    document.body.style.overflow = "hidden";
  } else {
    const layout = document.getElementById("appLayout") || document.querySelector(".app-layout");
    if (layout) layout.classList.remove("sidebar-collapsed");
    try { localStorage.setItem("cluewise_sidebar_collapsed", "false"); } catch {}
  }
}

function closeSidebar(forceDesktop) {
  const isMobile = window.innerWidth <= 700;
  if (isMobile) {
    const sidebar = document.getElementById("mainSidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    if (sidebar && sidebar.classList.contains("open")) {
      sidebar.classList.remove("open");
    }
    if (backdrop && backdrop.classList.contains("active")) {
      backdrop.classList.remove("active");
    }
    document.body.style.overflow = "";
  } else if (forceDesktop) {
    const layout = document.getElementById("appLayout") || document.querySelector(".app-layout");
    if (layout) layout.classList.add("sidebar-collapsed");
    try { localStorage.setItem("cluewise_sidebar_collapsed", "true"); } catch {}
  }
}

function toggleSidebar() {
  const isMobile = window.innerWidth <= 700;
  if (isMobile) {
    const sidebar = document.getElementById("mainSidebar");
    if (sidebar && sidebar.classList.contains("open")) {
      closeSidebar();
    } else {
      openSidebar();
    }
  } else {
    const layout = document.getElementById("appLayout") || document.querySelector(".app-layout");
    if (layout && layout.classList.contains("sidebar-collapsed")) {
      openSidebar();
    } else {
      closeSidebar(true);
    }
  }
}

function showView(view) {
  if (window.innerWidth <= 700) {
    closeSidebar();
  }
  state.view = view;
  $("#homeView").classList.toggle("hidden", view === "learning");
  $("#learningView").classList.toggle("hidden", view !== "learning");

  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
  const homeBtn = document.getElementById("sidebarHomeBtn");
  if (homeBtn) {
    homeBtn.classList.toggle("active", view !== "learning");
  }

  if (view !== "learning") {
    renderHome();
  }
  renderFileExplorer();
}

// =========================================================
// 5. FILE EXPLORER RENDERING (pure folder/file tree)
// =========================================================
function renderFileExplorer() {
  var host = document.querySelector("#fileExplorer");
  if (!host) return;

  var activeSets   = state.sets.filter(function(s){ return s.status !== "archived"; });
  var archivedSets = state.sets.filter(function(s){ return s.status === "archived"; });
  var isOnHome     = state.view !== "learning";

  // Root Library node
  var html = '<div class="tree-root-item' + (isOnHome ? ' tree-root-active' : '') + '"'
    + ' id="treeLibraryRoot" role="button" tabindex="0" title="Back to library"'
    + '><span class="tree-root-icon">&#128218;</span>'
    + '<span class="tree-root-label">Library</span>'
    + '<span class="tree-root-badge">' + activeSets.length + '</span></div>';

  if (!activeSets.length) {
    html += '<div class="sidebar-empty">No sets yet.<br><small>Click "Import JSON Pack" to begin.</small></div>';
  } else {
    // Group by category
    var grouped = {};
    activeSets.forEach(function(set) {
      var cat = set.category || "General Business";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(set);
    });
    var categories = Object.keys(grouped).sort();

    html += categories.map(function(cat) {
      var steps = grouped[cat];
      var isOpen = state.openFolders.has(cat);
      var completedCount = steps.filter(function(s){ return s.is_completed; }).length;
      var allDone = completedCount === steps.length && steps.length > 0;
      var folderIcon = allDone ? "&#128194;" : "&#128193;"; // open/closed folder emoji

      var stepsHtml = steps.map(function(step, idx) {
        var isCurrent = state.activeSet && state.activeSet.id === step.id && state.view === "learning";
        var isDone    = Boolean(step.is_completed);
        var levelCls  = (step.difficulty || "beg").slice(0,3).toLowerCase();
        var totalQ    = step.questions ? step.questions.length : 0;
        var completedQ = Object.keys(step.attempts || {}).filter(function(k){ return !k.startsWith("_"); }).length;
        var pct       = totalQ ? Math.round((completedQ / totalQ) * 100) : 0;
        var fileIcon  = isDone ? "&#9989;" : (isCurrent ? "&#128214;" : "&#128196;"); // checkmark / open book / page
        var progressHtml = isDone
          ? '<span class="step-done-tag">done</span>'
          : '<span class="step-progress-mini"><span style="width:' + pct + '%"></span></span>';
        return '<div class="explorer-step-item' + (isCurrent ? " active" : "") + (isDone ? " completed" : "") + '"'
          + ' data-step-id="' + step.id + '" role="button" tabindex="0"'
          + ' title="' + escapeHTML(step.title || ("Step " + (idx+1))) + '"'
          + '><span class="step-file-icon">' + fileIcon + '</span>'
          + '<div class="step-info"><span class="step-title">' + escapeHTML(step.title || ("Step " + (idx+1))) + '</span>'
          + '<div class="step-meta">'
          + '<span class="step-level-tag ' + levelCls + '">' + escapeHTML((step.difficulty || "BEG").slice(0,3).toUpperCase()) + '</span>'
          + '<span>' + totalQ + ' clues</span>'
          + progressHtml
          + '</div></div></div>';
      }).join("");

      return '<div class="explorer-folder' + (isOpen ? " open" : "") + '" data-folder="' + escapeHTML(cat) + '">'
        + '<button class="explorer-folder-head" type="button" aria-expanded="' + isOpen + '">'
        + '<span class="folder-chevron">&#9654;</span>'
        + '<span class="folder-icon">' + folderIcon + '</span>'
        + '<span class="folder-name" title="' + escapeHTML(cat) + '">' + escapeHTML(cat) + '</span>'
        + '<span class="folder-badge">' + (completedCount ? (completedCount+"/"+steps.length) : steps.length) + '</span>'
        + '</button>'
        + '<div class="explorer-steps">' + stepsHtml + '</div>'
        + '</div>';
    }).join("");
  }

  // Archived section
  if (archivedSets.length) {
    var archOpen = state.openFolders.has("__archived__");
    html += '<div class="explorer-folder' + (archOpen ? " open" : "") + '" data-folder="__archived__">'
      + '<button class="explorer-folder-head explorer-folder-head--muted" type="button">'
      + '<span class="folder-chevron">&#9654;</span><span class="folder-icon">&#128193;</span>'
      + '<span class="folder-name">Archived</span>'
      + '<span class="folder-badge">' + archivedSets.length + '</span></button>'
      + '<div class="explorer-steps">'
      + archivedSets.map(function(step, idx) {
        return '<div class="explorer-step-item explorer-step-item--archived" data-step-id="' + step.id + '" role="button" tabindex="0">'
          + '<span class="step-file-icon">&#128230;</span>'
          + '<div class="step-info"><span class="step-title">' + escapeHTML(step.title || ("Step " + (idx+1))) + '</span>'
          + '<div class="step-meta"><span class="step-level-tag">' + (step.difficulty || "BEG").slice(0,3).toUpperCase() + '</span></div>'
          + '</div></div>';
      }).join("")
      + '</div></div>';
  }

  host.innerHTML = html;

  // Library root click
  var rootBtn = host.querySelector("#treeLibraryRoot");
  if (rootBtn) {
    rootBtn.addEventListener("click", function() { state.category = "all"; showView("library"); });
    rootBtn.addEventListener("keydown", function(e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); state.category = "all"; showView("library"); }
    });
  }

  // Folder toggles
  host.querySelectorAll(".explorer-folder-head").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var folder = btn.closest(".explorer-folder");
      var catName = folder.dataset.folder;
      if (state.openFolders.has(catName)) {
        state.openFolders.delete(catName);
        folder.classList.remove("open");
      } else {
        state.openFolders.add(catName);
        folder.classList.add("open");
      }
    });
  });

  // Step clicks
  host.querySelectorAll(".explorer-step-item").forEach(function(item) {
    var stepId = Number(item.dataset.stepId);
    var click = function() { openSet(stepId); };
    item.addEventListener("click", click);
    item.addEventListener("keydown", function(e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); click(); }
    });
  });
}

// =========================================================
// 6. HOME VIEW / SET GRID RENDERING
// =========================================================
function renderHome() {
  const activeSets = state.sets.filter((s) => s.status === "active");
  const totalExplored = state.sets.reduce((sum, set) => {
    return sum + Object.keys(set.attempts || {}).filter(k => !k.startsWith('_')).length;
  }, 0);
  const totalCompleted = state.sets.filter((s) => s.is_completed).length;

  $("#statSets").textContent = activeSets.length;
  $("#statExplored").textContent = totalExplored;
  $("#statCompleted").textContent = totalCompleted;
  // libraryCount removed (nav buttons replaced by file tree)
  $("#searchSets").value = state.search;

  let heading = "Your learning library";
  let source = activeSets;
  if (state.view === "archive") {
    heading = "Archived learning sets";
    source = state.sets.filter((s) => s.status === "archived");
  }

  if (state.category !== "all" && state.view === "library") {
    source = source.filter((s) => s.category === state.category);
  }

  if (state.search.trim()) {
    const q = state.search.toLowerCase();
    source = source.filter((s) => {
      return `${s.title} ${s.category} ${s.subcategory} ${s.difficulty}`.toLowerCase().includes(q);
    });
  }

  $("#listHeading").textContent = heading;
  const grid = $("#setGrid");

  if (!source.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <span class="empty-illustration">✳</span>
        <h3>${state.view === "archive" ? "No archived sets." : "No learning steps match your search."}</h3>
        <p>${state.view === "archive" ? "Sets you archive will appear here." : "Try clearing your search query or import a new crossword pack."}</p>
        ${state.view !== "archive" ? `<button class="btn btn-primary" id="emptyAddButton">Import a learning pack</button>` : ""}
      </div>
    `;
    const btn = $("#emptyAddButton");
    if (btn) btn.addEventListener("click", openImport);
    return;
  }

  grid.innerHTML = source.map((set) => {
    const total = set.questions?.length || set.total || 0;
    const answered = Object.keys(set.attempts || {}).filter(k => !k.startsWith('_')).length;
    const percentage = total ? Math.min(100, Math.round((answered / total) * 100)) : 0;
    const isDone = Boolean(set.is_completed);

    return `
      <article class="set-card" tabindex="0" role="button" data-open-set="${set.id}">
        <div class="set-card-top">
          <span class="category-pill">${escapeHTML(set.category)}</span>
          <span class="card-arrow">${isDone ? "✓ COMPLETED" : "↗"}</span>
        </div>
        <h3>${escapeHTML(set.title)}</h3>
        <p>${escapeHTML(set.subcategory || set.difficulty || "Business Crossword Vocabulary")}</p>
        <div class="set-card-bottom">
          <span>${isDone ? "MASTERED STEP" : `${answered} / ${total} EXPLORED`}</span>
          <span>${percentage}%</span>
        </div>
        <div class="mini-progress">
          <span style="width:${percentage}%; ${isDone ? "background:#1e6954" : ""}"></span>
        </div>
      </article>
    `;
  }).join("");

  grid.querySelectorAll("[data-open-set]").forEach((card) => {
    const open = () => openSet(Number(card.dataset.openSet));
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  });
}

// =========================================================
// 7. QUESTION VIEW & "DONE" BUTTON LOGIC
// =========================================================
async function openSet(setId) {
  try {
    closeSidebar();
    if (state.view !== "learning") state.returnView = state.view;
    const target = state.sets.find((s) => s.id === setId);
    if (!target) throw new Error("Learning set not found.");

    state.activeSet = target;
    state.questionIndex = 0;

    // Open the folder containing this set in file explorer
    if (target.category) state.openFolders.add(target.category);

    $("#homeView").classList.add("hidden");
    $("#learningView").classList.remove("hidden");
    state.view = "learning";

    const categoryParts = [
      target.domain,
      target.category,
      (target.difficulty || "Beginner").toUpperCase()
    ].filter(Boolean);
    $("#learningCategory").textContent = categoryParts.join(" · ");
    $("#learningTitle").textContent = target.batch_title || target.title;
    
    const metaParts = [];
    if (target.subcategory) metaParts.push(target.subcategory);
    if (target.batch) metaParts.push(`Batch ${target.batch} of ${target.total_batches || 1}`);
    if (target.focus_area) metaParts.push(`Focus: ${target.focus_area}`);
    metaParts.push(target.level_status === "complete" ? "Status: Complete ✓" : "Status: In Progress");
    $("#learningSubtitle").textContent = metaParts.join(" · ");
    $("#archiveSetButton").textContent = target.status === "archived" ? "Restore set" : "Archive";

    renderQuestion();
    renderFileExplorer();
  } catch (error) {
    toast(error.message);
  }
}

function currentQuestion() {
  return state.activeSet?.questions?.[state.questionIndex];
}

function renderQuestion() {
  const set = state.activeSet;
  const question = currentQuestion();
  if (!set || !question) return;

  const total = set.questions.length;
  const attempts = set.attempts || {};
  const currentAttempt = attempts[String(question.id)];
  const answeredCount = Object.keys(attempts).filter(k => !k.startsWith('_')).length;

  $("#questionPosition").textContent = `CLUE ${state.questionIndex + 1} OF ${total}`;
  $("#progressLabel").textContent = `${answeredCount} of ${total} explored`;
  $("#progressBar").style.width = `${Math.min(100, (answeredCount / total) * 100)}%`;

  const letters = ["A", "B", "C", "D"];
  const pickedAnswer = currentAttempt?.selected_answer;
  const correctAnswer = question.answer;
  const hasAttempt = Boolean(currentAttempt);
  const isCorrect = hasAttempt && currentAttempt.is_correct;

  // Determine kicker label
  const typeKey = (question.type || "definition_to_term").toLowerCase().replace(/[\s-]/g, "_");
  const typeLabel = QUESTION_TYPE_TITLES[typeKey] || "CROSSWORD TERMINOLOGY";
  const levelLabel = (set.difficulty || "Beginner").toUpperCase();

  // Crossword clue connection text (strips letter counts like "(8 letters)")
  const clueText = stripLetterCounts(question.crossword_clue || "");
  const connectionExplanation = clueText
    ? `If you see a crossword clue like “${escapeHTML(clueText)}”, the target answer is ${escapeHTML(correctAnswer).toUpperCase()}.`
    : `In business crosswords, clues describing this meaning lead directly to ${escapeHTML(correctAnswer).toUpperCase()}.`;

  $("#questionCard").innerHTML = `
    <div class="kicker-row">
      <div class="badge-group">
        <span class="type-badge">${typeLabel}</span>
        <span class="step-level-tag ${levelLabel.slice(0, 3).toLowerCase()}">${levelLabel}</span>
        ${question.concept_scope === "supporting" && question.related_category ? `
          <span class="connected-badge" title="Supporting concept connected from ${escapeHTML(question.related_category)}">
            🔗 ${escapeHTML(question.related_category)}
          </span>
        ` : ""}
      </div>
      ${question.concept ? `<span class="concept-chip">CONCEPT: ${escapeHTML(question.concept)}</span>` : ""}
    </div>

    ${clueText ? `
      <div class="crossword-clue">
        <span class="crossword-icon">🔍</span>
        <div><b>Crossword Clue:</b> “${escapeHTML(clueText)}”</div>
      </div>
    ` : ""}

    <h2>${escapeHTML(question.question)}</h2>

    <div class="option-list">
      ${question.options.map((opt, idx) => {
        let cls = "";
        if (hasAttempt) {
          if (String(opt).toLowerCase() === String(correctAnswer).toLowerCase()) cls = "correct";
          else if (String(opt).toLowerCase() === String(pickedAnswer).toLowerCase()) cls = "incorrect";
        }
        return `
          <button class="option-button ${cls}" data-option="${idx}" ${hasAttempt ? "disabled" : ""}>
            <span class="option-letter">${letters[idx]}</span>
            <span>${escapeHTML(opt)}</span>
          </button>
        `;
      }).join("")}
    </div>

    ${hasAttempt ? `
      <div class="answer-panel ${isCorrect ? "" : "incorrect"}">
        <div class="answer-label">${isCorrect ? "✓ THAT'S THE CONNECTION" : "↗ A USEFUL DISTINCTION"}</div>
        <h3>${isCorrect ? "You found the right term." : `The correct term is “${escapeHTML(correctAnswer)}”.`}</h3>
        <p>${escapeHTML(question.explanation)}</p>

        <div class="crossword-connection-panel">
          <b>Crossword Connection:</b> ${connectionExplanation}
        </div>

        ${question.deeper_prompt ? `
          <div class="deeper-row">
            <p><b>Explore deeper with GPT:</b> “${escapeHTML(question.deeper_prompt)}”</p>
            <button class="btn btn-quiet btn-small" id="copyDeeperPrompt">📋 Copy deeper-learning prompt</button>
          </div>
        ` : ""}
      </div>
    ` : `
      <p class="muted choose-hint">Choose the option that matches the definition or clue. The explanation will appear straight away.</p>
    `}
  `;

  // Attach option clicks
  $("#questionCard").querySelectorAll("[data-option]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selected = question.options[Number(btn.dataset.option)];
      handleAnswerChoice(question, selected);
    });
  });

  // Attach copy exploration prompt
  const copyBtn = $("#copyDeeperPrompt");
  if (copyBtn && question.deeper_prompt) {
    copyBtn.addEventListener("click", () => {
      copyText(question.deeper_prompt, "Deeper exploration prompt copied to clipboard!");
    });
  }

  // Previous button state
  const prevBtn = $("#previousQuestion");
  prevBtn.disabled = state.questionIndex === 0;
  prevBtn.style.opacity = state.questionIndex === 0 ? ".45" : "1";

  // Next button text
  const nextBtn = $("#nextQuestion");
  nextBtn.textContent = state.questionIndex === total - 1 ? "Finish review →" : "Next clue →";

  // =====================================================
  // CRITICAL REQUIREMENT: DONE BUTTON
  // "inside each stp ehile solving add a done button whic
  // should only become active when the finised the last question"
  // =====================================================
  const doneBtn = $("#doneStepButton");
  const lastQuestionObj = set.questions[total - 1];
  const lastQuestionAnswered = Boolean(attempts[String(lastQuestionObj?.id)]);
  const allAnswered = total > 0 && Object.keys(attempts).filter(k => !k.startsWith('_')).length >= total;

  // Active only when the learner has finished the last question
  const isDoneActive = lastQuestionAnswered || allAnswered || Boolean(set.is_completed);

  if (isDoneActive) {
    doneBtn.disabled = false;
    doneBtn.classList.add("ready");
    doneBtn.title = "Click to mark this learning step as completed!";
  } else {
    doneBtn.disabled = true;
    doneBtn.classList.remove("ready");
    doneBtn.title = "Answer the last question to activate the Done button.";
  }
}

async function handleAnswerChoice(question, selectedAnswer) {
  const set = state.activeSet;
  if (!set) return;

  const isCorrect = String(selectedAnswer).trim().toLowerCase() === String(question.answer).trim().toLowerCase();
  set.attempts = set.attempts || {};
  set.attempts[String(question.id)] = {
    selected_answer: selectedAnswer,
    is_correct: isCorrect,
    answered_at: new Date().toISOString()
  };

  // Update in global state and persist
  const setIndex = state.sets.findIndex((s) => s.id === set.id);
  if (setIndex >= 0) {
    state.sets[setIndex] = { ...set };
    saveStoredSets(state.sets);
  }

  // Sync to server asynchronously if available (silent failover)
  api(`/api/sets/${set.id}/attempt`, {
    method: "POST",
    body: { question_id: question.id, selected_answer: selectedAnswer }
  }).catch(() => {});

  renderQuestion();
  renderFileExplorer();
}

function markStepDone() {
  const set = state.activeSet;
  if (!set) return;

  set.is_completed = true;
  const setIndex = state.sets.findIndex((s) => s.id === set.id);
  if (setIndex >= 0) {
    state.sets[setIndex] = { ...set, is_completed: true };
    saveStoredSets(state.sets);
  }

  // Update server if available
  api(`/api/sets/${set.id}/status`, {
    method: "POST",
    body: { status: "active" }
  }).catch(() => {});

  toast("🎉 Step completed! You have mastered this crossword vocabulary step.");
  renderFileExplorer();
  renderQuestion();
  renderHome();
}

// =========================================================
// 8. IMPORT MODAL & PROMPT BUILDER (DATABASE-BACKED CONFIG)
// =========================================================

// Loads categories, learning levels and prompt templates from browser cache or DB
async function loadCurriculumConfig(force = false) {
  const CACHE_KEY = "cluewise_curriculum_cache";
  const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours in browser memory
  const now = Date.now();

  // 1. Instant load from browser memory / local storage (zero db queries)
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.data && Array.isArray(parsed.data.categories) && parsed.data.categories.length) {
        state.curriculumConfig = parsed.data;
        populateCategoryDropdown();
        populateDifficultyDropdown();
        updatePromptFromInputs();

        // If cache is fresh and not forced, stop here (no DB hit)
        if (!force && (now - (parsed.timestamp || 0) < CACHE_TTL)) {
          return;
        }
      }
    }
  } catch {}

  // 2. Fetch from DB when cache is expired or missing
  try {
    const res = await api("/api/curriculum-config");
    if (res && Array.isArray(res.categories) && res.categories.length) {
      state.curriculumConfig = res;
      populateCategoryDropdown();
      populateDifficultyDropdown();
      updatePromptFromInputs();
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: now, data: res }));
      } catch {}
    }
  } catch (err) {
    // Graceful offline fallback
  }
}

function openImport() {
  $("#importMessage").textContent = "";
  populateCategoryDropdown();
  populateDifficultyDropdown();
  updatePromptFromInputs();
  $("#importModal").classList.remove("hidden");
}

function closeImport() {
  $("#importModal").classList.add("hidden");
}

function populateCategoryDropdown() {
  const select = $("#setCategorySelect");
  if (!select) return;

  // If DB categories are loaded, render dynamically
  if (state.curriculumConfig && Array.isArray(state.curriculumConfig.categories) && state.curriculumConfig.categories.length > 0) {
    const prevVal = select.value;
    const groups = {};
    state.curriculumConfig.categories.forEach(item => {
      const dom = item.domain_name || "Business & Economics";
      if (!groups[dom]) groups[dom] = [];
      groups[dom].push(item);
    });

    let html = "";
    Object.keys(groups).forEach(dom => {
      html += `<optgroup label="${escapeHtml(dom)}">`;
      groups[dom].forEach(cat => {
        const topicsAttr = escapeHtml(cat.topics || "");
        const catName = escapeHtml(cat.category_name || "");
        html += `<option value="${catName}" data-topics="${topicsAttr}">${catName}</option>`;
      });
      html += `</optgroup>`;
    });
    html += `<optgroup label="Other"><option value="Custom">Custom / Other Category...</option></optgroup>`;
    select.innerHTML = html;
    if (prevVal && Array.from(select.options).some(o => o.value === prevVal)) {
      select.value = prevVal;
    }
  }

  // When category changes, refresh the prompt automatically
  select.onchange = () => updatePromptFromInputs();
}

function populateDifficultyDropdown() {
  const select = $("#setDifficulty");
  if (!select) return;

  if (state.curriculumConfig && Array.isArray(state.curriculumConfig.levels) && state.curriculumConfig.levels.length > 0) {
    const prevVal = select.value;
    let html = "";
    state.curriculumConfig.levels.forEach(lvl => {
      html += `<option value="${escapeHtml(lvl.level_code)}">${escapeHtml(lvl.label)}</option>`;
    });
    select.innerHTML = html;
    if (prevVal && Array.from(select.options).some(o => o.value === prevVal)) {
      select.value = prevVal;
    }
  }

  select.onchange = () => updatePromptFromInputs();
}

function updatePromptFromInputs() {
  const select = $("#setCategorySelect");
  const category = select?.value || "Economic Fundamentals";
  const domain = getDomainForCategory(category) || "Business & Economics";
  const levelSelect = $("#setDifficulty");
  const level = levelSelect?.value || "beginner";
  const focusRaw = ($("#setFocusArea")?.value || "").trim();
  const hasFocus = focusRaw.length > 0;

  const focusInstruction = hasFocus
    ? 'Focus Area: "' + focusRaw + '"\n' +
      '  - Restrict the learning sequence specifically to concepts, terminology and applications within this Focus Area.\n' +
      '  - Do not expand beyond this specific topic.'
    : 'Focus Area: None specified (blank).\n' +
      '  - Plan and cover the complete "' + category + '" category (under the "' + domain + '" domain) across all its relevant subcategories.';

  // Check if DB configuration has depth descriptions
  let levelDesc = "";
  if (state.curriculumConfig && Array.isArray(state.curriculumConfig.levels)) {
    const lvlMatch = state.curriculumConfig.levels.find(l => l.level_code === level);
    if (lvlMatch && lvlMatch.depth_description) {
      levelDesc = lvlMatch.depth_description;
    }
  }

  const defaultLevelDescriptions = {
    beginner: 'BEGINNER depth:\n' +
      '- Basic terminology, simple definitions, and fundamental concepts.\n' +
      '- Term recognition and basic conceptual differences.\n' +
      '- Simple classification and direct descriptions.\n' +
      '- Basic crossword-style clues that directly indicate the answer.\n' +
      '- Mix suitable question formats naturally (e.g. definition_to_term, term_to_definition, concept_identification, fill_in_the_blank, acronym_recognition, classification).',
    intermediate: 'INTERMEDIATE depth:\n' +
      '- Relationships, distinctions and associations between concepts.\n' +
      '- Similar and easily confused terminology.\n' +
      '- Concept classification and practical business scenarios.\n' +
      '- Cause-and-effect relationships and contextual business understanding.\n' +
      '- Descriptive crossword clues.\n' +
      '- Mix suitable formats (e.g. difference_identification, classification, concept_association, scenario_identification, statement_based, cause_and_effect).',
    advanced: 'ADVANCED depth:\n' +
      '- Complex business terminology and indirect definitions.\n' +
      '- Multiple related concepts explored in context.\n' +
      '- Subtle conceptual distinctions and strategic business applications.\n' +
      '- Challenging crossword clues approaching from an indirect angle.\n' +
      '- Mix suitable formats (e.g. indirect_definition, crossword_clue_interpretation, case_study, scenario_identification, concept_association, statement_based).',
    mastery: 'MASTERY depth:\n' +
      '- Unfamiliar descriptions and subtle differences between closely related terms.\n' +
      '- Complex conceptual associations and multi-layered clues.\n' +
      '- Difficult crossword-style clues with abstract or indirect framing.\n' +
      '- Mixed-topic recognition across the subject.\n' +
      '- Mix suitable formats (e.g. crossword_clue_interpretation, indirect_definition, odd_one_out, case_study, concept_association, statement_based).'
  };

  const finalLevelDescription = levelDesc || defaultLevelDescriptions[level] || defaultLevelDescriptions.beginner;
  const FENCE = String.fromCharCode(96, 96, 96);

  // If a custom template is stored in the database, interpolate it!
  if (state.curriculumConfig && state.curriculumConfig.template && state.curriculumConfig.template.length > 80) {
    let tpl = state.curriculumConfig.template;
    tpl = tpl.replace(/\{\{DOMAIN\}\}/g, domain);
    tpl = tpl.replace(/\{\{CATEGORY\}\}/g, category);
    tpl = tpl.replace(/\{\{LEVEL\}\}/g, level);
    tpl = tpl.replace(/\{\{LEVEL_DESCRIPTION\}\}/g, finalLevelDescription);
    tpl = tpl.replace(/\{\{FOCUS_INSTRUCTION\}\}/g, focusInstruction);
    tpl = tpl.replace(/\{\{FOCUS_RAW\}\}/g, focusRaw);
    tpl = tpl.replace(/\{\{FENCE\}\}/g, FENCE);
    const outputEl = $("#promptOutput");
    if (outputEl) outputEl.textContent = tpl;
    return;
  }

  const prompt = [
    'You are an expert curriculum planner and crossword vocabulary educator specialising in Business & Economics.',
    '',
    'Your objective is to plan a structured, progressive learning sequence and generate self-describing JSON learning packs for Cluewise — a lightweight, standalone learning companion designed to help learners understand business and economics terminology commonly encountered in crossword puzzles.',
    '',
    '═══════════════════════════════════════',
    'CURRICULUM HIERARCHY & SPECIFICATIONS',
    '═══════════════════════════════════════',
    'Hierarchy: Domain → Category → Subcategory → Batch',
    'Domain: ' + domain,
    'Category: ' + category,
    'Learning Level: ' + level,
    focusInstruction,
    '',
    '═══════════════════════════════════════',
    'CROSS-CATEGORY RELATIONSHIPS & CONCEPT TYPES',
    '═══════════════════════════════════════',
    'Business and economics concepts do NOT exist in isolated silos; they are interconnected across categories.',
    'You must distinguish between three types of concepts:',
    '1. CORE CONCEPTS: Directly belong to "' + category + '". These form the primary curriculum and receive the vast majority of questions.',
    '2. SUPPORTING / RELATED CONCEPTS: Belong to neighbouring categories (e.g. Demand & Supply, Business Terminology) but are crucial for understanding ' + category + ' or recognizing cross-domain crossword clues. Include these naturally where relevant, tagging them with concept_scope: "supporting" and specifying their related_category.',
    '3. EXTENDED CONCEPTS: Useful peripheral concepts that provide broader perspective. Mention these briefly inside question explanations or deeper_prompts without creating separate batches.',
    '',
    'Rules:',
    '- "' + category + '" remains the primary focus throughout the sequence.',
    '- Do NOT exclude essential supporting concepts merely because they belong to another category.',
    '- Do NOT attempt to cover an entire neighbouring category.',
    '- Avoid unnecessary repetition: If a concept has appeared in an earlier sequence, explore new dimensions, practical business contexts, and fresh crossword clue angles rather than repeating basic definitions.',
    '',
    '═══════════════════════════════════════',
    'CURRICULUM ISOLATION & PROGRESS SEPARATION',
    '═══════════════════════════════════════',
    '- "concepts_covered": MUST ONLY contain core concepts that belong directly to "' + category + '".',
    '- "concepts_remaining": MUST ONLY contain remaining uncompleted core concepts for "' + category + '".',
    '- "supporting_concepts_covered": Tracks supporting concepts introduced from other categories (e.g. [{ "concept": "demand", "source_category": "Demand & Supply" }]).',
    '- CRITICAL ISOLATION RULE: Introducing a supporting concept (e.g. "Demand" in "Economic Fundamentals") does NOT complete or replace the core curriculum of that supporting category ("Demand & Supply"). When the learner subsequently studies "Demand & Supply" as a primary category, its curriculum will still be delivered in full depth from the ground up without skipping concepts.',
    '',
    '═══════════════════════════════════════',
    'STEP 1: CURRICULUM PLANNING (Internal Planning — do not output as text)',
    '═══════════════════════════════════════',
    'Before generating questions, you must plan the complete learning sequence:',
    '1. Identify all core concepts within "' + category + '" at ' + level + ' level' + (hasFocus ? ' focused on "' + focusRaw + '"' : '') + '.',
    '2. Identify essential supporting concepts borrowed from other categories.',
    '3. Sequence concepts logically from foundational to advanced.',
    '4. Divide the curriculum into manageable batches of EXACTLY 30 questions per regular batch.',
    '5. Assign a descriptive, meaningful title to each batch (e.g. "Meaning, Scarcity and Choice").',
    '6. Determine the total number of batches based on actual subject scope (do NOT force a fixed number).',
    '7. Create a complete "curriculum_plan" object containing all planned batches, including both core concepts and supporting_concepts (with their source_category).',
    '8. Generate Batch 1 ONLY in this response.',
    '',
    '═══════════════════════════════════════',
    'STEP 2: LEARNING DEPTH REQUIREMENTS (' + level.toUpperCase() + ')',
    '═══════════════════════════════════════',
    levelDescriptions[level] || levelDescriptions.beginner,
    '',
    'Rule: Do NOT generate only definition questions. Mix appropriate question types naturally based on the concept being taught. These levels represent conceptual depth, not fixed question types.',
    '',
    '═══════════════════════════════════════',
    'STEP 3: QUESTION GENERATION REQUIREMENTS',
    '═══════════════════════════════════════',
    '- Batch size: Generate EXACTLY 30 questions for this regular batch.',
    '- Canonical Question Schema (REQUIRED FOR ALL QUESTIONS):',
    '  • "question": Engaging multiple-choice question text exploring the concept. Do NOT use "clue" as the question key.',
    '  • "options": Array of EXACTLY 4 strings: ["Option A", "Option B", "Option C", "Option D"]. NEVER an array of objects.',
    '  • "answer": String matching one of the 4 options verbatim (case-sensitive).',
    '  • "explanation": Clear explanation of the concept and why the answer fits.',
    '  • "crossword_clue": Concise crossword puzzle clue without letter counts like "(8 letters)" or "(5,7)".',
    '  • "deeper_prompt": Ready-to-copy GPT prompt allowing the learner to explore the concept deeper. Do NOT rename to "educational_tip".',
    '  • "type": One of the 15 supported types (use "definition_to_term", NOT "definition_meaning").',
    '  • "concept": The specific business/economics term or concept (e.g. "Scarcity", "Demand").',
    '  • "concept_scope": "core" for current category concepts, or "supporting" for borrowed concepts.',
    '  • "related_category": Specified ONLY when concept_scope is "supporting" (e.g. "Demand & Supply").',
    '- Do NOT introduce an incompatible question format for supporting concepts. Both core and supporting questions follow the exact same canonical schema.',
    '- Non-numerical: All questions must focus on conceptual understanding of terminology — NO numerical calculations.',
    '- Avoid duplicate concepts and repeated questions.',
    '',
    'Supported question types (use exact lowercase_underscore value):',
    '• definition_to_term          • term_to_definition          • fill_in_the_blank',
    '• concept_identification      • difference_identification   • classification',
    '• odd_one_out                 • scenario_identification     • concept_association',
    '• acronym_recognition         • statement_based             • cause_and_effect',
    '• crossword_clue_interpretation • indirect_definition       • case_study',
    '',
    '═══════════════════════════════════════',
    'STEP 4: OUTPUT FORMAT (SELF-DESCRIBING JSON)',
    '═══════════════════════════════════════',
    'Return ONLY a single fenced JSON code block (' + FENCE + 'json ... ' + FENCE + '). No text or markdown before or after.',
    '',
    '' + FENCE + 'json',
    '{',
    '  "metadata": {',
    '    "domain": "' + domain + '",',
    '    "category": "' + category + '",',
    '    "subcategory": "[Descriptive Subcategory, e.g. Basic Economic Concepts]",',
    '    "focus_area": "' + focusRaw + '",',
    '    "level": "' + level + '",',
    '    "pack_id": "[Stable sequence identifier, e.g. ECO-EF-BEG-001 — reuse across all subsequent batches]",',
    '    "batch": 1,',
    '    "batch_title": "[Descriptive title for Batch 1, e.g. Meaning, Scarcity and Choice]",',
    '    "total_batches": [Total planned batches, e.g. 4],',
    '    "level_status": "in_progress",',
    '',
    '    "curriculum_plan": {',
    '      "planned_batches": [',
    '        {',
    '          "batch": 1,',
    '          "title": "Meaning, Scarcity and Choice",',
    '          "subcategory": "Basic Economic Concepts",',
    '          "concepts": ["meaning-of-economics", "scarcity", "economic-choice"],',
    '          "supporting_concepts": [',
    '            { "concept": "demand", "source_category": "Demand & Supply" },',
    '            { "concept": "supply", "source_category": "Demand & Supply" }',
    '          ]',
    '        },',
    '        {',
    '          "batch": 2,',
    '          "title": "Needs, Wants and Utility",',
    '          "subcategory": "Needs & Wants",',
    '          "concepts": ["needs", "wants", "utility"],',
    '          "supporting_concepts": [',
    '            { "concept": "consumer-behaviour", "source_category": "Consumer Behaviour" }',
    '          ]',
    '        }',
    '      ]',
    '    },',
    '',
    '    "batch_concepts": [',
    '      "meaning-of-economics",',
    '      "scarcity",',
    '      "economic-choice"',
    '    ],',
    '',
    '    "concepts_covered": [',
    '      "meaning-of-economics",',
    '      "scarcity",',
    '      "economic-choice"',
    '    ],',
    '',
    '    "concepts_remaining": [',
    '      "needs",',
    '      "wants",',
    '      "utility"',
    '    ],',
    '',
    '    "supporting_concepts_covered": [',
    '      { "concept": "demand", "source_category": "Demand & Supply" },',
    '      { "concept": "supply", "source_category": "Demand & Supply" }',
    '    ]',
    '  },',
    '',
    '  "questions": [',
    '    {',
    '      "id": "[pack_id]-01",',
    '      "type": "definition_to_term",',
    '      "concept": "Scarcity",',
    '      "concept_scope": "core",',
    '      "question": "Which fundamental economic condition arises because human wants are virtually unlimited while resources are finite?",',
    '      "options": ["Scarcity", "Abundance", "Surplus", "Inflation"],',
    '      "answer": "Scarcity",',
    '      "explanation": "Scarcity is the basic economic problem where unlimited human wants exceed limited productive resources, necessitating choices.",',
    '      "crossword_clue": "Universal condition where unlimited human desires exceed limited productive resources.",',
    '      "deeper_prompt": "Explain scarcity, its role in economics, opportunity cost, and common crossword clues for scarcity."',
    '    },',
    '    {',
    '      "id": "[pack_id]-02",',
    '      "type": "definition_to_term",',
    '      "concept": "Demand",',
    '      "concept_scope": "supporting",',
    '      "related_category": "Demand & Supply",',
    '      "question": "What term describes the willingness and financial ability of consumers to purchase goods or services at various prices?",',
    '      "options": ["Demand", "Supply", "Utility", "Elasticity"],',
    '      "answer": "Demand",',
    '      "explanation": "Demand refers to effective demand in economics, requiring both desire and the financial purchasing power to acquire the good.",',
    '      "crossword_clue": "Consumer desire for a product backed by the purchasing power to acquire it.",',
    '      "deeper_prompt": "Explain demand, its determinants, the law of demand, and common crossword clues."' ,
    '    }',
    '  ]',
    '}',
    '' + FENCE + '',
    '',
    '═══════════════════════════════════════',
    'BATCH CONTINUATION (FOR SUBSEQUENT BATCHES)',
    '═══════════════════════════════════════',
    'When the learner requests "Continue with the next batch" or provides previous batch metadata:',
    '1. Reuse the same pack_id.',
    '2. Preserve the original curriculum_plan exactly (do not reorganize, replace or invent new batches).',
    '3. Preserve original domain, category, focus_area and level.',
    '4. Increment the batch number (e.g. batch: 2).',
    '5. Use the next planned batch title, subcategory, core concepts and supporting_concepts from curriculum_plan.',
    '6. Generate the next planned concepts with exactly 30 questions (final batch may have fewer if fewer meaningful questions remain).',
    '7. Update batch_concepts to list only current batch\'s core concepts.',
    '8. Update concepts_covered cumulatively (all past + current CORE concepts only).',
    '9. Update concepts_remaining (remaining uncompleted CORE concepts).',
    '10. Update supporting_concepts_covered cumulatively with supporting concepts introduced across batches.',
    '11. Set level_status: "complete" ONLY when the final batch is generated and all planned concepts are covered; otherwise keep "in_progress".'
  ].join('\n');

  const outputEl = $("#promptOutput");
  if (outputEl) outputEl.textContent = prompt;
}

function parseImportJSON(raw) {
  let text = String(raw || "").trim();
  text = text.replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`\s*$/, "").trim();
  const parsed = JSON.parse(text);

  if (Array.isArray(parsed)) {
    return { questions: parsed };
  }
  return parsed;
}

async function importLearningSet() {
  const message = $("#importMessage");
  message.textContent = "";

  const rawInput = $("#jsonInput").value.trim();
  if (!rawInput) {
    message.textContent = "Please paste your JSON response in the field below.";
    return;
  }

  let data;
  try {
    data = parseImportJSON(rawInput);
  } catch (e) {
    message.textContent = "Invalid JSON syntax. Ensure you pasted the entire code block including braces.";
    return;
  }

  const rawQuestions = Array.isArray(data.questions) ? data.questions : (Array.isArray(data) ? data : null);
  if (!rawQuestions || !rawQuestions.length) {
    message.textContent = "The JSON must contain a 'questions' array with at least one question.";
    return;
  }

  // Extract metadata with Domain → Category → Subcategory → Batch hierarchy
  const meta = data.metadata || {};
  let domain = String(meta.domain || data.domain || "").trim();
  let category = String(meta.category || data.category || $("#setCategorySelect")?.value || "Economic Fundamentals").trim();
  let subcategory = String(meta.subcategory || data.subcategory || "").trim();

  // Smart resolution if an older pack swapped Domain and Category:
  // e.g. category was "Economics" (Domain) and subcategory was "Economic Fundamentals" (Category)
  if (!domain) {
    const derivedDomainFromSub = getDomainForCategory(subcategory);
    if (derivedDomainFromSub && (!getDomainForCategory(category) || category.toLowerCase() === derivedDomainFromSub.toLowerCase())) {
      domain = category;
      category = subcategory;
      subcategory = meta.batch_title || meta.title || "Core Concepts";
    } else {
      domain = getDomainForCategory(category) || "";
    }
  } else if (!getDomainForCategory(category)) {
    const derived = getDomainForCategory(subcategory);
    if (derived) {
      domain = domain || derived;
      category = subcategory;
      subcategory = meta.batch_title || meta.title || "";
    }
  }

  const focus_area = meta.focus_area !== undefined ? String(meta.focus_area).trim() : ($("#setFocusArea")?.value?.trim() || "");
  const difficulty = String(meta.level || data.difficulty || data.level || $("#setDifficulty")?.value || "beginner").trim();
  const pack_id = String(meta.pack_id || data.pack_id || `PACK-${Date.now().toString(36).toUpperCase()}`).trim();
  const batch = Number(meta.batch || data.batch || 1);
  const totalBatches = Number(meta.total_batches || data.total_batches || 1);
  const batch_title = String(meta.batch_title || data.title || subcategory || `${category} (Batch ${batch})`).trim();
  const level_status = String(meta.level_status || "in_progress").trim();
  const curriculum_plan = meta.curriculum_plan || null;
  const batch_concepts = Array.isArray(meta.batch_concepts) ? meta.batch_concepts : [];
  const concepts_covered = Array.isArray(meta.concepts_covered) ? meta.concepts_covered : [];
  const concepts_remaining = Array.isArray(meta.concepts_remaining) ? meta.concepts_remaining : [];
  const supporting_concepts_covered = Array.isArray(meta.supporting_concepts_covered) ? meta.supporting_concepts_covered : [];

  // Canonical Question Normalizer & Validator:
  // Ensures compatibility with canonical schema: question, options (4 strings), answer, explanation, crossword_clue, deeper_prompt
  // Resilient against object options [{ text, is_correct }], educational_tip, and definition_meaning.
  const cleanedQuestions = [];
  for (let i = 0; i < rawQuestions.length; i++) {
    const rawQ = rawQuestions[i] || {};

    // 1. Normalize options to array of 4 string values
    let opts = [];
    if (Array.isArray(rawQ.options)) {
      opts = rawQ.options.map((opt) => {
        if (typeof opt === "string") return opt.trim();
        if (opt && typeof opt === "object") {
          return String(opt.text || opt.option || opt.value || Object.values(opt)[0] || "").trim();
        }
        return String(opt || "").trim();
      });
    }

    // 2. Normalize answer (canonical string, with fallback to object or is_correct flag)
    let ans = "";
    if (typeof rawQ.answer === "string") {
      ans = rawQ.answer.trim();
    } else if (rawQ.answer && typeof rawQ.answer === "object") {
      ans = String(rawQ.answer.text || rawQ.answer.option || Object.values(rawQ.answer)[0] || "").trim();
    } else if (Array.isArray(rawQ.options)) {
      const correctObj = rawQ.options.find((o) => o && typeof o === "object" && o.is_correct);
      if (correctObj) {
        ans = String(correctObj.text || correctObj.option || Object.values(correctObj)[0] || "").trim();
      }
    }

    // 3. Question text (canonical is 'question', fallback to 'clue_question', 'prompt', or 'clue' if question missing)
    const qText = String(rawQ.question || rawQ.clue_question || rawQ.prompt || (rawQ.crossword_clue ? "" : rawQ.clue) || "").trim();

    // 4. Explanation
    const expl = String(rawQ.explanation || "").trim();

    // 5. Crossword clue (canonical is 'crossword_clue', fallback to 'clue')
    const clueText = stripLetterCounts(String(rawQ.crossword_clue || (rawQ.question ? rawQ.clue : "") || "").trim());

    // 6. Deeper prompt (canonical is 'deeper_prompt', fallback to 'educational_tip' or 'exploration_prompt')
    const deeper = String(rawQ.deeper_prompt || rawQ.educational_tip || rawQ.exploration_prompt || "").trim();

    // 7. Question type (canonical is definition_to_term, map definition_meaning to definition_to_term)
    let typeVal = String(rawQ.type || "definition_to_term").toLowerCase().replace(/[\s-]/g, "_");
    if (typeVal === "definition_meaning") typeVal = "definition_to_term";

    // 8. Concept scope and related category
    const concept = String(rawQ.concept || "").trim();
    const concept_scope = String(rawQ.concept_scope || "core").toLowerCase() === "supporting" ? "supporting" : "core";
    const related_category = String(rawQ.related_category || "").trim();

    // Validation
    if (!qText || opts.length !== 4 || !ans || !expl) {
      message.textContent = `Question ${i + 1} is missing required fields (question, 4 options, answer, explanation).`;
      return;
    }

    const matches = opts.some((opt) => opt.toLowerCase() === ans.toLowerCase());
    if (!matches) {
      message.textContent = `Question ${i + 1}: The answer ("${ans}") does not match any of its 4 options.`;
      return;
    }

    cleanedQuestions.push({
      id: String(rawQ.id || `${pack_id}-${String(i + 1).padStart(2, "0")}`),
      type: typeVal,
      concept,
      concept_scope,
      related_category,
      question: qText,
      options: opts,
      answer: ans,
      explanation: expl,
      crossword_clue: clueText,
      deeper_prompt: deeper
    });
  }

  const newSet = {
    id: Date.now(),
    title: batch_title,
    batch_title,
    domain,
    category,
    subcategory,
    focus_area,
    difficulty,
    level: difficulty,
    pack_id,
    batch,
    total_batches: totalBatches,
    curriculum_plan,
    batch_concepts,
    concepts_covered,
    concepts_remaining,
    supporting_concepts_covered,
    level_status,
    raw_metadata: meta,
    status: "active",
    is_completed: false,
    attempts: {},
    questions: cleanedQuestions
  };

  // Prepend to local state and persist
  state.sets.unshift(newSet);
  saveStoredSets(state.sets);

  // Try saving to backend if online
  api("/api/sets", {
    method: "POST",
    body: {
      title: batch_title,
      batch_title,
      domain,
      category,
      subcategory,
      focus_area,
      difficulty,
      pack_id,
      batch,
      total_batches: totalBatches,
      level_status,
      curriculum_plan,
      batch_concepts,
      concepts_covered,
      concepts_remaining,
      supporting_concepts_covered,
      questions: cleanedQuestions
    }
  }).then((res) => {
    if (res && res.id) newSet.id = res.id;
  }).catch(() => {});

  closeImport();
  $("#jsonInput").value = "";

  const batchInfo = totalBatches > 1 ? `Batch ${batch} of ${totalBatches}` : `Batch ${batch}`;
  toast(`✓ Imported ${batchInfo}: "${batch_title}" (${cleanedQuestions.length} crossword clues)!`);

  // Open the newly imported set immediately
  openSet(newSet.id);
}

async function copyText(text, successMessage = "Copied to clipboard.") {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    document.execCommand("copy");
    field.remove();
  }
  toast(successMessage);
}

// =========================================================
// 9. EVENT LISTENERS & INITIALIZATION
// =========================================================

function setAuthMessage(msg = "") {
  const el = $("#loginMessage");
  if (el) el.textContent = msg;
}

function showAuth(message = "") {
  $("#appShell").classList.add("hidden");
  $("#authScreen").classList.remove("hidden");
  setAuthMessage(message);
}

async function showApp(user) {
  state.user = user;
  if ($("#loggedInName")) $("#loggedInName").textContent = user.name || "Member";
  if ($("#sidebarUserName")) $("#sidebarUserName").textContent = user.name || "Member";
  $("#authScreen").classList.add("hidden");
  $("#appShell").classList.remove("hidden");

  // Load sets isolated for this specific member
  try {
    const serverSets = await api("/api/sets");
    if (Array.isArray(serverSets) && serverSets.length > 0) {
      state.sets = serverSets;
      saveStoredSets(state.sets, user.id);
    } else {
      state.sets = loadStoredSets(user.id);
    }
  } catch (err) {
    state.sets = loadStoredSets(user.id);
  }

  renderFileExplorer();
  renderHome();
}

function setupEventListeners() {
  // Navigation — handled by file tree Library root node in renderFileExplorer()

  // Import triggers
  $("#newSetButton")?.addEventListener("click", openImport);
  $("#sidebarAddBtn")?.addEventListener("click", openImport);
  $("#topAddSetBtn")?.addEventListener("click", openImport);
  $("#emptyAddButton")?.addEventListener("click", openImport);
  $("#closeImport")?.addEventListener("click", closeImport);
  $("#cancelImport")?.addEventListener("click", closeImport);
  $("#importModal")?.addEventListener("click", (e) => {
    if (e.target.id === "importModal") closeImport();
  });

  // Prompt builder refresh & copy
  $("#buildPromptButton")?.addEventListener("click", updatePromptFromInputs);
  $("#copyPromptButton")?.addEventListener("click", () => {
    const prompt = $("#promptOutput")?.textContent;
    if (prompt) copyText(prompt, "Prompt copied! Paste it into your AI assistant.");
  });

  $("#importSetButton")?.addEventListener("click", importLearningSet);

  // Search
  $("#searchSets")?.addEventListener("input", (e) => {
    state.search = e.target.value;
    renderHome();
  });

  // Question navigation
  $("#backToLibrary")?.addEventListener("click", () => showView(state.returnView || "library"));

  $("#previousQuestion")?.addEventListener("click", () => {
    if (state.questionIndex > 0) {
      state.questionIndex--;
      renderQuestion();
    }
  });

  $("#nextQuestion")?.addEventListener("click", () => {
    if (!state.activeSet) return;
    if (state.questionIndex < state.activeSet.questions.length - 1) {
      state.questionIndex++;
      renderQuestion();
    } else {
      showView(state.returnView || "library");
      toast("Great study session! Explore your next step when ready.");
    }
  });

  // CRITICAL REQUIREMENT: DONE BUTTON CLICK
  $("#doneStepButton")?.addEventListener("click", markStepDone);

  // Archive & Delete
  $("#archiveSetButton")?.addEventListener("click", async () => {
    if (!state.activeSet) return;
    const newStatus = state.activeSet.status === "archived" ? "active" : "archived";
    state.activeSet.status = newStatus;
    const idx = state.sets.findIndex((s) => s.id === state.activeSet.id);
    if (idx >= 0) state.sets[idx].status = newStatus;
    saveStoredSets(state.sets);
    api(`/api/sets/${state.activeSet.id}/status`, { method: "POST", body: { status: newStatus } }).catch(() => {});
    showView("library");
    toast(newStatus === "archived" ? "Set moved to archive." : "Set restored to active curriculum.");
  });

  $("#deleteSetButton")?.addEventListener("click", async () => {
    if (!state.activeSet) return;
    if (!confirm(`Delete “${state.activeSet.title}”? This cannot be undone.`)) return;
    const delId = state.activeSet.id;
    state.sets = state.sets.filter((s) => s.id !== delId);
    saveStoredSets(state.sets);
    api(`/api/sets/${delId}`, { method: "DELETE" }).catch(() => {});
    state.activeSet = null;
    showView("library");
    toast("Learning step deleted.");
  });

  // Continue Local / Offline
  $("#continueLocalBtn")?.addEventListener("click", () => {
    showApp({ id: 0, name: "Guest Learner" });
    toast("Continuing as guest learner (local browser storage).");
  });

  // Login form handler (Member profile sign-in)
  $("#loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#loginButton");
    btn.disabled = true;
    btn.textContent = "Signing in…";
    $("#loginMessage").textContent = "";
    try {
      const res = await api("/api/auth/login", {
        method: "POST",
        body: {
          name: $("#memberName").value.trim(),
          password: $("#memberPassword").value
        }
      });
      $("#memberPassword").value = "";
      toast(`Signed in as ${res.user.name}`);
      await showApp(res.user);
    } catch (err) {
      $("#loginMessage").textContent = err.message || "Sign in failed.";
    } finally {
      btn.disabled = false;
      btn.innerHTML = `Sign in <span>→</span>`;
    }
  });

  // Logout handler (clears session and returns to login screen)
  const handleLogout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST", body: {} });
    } catch {}
    state.user = null;
    state.sets = [];
    state.activeSet = null;
    $("#loginForm")?.reset();
    showAuth("You have been signed out.");
    toast("Signed out successfully.");
  };

  document.querySelectorAll("#logoutButton, #topLogoutButton, .logout-btn, .sidebar-logout-btn").forEach((btn) => {
    btn.addEventListener("click", handleLogout);
  });

  // Dynamic input triggers for prompt builder
  ["#setCategorySelect", "#setDifficulty", "#setFocusArea"].forEach((sel) => {
    const el = $(sel);
    if (el) el.addEventListener(sel === "#setFocusArea" ? "input" : "change", updatePromptFromInputs);
  });

  // Sidebar collapse / open handlers
  document.getElementById("sidebarToggleBtn")?.addEventListener("click", toggleSidebar);
  document.getElementById("sidebarCollapseBtn")?.addEventListener("click", () => closeSidebar(true));
  document.getElementById("sidebarCloseBtn")?.addEventListener("click", () => closeSidebar(true));
  document.getElementById("sidebarBackdrop")?.addEventListener("click", () => closeSidebar(true));
  document.getElementById("sidebarHomeBtn")?.addEventListener("click", () => {
    state.category = "all";
    showView("library");
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSidebar(true);
  });
}

// =========================================================
// 10. APP BOOTSTRAP (AUTH CHECK & PROFILE INITIALIZATION)
// =========================================================
async function init() {
  setupEventListeners();
  loadCurriculumConfig(); // Instant browser cache first, quiet background refresh if needed
  populateCategoryDropdown();
  populateDifficultyDropdown();
  updatePromptFromInputs();

  // Ensure desktop sidebar is open and visible by default
  const layout = document.getElementById("appLayout") || document.querySelector(".app-layout");
  if (layout) layout.classList.remove("sidebar-collapsed");
  try { localStorage.removeItem("cluewise_sidebar_collapsed"); } catch {}

  // Verify member session
  try {
    const me = await api("/api/me");
    if (me && me.user) {
      await showApp(me.user);
      return;
    }
  } catch (err) {
    // 401 or network error -> show member login screen
  }

  // Not signed in: present member login screen
  showAuth();
}

init();
