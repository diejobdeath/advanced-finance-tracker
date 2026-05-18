"use strict";

// new function, keep from xss attack
const escapeHTML = (str) => {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// modify i18n
let i18nData = {};
let currentLang = localStorage.getItem('siteLang') || 'zh';
let previouslyFocusedElement = null;

const STORAGE_KEY = "financeTrackerData";
const THEME_KEY = "financeTrackerTheme";

const state = {
  transactions: [],
  filters: {
    category: "all",
    type: "all",
    search: "",
  },
  editingId: null,
  pendingDeleteId: null,
  theme: "dark",
};

const dom = {
  form: document.getElementById("transactionForm"),
  titleInput: document.getElementById("titleInput"),
  amountInput: document.getElementById("amountInput"),
  categoryInput: document.getElementById("categoryInput"),
  dateInput: document.getElementById("dateInput"),
  titleError: document.getElementById("titleError"),
  amountError: document.getElementById("amountError"),
  categoryError: document.getElementById("categoryError"),
  dateError: document.getElementById("dateError"),
  submitBtn: document.getElementById("submitBtn"),
  cancelEditBtn: document.getElementById("cancelEditBtn"),
  filterCategory: document.getElementById("filterCategory"),
  filterType: document.getElementById("filterType"),
  searchInput: document.getElementById("searchInput"),
  resetFiltersBtn: document.getElementById("resetFiltersBtn"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  transactionsList: document.getElementById("transactionsList"),
  resultsCount: document.getElementById("resultsCount"),
  totalBalance: document.getElementById("totalBalance"),
  totalIncome: document.getElementById("totalIncome"),
  totalExpenses: document.getElementById("totalExpenses"),
  financeChart: document.getElementById("financeChart"),
  confirmModal: document.getElementById("confirmModal"),
  confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),
  cancelDeleteBtn: document.getElementById("cancelDeleteBtn"),
  toastContainer: document.getElementById("toastContainer"),
  skeleton: document.getElementById("skeleton"),
};

const generateID = () => {
  return `tx_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const saveToLocalStorage = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
};

const loadFromLocalStorage = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  state.transactions = stored ? JSON.parse(stored) : [];
};

const saveTheme = () => {
  localStorage.setItem(THEME_KEY, state.theme);
};

const setTheme = (theme) => {
  state.theme = theme;
  document.body.classList.toggle("theme-light", theme === "light");
  dom.themeToggleBtn.textContent =
    theme === "light" ? (i18nData.darkMode || "Dark Mode") : (i18nData.lightMode || "Light Mode");
  saveTheme();
  renderApp(); 
};

const loadTheme = () => {
  const storedTheme = localStorage.getItem(THEME_KEY);
  setTheme(storedTheme || "dark");
};

const showToast = (message, variant = "success") => {
  const toast = document.createElement("div");
  toast.className = `toast${variant === "error" ? " toast--error" : ""}`;
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 2400);
};

const clearErrors = () => {
  const fields = [
    { input: dom.titleInput, error: dom.titleError },
    { input: dom.amountInput, error: dom.amountError },
    { input: dom.categoryInput, error: dom.categoryError },
    { input: dom.dateInput, error: dom.dateError },
  ];

  fields.forEach(({ input, error }) => {
    input.classList.remove("is-invalid");
    error.textContent = "";
  });
};

const setError = (input, errorEl, message) => {
  input.classList.add("is-invalid");
  errorEl.textContent = message;
};

const validateForm = () => {
  clearErrors();

  const title = dom.titleInput.value.trim();
  const amountValue = dom.amountInput.value.trim();
  const amount = Number(amountValue);
  const category = dom.categoryInput.value;
  const date = dom.dateInput.value;

  let isValid = true;

  if (!title) {
    setError(dom.titleInput, dom.titleError, "Title is required.");
    isValid = false;
  }

  if (!amountValue || Number.isNaN(amount) || amount === 0) {
    setError(dom.amountInput, dom.amountError, "Enter a valid amount.");
    isValid = false;
  }

  if (!category) {
    setError(dom.categoryInput, dom.categoryError, "Select a category.");
    isValid = false;
  }

  if (!date) {
    setError(dom.dateInput, dom.dateError, "Pick a date.");
    isValid = false;
  }

  return isValid;
};

const resetFormState = () => {
  dom.form.reset();
  state.editingId = null;
  dom.submitBtn.textContent = i18nData.addTransaction || "Add Transaction";
  dom.cancelEditBtn.hidden = true;
  clearErrors();
};

const addTransaction = () => {
  if (!validateForm()) {
    showToast(i18nData.fixErrors || "Please fix the highlighted fields.", "error");
    return;
  }

  const title = dom.titleInput.value.trim();
  const amount = Number(dom.amountInput.value);
  const category = dom.categoryInput.value;
  const date = dom.dateInput.value;

  if (state.editingId) {
    state.transactions = state.transactions.map((tx) =>
      tx.id === state.editingId ? { ...tx, title, amount, category, date } : tx,
    );
    showToast(i18nData.transactionUpdated || "Transaction updated.");
  } else {
    const newTransaction = {
      id: generateID(),
      title,
      amount,
      category,
      date,
    };

    state.transactions = [newTransaction, ...state.transactions];
    showToast(i18nData.transactionAdded || "Transaction added.");
  }

  resetFormState();
  saveToLocalStorage();
  renderApp();
};

const startEditing = (id) => {
  const transaction = state.transactions.find((tx) => tx.id === id);
  if (!transaction) return;

  dom.titleInput.value = transaction.title;
  dom.amountInput.value = transaction.amount;
  dom.categoryInput.value = transaction.category;
  dom.dateInput.value = transaction.date;

  state.editingId = id;
  dom.submitBtn.textContent = i18nData.saveChanges || "Save Changes";
  dom.cancelEditBtn.hidden = false;
  dom.titleInput.focus();
  showToast(i18nData.editingMode || "Editing mode enabled.");
};

// new vesion
const deleteTransaction = (id) => {
  state.transactions = state.transactions.filter((tx) => tx.id !== id);
  saveToLocalStorage();
  renderApp();
  showToast(i18nData.transactionDeleted || "Transaction deleted.");
  if (state.editingId && state.editingId === id) {
    setTimeout(() => {
      resetFormState(); 
    }, 10);
  }
};


const openConfirmModal = (id) => {
  state.pendingDeleteId = id;
  previouslyFocusedElement = document.activeElement;
  dom.confirmModal.classList.add("is-open");
  dom.confirmModal.setAttribute("aria-hidden", "false");
  setTimeout(() => {
    dom.cancelDeleteBtn.focus();
  }, 50);
  dom.confirmModal.addEventListener("keydown", handleModalTab);
};

const closeConfirmModal = () => {
  state.pendingDeleteId = null;
  dom.confirmModal.classList.remove("is-open");
  dom.confirmModal.setAttribute("aria-hidden", "true");
  dom.confirmModal.removeEventListener("keydown", handleModalTab);
  if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === "function") {
    previouslyFocusedElement.focus();
  }
};

const handleModalTab = (e) => {
  if (e.key !== "Tab") return;
  const focusableElements = [dom.cancelDeleteBtn, dom.confirmDeleteBtn];
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === firstElement) {
      lastElement.focus();
      e.preventDefault(); 
    }
  } 
  else {
    if (document.activeElement === lastElement) {
      firstElement.focus();
      e.preventDefault();
    }
  }
};

// modify with locl

const renderTransactions = () => {
  const filtered = filterTransactions();
  dom.resultsCount.textContent = currentLang === 'zh' 
  ? `共 ${filtered.length} 条结果` 
  : `${filtered.length} results`;

  if (filtered.length === 0) {
    dom.transactionsList.innerHTML = `
      <div class="transactions__empty">
        <div class="empty__icon">+</div>
        <p i18n="noTransactions">${i18nData.noTransactions || "No transactions yet. Add your first one to get started."}</p>
        <button class="btn btn--accent empty-add-btn" type="button" i18n="addFirstTransaction">
          ${i18nData.addFirstTransaction || "Add First Transaction"}
        </button>
      </div>
    `;
    return;
  }

  const groups = groupByMonth(filtered);

  dom.transactionsList.innerHTML = groups
    .map(
      (group) => `
        <div class="month-group">
          <p class="month-title">${group.label}</p>
          ${group.items.map(renderTransactionItem).join("")}
        </div>
      `,
    )
    .join("");
};


// const renderTransactionItem = (tx) => {
//   const typeClass = tx.amount >= 0 ? "amount--income" : "amount--expense";
//   const formattedAmount = formatCurrency(tx.amount);
//   const formattedDate = formatDate(tx.date);

//   return `
//     <div class="transaction">
//       <div>
//         <p class="transaction__title">${tx.title}</p>
//         <div class="transaction__meta">
//           <span class="badge">${tx.category}</span>
//           <span>${formattedDate}</span>
//         </div>
//       </div>
//       <div>
//         <p class="amount ${typeClass}">${formattedAmount}</p>
//         <button class="edit-btn" data-id="${tx.id}">Edit</button>
//         <button class="delete-btn" data-id="${tx.id}">Delete</button>
//       </div>
//     </div>
//   `;
// };

const renderTransactionItem = (tx) => {
  const typeClass = tx.amount >= 0 ? "amount--income" : "amount--expense";
  const formattedAmount = formatCurrency(tx.amount);
  
  const locale = currentLang === 'en' ? 'en-US' : 'zh-CN';
  const formattedDate = new Date(tx.date).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const safeTitle = escapeHTML(tx.title);
  const translatedCategory = i18nData[tx.category.toLowerCase()] || tx.category;
  return `
    <div class="transaction">
      <div>
        <p class="transaction__title">${safeTitle}</p> 
        <div class="transaction__meta">
          <span class="badge">${translatedCategory}</span>
          <span>${formattedDate}</span>
        </div>
      </div>
      <div>
        <p class="amount ${typeClass}">${formattedAmount}</p>
        <button class="edit-btn" data-id="${tx.id}">${i18nData.edit || "Edit"}</button>
        <button class="delete-btn" data-id="${tx.id}">${i18nData.delete || "Delete"}</button>
      </div>
    </div>
  `;
};

const filterTransactions = () => {
  const { category, type, search } = state.filters;

  return state.transactions.filter((tx) => {
    const matchesCategory = category === "all" || tx.category === category;

    const matchesType =
      type === "all" ||
      (type === "income" && tx.amount > 0) ||
      (type === "expense" && tx.amount < 0);

    const matchesSearch = tx.title.toLowerCase().includes(search.toLowerCase());

    return matchesCategory && matchesType && matchesSearch;
  });
};

const groupByMonth = (transactions) => {
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );

  const groups = [];
  const lookup = new Map();

  sorted.forEach((tx) => {
    const locale = currentLang === 'en' ? 'en-US' : 'zh-CN';
    const label = new Date(tx.date).toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
    });

    if (!lookup.has(label)) {
      lookup.set(label, { label, items: [] });
      groups.push(lookup.get(label));
    }

    lookup.get(label).items.push(tx);
  });

  return groups;
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const renderChart = () => {
  const canvas = dom.financeChart;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  const displayWidth = canvas.clientWidth;
  const displayHeight = 260;

  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const width = displayWidth;
  const height = displayHeight;

  ctx.clearRect(0, 0, width, height);

  const amounts = state.transactions.map((tx) => tx.amount);
  const income = amounts.filter((a) => a > 0).reduce((s, a) => s + a, 0);
  const expenses = Math.abs(
    amounts.filter((a) => a < 0).reduce((s, a) => s + a, 0),
  );

  const maxValue = Math.max(income, expenses, 1);
  const barWidth = 120;
  const gap = 80;
  const baseY = height - 40;

  const incomeHeight = (income / maxValue) * (height - 80);
  const expenseHeight = (expenses / maxValue) * (height - 80);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.moveTo(40, baseY);
  ctx.lineTo(width - 40, baseY);
  ctx.stroke();

  ctx.fillStyle = "#22c55e";
  ctx.fillRect(160, baseY - incomeHeight, barWidth, incomeHeight);

  ctx.fillStyle = "#f97316";
  ctx.fillRect(
    160 + barWidth + gap,
    baseY - expenseHeight,
    barWidth,
    expenseHeight,
  );

  // ctx.fillStyle = "#f8f4e9";  new_version 
  ctx.fillStyle = state.theme === "light" ? "#1e293b" : "#f8f4e9";
  ctx.font = "14px sans-serif";
  ctx.fillText(i18nData.incomeType || "Income", 170, baseY + 20);
  ctx.fillText(i18nData.expenseType || "Expense", 160 + barWidth + gap, baseY + 20);

  ctx.fillText(formatCurrency(income), 150, baseY - incomeHeight - 10);
  ctx.fillText(
    formatCurrency(expenses),
    150 + barWidth + gap,
    baseY - expenseHeight - 10,
  );
};

