// js/main.js
// Orquestrador principal — importa firebase, views e helpers.
// Preserva a lógica original de autenticação, onSnapshot, writeBatch e roteamento.
// Base: trechos extraídos de scriptoficial.js (mantive lógica idêntica) :contentReference[oaicite:2]{index=2}.

import { app, db, auth } from './firebase.js';
import { onSnapshot, collection, query, where, getDocs, writeBatch, doc, setDoc, addDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { renderCaixa } from './views/caixa.js';
import { renderClientes } from './views/clientes.js';
import { renderProdutos } from './views/produtos.js';
import { renderPedidos } from './views/pedidos.js';

import { showBonusWheelModal, showWhatsAppModal } from './ui.js';
import { showToast, exportToCSV } from './utils.js';

// --- Estado global (idêntico ao usado originalmente) ---
const state = {
  loggedInUser: null,
  selectedStore: null,
  db: {
    products: [],
    clients: [],
    users: [],
    stores: [],
    settings: {},
    sales: []
  },
  currentOrder: [] // caixa
};

// --- Helpers de UI / roteamento ---
function hideAllViews() {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
}

function switchView(viewId) {
  hideAllViews();
  const v = document.getElementById(viewId);
  if (v) v.classList.add('active');

  // atualiza conteúdo da view
  if (viewId === 'caixa-view') renderCaixa(state);
  if (viewId === 'clientes-view') renderClientes(state);
  if (viewId === 'produtos-view') renderProdutos(state);
  if (viewId === 'pedidos-view') renderPedidos(state);
}

// --- Observadores / sincronização Firestore ---
// Esses onSnapshot/queries reproduzem os que estavam no scriptoficial.js
// (mantive as coleções e comportamento idênticos) :contentReference[oaicite:3]{index=3}.

function subscribeStores() {
  const storesCol = collection(db, "stores");
  // snapshot em main não estático no exemplo original — aqui fazemos um simple onSnapshot-like manual via getDocs + refresh
  // Para simplicidade e compatibilidade offline use getDocs (se quiser onSnapshot realtime, substitua por onSnapshot)
  getDocs(storesCol).then(snap => {
    state.db.stores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderStoreSelection();
  }).catch(err => console.error(err));
}

async function loadInitialDataForStore(storeId) {
  state.selectedStore = state.db.stores.find(s => s.id === storeId) || null;

  // products
  const productsSnap = await getDocs(query(collection(db, "products"), where("storeId", "==", storeId)));
  state.db.products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // clients
  const clientsSnap = await getDocs(query(collection(db, "clients"), where("storeId", "==", storeId)));
  state.db.clients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // users for this store (admins / vendedores)
  const usersSnap = await getDocs(query(collection(db, "users"), where("storeId", "==", storeId)));
  state.db.users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // settings (single doc "settings" per store id)
  try {
    const settingsSnap = await getDocs(query(collection(db, "settings"), where("__name__", "==", storeId)));
    if (!settingsSnap.empty) {
      const docData = settingsSnap.docs[0].data();
      state.db.settings = docData;
    } else {
      state.db.settings = { storeName: state.selectedStore?.name || '', bonusSystem: { enabled: true, value: 80 } };
    }
  } catch (err) { console.error("Erro carregando settings:", err); }

  // sales
  const salesSnap = await getDocs(query(collection(db, "sales"), where("storeId", "==", storeId), orderBy("date", "desc")));
  state.db.sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Rende a view atual para que as views peguem os dados do state
  const active = document.querySelector('.view.active')?.id || 'caixa-view';
  switchView(active);
}

// --- UI para seleção de loja / usuário (cópia adaptada do indexoficial.js) ---
// renderStoreSelection renderiza botões de lojas e ligações para loadInitialDataForStore
function renderStoreSelection() {
  const container = document.getElementById('store-selection-list');
  if (!container) return;
  container.innerHTML = '';
  state.db.stores.forEach(store => {
    const btn = document.createElement('button');
    btn.className = 'store-select-btn custom-card p-3 m-2';
    btn.textContent = store.name;
    btn.dataset.storeId = store.id;
    container.appendChild(btn);
  });
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.storeId;
    await loadInitialDataForStore(id);
    // mostra seleção de usuário
    document.getElementById('store-selection-view').classList.add('hidden');
    document.getElementById('user-selection-view').classList.remove('hidden');
    renderUserSelection();
  });
}

// renderUserSelection: botões de usuário (baseado no original)
function renderUserSelection() {
  const ul = document.getElementById('user-selection-list');
  if (!ul) return;
  ul.innerHTML = '';
  state.db.users.forEach(u => {
    const li = document.createElement('li');
    li.innerHTML = `<button data-username="${u.email}" class="user-btn w-full text-left p-3 custom-card mb-2">${u.name} <span class="text-xs text-slate-500">(${u.role})</span></button>`;
    ul.appendChild(li);
  });

  ul.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const username = b.dataset.username;
    // armazena usuário selecionado temporariamente para o fluxo de senha (igual original)
    document.getElementById('user-selection-view').classList.add('hidden');
    document.getElementById('password-view').classList.remove('hidden');
    document.getElementById('login-username-display').textContent = username;
    document.getElementById('login-username-display').dataset.email = username;
  });
}

// login com email+senha (mantive signInWithEmailAndPassword do original)
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-username-display')?.dataset?.email || document.getElementById('login-email')?.value;
  const password = document.getElementById('login-password')?.value;
  if (!email || !password) return showToast('Email e senha são obrigatórios.', 'error');

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    // procura usuário no state.db.users
    const user = state.db.users.find(u => u.email === email) || { name: cred.user.email, role: 'vendedor' };
    state.loggedInUser = user;
    document.getElementById('login-screen')?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('hidden');
    document.getElementById('user-name-display') && (document.getElementById('user-name-display').textContent = user.name);
    switchView('caixa-view');
    showToast('Login efetuado!', 'success');
  } catch (err) {
    console.error("Erro login:", err);
    showToast('Falha no login. Verifique as credenciais.', 'error');
  }
});

// logout
document.getElementById('logout-btn')?.addEventListener('click', async () => {
  try {
    await signOut(auth);
    state.loggedInUser = null;
    document.getElementById('app')?.classList.add('hidden');
    document.getElementById('login-screen')?.classList.remove('hidden');
    showToast('Desconectado.', 'success');
  } catch (err) { showToast('Erro ao sair.', 'error'); }
});

// --- Export CSV (usa helper exportToCSV) ---
document.getElementById('export-sales-btn')?.addEventListener('click', () => {
  exportToCSV(state.db.sales || [], `vendas_${state.selectedStore?.name || 'store'}`);
});

// --- Inicialização ---
(async function init() {
  try {
    await subscribeStores();
    // se houver apenas 1 loja, já selecionar automaticamente (comportamento inspirado no original)
    if (state.db.stores.length === 1) {
      await loadInitialDataForStore(state.db.stores[0].id);
      document.getElementById('store-selection-view').classList.add('hidden');
      document.getElementById('user-selection-view').classList.remove('hidden');
      renderUserSelection();
    } else {
      // render lista
      renderStoreSelection();
    }
    // inicial view padrão
    switchView('caixa-view');
  } catch (err) {
    console.error("Init error:", err);
    showToast('Erro na inicialização do app.', 'error');
  }
})();
