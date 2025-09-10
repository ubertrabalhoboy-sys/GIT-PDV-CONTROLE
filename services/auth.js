import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db } from '../config/firebase.js';
import { state, updateState, initializeAppUI } from '../main.js';
import { showToast } from '../ui/utils.js';
import { detachAllListeners } from './data.js';
import { loadInitialData } from "../views/login.js";

export async function handleLogin(user, password) {
    const email = `${user.name.toLowerCase().replace(/\s+/g, '')}@pdv-app.com`;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        
        let selectedStore = state.selectedStore;
        if (user.role !== 'superadmin' && !selectedStore) {
            selectedStore = state.db.stores.find(s => s.id === user.storeId);
        }
        
        updateState({ loggedInUser: user, selectedStore });

        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('password').value = '';
        document.getElementById('login-error').textContent = '';
        
        initializeAppUI();
    } catch (error) {
        console.error("Erro de login:", error.code);
        document.getElementById('login-error').textContent = 'Senha inválida.';
        const passwordView = document.getElementById('password-view');
        passwordView.classList.add('animate-shake');
        setTimeout(() => passwordView.classList.remove('animate-shake'), 500);
    }
}

export async function handleLogout() {
    await signOut(auth);
    detachAllListeners();
    
    // Reseta o estado para o inicial
    updateState({
        loggedInUser: null,
        selectedStore: null,
        currentOrder: [],
        db: { users: [], stores: [], sales: [], products: [], clients: [], settings: {} },
        listeners: { users: null, sales: null, stores: null, products: null, clients: null }
    });
    
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('store-switcher-container').classList.add('hidden');
    
    // Recarrega os dados iniciais para a tela de login
    loadInitialData();
}

export async function handleUserCreation(name, password, role) {
    if (!name || !password) {
        showToast('Nome e senha são obrigatórios.', 'error');
        return false;
    }
    if (state.db.users.some(u => u.name.toLowerCase() === name.toLowerCase())) {
        showToast('Nome de usuário já existe.', 'error');
        return false;
    }
    
    const email = `${name.toLowerCase().replace(/\s+/g, '')}@pdv-app.com`;
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
            name: name,
            role: role,
            storeId: state.selectedStore.id
        });

        showToast('Usuário cadastrado com sucesso!', 'success');
        return true;
    } catch (error) {
        console.error("Erro ao criar usuário:", error);
        if (error.code === 'auth/email-already-in-use') {
            showToast('Este nome de usuário já está em uso.', 'error');
        } else if (error.code === 'auth/weak-password') {
            showToast('A senha deve ter no mínimo 6 caracteres.', 'error');
        } else {
            showToast('Erro ao cadastrar usuário.', 'error');
        }
        return false;
    }
}