import { initializeFirebase } from './config/firebase.js';
import { onAuthStateChanged } from './services/authService.js';
import { showLoginView } from './views/loginView.js';
import { showInitialView, renderNavigation } from './ui/navigation.js';
import { showSpinner, hideSpinner } from './ui/components.js';

// Função principal que inicializa a aplicação
async function main() {
    const appRoot = document.getElementById('app-root');
    const appLayout = document.getElementById('app-layout');
    
    showSpinner(appRoot, 'Carregando Sistema...');

    try {
        initializeFirebase();
        
        // Ouve as mudanças no estado de autenticação (login/logout)
        onAuthStateChanged(async (user, userData) => {
            hideSpinner(appRoot);
            if (user) {
                // Usuário está logado
                console.log('Usuário autenticado:', user.email, 'Role:', userData.role);
                appRoot.innerHTML = ''; // Limpa a tela de login
                appLayout.style.display = 'block'; // Mostra o layout principal
                
                // Renderiza a navegação baseada no perfil do usuário
                await renderNavigation(userData);

                // Mostra a tela inicial apropriada para o perfil
                showInitialView(userData.role);
                
            } else {
                // Usuário não está logado
                console.log('Nenhum usuário autenticado.');
                appLayout.style.display = 'none'; // Esconde o layout principal
                showLoginView(appRoot); // Mostra a tela de login
            }
        });

    } catch (error) {
        console.error("Erro na inicialização:", error);
        appRoot.innerHTML = `<div class="text-red-500 text-center p-8">Erro crítico ao iniciar o sistema. Verifique o console.</div>`;
    }
}

// Inicia a aplicação
main();