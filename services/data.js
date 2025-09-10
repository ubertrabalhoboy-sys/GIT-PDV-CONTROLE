import { onSnapshot, collection, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from '../config/firebase.js';
import { state, updateState, renderViewContent } from '../main.js';
import { showToast } from '../ui/utils.js';

export function initializeListeners() {
    detachAllListeners();

    const { selectedStore, loggedInUser } = state;

    if (!selectedStore) {
        console.error("Nenhuma loja selecionada para iniciar os listeners.");
        return;
    }

    state.listeners.users = onSnapshot(query(collection(db, "users")), (snapshot) => {
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateState({ db: { ...state.db, users } });
        if (['configuracoes', 'pedidos', 'relatorios'].includes(state.currentView)) {
            renderViewContent(state.currentView);
        }
    }, (error) => { console.error("Erro no listener de usuários:", error); showToast('Erro ao carregar usuários.', 'error'); });

    const productsQuery = query(collection(db, "products"), where("storeId", "==", selectedStore.id));
    state.listeners.products = onSnapshot(productsQuery, (snapshot) => {
        const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateState({ db: { ...state.db, products } });
        if (state.currentView === 'produtos') {
            renderViewContent(state.currentView);
        }
    }, (error) => { console.error("Erro no listener de produtos:", error); showToast('Erro ao carregar produtos.', 'error'); });

    const clientsQuery = query(collection(db, "clients"), where("storeId", "==", selectedStore.id));
    state.listeners.clients = onSnapshot(clientsQuery, (snapshot) => {
        const clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateState({ db: { ...state.db, clients } });
        if (state.currentView === 'clientes') {
            renderViewContent(state.currentView);
        }
    }, (error) => { console.error("Erro no listener de clientes:", error); showToast('Erro ao carregar clientes.', 'error'); });

    if (loggedInUser.role === 'superadmin') {
        state.listeners.stores = onSnapshot(query(collection(db, "stores")), (snapshot) => {
            const stores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateState({ db: { ...state.db, stores } });
            if (state.currentView === 'configuracoes') {
                 renderViewContent(state.currentView);
            }
        }, (error) => { console.error("Erro no listener de lojas:", error); showToast('Erro ao carregar lojas.', 'error'); });
    }
}

export function detachAllListeners() {
    Object.values(state.listeners).forEach(unsubscribe => {
        if (unsubscribe) unsubscribe();
    });
    updateState({ listeners: { users: null, sales: null, stores: null, products: null, clients: null } });
}