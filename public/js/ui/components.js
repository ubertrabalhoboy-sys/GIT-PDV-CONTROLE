/**
 * Mostra um spinner de carregamento dentro de um elemento.
 * @param {HTMLElement} container - O elemento onde o spinner será inserido.
 * @param {string} text - Texto a ser exibido sob o spinner.
 */
export function showSpinner(container, text = 'Carregando...') {
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full p-8">
            <div class="spinner"></div>
            <p class="mt-4 text-gray-600">${text}</p>
        </div>
    `;
}

/**
 * Esconde o spinner e limpa o contêiner.
 * @param {HTMLElement} container 
 */
export function hideSpinner(container) {
    container.innerHTML = '';
}


/**
 * Cria e exibe uma notificação (toast).
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} type - 'success' (verde) ou 'error' (vermelho).
 */
export function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    
    toast.className = `fixed bottom-5 right-5 ${bgColor} text-white py-2 px-4 rounded-lg shadow-lg z-50 animate-fade-in-out`;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);

    // Adiciona a animação ao CSS se não existir
    if (!document.getElementById('toast-animation-style')) {
        const style = document.createElement('style');
        style.id = 'toast-animation-style';
        style.innerHTML = `
            @keyframes fade-in-out {
                0% { opacity: 0; transform: translateY(20px); }
                10% { opacity: 1; transform: translateY(0); }
                90% { opacity: 1; transform: translateY(0); }
                100% { opacity: 0; transform: translateY(20px); }
            }
            .animate-fade-in-out {
                animation: fade-in-out 3s ease-in-out;
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Cria e gerencia um modal.
 * @param {string} title - Título do modal.
 * @param {string} contentHTML - O HTML do corpo do modal.
 * @param {string} footerHTML - O HTML do rodapé (botões).
 * @returns {Promise<void>} - A função retorna quando o modal é criado.
 */
export function createModal(title, contentHTML, footerHTML) {
    const modalId = `modal-${Date.now()}`;
    const modalHTML = `
        <div id="${modalId}" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
            <div class="bg-white rounded-lg shadow-xl w-full max-w-lg animate-scale-in">
                <div class="flex justify-between items-center p-4 border-b">
                    <h3 class="text-xl font-semibold">${title}</h3>
                    <button class="text-gray-500 hover:text-gray-800 close-modal">&times;</button>
                </div>
                <div class="p-6">${contentHTML}</div>
                <div class="flex justify-end p-4 bg-gray-50 border-t">${footerHTML}</div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modalElement = document.getElementById(modalId);

    const closeModal = () => {
        modalElement.remove();
    };

    modalElement.addEventListener('click', (e) => {
        // Fecha se clicar no botão de fechar ou fora do conteúdo do modal
        if (e.target.classList.contains('close-modal') || e.target.id === modalId) {
            closeModal();
        }
    });

    // Adiciona a animação ao CSS se não existir
     if (!document.getElementById('modal-animation-style')) {
        const style = document.createElement('style');
        style.id = 'modal-animation-style';
        style.innerHTML = `
            @keyframes scale-in {
                0% { transform: scale(0.9); opacity: 0; }
                100% { transform: scale(1); opacity: 1; }
            }
            .animate-scale-in { animation: scale-in 0.2s ease-out; }
        `;
        document.head.appendChild(style);
    }
    
    return { modalElement, closeModal };
}