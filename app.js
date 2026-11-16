// Taksir app — view routing, storage, form wiring, rendering.
// Pricing math lives ONLY in src/pricing.js (pure functions, no DOM).
// Honesty: every price shown is labelled "Taksiran dari data referensi".

import { estimatePrice, priceBreakdown, findComparables, generateListing, formatIDR } from "./src/pricing.js";

const ITEMS_KEY = "taksir.items.v1";
const SELLER_KEY = "taksir.seller.v1";
const COMPARABLES_KEY = "taksir.comparables.v1";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------------------------------------------------------------- storage
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.warn(`Taksir: corrupt ${key}, resetting.`, err);
    try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
    return fallback;
  }
}
function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
const loadItems = () => loadJSON(ITEMS_KEY, []);
const loadSeller = () => loadJSON(SELLER_KEY, { storeName: "", sellerName: "", city: "", whatsapp: "" });
function saveItems(items) {
  try {
    saveJSON(ITEMS_KEY, items);
  } catch (err) {
    // Quota: retry without photos, warn the seller (design.md §4).
    console.warn("Taksir: storage quota hit, saving without photos.", err);
    saveJSON(ITEMS_KEY, items.map(({ photo, ...rest }) => rest));
    showToast("Penyimpanan penuh — barang tersimpan tanpa foto.");
  }
}
const saveSeller = (seller) => saveJSON(SELLER_KEY, seller);

// ------------------------------------------------------------ comparables
let comparablesCache = null;
async function loadComparables() {
  if (comparablesCache) return comparablesCache;
  const override = loadJSON(COMPARABLES_KEY, null);
  if (override?.comparables) { comparablesCache = override.comparables; return comparablesCache; }
  try {
    const res = await fetch("data/comparables.json");
    const data = await res.json();
    comparablesCache = data.comparables ?? [];
  } catch (err) {
    console.warn("Taksir: could not load comparables.json", err);
    comparablesCache = [];
  }
  return comparablesCache;
}

// ---------------------------------------------------------------- helpers
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.hidden = true; }, 2500);
}
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function newId() {
  return "itm-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function waLink(item, estimate) {
  const seller = loadSeller();
  if (!seller.whatsapp) return null;
  const text = `Halo! Saya mau tanya soal ${item.brand} ${item.model} (${formatIDR(estimate)} — taksiran). Apakah masih tersedia?`;
  return `https://wa.me/${seller.whatsapp}?text=${encodeURIComponent(text)}`;
}
function itemTitle(item) { return `${item.brand} ${item.model}`.trim(); }
function itemSpecs(item) {
  return [item.cpu, `RAM ${item.ramGB} GB`, `${item.storageGB} GB ${item.storageType}`, item.screenInch ? `${item.screenInch}"` : ""].filter(Boolean).join(" • ");
}

// ---------------------------------------------------------------- routing
const VIEWS = ["view-home", "view-add", "view-estimate", "view-listing", "view-storefront", "view-settings"];
function showView(id) {
  VIEWS.forEach((v) => { document.getElementById(v).hidden = v !== id; });
  $$(".app-nav a").forEach((a) => a.classList.toggle("active", a.dataset.nav === ({ "view-home": "home", "view-add": "add", "view-storefront": "store", "view-settings": "settings" }[id] ?? "")));
  window.scrollTo(0, 0);
}
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, query] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  return { parts, params: new URLSearchParams(query ?? "") };
}
async function route() {
  const { parts, params } = parseHash();
  // Loading state while the reference dataset loads (B11).
  const loading = $("#loading");
  if (!comparablesCache) loading.hidden = false;
  const comparables = await loadComparables();
  loading.hidden = true;
  if (parts.length === 0) { renderHome(comparables); showView("view-home"); }
  else if (parts[0] === "tambah") { renderAddForm(params.get("id")); showView("view-add"); }
  else if (parts[0] === "barang" && parts[1] && !parts[2]) { renderEstimate(parts[1], comparables); showView("view-estimate"); }
  else if (parts[0] === "barang" && parts[1] && parts[2] === "listing") { renderListing(parts[1], comparables); showView("view-listing"); }
  else if (parts[0] === "toko") { renderStorefront(parts[1] ?? null); showView("view-storefront"); }
  else if (parts[0] === "pengaturan") { renderSettings(); showView("view-settings"); }
  else { renderHome(comparables); showView("view-home"); }
}
window.addEventListener("hashchange", route);

