// js/state.js

// Este objeto guarda todo o estado de dados da aplicação.
export const state = {
    loggedInUser: null,
    currentView: '',
    currentOrder: [],
    db: {
        users: [],
        stores: [],
        products: [],
        clients: [],
        settings: {
            storeName: "Minha Loja",
            goals: { daily: 150, weekly: 1000, monthly: 4000 },
            bonusSystem: { enabled: true, value: 80 },
            bonusWheel: { enabled: false, prizes: [], minValue: 0 },
            ownerPhone: ''
        },
        sales: []
    },
    listeners: {
        users: null,
        sales: null,
        stores: null,
        products: null,
        clients: null
    },
    selectedStore: null
};

// Variáveis globais relacionadas ao estado da UI, mas separadas dos dados principais.
export let uiState = {
    selectedUserForLogin: null,
    vendasChartInstance: null,
    pagamentoChartInstance: null,
    currentRankingPeriod: 'day',
    selectedProductFromSearch: null, // Para busca de produtos no Caixa
    selectedClientForSale: null, // Para busca de clientes na Venda
    currentEditingClientId: null, // Para edição de clientes
    configPrizes: [], // Para configurar prêmios da roleta
};

// Função para resetar o estado ao fazer logout.
export function resetState() {
    state.loggedInUser = null;
    state.currentView = '';
    state.currentOrder = [];
    state.db = {
        users: [],
        stores: [],
        products: [],
        clients: [],
        settings: {
            storeName: "Minha Loja",
            goals: { daily: 150, weekly: 1000, monthly: 4000 },
            bonusSystem: { enabled: true, value: 80 },
            bonusWheel: { enabled: false, prizes: [], minValue: 0 },
            ownerPhone: ''
        },
        sales: []
    };

    // Desconecta todos os listeners do Firestore.
    Object.values(state.listeners).forEach(unsubscribe => {
        if (unsubscribe) unsubscribe();
    });
    state.listeners = { users: null, sales: null, stores: null, products: null, clients: null };
    state.selectedStore = null;

    // Reseta o estado da UI.
    uiState.selectedUserForLogin = null;
    if (uiState.vendasChartInstance) uiState.vendasChartInstance.destroy();
    if (uiState.pagamentoChartInstance) uiState.pagamentoChartInstance.destroy();
    uiState.vendasChartInstance = null;
    uiState.pagamentoChartInstance = null;
}