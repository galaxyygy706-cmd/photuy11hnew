/* =====================================================================
   Phở POS — vanilla JS + Firebase Firestore
   ---------------------------------------------------------------------
   1. Fill in your Firebase config below (Firebase console → Project
      settings → General → "Your apps" → SDK setup and configuration).
   2. Firestore collections used:
        tables/{tableId}   -> { label, zone, status, paidAt }
        orders/{tableId}   -> { items: [...], status, sentBatches, updatedAt }
        history/{autoId}   -> { tableLabel, date, time, total, method,
                                 itemCount, paymentStatus, createdAt }

      An order item carries the batch it was sent to the kitchen in:
        { menuItemId, name, size, toppings, note, quantity, unitPrice,
          subtotal, batch, sentAt, kitchenStatus, voided, voidReason }
      `batch: null` means the line is still in the cart and has never been
      printed for the kitchen — that is what makes "gọi thêm món" safe.
   3. Menu items are kept as a local constant for this MVP — move them
      to a `menu` collection later if you want to edit the menu without
      redeploying.
   ===================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
  enableIndexedDbPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------------------------------------------------------------------
   1. FIREBASE CONFIG — replace with your own project's values
   --------------------------------------------------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyDSEvMgc9DPKDIUskl_unblJOlBK1KwQ7E",
  authDomain: "photuy11h.firebaseapp.com",
  projectId: "photuy11h",
  storageBucket: "photuy11h.firebasestorage.app",
  messagingSenderId: "625914774149",
  appId: "1:625914774149:web:6b4a093ca503550b20dfec",
  measurementId: "G-GGJSPQVPTH"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Let staff keep ordering even with a flaky connection — writes queue
// locally and sync automatically once the network is back.
enableIndexedDbPersistence(db).catch((err) => {
  console.warn("Offline persistence not enabled:", err.code);
});

const tablesCol = collection(db, "tables");
const ordersCol = collection(db, "orders");
const historyCol = collection(db, "history");

/* ---------------------------------------------------------------------
   2. Static data
   --------------------------------------------------------------------- */
// Three tabs, sized to fill the bar. "Đơn" holds every single-serving item
// (phở and side dishes alike) — splitting them cost a tap without helping
// anyone find a bowl of phở faster.
const CATEGORIES = ["Đơn", "Combo", "Đồ uống"];

/**
 * Fields beyond the obvious ones:
 *   tag      – short grey pill under the name ("Phở thường").
 *   scroll   – marquee the description instead of clipping it. The flavour
 *              text runs far wider than a menu card, so it scrolls past.
 *   tagline  – combo slogan, bold, scrolls the same way.
 *   starred  – renders ⭐ after the name, matching the printed menu.
 */
const MENU_ITEMS = [
  {
    id: "tuy-tam", name: "Túy Tâm", category: "Đơn", price: 50000,
    tag: "Phở thường", scroll: true,
    desc: "Nước dùng thanh ngọt, thịt bò tươi thơm ngon, đậm đà vị truyền thống ✨", emoji: "🍜",
    customizable: true,
    sizes: [{ label: "Thường", extra: 0 }, { label: "Lớn", extra: 15000 }],
    toppings: [
      { label: "Thêm thịt", extra: 20000 },
      { label: "Thêm nạm", extra: 20000 },
      { label: "Thêm gầu", extra: 20000 },
      { label: "Thêm trứng", extra: 8000 },
    ],
  },
  {
    id: "tuy-thuong", name: "Túy Thượng", category: "Đơn", price: 80000,
    tag: "Phở đặc biệt", scroll: true,
    desc: "Thưởng thức tinh túy từ phần thịt lõi rùa quý hiếm, mềm tan trong thực quản 💎", emoji: "🍜",
    customizable: true,
    sizes: [{ label: "Thường", extra: 0 }, { label: "Lớn", extra: 15000 }],
    toppings: [
      { label: "Thêm thịt", extra: 20000 },
      { label: "Thêm nạm", extra: 20000 },
      { label: "Thêm gầu", extra: 20000 },
      { label: "Thêm trứng", extra: 8000 },
    ],
  },
  {
    id: "tuy-long-hoa-chau", name: "Túy Long Hỏa Châu", category: "Đơn", price: 10000,
    tag: "Trứng chần", starred: true, scroll: true,
    desc: "Trứng gà tươi chần trong nước dùng thanh ngọt ✨", emoji: "🥚",
  },
  {
    id: "tuy-long-tiem-thuy", name: "Túy Long Tiềm Thủy", category: "Đơn", price: 20000,
    tag: "Trứng hấp", starred: true, scroll: true,
    desc: "Ngâm trong nước cốt sá sùng quý giá, hấp cách thủy tinh hoa 🥚", emoji: "🍮",
  },
  {
    id: "quay", name: "Quẩy", category: "Đơn", price: 10000,
    starred: true,
    desc: "Giòn rụm (4 cái)", emoji: "🥖",
  },

  {
    id: "combo-thuong-thuy", name: "Combo Thượng Thủy", category: "Combo", price: 89000,
    desc: "Túy Thượng + Túy Long Tiềm Thủy",
    tagline: "Bậc quân tử thưởng thức tinh hoa ✨", emoji: "🍱",
  },
  {
    id: "combo-tam-chau", name: "Combo Tâm Châu", category: "Combo", price: 55000,
    desc: "Túy Tâm + Túy Long Hỏa Châu",
    tagline: "Năng lượng cho ngày mới ☀️", emoji: "🍱",
  },
  {
    id: "combo-song-long", name: "Combo Song Long Hội Tụ", category: "Combo", price: 175000,
    desc: "2 Túy Thượng + 2 Túy Long Tiềm Thủy + quẩy",
    tagline: "Chiêu đãi bậc Đế Vương 👑", emoji: "🍱",
  },

  { id: "tra-da", name: "Trà Đá", category: "Đồ uống", price: 3000, desc: "Trà đá mát lạnh", emoji: "🧊" },
  { id: "tra-chanh", name: "Trà Chanh", category: "Đồ uống", price: 10000, desc: "Trà chanh tươi mát", emoji: "🍋" },
  { id: "nuoc-ngot", name: "Nước Ngọt", category: "Đồ uống", price: 15000, desc: "Coca / Pepsi / 7Up", emoji: "🥤" },
];

const INITIAL_TABLES = [
  ...["01", "02", "03", "04", "05", "06", "07", "08"].map((n) => ({
    id: "ban-" + n, label: "Bàn " + n, zone: "Khu bàn", status: "trong",
  })),
  ...["01", "02", "03", "04", "05"].map((n) => ({
    id: "quay-" + n, label: "Quầy " + n, zone: "Quầy bar", status: "trong",
  })),
];

const STATUS_META = {
  trong: { label: "Trống" },
  dang_goi: { label: "Đang gọi" },
  dang_phuc_vu: { label: "Đang phục vụ" },
  thanh_toan: { label: "Thanh toán" },
  cho_don: { label: "Chờ dọn" },
};

// Two states only: a bowl of phở takes minutes, so anything finer than
// "đã gửi bếp" / "đã bưng ra" is data nobody keeps up to date.
const KITCHEN_LABEL = { da_gui: "Đã gửi", hoan_thanh: "Hoàn thành" };
const METHOD_LABEL = { cash: "Tiền mặt", qr: "VietQR", card: "Thẻ" };
const VOID_REASONS = ["Hết món", "Khách đổi ý", "Nhân viên nhập sai", "Lý do khác"];

// A "Chờ dọn" table falls back to "Trống" on its own so a forgotten tap
// never leaves the floor map lying to the staff.
const AUTO_CLEAN_MS = 5 * 60 * 1000;

