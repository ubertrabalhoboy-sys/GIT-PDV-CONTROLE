// js/views/configuracoes.js

import { state, uiState } from '../state.js';

function renderUsersList() {
    const list = document.getElementById('users-list');
    if (!list) return;
    list.innerHTML = '';
    
    const usersInStore = state.db.users.filter(u => u.storeId === state.selectedStore.id || u.role === 'superadmin');

    if (usersInStore.length === 0) {
        list.innerHTML = '<p class="text-slate-500 text-sm text-center">Nenhum usuário cadastrado para esta loja.</p>';
        return;
    }

    usersInStore.forEach(v => {
        const roleClass = v.role === 'superadmin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
            : v.role === 'gerente' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
        const roleText = v.role.charAt(0).toUpperCase() + v.role.slice(1);

        const li = document.createElement('li');
        li.className = 'flex justify-between items-center bg-slate-100 dark:bg-slate-700 p-2 rounded-md';
        li.innerHTML = `
            <div>
                <span>${v.name}</span>
                <span class="text-xs ml-2 px-2 py-0.5 rounded-full font-medium ${roleClass}">${roleText}</span>
            </div>
            <button data-userid="${v.id}" data-username="${v.name}" class="remove-user-btn text-red-500 hover:text-red-700 ${v.name === state.loggedInUser.name || v.role === 'superadmin' ? 'hidden' : ''}">
                <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
            </button>
        `;
        list.appendChild(li);
    });
    window.lucide.createIcons();
}

function renderStoresList() {
    const storesListEl = document.getElementById('stores-management-list');
    if (!storesListEl) return;
    storesListEl.innerHTML = '';

    state.db.stores.forEach(store => {
        const li = document.createElement('li');
        li.className = 'flex justify-between items-center bg-slate-100 dark:bg-slate-700 p-2 rounded-md';
        li.innerHTML = `
            <span>${store.name}</span>
            <button data-store-id="${store.id}" data-store-name="${store.name}" class="remove-store-btn text-red-500 hover:text-red-700">
                <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
            </button>
        `;
        storesListEl.appendChild(li);
    });
    window.lucide.createIcons();
}

export function renderPrizes() {
    const list = document.getElementById('prizes-list');
    const totalProbEl = document.getElementById('total-probability');
    if (!list || !totalProbEl) return;
    list.innerHTML = '';
    
    let totalProb = 0;
    uiState.configPrizes.forEach((prize, index) => {
        totalProb += prize.probability;
        const li = document.createElement('li');
        li.className = 'flex justify-between items-center bg-slate-100 dark:bg-slate-700 p-2 rounded-md text-sm';
        li.innerHTML = `
            <span>${prize.name} <span class="text-xs text-slate-500">(${prize.probability}%)</span></span>
            <button data-index="${index}" class="remove-prize-btn text-red-500 hover:text-red-700">
                <i data-lucide="x" class="w-4 h-4 pointer-events-none"></i>
            </button>
        `;
        list.appendChild(li);
    });

    totalProbEl.textContent = `${totalProb}%`;
    totalProbEl.classList.toggle('text-red-500', totalProb !== 100);
    totalProbEl.classList.toggle('text-green-500', totalProb === 100);
    window.lucide.createIcons();
}

export function renderConfiguracoes() {
    const c = document.getElementById('configuracoes-view');
    if (!c) return;

    // Popula os campos com os dados do estado
    c.querySelector('#config-store-name').value = state.db.settings.storeName || '';
    c.querySelector('#owner-phone').value = state.db.settings.ownerPhone || '';
    c.querySelector('#meta-diaria').value = state.db.settings.goals?.daily || 0;
    c.querySelector('#meta-semanal').value = state.db.settings.goals?.weekly || 0;
    c.querySelector('#meta-mensal').value = state.db.settings.goals?.monthly || 0;

    const enableBonusCheckbox = c.querySelector('#enable-bonus');
    const bonusValueContainer = c.querySelector('#bonus-value-container');
    const bonusValueInput = c.querySelector('#bonus-value');
    enableBonusCheckbox.checked = state.db.settings.bonusSystem?.enabled ?? true;
    bonusValueInput.value = state.db.settings.bonusSystem?.value ?? 80;
    bonusValueContainer.classList.toggle('hidden', !enableBonusCheckbox.checked);

    const exportVendedorSelect = c.querySelector('#export-vendedor-select');
    exportVendedorSelect.innerHTML = '<option value="Todos">Todos os Vendedores</option>';
    const vendedores = state.db.users.filter(u => u.role === 'vendedor' && u.storeId === state.selectedStore.id).map(u => u.name);
    vendedores.forEach(name => {
        exportVendedorSelect.innerHTML += `<option value="${name}">${name}</option>`;
    });

    renderUsersList();

    const manageStoresSection = c.querySelector('#manage-stores-section');
    if (state.loggedInUser.role === 'superadmin') {
        manageStoresSection.classList.remove('hidden');
        renderStoresList();
    } else {
        manageStoresSection.classList.add('hidden');
    }

    const wheelConfigContainer = c.querySelector('#bonus-wheel-config-container');
    const enableWheelCheckbox = c.querySelector('#enable-bonus-wheel');
    uiState.configPrizes = state.db.settings.bonusWheel?.prizes ? [...state.db.settings.bonusWheel.prizes] : [];
    enableWheelCheckbox.checked = state.db.settings.bonusWheel?.enabled ?? false;
    wheelConfigContainer.classList.toggle('hidden', !enableWheelCheckbox.checked);
    c.querySelector('#bonus-wheel-min-value').value = state.db.settings.bonusWheel?.minValue ?? 0;
    
    renderPrizes();
}