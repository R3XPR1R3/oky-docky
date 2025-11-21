// === CONFIG ===
// Сейчас фронт и бэкенд крутятся на одном origin (FastAPI раздаёт index.html),
// поэтому можно оставить пустую строку. Если будешь выносить фронт на другой домен,
// тогда тут прописываешь полный URL API и на бэке настраиваешь CORS.
const API_BASE = "";

// DOM
const cardsContainer   = document.getElementById("cards");
const searchInput      = document.getElementById("search");
const yearSpan         = document.getElementById("year");
const panelPreviewWrap = document.getElementById("panel-preview-wrap");

const panel            = document.getElementById("form-panel");
const panelBackdrop    = document.getElementById("panel-backdrop");
const panelClose       = document.getElementById("panel-close");
const panelTitle       = document.getElementById("form-panel-title");
const panelSubtitle    = document.getElementById("form-panel-subtitle");
const panelStatus      = document.getElementById("panel-status");
const panelFieldsWrap  = document.getElementById("panel-fields");
const panelEmpty       = document.getElementById("panel-fields-empty");
const panelRenderBtn   = document.getElementById("panel-render");
const panelDownloadBtn = document.getElementById("panel-download");
const panelPreview     = document.getElementById("panel-preview");
const panelCheckboxes = document.getElementById("panel-checkboxes");



// state
let allForms = [];
let filteredForms = [];
let currentFormId = null;
let currentFormDesc = "";
let currentPlaceholders = [];
let currentValues = {};
let lastPdfBlob = null;
let isLoading = false;

// utils

function closePanel() {
  panel.classList.remove("is-open");
  panel.setAttribute("aria-hidden", "true");

  currentFormId = null;
  currentPlaceholders = [];
  currentValues = {};
  lastPdfBlob = null;

  panelFieldsWrap.innerHTML = "";
  panelPreview.src = "about:blank";
  panelRenderBtn.disabled = true;
  panelDownloadBtn.disabled = true;
  panelEmpty.style.display = "";
  setPanelStatus("");
}


function setPanelStatus(msg, type = "info") {
  if (!panelStatus) return;
  panelStatus.textContent = msg || "";
  panelStatus.style.color =
    type === "err" ? "#b34040" :
    type === "ok"  ? "#2f6b3a" :
                     "#7b6f72";
}

// строим чекбокс-группы по cb_counts



function setLoading(flag) {
  isLoading = !!flag;
  panelRenderBtn.disabled   = isLoading || !currentPlaceholders.length;
  panelDownloadBtn.disabled = isLoading || !lastPdfBlob;
  if (isLoading) setPanelStatus("Working…");
}

async function fetchJson(path, options = {}) {
  const resp = await fetch(API_BASE + path, {
    ...options,
    headers: {
      "Accept": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!resp.ok) {
    let text = "";
    try { text = await resp.text(); } catch {}
    throw new Error(`HTTP ${resp.status}: ${text || resp.statusText}`);
  }
  return resp.json();
}

// === cards ===

function cardTemplate(form) {
  const cat = getFormCategory(form);

  return `
    <article class="card" data-id="${form.id}" tabindex="0" role="button"
             aria-label="Open ${form.title}">
      <h3 class="card__title">${form.title}</h3>

      <div class="card__media">
        <div class="card-art card-art--${cat}">
          <div class="card-art__icon"></div>
        </div>
      </div>

      <p class="card__desc">${form.description || ""}</p>
    </article>
  `;
}


function renderCards(list) {
  if (!cardsContainer) return;
  if (!list.length) {
    cardsContainer.innerHTML = `<p>No forms found.</p>`;
    return;
  }
  cardsContainer.innerHTML = list.map(cardTemplate).join("");

  cardsContainer.querySelectorAll(".card").forEach(el => {
    const id = el.dataset.id;
    el.addEventListener("click", () => {
      if (id) openFormPanel(id);
    });
    el.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && id) openFormPanel(id);
    });
  });
}

function getFormCategory(form) {
  const id = (form.id || "").toLowerCase();
  const title = (form.title || "").toLowerCase();
  const desc = (form.description || "").toLowerCase();

  // примеры — потом сам подредачешь
  if (id.startsWith("w4") || id.startsWith("w-4") || title.includes("tax")) {
    return "tax";
  }
  if (title.includes("ack") || title.includes("acknowledgment") || desc.includes("notary")) {
    return "notary";
  }
  // всё остальное пока — generic
  return "generic";
}