// Shown on the tables screen. Bump it with every deploy: it is the fastest
// way to tell "the fix does not work" apart from "the fix never loaded".
const APP_VERSION = "v6 · 2026-08-19";

const SHOP = {
  name: "PHỞ HƯƠNG VỊ VIỆT",
  address: "123 Đường ABC, Quận 1, TP.HCM",
  phone: "0900 000 000",
};

const fmt = (n) => n.toLocaleString("vi-VN") + "đ";
const byId = (id) => document.getElementById(id);
const nowStamp = () => new Date().toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const timeOf = (ms) => new Date(ms).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------------------------------------------------------------------
   2b. Printing — 80mm thermal receipts, rendered into a hidden iframe so
       the POS screen never navigates away and no popup blocker fires.
   --------------------------------------------------------------------- */
const PRINT_CSS = `
  @page { size: 80mm auto; margin: 4mm 3mm; }
  * { box-sizing: border-box; }
  body { margin: 0; width: 74mm; color: #000;
         font-family: "Segoe UI", Roboto, Arial, sans-serif; font-size: 12px; }
  .c { text-align: center; }
  .shop { font-size: 15px; font-weight: 700; }
  .muted { font-size: 11px; }
  .doc-title { font-size: 17px; font-weight: 700; margin: 7px 0 2px; letter-spacing: 1px; }
  .table-line { font-size: 20px; font-weight: 700; margin: 2px 0; }
  hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 2px 0; }
  td.qty { width: 34px; font-weight: 700; }
  td.amt { text-align: right; white-space: nowrap; }
  .mod { font-size: 11px; }
  .note { font-size: 11px; font-style: italic; }
  .total td { font-size: 15px; font-weight: 700; padding-top: 5px; }
  .foot { font-size: 11px; margin-top: 9px; }
  /* Kitchen tickets are read at arm's length over a hot pot. */
  body.kitchen { font-size: 13px; }
  body.kitchen td { padding: 4px 0; }
  body.kitchen .item { font-size: 15px; font-weight: 700; }
  body.kitchen .mod, body.kitchen .note { font-size: 12px; }
`;