// ---------------------------------------------------------------- home
function renderHome(comparables) {
  const items = loadItems();
  const available = items.filter((i) => i.status !== "sold");
  $("#home-summary").innerHTML = items.length
    ? `<strong>${available.length} tersedia</strong> · ${items.length - available.length} terjual · ${items.length} total barang`
    : "Mulai dengan menambahkan laptop pertama yang mau dijual.";
  const list = $("#inventory-list");
  $("#inventory-empty").hidden = items.length > 0;
  list.innerHTML = items.map((item) => {
    const est = estimatePrice(item, comparables);
    const sold = item.status === "sold";
    return `<article class="item-card">
      ${item.photo ? `<a href="#/barang/${item.id}"><img src="${escapeHtml(item.photo)}" alt="Foto ${escapeHtml(itemTitle(item))}"></a>` : ""}
      <div class="item-card-body">
        <h3><a href="#/barang/${item.id}">${escapeHtml(itemTitle(item))}</a></h3>
        <p class="muted small">${escapeHtml(itemSpecs(item))}</p>
        <p class="price">${formatIDR(est.estimate)}</p>
        <p class="muted small">Taksiran dari data referensi</p>
        <span class="chip ${sold ? "chip-sold" : "chip-available"}">${sold ? "Terjual" : "Tersedia"}</span>
        <div class="card-actions">
          <a class="btn btn-ghost btn-sm" href="#/barang/${item.id}">Detail</a>
          <a class="btn btn-ghost btn-sm" href="#/tambah?id=${item.id}">Ubah</a>
          <button class="btn btn-ghost btn-sm" type="button" data-action="toggle-sold" data-id="${item.id}">${sold ? "Tandai Tersedia" : "Tandai Terjual"}</button>
          <button class="btn btn-danger btn-sm" type="button" data-action="delete" data-id="${item.id}">Hapus</button>
        </div>
      </div></article>`;
  }).join("");
}

// Home inventory actions (delegated): mark sold/available + delete w/ confirm.
$("#inventory-list").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const items = loadItems();
  const item = items.find((i) => i.id === btn.dataset.id);
  if (!item) return;
  if (btn.dataset.action === "toggle-sold") {
    item.status = item.status === "sold" ? "available" : "sold";
    item.updatedAt = Date.now();
    saveItems(items);
    showToast(item.status === "sold" ? "Ditandai terjual." : "Ditandai tersedia.");
    route();
  } else if (btn.dataset.action === "delete") {
    if (!confirm(`Hapus ${itemTitle(item)}? Tindakan ini tidak bisa dibatalkan.`)) return;
    saveItems(items.filter((i) => i.id !== item.id));
    showToast("Barang dihapus.");
    route();
  }
});

