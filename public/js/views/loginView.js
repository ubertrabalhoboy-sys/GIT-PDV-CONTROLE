import { db } from '../config/firebase.js';
import { login } from '../services/authService.js';
import { showToast } from '../ui/components.js';

let selectedStoreId = null;
let selectedUser = null;

export async function showLoginView(container) {
    container.innerHTML = `
        <div class="min-h-screen flex flex-col items-center justify-center bg-gray-200 p-4">
            <div id="login-container" class="w-full max-w-md bg-white rounded-lg shadow-md p-8">
                <h1 class="text-2xl font-bold text-center mb-6">Selecione a Loja</h1>
                <div id="stores-list" class="text-center">
                    <div class="spinner"></div>
                </div>
            </div>
        </div>
    `;

    try {
        const storesSnapshot = await db.collection('stores').get();
        const storesList = document.getElementById('stores-list');
        
        if (storesSnapshot.empty) {
            // Lógica de primeira execução: criar loja padrão, etc.
            storesList.innerHTML = `<p class="text-red-500">Nenhuma loja encontrada. Configure o sistema.</p>`;
            return;
        }

        storesList.innerHTML = storesSnapshot.docs.map(doc => `
            <button data-store-id="${doc.id}" class="store-btn block w-full text-left p-3 my-2 bg-gray-100 hover:bg-blue-500 hover:text-white rounded transition">
                ${doc.data().name}
            </button>
        `).join('');

        document.querySelectorAll('.store-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedStoreId = btn.dataset.storeId;
                showUsersForStore(selectedStoreId);
            });
        });

    } catch (error) {
        console.error("Erro ao buscar lojas:", error);
        document.getElementById('stores-list').innerHTML = `<p class="text-red-500">Erro ao carregar lojas.</p>`;
    }
}

async function showUsersForStore(storeId) {
    const loginContainer = document.getElementById('login-container');
    loginContainer.innerHTML = `
        <h1 class="text-2xl font-bold text-center mb-6">Selecione o Usuário</h1>
        <div id="users-list" class="flex flex-wrap justify-center gap-4">
            <div class="spinner"></div>
        </div>
        <button id="back-to-stores" class="mt-6 w-full text-center text-blue-500 hover:underline">Voltar</button>
    `;
    
    document.getElementById('back-to-stores').addEventListener('click', () => showLoginView(document.getElementById('app-root')));

    const usersSnapshot = await db.collection('users').where('storeId', '==', storeId).get();
    const usersList = document.getElementById('users-list');

    usersList.innerHTML = usersSnapshot.docs.map(doc => {
        const user = { id: doc.id, ...doc.data() };
        return `
            <div data-user-name="${user.username}" data-user='${JSON.stringify(user)}' class="user-avatar text-center cursor-pointer p-2 rounded hover:bg-gray-200">
                <img src="${user.avatarUrl || 'https://via.placeholder.com/80'}" alt="${user.name}" class="w-20 h-20 rounded-full mx-auto border-2 border-transparent">
                <p class="mt-2 font-semibold">${user.name}</p>
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.user-avatar').forEach(avatar => {
        avatar.addEventListener('click', (e) => {
            document.querySelectorAll('.user-avatar img').forEach(img => img.classList.remove('border-blue-500'));
            e.currentTarget.querySelector('img').classList.add('border-blue-500');
            selectedUser = JSON.parse(e.currentTarget.dataset.user);
            showPasswordScreen(selectedUser);
        });
    });
}

function showPasswordScreen(user) {
    const loginContainer = document.getElementById('login-container');
    loginContainer.innerHTML = `
        <div class="text-center">
             <img src="${user.avatarUrl || 'https://via.placeholder.com/80'}" alt="${user.name}" class="w-24 h-24 rounded-full mx-auto mb-4">
             <h2 class="text-xl font-semibold">${user.name}</h2>
        </div>
        <form id="login-form" class="mt-6">
            <label for="password" class="block text-sm font-medium text-gray-700">Senha</label>
            <input type="password" id="password" required class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
            <button type="submit" class="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Entrar</button>
        </form>
         <button id="back-to-users" class="mt-4 w-full text-center text-blue-500 hover:underline">Trocar Usuário</button>
    `;

    document.getElementById('back-to-users').addEventListener('click', () => showUsersForStore(selectedStoreId));

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('password').value;
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.innerHTML = '<div class="spinner mx-auto" style="width: 20px; height: 20px;"></div>';

        try {
            await login(selectedStoreId, user.username, password);
            // O onAuthStateChanged em main.js cuidará do resto
        } catch (error) {
            showToast(error.message, 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Entrar';
        }
    });
}