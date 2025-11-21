// === CONFIG ===
const API_BASE = ""; // если фронт на том же домене/порту, оставь пустым. Иначе: "http://127.0.0.1:8000"

// DOM
const formSelect    = document.getElementById("form-select");
const btnLoadForm   = document.getElementById("btn-load-form");
const jsonFileInput = document.getElementById("json-file");
const btnIntrospectUpload = document.getElementById("btn-introspect-upload");
const imageFilesInput = document.getElementById("image-files");
const statusBox     = document.getElementById("status");

const cbEmpty = document.getElementById("cb-empty");
const cbList  = document.getElementById("cb-list");




const placeholdersEmpty = document.getElementById("placeholders-empty");
const placeholdersList  = document.getElementById("placeholders-list");
const btnRender   = document.getElementById("btn-render");
const btnDownload = document.getElementById("btn-download");

const previewWrap  = document.getElementById("preview-wrap");
const previewFrame = document.getElementById("preview-frame");

// state
let currentFormId = null;
let currentTemplateJson = null;     // если был аплоад
let currentPlaceholders = [];       // список ключей
let currentValues = {};             // key -> value
let lastPdfBlob = null;
let isLoading = false;
let currentCbPrefs = {}; // gid -> объект настроек для cbgroup:gid

// === helpers ===
function setStatus(msg, type = "info") {
  if (!statusBox) return;
  statusBox.textContent = msg || "";
  statusBox.classList.remove("pg-status--ok", "pg-status--err");
  if (type === "ok") statusBox.classList.add("pg-status--ok");
  if (type === "err") statusBox.classList.add("pg-status--err");
}

function setLoading(flag) {
  isLoading = !!flag;
  btnLoadForm.disabled = isLoading;
  btnIntrospectUpload.disabled = isLoading;
  btnRender.disabled = isLoading || !currentPlaceholders.length;
  // download можно только если уже есть PDF
  btnDownload.disabled = isLoading || !lastPdfBlob;
  if (flag) setStatus("Working…");
}