function applySearchFilter() {
  const q = (searchInput?.value || "").trim().toLowerCase();
  if (!q) {
    filteredForms = allForms.slice();
  } else {
    filteredForms = allForms.filter(f =>
      f.title.toLowerCase().includes(q) ||
      (f.description || "").toLowerCase().includes(q) ||
      f.id.toLowerCase().includes(q)
    );
  }
  renderCards(filteredForms);
}

// === panel logic ===

function openPanel() {
  panel.classList.add("is-open");
  panel.setAttribute("aria-hidden", "false");
}



async function openFormPanel(formId) {
  currentFormId = formId;
  lastPdfBlob = null;
  hasAnyFields = false;

  panelPreview.src = "about:blank";
  panelRenderBtn.disabled = true;
  panelDownloadBtn.disabled = true;
  panelFieldsWrap.innerHTML = "";
  panelEmpty.style.display = "none";
  setPanelStatus("Loading fields…");
  openPanel();

  const meta = allForms.find(f => f.id === formId);
  if (meta) {
    panelTitle.textContent = meta.title;
    panelSubtitle.textContent = meta.description || "";
    currentFormDesc = meta.description || "";
  } else {
    panelTitle.textContent = formId;
    panelSubtitle.textContent = "";
    currentFormDesc = "";
  }

  try {
    setLoading(true);
    const info = await fetchJson(`/forms/${encodeURIComponent(formId)}/introspect`);

    const fieldsCount = buildFieldsUI(info);      // 👈 теперь берём количество
    

    if (!fieldsCount) {
      panelEmpty.style.display = "";
      setPanelStatus("This template has no fields.", "err");
    } else {
      setPanelStatus(`Loaded ${fieldsCount} fields. Fill and click “Preview PDF”.`, "ok");
      panelRenderBtn.disabled = false;
    }
  } catch (err) {
    console.error(err);
    setPanelStatus(`Failed to load fields: ${err.message}`, "err");
  } finally {
    setLoading(false);
  }
}


function buildFieldsUI(info) {
  const fieldsFromApi = info.fields || [];
  const varAliases = info.variable_aliases || {};
  const cbAliases  = info.checkbox_aliases || {};

  panelFieldsWrap.innerHTML = "";
  currentValues = {};
  currentPlaceholders = [];
  hasAnyFields = false;

  // === СТАРЫЙ РЕЖИМ: если бэк пока НЕ отдаёт fields ===
  if (!fieldsFromApi.length && Array.isArray(info.placeholders)) {
    info.placeholders.forEach((key) => {
      const niceLabel = varAliases[key] || key;

      const wrap = document.createElement("div");
      wrap.className = "pg-field";

      const label = document.createElement("label");
      label.textContent = niceLabel;

      const keySpan = document.createElement("div");
      keySpan.className = "pg-field__key";
      keySpan.textContent = `{{${key}}}`;

      const ta = document.createElement("textarea");
      ta.rows = 1;
      ta.placeholder = "Enter Here →";
      ta.addEventListener("input", () => {
        currentValues[key] = ta.value;
      });

      wrap.appendChild(label);
      wrap.appendChild(keySpan);
      wrap.appendChild(ta);
      panelFieldsWrap.appendChild(wrap);

      currentPlaceholders.push(key);
    });

    panelEmpty.style.display = info.placeholders.length ? "none" : "";
    panelRenderBtn.disabled = !currentPlaceholders.length;
    return currentPlaceholders.length;
  }

  // === НОВЫЙ РЕЖИМ: бэк отдаёт info.fields в нужном порядке ===

  if (!fieldsFromApi.length) {
    panelEmpty.style.display = "";
    panelRenderBtn.disabled = true;
    return 0;
  }

  panelEmpty.style.display = "none";

  fieldsFromApi.forEach((field) => {
    // ---- текстовые поля ----
    if (field.kind === "text") {
      const key = field.key;
      if (!key) return;

      currentPlaceholders.push(key);

      const niceLabel = varAliases[key] || key;

      const wrap = document.createElement("div");
      wrap.className = "pg-field";

      const label = document.createElement("label");
      label.textContent = niceLabel;

      const keySpan = document.createElement("div");
      keySpan.className = "pg-field__key";
      keySpan.textContent = ` `;

      const ta = document.createElement("textarea");
      ta.rows = 1;
      ta.placeholder = "Enter Here →";
      ta.addEventListener("input", () => {
        currentValues[key] = ta.value;
      });

      wrap.appendChild(label);
      wrap.appendChild(keySpan);
      wrap.appendChild(ta);
      panelFieldsWrap.appendChild(wrap);
      return;
    }

    // ---- чекбоксы / радио-группа ----
    if (field.kind === "checkbox") {
      const groupId = field.group_id;
      if (!groupId) return;

      const groupLabel = cbAliases[groupId] || cbAliases[String(groupId)] || groupId;

      // 1) пробуем взять список опций из field.options
      let opts = Array.isArray(field.options) ? field.options.slice() : [];

      // 2) если options нет — пробуем собрать по алиасам вида "1.opt1", "1.opt2"…
      if (!opts.length) {
        const prefix = `${groupId}.opt`;
        const derived = Object.keys(cbAliases).filter((k) => k.startsWith(prefix));
        if (derived.length) {
          derived.sort((a, b) => {
            const na = parseInt(a.split(".opt")[1] || "0", 10);
            const nb = parseInt(b.split(".opt")[1] || "0", 10);
            return na - nb;
          });
          opts = derived; // будут строки типа "1.opt1"
        }
      }

      // 3) если вообще ничего не нашли — fallback по count
      if (!opts.length && typeof field.count === "number" && field.count > 0) {
        for (let i = 1; i <= field.count; i++) {
          opts.push(`${groupId}.opt${i}`);
        }
      }

      const fs = document.createElement("fieldset");
      fs.className = "cb-group";

      const label = document.createElement("label");
      label.textContent = groupLabel;
      
      fs.appendChild(label);

      opts.forEach((optKey, idx) => {
        // нормализуем ключ для поиска алиаса:
        // "opt1" → "1.opt1", если надо
        let aliasKey = optKey;
        if (!aliasKey.includes(".")) {
          aliasKey = `${groupId}.${aliasKey}`;
        }

        const labelText =
          cbAliases[aliasKey] ||
          cbAliases[optKey] ||
          `Option ${idx + 1}`;   // 👈 вот тут фолбэк по порядковому номеру

        const labelEl = document.createElement("label");
        labelEl.className = "cb-option";

        const input = document.createElement("input");
        input.type = "radio";
        input.name = `cb__${groupId}`;
        input.value = String(idx + 1);      // храним именно номер варианта 1..N

        input.addEventListener("change", () => {
          // новый формат для бэка:
          // values["cbgroup:1"] = { yes_index: 2, else: "SKIP" }
          currentValues[`cbgroup:${groupId}`] = {
            yes_index: idx + 1,
            else: "SKIP", // или "NO" если хочешь крестики вместо пустых
          };
        });

        const span = document.createElement("span");
        span.textContent = labelText;

        labelEl.appendChild(input);
        labelEl.appendChild(span);
        fs.appendChild(labelEl);
      });

      panelFieldsWrap.appendChild(fs);
    }
  });

  panelRenderBtn.disabled = false;
  return fieldsFromApi.length;
}





