import { auth, db } from '../config/firebase.js';

let currentUserData = null;

// Tenta fazer login
export async function login(storeId, username, password) {
    // O Firebase Auth usa e-mail. Criamos um padrão para o nosso sistema.
    const email = `${username}@${storeId}.pdv`;
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Após logar, busca os dados adicionais do usuário (perfil, loja, etc.) no Firestore
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
            throw new Error("Dados do usuário não encontrados no banco de dados.");
        }

        currentUserData = { uid: user.uid, ...userDoc.data() };
        sessionStorage.setItem('currentUserData', JSON.stringify(currentUserData)); // Salva na sessão do navegador
        
        return { user, userData: currentUserData };
    } catch (error) {
        console.error("Erro no login:", error);
        if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
            throw new Error("Usuário ou senha inválidos.");
        }
        throw new Error("Ocorreu um erro ao tentar fazer login.");
    }
}

// Faz logout
export async function logout() {
    await auth.signOut();
    currentUserData = null;
    sessionStorage.removeItem('currentUserData');
    window.location.reload(); // Recarrega a página para limpar o estado
}

// Observador do estado de autenticação (a mágica do login persistente)
export function onAuthStateChanged(callback) {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Se o usuário está autenticado, mas os dados da sessão foram perdidos, busca novamente
            if (!currentUserData) {
                const storedData = sessionStorage.getItem('currentUserData');
                if (storedData) {
                    currentUserData = JSON.parse(storedData);
                } else {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    if (userDoc.exists) {
                        currentUserData = { uid: user.uid, ...userDoc.data() };
                        sessionStorage.setItem('currentUserData', JSON.stringify(currentUserData));
                    }
                }
            }
            callback(user, currentUserData);
        } else {
            callback(null, null);
        }
    });
}

// Retorna os dados do usuário logado
export function getCurrentUser() {
    if (!currentUserData) {
        const storedData = sessionStorage.getItem('currentUserData');
        if (storedData) {
            currentUserData = JSON.parse(storedData);
        }
    }
    return currentUserData;
}