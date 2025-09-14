import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from './firebaseConfig.js';
import { getStores, getUsersForStore, getUserProfile, getSettings, getInitialAdminUser } from './firebaseApi.js';
import { renderLoginScreen, clearLoginScreen, clearApp, renderAppLoading } from './ui.js';

let currentUser = null;
let selectedStore = null;

export const getCurrentUser = () => currentUser;
export const getSelectedStore = () => selectedStore;
export const setSelectedStore = (store) => {
    selectedStore = store;
    sessionStorage.setItem('selectedStore', JSON.stringify(store));
};

export async function login(username, password) {
    const email = `${username.toLowerCase().replace(/\s+/g, '')}@pdv-app.com`;
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userProfile = await getUserProfile(userCredential.user.uid);
        if (!userProfile) throw new Error("Perfil do usuário não encontrado no Firestore.");
        currentUser = userProfile;
        sessionStorage.setItem('lastUserUID', userCredential.user.uid);
        return userProfile;
    } catch (error) {
        console.error("Falha no login:", error.code);
        throw new Error("Usuário ou senha inválidos.");
    }
}

export async function logout() {
    try {
        await firebaseSignOut(auth);
    } catch (error) {
        console.error("Falha no logout:", error);
    } finally {
        currentUser = null;
        selectedStore = null;
        sessionStorage.removeItem('selectedStore');
        sessionStorage.removeItem('lastUserUID');
        clearApp();
        startLoginFlow();
    }
}

async function startLoginFlow() {
    clearLoginScreen();
    try {
        let stores = await getStores();
        if (stores.length === 0) {
            const adminUser = await getInitialAdminUser();
            renderLoginScreen([], adminUser ? [adminUser] : [], true);
            return;
        }

        const allUsersForStore = stores.length === 1 ? await getUsersForStore(stores[0].id) : [];
        const superAdmin = await getInitialAdminUser();
        const combinedUsers = [...new Map([...allUsersForStore, (superAdmin || {})].filter(u => u.id).map(item => [item['id'], item])).values()];
        
        renderLoginScreen(stores, combinedUsers);
    } catch (error) {
        console.error("ERRO CRÍTICO no startLoginFlow:", error);
        renderLoginScreen([], [], false, "Erro ao carregar dados iniciais.");
    }
}

export function listenForAuthStateChanges(onLoginSuccess) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            renderAppLoading(); // Mostra o spinner de carregamento
            const lastUID = sessionStorage.getItem('lastUserUID');
            if (lastUID && user.uid !== lastUID) {
                return logout();
            }

            const storedStoreJSON = sessionStorage.getItem('selectedStore');
            if (storedStoreJSON) {
                selectedStore = JSON.parse(storedStoreJSON);
                currentUser = await getUserProfile(user.uid);

                if (currentUser && selectedStore) {
                    const settings = await getSettings(selectedStore.id);
                    selectedStore.settings = settings;
                    clearLoginScreen();
                    onLoginSuccess(currentUser, selectedStore);
                    return;
                }
            }
            return logout(); // Se não tiver loja na sessão, força o re-login
        } else {
            startLoginFlow();
        }
    });
}