const renderApp = () => {
  renderSummary();
  renderTransactions();
  renderChart();
};

const exportToCSV = () => {
  if (state.transactions.length === 0) {
    showToast(i18nData.noDataExport || "No data to export.", "error");
    return;
  }

  const headers = ["Title", "Amount", "Category", "Date"];
  const rows = state.transactions.map((tx) => [
    tx.title,
    tx.amount,
    tx.category,
    tx.date,
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "transactions.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showToast(i18nData.csvExported || "CSV exported.");
};

// async function loadLanguage(lang) {
//   try {
//     const res = await fetch(`locales/${lang}.json`);
//     i18nData = await res.json();
//     currentLang = lang;
//     localStorage.setItem('siteLang', lang);
//     applyI18n();
//   } catch (err) {
//     console.error('语言文件加载失败', err);
//   }
// }

// new version
async function loadLanguage(lang) {
  try {
    const res = await fetch(`locales/${lang}.json`);
    i18nData = await res.json();
    currentLang = lang;
    localStorage.setItem('siteLang', lang);
    
    document.documentElement.lang = lang; 

    applyI18n();
    resetFormState();
    renderApp();
  } catch (err) {
    console.error('语言文件加载失败', err);
  }
}

function applyI18n() {
  document.querySelectorAll('[i18n]').forEach(el => {
    const key = el.getAttribute('i18n');
    if (i18nData[key]) {
      el.innerText = i18nData[key];
    }
  });

  document.querySelectorAll('[i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('i18n-placeholder');
    if (i18nData[key]) {
      el.setAttribute('placeholder', i18nData[key]);
    }
  });
}

const initializeApp = () => {
  loadFromLocalStorage();
  loadTheme();
  renderApp();

  setTimeout(() => {
    dom.skeleton.classList.add("is-hidden");
  }, 300);

  dom.form.addEventListener("submit", (e) => {
    e.preventDefault();
    addTransaction();
  });

  dom.cancelEditBtn.addEventListener("click", () => {
    resetFormState();
  });

  dom.transactionsList.addEventListener("click", (e) => {
    const deleteButton = e.target.closest(".delete-btn");
    const editButton = e.target.closest(".edit-btn");
    const emptyAdd = e.target.closest(".empty-add-btn");

    const deleteId = deleteButton?.dataset?.id;
    const editId = editButton?.dataset?.id;

    if (deleteId) {
      openConfirmModal(deleteId);
    }

    if (editId) {
      startEditing(editId);
    }

    if (emptyAdd) {
      dom.titleInput.focus();
    }
  });

  dom.filterCategory.addEventListener("change", (e) => {
    state.filters.category = e.target.value;
    renderTransactions();
  });

  dom.filterType.addEventListener("change", (e) => {
    state.filters.type = e.target.value;
    renderTransactions();
  });

  dom.searchInput.addEventListener("input", (e) => {
    state.filters.search = e.target.value;
    renderTransactions();
  });

  // dom.resetFiltersBtn.addEventListener("click", () => {
  //   state.filters = { category: "all", type: "all", search: "" };
  //   dom.filterCategory.value = "all";
  //   dom.filterType.value = "all";
  //   dom.searchInput.value = "";
  //   renderTransactions();
  // });

  // new version
  dom.resetFiltersBtn.addEventListener("click", () => {
    state.filters = { category: "all", type: "all", search: "" };
    dom.filterCategory.value = "all";
    dom.filterType.value = "all";
    dom.searchInput.value = "";
    renderTransactions();
    if (typeof showToast === 'function') {
      showToast(i18nData.filtersCleared || "Filters cleared.");
    }
  });
  // ......

  dom.exportCsvBtn.addEventListener("click", exportToCSV);

  dom.themeToggleBtn.addEventListener("click", () => {
    setTheme(state.theme === "dark" ? "light" : "dark");
  });

  dom.confirmDeleteBtn.addEventListener("click", () => {
    if (state.pendingDeleteId) {
      deleteTransaction(state.pendingDeleteId);
    }
    closeConfirmModal();
  });

  dom.cancelDeleteBtn.addEventListener("click", closeConfirmModal);

  dom.confirmModal.addEventListener("click", (e) => {
    if (e.target.dataset.close) {
      closeConfirmModal();
    }
  });
};

// --- new add  Cookie Consent 
const initCookieBanner = () => {
  const banner = document.getElementById("cookieBanner");
  const acceptBtn = document.getElementById("acceptCookies");
  
  if (!localStorage.getItem("cookiesAccepted")) {
    banner.style.display = "flex";
  }
  acceptBtn.addEventListener("click", () => {
    localStorage.setItem("cookiesAccepted", "true");
    banner.style.display = "none";
    if (typeof showToast === 'function') {
      showToast(i18nData.privacySaved || "Privacy preferences saved.");
    }
  });
};

window.addEventListener('DOMContentLoaded', () => {
  initCookieBanner();
  loadLanguage(currentLang);
  
  const langSwitch = document.getElementById('langSwitch');
  if(langSwitch){
    langSwitch.value = currentLang;
    langSwitch.addEventListener('change', e => {
      currentLang = e.target.value; 
      loadLanguage(currentLang);
    });
  }
});


initializeApp();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    escapeHTML, 
    formatCurrency,
    generateID,
    saveToLocalStorage,
    loadFromLocalStorage,
    saveTheme,
    setTheme,
    loadTheme,
    showToast,
    clearErrors,
    setError,
    validateForm,
    resetFormState,
    addTransaction,
    startEditing,
    deleteTransaction,
    openConfirmModal,
    closeConfirmModal,
    renderSummary,
    renderTransactions,
    renderTransactionItem,
    filterTransactions,
    groupByMonth,
    formatDate,
    renderChart,
    renderApp,
    exportToCSV,
    loadLanguage,
    applyI18n,
    initializeApp,
    initCookieBanner
  };
}
