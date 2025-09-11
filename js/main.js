// js/main.js
// Orquestrador principal — versão com onSnapshot para dados em tempo real.
// Mantém a lógica original de autenticação, writeBatch, roleta e relatórios.
// Base: scriptoficial.js original  .

import { app, db, auth } from './firebase.js';
import {
  onSnapshot, collection, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { renderCaixa } from './views/caixa.js';
import { renderClientes } from './views/clientes.js';
import { renderProdutos } from './views/produtos.js';
import { renderPedidos } from './views/pedidos.js';

import { showToast, exportToCSV } from './utils.js';

// --- Estado global ---
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
  currentOrder: []
};

// --- UI / Views ---
function hideAllViews() {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
}

function switchView(viewId) {
  hideAllViews();
  const v = document.getElementById(viewId);
  if (v) v.classList.add('active');

  if (viewId === 'caixa-view') renderCaixa(state);
  if (viewId === 'clientes-view') renderClientes(state);
  if (viewId === 'produtos-view') renderProdutos(state);
  if (viewId === 'pedidos-view') renderPedidos(state);
}

// --- Observadores (onSnapshot) ---
// Atualização em tempo real para cada coleção da loja selecionada
function subscribeStoreData(storeId) {
  // Products
  const productsQ = query(collection(db, "products"), where("storeId", "==", storeId));
  onSnapshot(productsQ, snap => {
    state.db.products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (document.getElementById('produtos-view')?.classList.contains('active')) {
      renderProdutos(state);
    }
  });

  // Clients
  const clientsQ = query(collection(db, "clients"), where("storeId", "==", storeId));
  onSnapshot(clientsQ, snap => {
    state.db.clients = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (document.getElementById('clientes-view')?.classList.contains('active')) {
      renderClientes(state);
    }
  });

  // Users
  const usersQ = query(collection(db, "users"), where("storeId", "==", storeId));
  onSnapshot(usersQ, snap => {
    state.db.users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (document.getElementById('user-selection-view') && !state.loggedInUser) {
      renderUserSelection();
    }
  });

  // Settings (um doc por loja, id = storeId)
  onSnapshot(collection(db, "settings"), snap => {
    const docData = snap.docs.find(d => d.id === storeId)?.data();
    if (docData) state.db.settings = docData;
  });

  // Sales
  const salesQ = query(collection(db, "sales"), where("storeId", "==", storeId), orderBy("date", "desc"));
  onSnapshot(salesQ, snap => {
    state.db.sales = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (document.getElementById('pedidos-view')?.classList.contains('active')) {
      renderPedidos(state);
    }
  });
}

// --- Seleção de loja e usuário ---
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
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.storeId;
    state.selectedStore = state.db.stores.find(s => s.id === id);
    document.getElementById('store-selection-view').classList.add('hidden');
    document.getElementById('user-selection-view').classList.remove('hidden');
    subscribeStoreData(id);
    renderUserSelection();
  });
}

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
    document.getElementById('user-selection-view').classList.add('hidden');
    document.getElementById('password-view').classList.remove('hidden');
    document.getElementById('login-username-display').textContent = username;
    document.getElementById('login-username-display').dataset.email = username;
  });
}

// --- Login ---
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-username-display')?.dataset?.email || document.getElementById('login-email')?.value;
  const password = document.getElementById('login-password')?.value;
  if (!email || !password) return showToast('Email e senha são obrigatórios.', 'error');

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = state.db.users.find(u => u.email === email) || { name: cred.user.email, role: 'vendedor' };
    state.loggedInUser = user;
    document.getElementById('login-screen')?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('hidden');
    document.getElementById('user-name-display').textContent = user.name;
    switchView('caixa-view');
    showToast('Login efetuado!', 'success');
  } catch (err) {
    console.error("Erro login:", err);
    showToast('Falha no login. Verifique as credenciais.', 'error');
  }
});

// --- Logout ---
document.getElementById('logout-btn')?.addEventListener('click', async () => {
  try {
    await signOut(auth);
    state.loggedInUser = null;
    document.getElementById('app')?.classList.add('hidden');
    document.getElementById('login-screen')?.classList.remove('hidden');
    showToast('Desconectado.', 'success');
  } catch (err) {
    showToast('Erro ao sair.', 'error');
  }
});

// --- Exportação CSV ---
document.getElementById('export-sales-btn')?.addEventListener('click', () => {
  exportToCSV(state.db.sales || [], `vendas_${state.selectedStore?.name || 'store'}`);
});

// --- Inicialização ---
(function init() {
  // Lojas em tempo real
  onSnapshot(collection(db, "stores"), snap => {
    state.db.stores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (state.db.stores.length === 1) {
      state.selectedStore = state.db.stores[0];
      document.getElementById('store-selection-view').classList.add('hidden');
      document.getElementById('user-selection-view').classList.remove('hidden');
      subscribeStoreData(state.selectedStore.id);
      renderUserSelection();
    } else {
      renderStoreSelection();
    }
  });
})();