function printHtml(title, bodyClass, inner) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:-9999px;top:0;width:0;height:0;border:0";
  document.body.appendChild(frame);

  const fdoc = frame.contentDocument;
  fdoc.open();
  fdoc.write(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8" />
    <title>${esc(title)}</title><style>${PRINT_CSS}</style></head>
    <body class="${bodyClass}">${inner}</body></html>`);
  fdoc.close();

  // Give the frame a tick to lay out before asking the browser to print.
  setTimeout(() => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch (err) {
      showToast("Không mở được hộp thoại in", true);
    }
    setTimeout(() => frame.remove(), 60000);
  }, 200);
}

function shopHeader() {
  return `<div class="c">
    <div class="shop">${esc(SHOP.name)}</div>
    <div class="muted">${esc(SHOP.address)}</div>
    <div class="muted">ĐT: ${esc(SHOP.phone)}</div>
  </div>`;
}

function itemRowsNoPrice(items) {
  return items.map((it) => {
    const mods = [it.size, ...(it.toppings || [])].filter(Boolean).join(", ");
    return `<tr>
      <td class="qty">${it.quantity}x</td>
      <td><div class="item">${esc(it.name)}</div>
        ${mods ? `<div class="mod">+ ${esc(mods)}</div>` : ""}
        ${it.note ? `<div class="note">“${esc(it.note)}”</div>` : ""}</td>
    </tr>`;
  }).join("");
}

function itemRowsWithPrice(items) {
  return items.map((it) => {
    const mods = [it.size, ...(it.toppings || [])].filter(Boolean).join(", ");
    return `<tr>
      <td class="qty">${it.quantity}x</td>
      <td>${esc(it.name)}
        ${mods ? `<div class="mod">+ ${esc(mods)}</div>` : ""}
        ${it.note ? `<div class="note">“${esc(it.note)}”</div>` : ""}</td>
      <td class="amt">${fmt(it.subtotal)}</td>
    </tr>`;
  }).join("");
}

/** Kitchen ticket — no prices, only the lines of one send batch. */
function printKitchenTicket(tableLabel, batchNo, items) {
  if (!items.length) return;
  const count = items.reduce((s, i) => s + i.quantity, 0);
  printHtml(`Phiếu bếp — ${tableLabel}`, "kitchen", `
    <div class="c">
      <div class="doc-title">PHIẾU BẾP</div>
      <div class="table-line">${esc(tableLabel)}</div>
      <div class="muted">Lượt gửi #${batchNo} · ${nowStamp()}</div>
    </div>
    <hr />
    <table>${itemRowsNoPrice(items)}</table>
    <hr />
    <div class="c muted">Tổng ${count} phần</div>`);
}

/** Void ticket — tells the kitchen to stop making something already sent. */
function printVoidTicket(tableLabel, item, reason) {
  printHtml(`Hủy món — ${tableLabel}`, "kitchen", `
    <div class="c">
      <div class="doc-title">*** HỦY MÓN ***</div>
      <div class="table-line">${esc(tableLabel)}</div>
      <div class="muted">${nowStamp()}</div>
    </div>
    <hr />
    <table>${itemRowsNoPrice([item])}</table>
    <hr />
    <div class="c">Lý do: <b>${esc(reason)}</b></div>`);
}

/**
 * Guest-facing bill. `variant` is "tam_tinh" (handed over so the guest can
 * check it before paying) or "hoa_don" (printed after the money is in).
 */
function printBill(tableLabel, items, total, variant, method) {
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const isFinal = variant === "hoa_don";
  printHtml(`${isFinal ? "Hóa đơn" : "Tạm tính"} — ${tableLabel}`, "", `
    ${shopHeader()}
    <div class="c">
      <div class="doc-title">${isFinal ? "HÓA ĐƠN" : "PHIẾU TẠM TÍNH"}</div>
      <div class="muted">${esc(tableLabel)} · ${nowStamp()}</div>
    </div>
    <hr />
    <table>${itemRowsWithPrice(items)}</table>
    <hr />
    <table>
      <tr><td colspan="2">Số món</td><td class="amt">${count}</td></tr>
      <tr><td colspan="2">Giảm giá</td><td class="amt">0đ</td></tr>
      <tr class="total"><td colspan="2">TỔNG CỘNG</td><td class="amt">${fmt(total)}</td></tr>
      ${isFinal && method ? `<tr><td colspan="2">Thanh toán</td><td class="amt">${esc(method)}</td></tr>` : ""}
    </table>
    <hr />
    <div class="c foot">
      ${isFinal ? "Cảm ơn quý khách — hẹn gặp lại!" : "Phiếu tạm tính, không có giá trị thanh toán"}
    </div>`);
}

/* ---------------------------------------------------------------------
   3. App state
   --------------------------------------------------------------------- */
const state = {
  screen: "loading", // loading | tables | menu | cart | tracking | payment | success | history
  tables: [],
  activeTableId: null,
  activeOrder: null,   // { items, status, sentBatches } synced live from Firestore
  history: [],
  menuCategory: "Đơn",
  menuQuery: "",
  customizeItem: null,
  voidTarget: null,    // index of the sent line awaiting a cancel reason
  lastPayment: null,
};

let unsubOrder = null;

/* ---------------------------------------------------------------------
   3b. Order shape helpers
   --------------------------------------------------------------------- */
const isSent = (it) => it.batch != null;
const isPending = (it) => it.batch == null;

/**
 * Brings older documents onto the current shape: the four-step kitchen
 * flow collapses to two, and lines written before batches existed are
 * treated as batch #1 so their tickets are never reprinted.
 */
function normalizeOrder(data) {
  let maxBatch = 0;
  const items = (data.items || []).map((it) => {
    if (it.batch == null && it.kitchenStatus == null) return { ...it, batch: null };
    const batch = it.batch != null ? it.batch : 1;
    maxBatch = Math.max(maxBatch, batch);
    return {
      ...it,
      batch,
      sentAt: it.sentAt || null,
      kitchenStatus: it.kitchenStatus === "hoan_thanh" ? "hoan_thanh" : "da_gui",
      voided: !!it.voided,
    };
  });
  return {
    ...data,
    items,
    status: data.status || "draft",
    sentBatches: Math.max(data.sentBatches || 0, maxBatch),
  };
}

function currentItems() {
  return (state.activeOrder && state.activeOrder.items) || [];
}
/** Lines still in the cart — never printed, never billed. */
function pendingItems() { return currentItems().filter(isPending); }
/** Lines the kitchen has, minus the cancelled ones — this is the bill. */
function billableItems() { return currentItems().filter((i) => isSent(i) && !i.voided); }
function billTotal() { return billableItems().reduce((s, i) => s + i.subtotal, 0); }
/** Indexed view so filtered lists can still address the original array. */
function itemEntries() { return currentItems().map((it, idx) => ({ it, idx })); }

/* ---------------------------------------------------------------------
   4. Firestore: seed + subscriptions
   --------------------------------------------------------------------- */
async function seedTablesIfEmpty() {
  const snap = await getDocs(tablesCol);
  if (!snap.empty) return;
  const batch = writeBatch(db);
  INITIAL_TABLES.forEach((t) => {
    batch.set(doc(db, "tables", t.id), { label: t.label, zone: t.zone, status: t.status });
  });
  // Not awaited: on a first run with no network this would hang boot, and
  // the seeded tables are already readable from the local cache anyway.
  batch.commit().catch(() => showToast("Không thể khởi tạo dữ liệu bàn", true));
}

function subscribeTables() {
  onSnapshot(
    tablesCol,
    (snap) => {
      state.tables = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      render();
    },
    (err) => showToast("Mất kết nối tới máy chủ bàn — " + err.code, true)
  );
}

function subscribeHistory() {
  const q = query(historyCol, orderBy("createdAt", "desc"), limit(50));
  onSnapshot(
    q,
    (snap) => {
      state.history = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (state.screen === "history") render();
    },
    (err) => showToast("Không tải được lịch sử — " + err.code, true)
  );
}

function subscribeActiveOrder(tableId, onFirstSnapshot) {
  if (unsubOrder) unsubOrder();
  let first = true;
  unsubOrder = onSnapshot(
    doc(db, "orders", tableId),
    (snap) => {
      state.activeOrder = snap.exists()
        ? normalizeOrder(snap.data())
        : { items: [], status: "draft", sentBatches: 0 };
      if (first) {
        first = false;
        if (onFirstSnapshot) onFirstSnapshot(state.activeOrder);
      }
      render();
    },
    (err) => showToast("Mất kết nối tới đơn hàng — " + err.code, true)
  );
}

function stopActiveOrder() {
  if (unsubOrder) unsubOrder();
  unsubOrder = null;
  state.activeOrder = null;
}

/* ---------------------------------------------------------------------
   5. Firestore write helpers

   NEVER `await` these.

   With offline persistence enabled, a Firestore write promise only settles
   once the SERVER acknowledges it. On a flaky connection it stays pending
   indefinitely, so awaiting one blocks every step that follows — that is how
   a paid table used to get stuck on "Thanh toán" instead of "Chờ dọn".

   Each helper instead updates local state optimistically and lets the write
   drain in the background, exactly what the offline queue is for. Failures
   still surface through the toast.
   --------------------------------------------------------------------- */
function setTableStatus(tableId, status, extra = {}) {
  if (!tableId) {
    showToast("Lỗi: không xác định được bàn để cập nhật", true);
    return;
  }
  const table = state.tables.find((t) => t.id === tableId);
  if (table) Object.assign(table, { status, ...extra });

  // A rejected write is rolled back out of the local cache too, so the table
  // would silently snap back to its old status — name the failure instead.
  updateDoc(doc(db, "tables", tableId), { status, ...extra })
    .catch((err) => showToast(`Không đổi được bàn sang "${STATUS_META[status]?.label || status}" — ${err.code || err}`, true));
}

function saveOrderItems(tableId, items, extra = {}) {
  if (tableId === state.activeTableId && state.activeOrder) {
    state.activeOrder = { ...state.activeOrder, items, ...extra };
  }

  setDoc(
    doc(db, "orders", tableId),
    { items, updatedAt: serverTimestamp(), ...extra },
    { merge: true }
  ).catch(() => showToast("Không thể lưu đơn hàng", true));
}

function clearOrder(tableId) {
  deleteDoc(doc(db, "orders", tableId)).catch(() => { /* non-fatal */ });
}

function addHistoryEntry(entry) {
  addDoc(historyCol, { ...entry, createdAt: serverTimestamp() })
    .catch(() => showToast("Không thể lưu lịch sử đơn hàng", true));
}

/* ---------------------------------------------------------------------
   6. Toast
   --------------------------------------------------------------------- */
let toastTimer = null;
function showToast(msg, isError = false) {
  const el = byId("toast");
  el.textContent = msg;
  el.hidden = false;
  el.className = isError ? "" : "info";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

/* ---------------------------------------------------------------------
   7. Navigation
   --------------------------------------------------------------------- */
function goTables() {
  stopActiveOrder();
  state.activeTableId = null;
  state.screen = "tables";
  render();
}

function selectTable(tableId) {
  const table = state.tables.find((t) => t.id === tableId);

  // A table waiting to be bussed is cleared with the same single tap that
  // would otherwise open it — no drilling into a detail screen mid-service.
  if (table && table.status === "cho_don") {
    markCleaned(tableId);
    return;
  }

  state.activeTableId = tableId;
  if (table && table.status === "trong") setTableStatus(tableId, "dang_goi");
  state.screen = "menu";
  subscribeActiveOrder(tableId, (order) => {
    // Reopen where the table actually is, not always at the menu.
    if (order.status === "paying") state.screen = "payment";
    else if (order.items.some(isSent)) state.screen = "tracking";
    else state.screen = "menu";
  });
  render();
}

function markCleaned(tableId) {
  const table = state.tables.find((t) => t.id === tableId);
  const label = table ? table.label : "Bàn";
  setTableStatus(tableId, "trong", { paidAt: null });
  showToast(`${label} đã dọn — chạm lại để order`);
  render();
}

/** Safety net for the tap nobody remembered to make. */
function autoReleaseCleaningTables() {
  const now = Date.now();
  state.tables.forEach((t) => {
    if (t.status === "cho_don" && t.paidAt && now - t.paidAt > AUTO_CLEAN_MS) {
      setTableStatus(t.id, "trong", { paidAt: null });
    }
  });
}

function goCart() { state.screen = "cart"; render(); }
function goMenu() { state.screen = "menu"; render(); }
function goTracking() { state.screen = "tracking"; render(); }
function goHistory() {
  stopActiveOrder();
  state.activeTableId = null;
  state.screen = "history";
  render();
}

/* ---------------------------------------------------------------------
   8. Order mutation helpers (operate on local copy, then persist)
   --------------------------------------------------------------------- */
function addSimpleItem(menuItem, forcedQty) {
  const items = currentItems();
  // Only ever merge into a line that has NOT gone to the kitchen, otherwise
  // bumping a quantity would silently rewrite an order the cook already has.
  const idx = items.findIndex((i) => i.menuItemId === menuItem.id && !i.size && isPending(i));
  let next;
  if (idx === -1) {
    next = [...items, { menuItemId: menuItem.id, name: menuItem.name, quantity: 1, unitPrice: menuItem.price, subtotal: menuItem.price, batch: null }];
  } else {
    const nextQty = forcedQty !== undefined ? forcedQty : items[idx].quantity + 1;
    if (nextQty <= 0) {
      next = items.filter((_, i) => i !== idx);
    } else {
      next = [...items];
      next[idx] = { ...next[idx], quantity: nextQty, subtotal: next[idx].unitPrice * nextQty };
    }
  }
  saveOrderItems(state.activeTableId, next, { status: orderStatus() });
  render();
}

/** Never downgrade a sent order back to "draft" when adding a new line. */
function orderStatus() {
  return (state.activeOrder && state.activeOrder.status) || "draft";
}

function confirmCustomizeLine(line) {
  const next = [...currentItems(), { ...line, batch: null }];
  saveOrderItems(state.activeTableId, next, { status: orderStatus() });
  state.customizeItem = null;
  state.screen = "menu";
  render();
}

function cartQtyChange(idx, v) {
  const items = [...currentItems()];
  items[idx] = { ...items[idx], quantity: v, subtotal: items[idx].unitPrice * v };
  saveOrderItems(state.activeTableId, items);
  render();
}

function cartRemove(idx) {
  const items = currentItems().filter((_, i) => i !== idx);
  saveOrderItems(state.activeTableId, items);
  render();
}

/**
 * Sends only the lines that have never been sent, stamping them with the
 * next batch number. Lines already with the kitchen keep their status, and
 * the printed ticket lists the new batch alone — no duplicate cooking.
 */
function sendToKitchen() {
  const tableId = state.activeTableId;
  const table = state.tables.find((t) => t.id === tableId);
  const pending = pendingItems();
  if (!pending.length) return;

  const batch = (state.activeOrder?.sentBatches || 0) + 1;
  const sentAt = Date.now();
  const items = currentItems().map((it) =>
    isPending(it) ? { ...it, batch, sentAt, kitchenStatus: "da_gui", voided: false } : it
  );

  saveOrderItems(tableId, items, { status: "sent", sentBatches: batch });
  setTableStatus(tableId, "dang_phuc_vu");
  printKitchenTicket(table ? table.label : "Bàn", batch, pending);
  goTracking();
}

function reprintBatch(batchNo) {
  const table = state.tables.find((t) => t.id === state.activeTableId);
  const items = currentItems().filter((it) => it.batch === batchNo && !it.voided);
  printKitchenTicket(table ? table.label : "Bàn", batchNo, items);
}

function toggleItemDone(idx) {
  const items = [...currentItems()];
  const it = items[idx];
  if (!it || it.voided) return;
  items[idx] = { ...it, kitchenStatus: it.kitchenStatus === "hoan_thanh" ? "da_gui" : "hoan_thanh" };
  saveOrderItems(state.activeTableId, items);
  render();
}

function markAllDone() {
  const items = currentItems().map((it) =>
    isSent(it) && !it.voided ? { ...it, kitchenStatus: "hoan_thanh" } : it
  );
  saveOrderItems(state.activeTableId, items);
  render();
}

/**
 * Cancels a line the kitchen already has. The line is kept (struck through)
 * rather than deleted so the cancellation stays auditable, and a void ticket
 * goes to the kitchen so nobody keeps cooking it.
 */
function voidSentItem(idx, reason) {
  const items = [...currentItems()];
  const it = items[idx];
  if (!it || it.voided) return;
  items[idx] = { ...it, voided: true, voidReason: reason, voidedAt: Date.now() };
  saveOrderItems(state.activeTableId, items);

  const table = state.tables.find((t) => t.id === state.activeTableId);
  printVoidTicket(table ? table.label : "Bàn", it, reason);
  showToast(`Đã hủy ${it.name} — ${reason}`);
}

/** Step 4: the guest asks for the bill, so hand them a provisional slip. */
function requestPayment() {
  saveOrderItems(state.activeTableId, currentItems(), { status: "paying" });
  setTableStatus(state.activeTableId, "thanh_toan");
  state.screen = "payment";
  render();
  printProvisional();
}

function printProvisional() {
  const table = state.tables.find((t) => t.id === state.activeTableId);
  printBill(table ? table.label : "Bàn", billableItems(), billTotal(), "tam_tinh");
}

/** Undo a payment request — the guest decided to order more after all. */
function cancelPaymentRequest() {
  saveOrderItems(state.activeTableId, currentItems(), { status: "sent" });
  setTableStatus(state.activeTableId, "dang_phuc_vu");
  goTracking();
}

/** Step 5: money is in. Table moves to "Chờ dọn", not straight to "Trống". */
function confirmPayment(method) {
  const tableId = state.activeTableId;
  const items = billableItems();
  const total = billTotal();
  const table = state.tables.find((t) => t.id === tableId);
  const tableLabel = table ? table.label : "Bàn";
  const now = new Date();

  // Read everything off the live order before the listener is dropped.
  const historyEntry = {
    tableId,
    tableLabel,
    date: now.toLocaleDateString("vi-VN"),
    time: now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    total,
    method: METHOD_LABEL[method],
    itemCount: items.reduce((s, i) => s + i.quantity, 0),
    voidedCount: currentItems().filter((i) => i.voided).length,
    batches: state.activeOrder?.sentBatches || 1,
    paymentStatus: "paid",
  };

  // Snapshot the bill so the receipt can still be printed from the success
  // screen after the order document is gone.
  state.lastPayment = { total, items, method: METHOD_LABEL[method], tableLabel };

  // Free the floor map first — it is the one write staff notice immediately.
  setTableStatus(tableId, "cho_don", { paidAt: Date.now() });
  addHistoryEntry(historyEntry);

  // Drop the live listener BEFORE deleting the order, otherwise the emptied
  // snapshot repaints the payment screen at 0đ.
  state.screen = "success";
  stopActiveOrder();
  clearOrder(tableId);
  render();
}

function printFinalReceipt() {
  const p = state.lastPayment;
  if (!p) return;
  printBill(p.tableLabel, p.items, p.total, "hoa_don", p.method);
}

function backToTablesAfterSuccess() {
  stopActiveOrder();
  state.lastPayment = null;
  goTables();
}

/* ---------------------------------------------------------------------
   9. Render: top bar + bottom nav
   --------------------------------------------------------------------- */
function renderChrome() {
  const table = state.tables.find((t) => t.id === state.activeTableId);
  const title =
    state.screen === "tables" ? "Phở Hương Vị Việt" :
    state.screen === "history" ? "Lịch sử đơn hàng" :
    table ? table.label + (table.zone === "Khu bàn" ? " · 2 khách" : "") : "";
  byId("topbar-title").textContent = title;

  const backBtn = byId("btn-back");
  const showBack = !["tables", "history", "loading", "success"].includes(state.screen);
  backBtn.hidden = !showBack;

  document.querySelectorAll(".nav-item").forEach((btn) => {
    const nav = btn.dataset.nav;
    btn.classList.toggle("active", (nav === "tables" && state.screen === "tables") || (nav === "history" && state.screen === "history"));
  });
  byId("bottomnav").style.display = ["tables", "history"].includes(state.screen) ? "grid" : "none";
}

byId("btn-back").addEventListener("click", () => {
  if (state.screen === "menu") {
    // Leaving the menu of a table that already has food out must not
    // downgrade it back to "Đang gọi".
    if (currentItems().some(isSent)) { goTracking(); return; }
    setTableStatus(state.activeTableId, currentItems().length ? "dang_goi" : "trong");
    goTables();
  } else if (state.screen === "cart") { goMenu(); }
  else if (state.screen === "tracking") { goTables(); }
  else if (state.screen === "payment") { cancelPaymentRequest(); }
});

document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    const nav = btn.dataset.nav;
    if (nav === "tables") goTables();
    else if (nav === "history") goHistory();
  });
});

/* ---------------------------------------------------------------------
   10. Render: screens
   --------------------------------------------------------------------- */
function render() {
  renderChrome();
  const el = byId("screen");
  switch (state.screen) {
    case "loading": el.innerHTML = renderLoading(); break;
    case "tables": el.innerHTML = renderTables(); attachTablesEvents(); break;
    case "menu": el.innerHTML = renderMenu(); attachMenuEvents(); break;
    case "cart": el.innerHTML = renderCart(); attachCartEvents(); break;
    case "tracking": el.innerHTML = renderTracking(); attachTrackingEvents(); break;
    case "payment": el.innerHTML = renderPayment(); attachPaymentEvents(); break;
    case "success": el.innerHTML = renderSuccess(); attachSuccessEvents(); break;
    case "history": el.innerHTML = renderHistory(); attachHistoryEvents(); break;
  }
  renderModals();
}

function renderModals() {
  if (state.voidTarget != null) { renderVoidModal(); return; }
  renderCustomizeModal();
}

function renderLoading() {
  return `<div class="loading-screen"><svg class="spin" viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="9" fill="none" stroke="#9ca3af" stroke-width="3" stroke-dasharray="40" stroke-linecap="round"/></svg></div>`;
}

/* ---- Tables ---- */
function renderTables() {
  const zones = ["Khu bàn", "Quầy bar"];
  const zoneHtml = zones.map((zone) => {
    const list = state.tables.filter((t) => t.zone === zone).sort((a,b)=>a.label.localeCompare(b.label));
    const cards = list.map((t) => {
      const meta = STATUS_META[t.status] || STATUS_META.trong;
      const num = t.label.replace(zone === "Khu bàn" ? "Bàn " : "Quầy ", "");
      const cleaning = t.status === "cho_don";
      return `
        <button class="table-card ${cleaning ? "cleaning" : ""}" data-table="${t.id}">
          <span class="num">${num}</span>
          <span class="status status-${t.status}">${meta.label}</span>
          ${cleaning ? `<span class="count">Chạm để dọn</span>` : ""}
        </button>`;
    }).join("");
    return `
      <div class="zone-block">
        <p class="zone-title">${zone} (${list.length} bàn)</p>
        <div class="table-grid">${cards}</div>
      </div>`;
  }).join("");

  const legend = Object.entries(STATUS_META).map(([k, v]) => `
    <div class="legend-item"><span class="dot dot-${k}"></span>${v.label}</div>
  `).join("");

  return `
    <div class="scroll">
      <div class="search-box">
        <svg viewBox="0 0 24 24" width="16" height="16"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <input placeholder="Tìm bàn..." />
      </div>
      ${zoneHtml}
      <p class="section-label" style="margin-top:8px">Chú thích</p>
      <div class="legend">${legend}</div>
      <p class="hint-text">Chọn bàn để bắt đầu order · ${APP_VERSION}</p>
    </div>`;
}

function attachTablesEvents() {
  document.querySelectorAll(".table-card").forEach((btn) => {
    btn.addEventListener("click", () => selectTable(btn.dataset.table));
  });
}

/* ---- Menu ---- */
function qtyForSimple(id) {
  // Sent lines are excluded: the stepper edits the cart, not the kitchen.
  return pendingItems().filter((i) => i.menuItemId === id && !i.size).reduce((s, i) => s + i.quantity, 0);
}

function renderMenu() {
  const pending = pendingItems();
  const hasSent = currentItems().some(isSent);
  const cartCount = pending.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = pending.reduce((s, i) => s + i.subtotal, 0);

  const tabs = CATEGORIES.map((c) => `
    <button class="tab-chip ${c === state.menuCategory ? "active" : ""}" data-cat="${c}">${c}</button>
  `).join("");

  // Searching spans every tab. Without the old "Tất cả" tab, confining the
  // search to the active one would hide "Trà đá" from anyone typing while
  // still on "Đơn".
  const q = state.menuQuery.trim().toLowerCase();
  const filtered = q
    ? MENU_ITEMS.filter((m) => m.name.toLowerCase().includes(q))
    : MENU_ITEMS.filter((m) => m.category === state.menuCategory);

  const list = filtered.map((item) => {
    const qty = qtyForSimple(item.id);
    let control;
    if (item.customizable) {
      control = `<button class="round-btn" data-customize="${item.id}"><svg viewBox="0 0 24 24" width="15" height="15"><path d="M12 5v14M5 12h14" stroke="white" stroke-width="2.4" stroke-linecap="round"/></svg></button>`;
    } else if (qty === 0) {
      control = `<button class="round-btn" data-add="${item.id}"><svg viewBox="0 0 24 24" width="15" height="15"><path d="M12 5v14M5 12h14" stroke="white" stroke-width="2.4" stroke-linecap="round"/></svg></button>`;
    } else {
      control = `
        <div class="stepper">
          <button class="round-btn outline" data-dec="${item.id}"><svg viewBox="0 0 24 24" width="13" height="13"><path d="M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>
          <span class="qty">${qty}</span>
          <button class="round-btn" data-inc="${item.id}"><svg viewBox="0 0 24 24" width="13" height="13"><path d="M12 5v14M5 12h14" stroke="white" stroke-width="2.4" stroke-linecap="round"/></svg></button>
        </div>`;
    }
    const descHtml = item.scroll
      ? `<div class="scroll-container"><div class="scroll-text">${esc(item.desc)}</div></div>`
      : `<p class="menu-desc">${esc(item.desc)}</p>`;

    return `
      <div class="menu-item">
        <div class="menu-thumb">${item.emoji}</div>
        <div class="menu-info">
          <p class="menu-name">${esc(item.name)}${item.starred ? ` <span class="menu-star">⭐</span>` : ""}</p>
          ${item.tag ? `<span class="menu-tag">${esc(item.tag)}</span>` : ""}
          ${descHtml}
          ${item.tagline ? `<div class="scroll-container"><div class="scroll-text strong">${esc(item.tagline)}</div></div>` : ""}
          <div class="menu-row-bottom">
            <span class="price-tag">${fmt(item.price)}</span>
            ${control}
          </div>
        </div>
      </div>`;
  }).join("") || `<p class="empty-msg">Không tìm thấy món phù hợp</p>`;

  const cartBar = cartCount > 0 ? `
    <div class="cart-bar-wrap">
      <button class="cart-bar" id="go-cart">
        <span class="left">
          <span class="cart-badge">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M3 3h2l2.4 12.4a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L21 8H6" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="20" r="1.3" fill="white"/><circle cx="17" cy="20" r="1.3" fill="white"/></svg>
            <span class="count">${cartCount}</span>
          </span>
          ${cartCount} món${hasSent ? " mới" : ""}
        </span>
        <span>${fmt(cartTotal)} ›</span>
      </button>
    </div>` : "";

  const sentBanner = hasSent ? `
    <div class="info-strip" id="back-to-tracking">
      Bàn đang phục vụ · thêm món rồi bấm <b>Gửi bếp</b> để in phiếu lượt mới
      <span class="link">Theo dõi ›</span>
    </div>` : "";

  return `
    ${sentBanner}
    <div class="search-box">
      <svg viewBox="0 0 24 24" width="16" height="16"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <input id="menu-search" placeholder="Tìm món..." value="${state.menuQuery}" />
    </div>
    <div class="tabs tabs-equal">${tabs}</div>
    <div class="scroll">
      <p class="section-label">${q ? `Kết quả cho "${esc(state.menuQuery.trim())}"` : state.menuCategory}</p>
      <div class="menu-list">${list}</div>
    </div>
    ${cartBar}`;
}

function attachMenuEvents() {
  byId("menu-search")?.addEventListener("input", (e) => { state.menuQuery = e.target.value; render(); byId("menu-search").focus(); });
  document.querySelectorAll("[data-cat]").forEach((btn) => btn.addEventListener("click", () => { state.menuCategory = btn.dataset.cat; render(); }));
  document.querySelectorAll("[data-customize]").forEach((btn) => btn.addEventListener("click", () => {
    state.customizeItem = MENU_ITEMS.find((m) => m.id === btn.dataset.customize);
    render();
  }));
  document.querySelectorAll("[data-add]").forEach((btn) => btn.addEventListener("click", () => addSimpleItem(MENU_ITEMS.find((m) => m.id === btn.dataset.add))));
  document.querySelectorAll("[data-inc]").forEach((btn) => btn.addEventListener("click", () => addSimpleItem(MENU_ITEMS.find((m) => m.id === btn.dataset.inc), qtyForSimple(btn.dataset.inc) + 1)));
  document.querySelectorAll("[data-dec]").forEach((btn) => btn.addEventListener("click", () => addSimpleItem(MENU_ITEMS.find((m) => m.id === btn.dataset.dec), qtyForSimple(btn.dataset.dec) - 1)));
  byId("go-cart")?.addEventListener("click", goCart);
  byId("back-to-tracking")?.addEventListener("click", goTracking);
}

/* ---- Customize modal ---- */
function renderCustomizeModal() {
  const layer = byId("modal-layer");
  const item = state.customizeItem;
  if (!item) { layer.innerHTML = ""; return; }

  if (state._customizeDraft?.id !== item.id) {
    state._customizeDraft = { id: item.id, sizeIdx: 0, toppings: {}, qty: 1, note: "" };
  }
  const draft = state._customizeDraft;
  const size = item.sizes[draft.sizeIdx];
  const toppingTotal = item.toppings.reduce((s, t) => s + (draft.toppings[t.label] ? t.extra : 0), 0);
  const unit = item.price + size.extra + toppingTotal;
  const total = unit * draft.qty;

  const sizesHtml = item.sizes.map((s, i) => `
    <div class="option-row ${i === draft.sizeIdx ? "active" : ""}" data-size-idx="${i}">
      <span class="opt-left">
        <span class="radio-dot ${i === draft.sizeIdx ? "active" : ""}">${i === draft.sizeIdx ? '<span class="inner"></span>' : ""}</span>
        ${s.label}
      </span>
      ${s.extra > 0 ? `<span class="extra">+${fmt(s.extra)}</span>` : ""}
    </div>`).join("");

  const toppingsHtml = item.toppings.map((t) => `
    <label class="option-row" style="cursor:pointer">
      <span class="opt-left">
        <input type="checkbox" data-topping="${t.label}" ${draft.toppings[t.label] ? "checked" : ""} style="width:16px;height:16px;accent-color:#15803d" />
        ${t.label}
      </span>
      <span class="extra">+${fmt(t.extra)}</span>
    </label>`).join("");

  byId("modal-layer").innerHTML = `
    <div class="modal-screen">
      <header id="topbar" style="flex-shrink:0">
        <button class="icon-btn" id="modal-close"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <h1 id="topbar-title">${item.name}</h1>
        <span style="width:26px"></span>
      </header>
      <div class="modal-body">
        <div class="modal-item-head">
          <div class="modal-item-thumb">${item.emoji}</div>
          <div>
            <p class="menu-name">${item.name}</p>
            <p class="menu-desc" style="white-space:normal">${item.desc}</p>
            <span class="price-tag" style="margin-top:6px;display:inline-block">${fmt(item.price)}</span>
          </div>
        </div>
        <div class="qty-row">
          <span class="label">Số lượng</span>
          <div class="stepper">
            <button class="round-btn outline" id="modal-qty-dec"><svg viewBox="0 0 24 24" width="13" height="13"><path d="M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>
            <span class="qty">${draft.qty}</span>
            <button class="round-btn" id="modal-qty-inc"><svg viewBox="0 0 24 24" width="13" height="13"><path d="M12 5v14M5 12h14" stroke="white" stroke-width="2.4" stroke-linecap="round"/></svg></button>
          </div>
        </div>
        <p class="field-label">Kích cỡ</p>
        ${sizesHtml}
        <p class="field-label" style="margin-top:12px">Thêm topping</p>
        ${toppingsHtml}
        <p class="field-label" style="margin-top:12px">Ghi chú</p>
        <textarea class="note-input" id="modal-note" rows="2" placeholder="VD: Không hành, ít bánh...">${draft.note}</textarea>
      </div>
      <div class="footer-panel">
        <button class="btn btn-primary btn-block" id="modal-confirm" style="display:flex;justify-content:space-between">
          <span>Thêm vào đơn</span><span>${fmt(total)}</span>
        </button>
      </div>
    </div>`;

  byId("modal-close").addEventListener("click", () => { state.customizeItem = null; state._customizeDraft = null; render(); });
  byId("modal-qty-inc").addEventListener("click", () => { draft.qty++; renderCustomizeModal(); });
  byId("modal-qty-dec").addEventListener("click", () => { draft.qty = Math.max(1, draft.qty - 1); renderCustomizeModal(); });
  document.querySelectorAll("[data-size-idx]").forEach((row) => row.addEventListener("click", () => { draft.sizeIdx = Number(row.dataset.sizeIdx); renderCustomizeModal(); }));
  document.querySelectorAll("[data-topping]").forEach((cb) => cb.addEventListener("change", () => { draft.toppings[cb.dataset.topping] = cb.checked; renderCustomizeModal(); }));
  byId("modal-note").addEventListener("input", (e) => { draft.note = e.target.value; });
  byId("modal-confirm").addEventListener("click", () => {
    confirmCustomizeLine({
      menuItemId: item.id,
      name: item.name,
      size: size.label,
      toppings: item.toppings.filter((t) => draft.toppings[t.label]).map((t) => t.label),
      note: draft.note,
      quantity: draft.qty,
      unitPrice: unit,
      subtotal: total,
    });
    state._customizeDraft = null;
  });
}

/* ---- Cart ---- */
/** mode: "edit" (cart, still changeable) | "track" (with the kitchen) */
function lineHtml(it, idx, opts = {}) {
  const mods = [it.size, ...(it.toppings || [])].filter(Boolean).join(", ");
  const done = it.kitchenStatus === "hoan_thanh";

  const bottom = opts.mode === "edit"
    ? `<div class="line-bottom">
        <div class="stepper">
          <button class="round-btn outline" data-cart-dec="${idx}"><svg viewBox="0 0 24 24" width="13" height="13"><path d="M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>
          <span class="qty">${it.quantity}</span>
          <button class="round-btn" data-cart-inc="${idx}"><svg viewBox="0 0 24 24" width="13" height="13"><path d="M12 5v14M5 12h14" stroke="white" stroke-width="2.4" stroke-linecap="round"/></svg></button>
        </div>
        <button class="trash-btn" data-cart-remove="${idx}"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-8 0v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
      </div>`
    : opts.mode === "plain"
      ? ""
      : it.voided
      ? `<div class="line-bottom"><span class="void-chip">Đã hủy · ${it.voidReason || ""}</span></div>`
      : `<div class="line-bottom">
          <span class="kitchen-chip ${done ? "done" : ""}" data-toggle-done="${idx}">
            ${KITCHEN_LABEL[it.kitchenStatus || "da_gui"]}${done ? "" : " · chạm khi bưng ra"}
          </span>
          <button class="void-btn" data-void="${idx}">Hủy món</button>
        </div>`;

  return `
    <div class="line-item ${it.voided ? "voided" : ""}">
      <div class="line-thumb">${MENU_ITEMS.find((m) => m.id === it.menuItemId)?.emoji || "🍽️"}</div>
      <div class="line-info">
        <div class="line-top">
          <p class="line-name">${it.name} ${it.quantity > 1 ? `<span class="qty-suffix">x${it.quantity}</span>` : ""}</p>
          <span class="line-price">${fmt(it.subtotal)}</span>
        </div>
        ${mods ? `<p class="line-mods">${mods}</p>` : ""}
        ${it.note ? `<p class="line-note">"${it.note}"</p>` : ""}
        ${bottom}
      </div>
    </div>`;
}

/** The cart holds only what has not gone to the kitchen yet. */
function renderCart() {
  const pending = itemEntries().filter((e) => isPending(e.it));
  const sentCount = currentItems().filter((i) => isSent(i) && !i.voided).reduce((s, i) => s + i.quantity, 0);
  const total = pending.reduce((s, e) => s + e.it.subtotal, 0);
  const nextBatch = (state.activeOrder?.sentBatches || 0) + 1;

  const list = pending.length
    ? pending.map((e) => lineHtml(e.it, e.idx, { mode: "edit" })).join("")
    : `<p class="empty-msg">Chưa có món mới nào</p>`;

  const sentNote = sentCount > 0 ? `
    <div class="info-strip" id="to-tracking">
      Đã gửi bếp ${sentCount} món ở ${nextBatch - 1} lượt trước
      <span class="link">Theo dõi ›</span>
    </div>` : "";

  return `
    ${sentNote}
    <div class="scroll">
      <div class="line-list">
        ${list}
      </div>
      <button class="add-more-btn" id="add-more">
        <svg viewBox="0 0 24 24" width="15" height="15"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
        Thêm món khác
      </button>
    </div>
    <div class="footer-panel">
      <div class="summary-row"><span>Món mới</span><span style="color:#262626;font-weight:600">${fmt(total)}</span></div>
      <button class="btn btn-primary btn-block" id="send-kitchen" ${pending.length === 0 ? "disabled" : ""}>
        Gửi bếp — lượt #${nextBatch} (${pending.reduce((s, e) => s + e.it.quantity, 0)} món)
      </button>
    </div>`;
}

function attachCartEvents() {
  document.querySelectorAll("[data-cart-inc]").forEach((btn) => btn.addEventListener("click", () => cartQtyChange(Number(btn.dataset.cartInc), currentItems()[btn.dataset.cartInc].quantity + 1)));
  document.querySelectorAll("[data-cart-dec]").forEach((btn) => btn.addEventListener("click", () => {
    const idx = Number(btn.dataset.cartDec);
    const nextQty = currentItems()[idx].quantity - 1;
    nextQty <= 0 ? cartRemove(idx) : cartQtyChange(idx, nextQty);
  }));
  document.querySelectorAll("[data-cart-remove]").forEach((btn) => btn.addEventListener("click", () => cartRemove(Number(btn.dataset.cartRemove))));
  byId("add-more")?.addEventListener("click", goMenu);
  byId("send-kitchen")?.addEventListener("click", sendToKitchen);
  byId("to-tracking")?.addEventListener("click", goTracking);
}

/* ---- Tracking ---- */
function renderTracking() {
  const entries = itemEntries();
  const sent = entries.filter((e) => isSent(e.it));
  const pendingCount = entries.filter((e) => isPending(e.it)).reduce((s, e) => s + e.it.quantity, 0);

  const live = sent.filter((e) => !e.it.voided);
  const totalQty = live.reduce((s, e) => s + e.it.quantity, 0);
  const doneQty = live.filter((e) => e.it.kitchenStatus === "hoan_thanh").reduce((s, e) => s + e.it.quantity, 0);
  const pct = totalQty ? Math.round((doneQty / totalQty) * 100) : 0;
  const allDone = totalQty > 0 && doneQty === totalQty;

  // One group per send batch, newest last, so the floor reads like the
  // kitchen's stack of tickets.
  const batches = [...new Set(sent.map((e) => e.it.batch))].sort((a, b) => a - b);
  const groups = batches.map((b) => {
    const rows = sent.filter((e) => e.it.batch === b);
    const at = rows.map((e) => e.it.sentAt).filter(Boolean).sort()[0];
    return `
      <div class="batch-head">
        <span>Lượt #${b}${at ? ` · ${timeOf(at)}` : ""}</span>
        <button class="link-btn" data-reprint="${b}">In lại phiếu</button>
      </div>
      <div class="line-list">${rows.map((e) => lineHtml(e.it, e.idx, { mode: "track" })).join("")}</div>`;
  }).join("") || `<p class="empty-msg">Chưa gửi món nào cho bếp</p>`;

  const warn = pendingCount > 0 ? `
    <div class="warn-strip" id="warn-pending">
      ⚠ Còn ${pendingCount} món chưa gửi bếp — sẽ không được tính tiền
      <span class="link">Gửi ngay ›</span>
    </div>` : "";

  return `
    <div class="track-summary">
      <div class="track-top">
        <span>${allDone ? "Đã bưng ra đủ" : `Đã bưng ra ${doneQty}/${totalQty} món`}</span>
        <span class="track-total">${fmt(billTotal())}</span>
      </div>
      <div class="track-bar"><div class="track-fill" style="width:${pct}%"></div></div>
    </div>
    ${warn}
    <div class="scroll">${groups}</div>
    <div class="footer-panel">
      <div class="btn-row-2">
        <button class="btn btn-outline" id="add-item">Thêm món</button>
        <button class="btn btn-outline" id="all-done" ${allDone || !totalQty ? "disabled" : ""}>Hoàn thành tất cả</button>
      </div>
      <!-- Enabled as soon as anything was sent: a table where every line got
           voided must still be closable, even at 0đ. -->
      <button class="btn btn-primary btn-block" id="req-payment" style="margin-top:8px" ${sent.length ? "" : "disabled"}>
        Yêu cầu thanh toán · in tạm tính
      </button>
    </div>`;
}

function attachTrackingEvents() {
  document.querySelectorAll("[data-toggle-done]").forEach((chip) =>
    chip.addEventListener("click", () => toggleItemDone(Number(chip.dataset.toggleDone))));
  document.querySelectorAll("[data-void]").forEach((btn) =>
    btn.addEventListener("click", () => { state.voidTarget = Number(btn.dataset.void); render(); }));
  document.querySelectorAll("[data-reprint]").forEach((btn) =>
    btn.addEventListener("click", () => reprintBatch(Number(btn.dataset.reprint))));
  byId("add-item")?.addEventListener("click", goMenu);
  byId("warn-pending")?.addEventListener("click", goCart);
  byId("all-done")?.addEventListener("click", markAllDone);
  byId("req-payment")?.addEventListener("click", requestPayment);
}

/* ---- Void reason sheet ---- */
function renderVoidModal() {
  const it = currentItems()[state.voidTarget];
  if (!it) { state.voidTarget = null; byId("modal-layer").innerHTML = ""; return; }

  byId("modal-layer").innerHTML = `
    <div class="sheet-backdrop" id="void-cancel-bg">
      <div class="sheet" role="dialog" aria-label="Lý do hủy món">
        <p class="sheet-title">Hủy “${esc(it.name)}”?</p>
        <p class="sheet-sub">Bếp sẽ nhận phiếu hủy và món không được tính tiền.</p>
        ${VOID_REASONS.map((r) => `<button class="sheet-row" data-reason="${esc(r)}">${esc(r)}</button>`).join("")}
        <button class="btn btn-outline btn-block" id="void-cancel" style="margin-top:10px">Đóng</button>
      </div>
    </div>`;

  const close = () => { state.voidTarget = null; render(); };
  byId("void-cancel").addEventListener("click", close);
  byId("void-cancel-bg").addEventListener("click", (e) => { if (e.target.id === "void-cancel-bg") close(); });
  document.querySelectorAll("[data-reason]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const idx = state.voidTarget;
      state.voidTarget = null;
      voidSentItem(idx, btn.dataset.reason);
      render();
    }));
}

/* ---- Payment ---- */
let selectedMethod = "cash";
function renderPayment() {
  const items = billableItems();
  const total = billTotal();
  const voided = currentItems().filter((i) => i.voided).length;
  const pendingCount = pendingItems().reduce((s, i) => s + i.quantity, 0);
  const methods = [
    { id: "cash", label: "Tiền mặt" },
    { id: "qr", label: "Chuyển khoản / VietQR" },
    { id: "card", label: "Thẻ ngân hàng" },
  ];
  const methodsHtml = methods.map((m) => `
    <div class="method-row ${selectedMethod === m.id ? "active" : ""}" data-method="${m.id}">
      <span>${m.label}</span>
      ${selectedMethod === m.id ? `<svg class="check" viewBox="0 0 24 24" width="16" height="16"><path d="M20 6L9 17l-5-5" fill="none" stroke="#15803d" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ""}
    </div>`).join("");

  const warn = pendingCount > 0 ? `
    <div class="warn-strip" id="warn-pending-pay">
      ⚠ ${pendingCount} món chưa gửi bếp không nằm trong hóa đơn
      <span class="link">Xem ›</span>
    </div>` : "";

  return `
    ${warn}
    <div class="scroll">
      <div class="summary-card">
        <div class="summary-row"><span>Tạm tính</span><span style="color:#262626">${fmt(total)}</span></div>
        <div class="summary-row"><span>Giảm giá</span><span style="color:#262626">0đ</span></div>
        ${voided ? `<div class="summary-row"><span>Món đã hủy</span><span style="color:#262626">${voided}</span></div>` : ""}
        <div class="divider-dashed"></div>
        <div class="summary-total"><span>Tổng cộng</span><span style="color:#15803d">${fmt(total)}</span></div>
      </div>
      <div class="line-list">${items.map((it) => lineHtml(it, -1, { mode: "plain" })).join("")}</div>
      <p class="field-label" style="margin:0 16px 8px">Chọn hình thức thanh toán</p>
      <div class="method-list">${methodsHtml}</div>
    </div>
    <div class="footer-panel">
      <button class="btn btn-outline btn-block" id="reprint-provisional">In lại phiếu tạm tính</button>
      <button class="btn btn-primary btn-block" id="confirm-payment" style="margin-top:8px">Xác nhận đã thu tiền</button>
    </div>`;
}