async function fetchJson(url, options = {}) {
  const resp = await fetch(API_BASE + url, {
    ...options,

    headers: {
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



// Если хотим base64 для картинок (для /forms/{id}/render с external_images_b64)
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = String(reader.result || "");
      // result типа "data:image/png;base64,AAA..." → отрезаем префикс
      const base64 = result.split(",")[1] || "";
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

// === INIT: загрузка списка форм ===
async function initForms() {
  try {
    const forms = await fetchJson("/forms");
    // forms: [{id,title,description}, ...]
    // заполняем select
    forms.forEach(f => {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = `${f.title} (${f.id})`;
      opt.dataset.desc = f.description;
      formSelect.appendChild(opt);
    });
  } catch (err) {
    console.error(err);
    setStatus("Failed to load forms list. Check backend /forms.", "err");
  }
}

// === building placeholder UI ===
function buildPlaceholdersUI(placeholders) {
  placeholdersList.innerHTML = "";
  currentPlaceholders = placeholders || [];
  currentValues = {}; // сброс

  if (!placeholders.length) {
    placeholdersEmpty.style.display = "";
    btnRender.disabled = true;
    return;
  }
  placeholdersEmpty.style.display = "none";

  placeholders.forEach(key => {
    const field = document.createElement("div");
    field.className = "pg-field";

    const label = document.createElement("label");
    label.textContent = key;
    const keySpan = document.createElement("div");
    keySpan.className = "pg-field__key";
    keySpan.textContent = `[{${key}}]`;

    const input = document.createElement("textarea");
    input.rows = 1;
    input.placeholder = `Value for ${key}`;
    input.addEventListener("input", () => {
      currentValues[key] = input.value;
    });

    field.appendChild(label);
    field.appendChild(keySpan);
    field.appendChild(input);
    placeholdersList.appendChild(field);
  });

  btnRender.disabled = false;
}


// === build checkbox groups UI ===

function buildCheckboxesUI(cbCounts) {
  cbList.innerHTML = "";
  currentCbPrefs = {};

  const ids = Object.keys(cbCounts || {});
  if (!ids.length) {
    if (cbEmpty) cbEmpty.style.display = "";
    return;
  }
  if (cbEmpty) cbEmpty.style.display = "none";

  ids.forEach((gid) => {
    const count = cbCounts[gid];

    const row = document.createElement("div");
    row.className = "pg-field";

    const label = document.createElement("label");
    label.textContent = gid;

    const meta = document.createElement("div");
    meta.className = "pg-field__key";
    meta.textContent = count === 1
      ? "Single checkbox"
      : `Group with ${count} checkboxes (ordered in template)`;

    row.appendChild(label);
    row.appendChild(meta);

    if (count === 1) {
      // простой режим: single YES/NO/SKIP
      const select = document.createElement("select");
      ["SKIP", "YES", "NO"].forEach((optVal) => {
        const opt = document.createElement("option");
        opt.value = optVal;
        opt.textContent = optVal;
        select.appendChild(opt);
      });

      select.addEventListener("change", () => {
        currentCbPrefs[gid] = {
          mode: "single",
          single: select.value, // YES/NO/SKIP
        };
      });

      // дефолт
      currentCbPrefs[gid] = { mode: "single", single: "SKIP" };
      select.value = "SKIP";

      row.appendChild(select);
    } else {
      // режим "радио-группа": у нас есть N чекбоксов, один может быть YES
      const indexLabel = document.createElement("div");
      indexLabel.className = "pg-field__hint";
      indexLabel.textContent = "Which checkbox (1..N) is YES?";

      const indexInput = document.createElement("input");
      indexInput.type = "number";
      indexInput.min = "0";
      indexInput.max = String(count);
      indexInput.value = "0"; // 0 = ни один не YES

      const elseSelect = document.createElement("select");
      ["NO", "SKIP"].forEach((optVal) => {
        const opt = document.createElement("option");
        opt.value = optVal;
        opt.textContent = `others → ${optVal}`;
        elseSelect.appendChild(opt);
      });

      // дефолты
      currentCbPrefs[gid] = {
        mode: "indexed",
        yes_index: 0,
        else: "NO",
      };

      indexInput.addEventListener("input", () => {
        const n = parseInt(indexInput.value, 10);
        currentCbPrefs[gid].yes_index = isNaN(n) ? 0 : Math.max(0, Math.min(count, n));
      });

      elseSelect.addEventListener("change", () => {
        currentCbPrefs[gid].else = elseSelect.value;
      });

      const controls = document.createElement("div");
      controls.className = "pg-field__row";
      controls.appendChild(indexInput);
      controls.appendChild(elseSelect);

      row.appendChild(indexLabel);
      row.appendChild(controls);
    }

    cbList.appendChild(row);
  });
}


// === HANDLERS ===

// 1) Интроспекция по form_id
btnLoadForm.addEventListener("click", async () => {
  const formId = formSelect.value;
  if (!formId) {
    setStatus("Please select a form id first.", "err");
    return;
  }
  currentFormId = formId;
  currentTemplateJson = null; // мы работаем через сервер, не через аплоад
  setLoading(true);
  try {
  const info = await fetchJson(`/forms/${encodeURIComponent(formId)}/introspect`);
  // info = { id, title, placeholders:[...], cb_counts:{...} }

  buildPlaceholdersUI(info.placeholders || []);
  buildCheckboxesUI(info.cb_counts || {});

  const phCount = (info.placeholders || []).length;
  const cbCount = Object.keys(info.cb_counts || {}).length;

  if (!phCount && !cbCount) {
    setStatus(`No placeholders or checkbox groups found in "${info.title}".`, "err");
  } else {
    setStatus(
    `Loaded ${phCount} text placeholders and ${cbCount} checkbox group(s) from ${info.title}.`,
    "ok"
  );
}

  } catch (err) {
    console.error(err);
    setStatus(`Introspect failed: ${err.message}`, "err");
  } finally {
    setLoading(false);
  }
});

// 2) Интроспекция загруженного JSON через /introspect (multipart)
btnIntrospectUpload.addEventListener("click", async () => {
  const file = jsonFileInput.files && jsonFileInput.files[0];
  if (!file) {
    setStatus("Choose a JSON template file first.", "err");
    return;
  }

  currentFormId = null; // сейчас мы идём не по id, а по файлу
  currentTemplateJson = null;
  setLoading(true);
  try {
    const formData = new FormData();
    formData.append("file", file);
    const resp = await fetch(API_BASE + "/introspect", {
    method: "POST",
    body: formData,

  });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const info = await resp.json();
    // предположим, что /introspect возвращает что-то типа {placeholders:[...], cb_counts:{...}}
    if (!info.placeholders || !info.placeholders.length) {
      setStatus("No placeholders found in uploaded template.", "err");
    } else {
      buildPlaceholdersUI(info.placeholders);
      setStatus(`Loaded ${info.placeholders.length} placeholders from uploaded JSON.`, "ok");
    }

    // Можно хранить файл в памяти (если нужно потом /render_json с template_json)
    const text = await file.text();
    try {
      currentTemplateJson = JSON.parse(text);
    } catch {
      currentTemplateJson = null;
    }
  } catch (err) {
    console.error(err);
    setStatus(`Introspect failed: ${err.message}`, "err");
  } finally {
    setLoading(false);
  }
});

// 3) Рендер PDF
btnRender.addEventListener("click", async () => {
  if (!currentPlaceholders.length) {
    setStatus("No placeholders to render. Load a form first.", "err");
    return;
  }
  setLoading(true);
  lastPdfBlob = null;
  previewFrame.src = "about:blank";
  previewWrap.classList.remove("has-pdf");

  try {
    let resp;
    // Вариант А: рендер по form_id → /forms/{id}/render (JSON body)
    if (currentFormId) {
      // собираем external_images_b64, если нужно
      const files = Array.from(imageFilesInput.files || []);
      const imagesB64 = {};
      for (const f of files) {
        const base64 = await fileToBase64(f);
        // ключом будет имя файла без пробелов
        const refKey = f.name.replace(/\s+/g, "_");
        imagesB64[refKey] = base64;
      }
      
      // соберём values для чекбоксов в формате, который ждёт рендер
      const cbValues = {};
      Object.entries(currentCbPrefs).forEach(([gid, pref]) => {
        if (!pref) return;
        const key = `cbgroup:${gid}`;

        if (pref.mode === "single") {
          cbValues[key] = { single: pref.single };         // {single:"YES"/"NO"/"SKIP"}
        } else if (pref.mode === "indexed") {
          cbValues[key] = {
            yes_index: pref.yes_index || 0,                // номер чекбокса (1..N), 0 = ни один
            else: pref.else || "NO",
          };
        }
      });

      // итоговое values, которое уйдёт на сервер
      const valuesToSend = {
        ...currentValues,  // текстовые [{name}]
        ...cbValues,       // cbgroup:<gid>
      };



    resp = await fetch(API_BASE + `/forms/${encodeURIComponent(currentFormId)}/render`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        values: valuesToSend,
        external_images_b64: Object.keys(imagesB64).length ? imagesB64 : null
      }),
      credentials: "include",
    });


    } else if (currentTemplateJson) {
      // Вариант Б: рендер напрямую по JSON → /render_json
      resp = await fetch(API_BASE + "/render_json", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          template_json: currentTemplateJson,
          values: currentValues
        }),

      });
    } else {
      setStatus("No formId or template JSON provided. Load something first.", "err");
      setLoading(false);
      return;
    }

    if (!resp.ok) {
      const text = await resp.text().catch(()=>"");
      throw new Error(`Render failed: HTTP ${resp.status} ${text}`);
    }

    const blob = await resp.blob();
    lastPdfBlob = blob;
    const url = URL.createObjectURL(blob);
    previewFrame.src = url;
    previewWrap.classList.add("has-pdf");
    setStatus("PDF rendered successfully.", "ok");
    btnDownload.disabled = false;
  } catch (err) {
    console.error(err);
    setStatus(err.message || "Render failed", "err");
  } finally {
    setLoading(false);
  }
});

// 4) Скачать PDF
btnDownload.addEventListener("click", () => {
  if (!lastPdfBlob) return;
  const url = URL.createObjectURL(lastPdfBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (currentFormId || "document") + ".pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// старт
initForms().catch(console.error);
setStatus("Ready. Choose a form or upload a JSON template.", "ok");
