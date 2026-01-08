function safeJsonParse(text, fallback) {
  try { return JSON.parse(text); } catch { return fallback; }
}

async function doFetch({ download=false } = {}) {
  const method = document.getElementById("method").value.trim();
  const url = document.getElementById("url").value.trim();
  const headersText = document.getElementById("headers").value;
  const bodyText = document.getElementById("body").value;

  const headersObj = safeJsonParse(headersText, {});
  const init = { method, headers: headersObj };

  if (method !== "GET" && method !== "HEAD") {
    const bodyObj = safeJsonParse(bodyText, {});
    init.headers = { "Content-Type": "application/json", ...headersObj };
    init.body = JSON.stringify(bodyObj);
  }

  const res = await fetch(url, init);

  document.getElementById("status").value = `${res.status} ${res.statusText}`;
  document.getElementById("ctype").value = res.headers.get("content-type") || "";
  document.getElementById("finalUrl").value = res.url || url;

  if (download) {
    const blob = await res.blob();
    const cd = res.headers.get("content-disposition") || "";
    const suggested = (cd.match(/filename="([^"]+)"/) || [])[1] || "download.bin";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = suggested;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    return;
  }

  const ctype = (res.headers.get("content-type") || "").toLowerCase();
  if (ctype.includes("application/json")) {
    const j = await res.json();
    document.getElementById("out").textContent = JSON.stringify(j, null, 2);
  } else {
    const t = await res.text();
    document.getElementById("out").textContent = t || "(empty)";
  }
}

document.getElementById("send").addEventListener("click", () => doFetch({download:false}));
document.getElementById("download").addEventListener("click", () => doFetch({download:true}));