function attachPaymentEvents() {
  document.querySelectorAll("[data-method]").forEach((row) => row.addEventListener("click", () => { selectedMethod = row.dataset.method; render(); }));
  byId("warn-pending-pay")?.addEventListener("click", goCart);
  byId("reprint-provisional")?.addEventListener("click", printProvisional);
  byId("confirm-payment")?.addEventListener("click", () => confirmPayment(selectedMethod));
}

/* ---- Success ---- */
function renderSuccess() {
  const total = state.lastPayment?.total || 0;
  const table = { label: state.lastPayment?.tableLabel || "" };
  return `
    <div class="success-wrap">
      <div class="success-circle">
        <svg viewBox="0 0 24 24" width="42" height="42"><path d="M20 6L9 17l-5-5" fill="none" stroke="#15803d" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <p class="success-title">Thanh toán thành công!</p>
      <p class="success-sub">${table ? table.label : ""}</p>
      <p class="success-total">${fmt(total)}</p>
      <p class="success-thanks">Cảm ơn quý khách!</p>
      <p class="success-sub">Bàn đã chuyển sang <b>Chờ dọn</b> — chạm ô bàn khi dọn xong.</p>
      <div class="success-actions">
        <button class="btn btn-outline" id="print-receipt">In hóa đơn</button>
        <button class="btn btn-primary" id="back-to-tables">Xong</button>
      </div>
    </div>`;
}