// === render / download ===

panelRenderBtn.addEventListener("click", async () => {
  if (!currentFormId || !currentPlaceholders.length) {
    setPanelStatus("No form selected or no fields.", "err");
    return;
  }

  setLoading(true);
  lastPdfBlob = null;
  panelPreview.src = "about:blank";

  try {
    const resp = await fetch(API_BASE + `/forms/${encodeURIComponent(currentFormId)}/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/pdf",
      },
      body: JSON.stringify({ values: currentValues }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`HTTP ${resp.status} ${text}`);
    }

    const blob = await resp.blob();
    lastPdfBlob = blob;
    const url = URL.createObjectURL(blob);

    // вместо iframe:
    window.open(url, "_blank");   // 👈 открываем превью в новой вкладке

    panelDownloadBtn.disabled = false;
    setPanelStatus("PDF rendered successfully. Preview opened in new tab.", "ok");


  } catch (err) {
    console.error(err);
    setPanelStatus(`Render failed: ${err.message}`, "err");
  } finally {
    setLoading(false);
  }
});

panelDownloadBtn.addEventListener("click", () => {
  if (!lastPdfBlob || !currentFormId) return;
  const url = URL.createObjectURL(lastPdfBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${currentFormId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// === close actions ===

panelClose.addEventListener("click", closePanel);
panelBackdrop.addEventListener("click", closePanel);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && panel.classList.contains("is-open")) {
    closePanel();
  }
});

// === init ===

async function init() {
  if (yearSpan) yearSpan.textContent = new Date().getFullYear().toString();

  try {
    const forms = await fetchJson("/forms");
    allForms = forms || [];
    filteredForms = allForms.slice();
    renderCards(filteredForms);
  } catch (err) {
    console.error(err);
    if (cardsContainer) {
      cardsContainer.innerHTML = `<p style="color:#b34040;">Failed to load forms list: ${err.message}</p>`;
    }
  }

  if (searchInput) {
    searchInput.addEventListener("input", applySearchFilter);
  }
}

init().catch(console.error);