// ------------------------------------------------------------- add / edit
let editingId = null;
let photoDataUrl = null;
function renderAddForm(id) {
  editingId = id;
  const form = $("#item-form");
  const item = id ? loadItems().find((i) => i.id === id) : null;
  $("#add-title").textContent = item ? "Ubah Barang" : "Tambah Barang";
  form.reset();
  photoDataUrl = item?.photo ?? null;
  const preview = $("#photo-preview");
  if (photoDataUrl) { preview.src = photoDataUrl; preview.hidden = false; } else { preview.hidden = true; }
  if (item) {
    $("#f-brand").value = item.brand ?? "";
    $("#f-model").value = item.model ?? "";
    $("#f-cpu").value = item.cpu ?? "";
    $("#f-ram").value = item.ramGB ?? "";
    $("#f-storage").value = item.storageGB ?? "";
    $("#f-storage-type").value = item.storageType ?? "SSD";
    $("#f-screen").value = item.screenInch ?? "";
    $("#f-battery").value = item.batteryHealth ?? "";
    $("#f-age").value = item.ageYears ?? "";
    $("#f-cosmetic").value = item.cosmetic ?? "";
    $("#f-notes").value = item.notes ?? "";
    $$('input[name="accessories"]').forEach((cb) => { cb.checked = (item.accessories ?? []).includes(cb.value); });
  }
}
function readItemForm() {
  return {
    brand: $("#f-brand").value.trim(),
    model: $("#f-model").value.trim(),
    cpu: $("#f-cpu").value.trim(),
    ramGB: Number($("#f-ram").value),
    storageGB: Number($("#f-storage").value),
    storageType: $("#f-storage-type").value,
    screenInch: $("#f-screen").value ? Number($("#f-screen").value) : null,
    batteryHealth: $("#f-battery").value ? Number($("#f-battery").value) : null,
    ageYears: $("#f-age").value ? Number($("#f-age").value) : null,
    cosmetic: $("#f-cosmetic").value,
    accessories: $$('input[name="accessories"]:checked').map((cb) => cb.value),
    notes: $("#f-notes").value.trim(),
    photo: photoDataUrl,
  };
}
function validateItemForm(data) {
  const errors = {};
  if (!data.brand) errors.brand = true;
  if (!data.model) errors.model = true;
  if (!data.ramGB || data.ramGB <= 0) errors.ram = true;
  if (!data.storageGB || data.storageGB <= 0) errors.storage = true;
  if (!data.cosmetic) errors.cosmetic = true;
  for (const [key, el] of [["brand", "#err-brand"], ["model", "#err-model"], ["ram", "#err-ram"], ["storage", "#err-storage"], ["cosmetic", "#err-cosmetic"]]) {
    $(el).hidden = !errors[key];
  }
  return Object.keys(errors).length === 0;
}
$("#item-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const data = readItemForm();
  if (!validateItemForm(data)) { showToast("Lengkapi kolom bertanda * dulu."); return; }
  const items = loadItems();
  const now = Date.now();
  if (editingId) {
    const idx = items.findIndex((i) => i.id === editingId);
    if (idx >= 0) items[idx] = { ...items[idx], ...data, updatedAt: now };
    saveItems(items);
    showToast("Barang diperbarui.");
    location.hash = `#/barang/${editingId}`;
  } else {
    const item = { ...data, id: newId(), status: "available", createdAt: now, updatedAt: now };
    items.push(item);
    saveItems(items);
    showToast("Barang tersimpan.");
    location.hash = `#/barang/${item.id}`;
  }
});
$("#f-photo").addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      // Downscale to max 1200 px wide so offline storage stays small.
      const scale = Math.min(1, 1200 / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      photoDataUrl = canvas.toDataURL("image/jpeg", 0.82);
      const preview = $("#photo-preview");
      preview.src = photoDataUrl;
      preview.hidden = false;
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

// --------------------------------------------------------------- estimate
function renderEstimate(id, comparables) {
  const item = loadItems().find((i) => i.id === id);
  const body = $("#estimate-body");
  if (!item) { body.innerHTML = "<p>Barang tidak ditemukan. <a href='#/'>Kembali ke Beranda</a></p>"; $("#comparables-list").innerHTML = ""; return; }
  const b = priceBreakdown(item, comparables);
  const bestScore = b.matched[0]?.matchScore ?? 0;
  // REQ-2.4: state which fallback produced the base price.
  const fallbackNote = {
    "matched-median": "",
    "same-brand-median": "Tidak ada pembanding yang cukup mirip — harga dasar memakai median listing merek yang sama.",
    "global-median": "Tidak ada pembanding yang cukup mirip — harga dasar memakai median seluruh data referensi.",
    "no-data": "Tidak ada data referensi — taksiran tidak dapat dihitung.",
  }[b.baseSource] ?? "";
  body.innerHTML = `
    ${item.photo ? `<img src="${escapeHtml(item.photo)}" alt="Foto ${escapeHtml(itemTitle(item))}" style="border-radius:12px;max-height:260px;width:100%;object-fit:cover">` : ""}
    <h2>${escapeHtml(itemTitle(item))}</h2>
    <p class="muted">${escapeHtml(itemSpecs(item))}</p>
    <div class="estimate-hero">
      <div class="estimate-label">Taksiran dari data referensi</div>
      <div class="estimate-value">${formatIDR(b.estimate)}</div>
      <div class="estimate-range">Kisaran wajar: ${formatIDR(b.low)} – ${formatIDR(b.high)}</div>
    </div>
    ${fallbackNote ? `<p class="fallback-note">ℹ️ ${escapeHtml(fallbackNote)}</p>` : ""}
    ${bestScore < 30 ? `<p class="low-match">⚠️ Kecocokan pembanding rendah (skor ${bestScore}) — taksiran ini kurang yakin. Tambahkan data pembanding yang mirip di data/comparables.json.</p>` : ""}
    <h2>Rincian taksiran</h2>
    <table class="breakdown">
      <thead><tr><th>Komponen</th><th>Alasan</th><th class="num">Dampak</th></tr></thead>
      <tbody>
        <tr><td><strong>Harga dasar</strong> (${escapeHtml(b.baseSource)})</td><td>Median ${b.matchedCount} pembanding paling mirip</td><td class="num">${formatIDR(b.basePrice)}</td></tr>
        ${b.adjustments.map((a) => `<tr><td>${escapeHtml(a.label)}</td><td>${escapeHtml(a.reason)}</td><td class="num ${a.percent > 0 ? "adj-positive" : "adj-negative"}">${a.percent > 0 ? "+" : ""}${a.percent}% (${formatIDR(a.amountIDR)})</td></tr>`).join("")}
        <tr><td><strong>Total</strong></td><td>${b.totalPercent > 0 ? "+" : ""}${b.totalPercent}% dari harga dasar</td><td class="num"><strong>${formatIDR(b.estimate)}</strong></td></tr>
      </tbody>
    </table>`;
  $("#comparables-list").innerHTML = b.matched.map((c) => `
    <div class="comp-card">
      <strong>${escapeHtml(c.brand)} ${escapeHtml(c.model)}</strong>
      <span class="comp-score">· skor kecocokan ${c.matchScore}</span><br>
      <span class="muted small">${escapeHtml([c.cpu, `RAM ${c.ramGB} GB`, `${c.storageGB} GB ${c.storageType}`, c.cosmetic].filter(Boolean).join(" • "))}</span><br>
      <span class="comp-price">${formatIDR(c.priceIDR)}</span>
      <span class="muted small">· ${escapeHtml(c.city ?? "")}</span>
    </div>`).join("") || "<p class='muted'>Tidak ada data pembanding.</p>";
  $("#btn-to-listing").href = `#/barang/${item.id}/listing`;
  $("#btn-edit-item").href = `#/tambah?id=${item.id}`;
  const wa = waLink(item, b.estimate);
  const waBtn = $("#btn-wa-estimate");
  if (wa) { waBtn.href = wa; waBtn.textContent = "Pesan via WhatsApp"; }
  else { waBtn.href = "#/pengaturan"; waBtn.textContent = "Atur nomor WhatsApp dulu"; }
  const soldBtn = $("#btn-mark-sold");
  soldBtn.textContent = item.status === "sold" ? "Tandai Tersedia Lagi" : "Tandai Terjual";
  soldBtn.onclick = () => {
    const items = loadItems();
    const it = items.find((i) => i.id === item.id);
    if (it) { it.status = it.status === "sold" ? "available" : "sold"; it.updatedAt = Date.now(); saveItems(items); showToast(it.status === "sold" ? "Ditandai terjual." : "Ditandai tersedia."); route(); }
  };
  $("#btn-delete-item").onclick = () => {
    if (!confirm(`Hapus ${itemTitle(item)}? Tindakan ini tidak bisa dibatalkan.`)) return;
    saveItems(loadItems().filter((i) => i.id !== item.id));
    showToast("Barang dihapus.");
    location.hash = "#/";
  };
}

// --------------------------------------------------------------- listing
function renderListing(id, comparables) {
  const item = loadItems().find((i) => i.id === id);
  if (!item) { $("#listing-id").textContent = "Barang tidak ditemukan."; $("#listing-en").textContent = ""; return; }
  const est = estimatePrice(item, comparables);
  const seller = loadSeller();
  const enriched = { ...item, sellerName: seller.sellerName, city: seller.city };
  $("#listing-id").textContent = generateListing(enriched, est, "id");
  $("#listing-en").textContent = generateListing(enriched, est, "en");
  $("#btn-back-estimate").href = `#/barang/${item.id}`;
  const wa = waLink(item, est.estimate);
  const waBtn = $("#btn-wa-listing");
  if (wa) { waBtn.href = wa; waBtn.textContent = "Pesan via WhatsApp"; }
  else { waBtn.href = "#/pengaturan"; waBtn.textContent = "Atur nomor WhatsApp dulu"; }
}
$$("[data-copy]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const text = document.getElementById(btn.dataset.copy).textContent;
    try { await navigator.clipboard.writeText(text); showToast("Teks listing disalin."); }
    catch { showToast("Gagal menyalin — salin manual dari layar."); }
  });
});

