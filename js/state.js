// This object holds the entire state of the application.
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

// These are global variables related to UI state but not part of the core data state.
export let uiState = {
    selectedUserForLogin: null,
    vendasChartInstance: null,
    pagamentoChartInstance: null,
    currentRankingPeriod: 'day',
};

// Function to reset the state on logout
export function resetState() {
    state.loggedInUser = null;
    state.currentView = '';
    state.currentOrder = [];
    state.db = {
        users: [], stores: [], products: [], clients: [],
        settings: { storeName: "Minha Loja", goals: { daily: 150, weekly: 1000, monthly: 4000 }, bonusSystem: { enabled: true, value: 80 }, bonusWheel: { enabled: false, prizes: [], minValue: 0 }, ownerPhone: '' },
        sales: []
    };
    // Detach all listeners
    Object.values(state.listeners).forEach(unsubscribe => {
        if (unsubscribe) unsubscribe();
    });
    state.listeners = { users: null, sales: null, stores: null, products: null, clients: null };
    state.selectedStore = null;

    uiState.selectedUserForLogin = null;
    if (uiState.vendasChartInstance) uiState.vendasChartInstance.destroy();
    if (uiState.pagamentoChartInstance) uiState.pagamentoChartInstance.destroy();
    uiState.vendasChartInstance = null;
    uiState.pagamentoChartInstance = null;
}