function attachSuccessEvents() {
  byId("print-receipt")?.addEventListener("click", printFinalReceipt);
  byId("back-to-tables")?.addEventListener("click", backToTablesAfterSuccess);
}

/* ---- History ---- */
let historyFilter = "all";
function renderHistory() {
  const filtered = state.history.filter((h) => historyFilter === "all" || h.paymentStatus === historyFilter);
  const grouped = {};
  filtered.forEach((h) => { (grouped[h.date] = grouped[h.date] || []).push(h); });

  const groupsHtml = Object.keys(grouped).length
    ? Object.entries(grouped).map(([date, rows]) => `
        <div class="history-group">
          <p class="history-date">${date}</p>
          <div class="history-list">
            ${rows.map((o) => `
              <div class="history-row">
                <div>
                  <p class="main">${o.tableLabel} · ${o.time}</p>
                  <p class="sub">${o.itemCount} món</p>
                </div>
                <div>
                  <p class="amount">${fmt(o.total)}</p>
                  <p class="method">${o.method}</p>
                </div>
              </div>`).join("")}
          </div>
        </div>`).join("")
    : `<p class="empty-msg">Chưa có đơn hàng nào</p>`;

  return `
    <div class="tabs">
      <button class="tab-chip ${historyFilter === "all" ? "active" : ""}" data-hfilter="all">Tất cả</button>
      <button class="tab-chip ${historyFilter === "paid" ? "active" : ""}" data-hfilter="paid">Đã thanh toán</button>
    </div>
    <div class="scroll">${groupsHtml}</div>`;
}

function attachHistoryEvents() {
  document.querySelectorAll("[data-hfilter]").forEach((btn) => btn.addEventListener("click", () => { historyFilter = btn.dataset.hfilter; render(); }));
}

/* ---------------------------------------------------------------------
   11. Boot
   --------------------------------------------------------------------- */
async function boot() {
  try {
    await seedTablesIfEmpty();
  } catch (err) {
    showToast("Không thể khởi tạo dữ liệu bàn — kiểm tra cấu hình Firebase", true);
  }
  subscribeTables();
  subscribeHistory();
  setInterval(autoReleaseCleaningTables, 60000);
  state.screen = "tables";
  render();
}

boot();

// Register service worker for offline app-shell caching.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // updateViaCache:"none" stops the browser serving sw.js itself from the
    // HTTP cache — without it a new worker can sit undiscovered for hours.
    navigator.serviceWorker
      .register("sw.js", { updateViaCache: "none" })
      .then((reg) => reg.update())
      .catch(() => {});
  });

  // When a new worker takes over, reload once so the running page is not a
  // mix of old code and new assets. The flag guards against a reload loop.
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}