// ------------------------------------------------------------- storefront
function renderStorefront(publicId) {
  const seller = loadSeller();
  const items = loadItems().filter((i) => i.status !== "sold");
  const isPublic = Boolean(publicId);
  $("#store-header").innerHTML = `
    <h1>${escapeHtml(seller.storeName || "Toko Saya")}</h1>
    <p class="muted">${escapeHtml([seller.sellerName, seller.city].filter(Boolean).join(" · ") || "Penjual laptop bekas")}</p>
    ${isPublic ? `<p class="muted small">Etalase publik — dibagikan oleh penjual.</p>` : `<p><a class="btn btn-ghost" href="#/pengaturan">Ubah info toko</a></p>`}`;
  $("#store-empty").hidden = items.length > 0;
  $("#store-grid").innerHTML = items.map((item) => {
    const est = estimatePrice(item, comparablesCache ?? []);
    const wa = waLink(item, est.estimate);
    return `<div class="item-card">
      ${item.photo ? `<img src="${escapeHtml(item.photo)}" alt="Foto ${escapeHtml(itemTitle(item))}">` : ""}
      <div class="item-card-body">
        <h3>${escapeHtml(itemTitle(item))}</h3>
        <p class="muted small">${escapeHtml(itemSpecs(item))}</p>
        <p class="price">${formatIDR(est.estimate)}</p>
        <p class="muted small">Taksiran dari data referensi</p>
        <div class="action-row">
          <a class="btn btn-ghost" href="#/barang/${item.id}">Detail</a>
          ${wa ? `<a class="btn btn-whatsapp" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>`
            : !isPublic ? `<a class="btn btn-ghost" href="#/pengaturan">Atur nomor WhatsApp</a>` : ""}
        </div>
      </div></div>`;
  }).join("");
}

// --------------------------------------------------------------- settings
function renderSettings() {
  const seller = loadSeller();
  $("#s-store").value = seller.storeName ?? "";
  $("#s-name").value = seller.sellerName ?? "";
  $("#s-city").value = seller.city ?? "";
  $("#s-wa").value = seller.whatsapp ?? "";
}
$("#seller-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const whatsapp = $("#s-wa").value.trim();
  if (whatsapp && !/^\d{8,15}$/.test(whatsapp)) { $("#err-wa").hidden = false; return; }
  $("#err-wa").hidden = true;
  saveSeller({
    storeName: $("#s-store").value.trim(),
    sellerName: $("#s-name").value.trim(),
    city: $("#s-city").value.trim(),
    whatsapp,
  });
  showToast("Pengaturan tersimpan.");
});

// ----------------------------------------------------------- offline + SW
function updateOnline() {
  $("#offline-banner").hidden = navigator.onLine;
}
window.addEventListener("online", updateOnline);
window.addEventListener("offline", updateOnline);
updateOnline();
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch((err) => console.warn("Taksir: SW registration failed", err));
}

// ------------------------------------------------------------------- boot
route();
