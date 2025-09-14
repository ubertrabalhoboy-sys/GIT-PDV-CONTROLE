import { getCurrentUser } from '../services/authService.js';
import { getPaginatedData, addDocument } from '../services/firestoreService.js';
import { createModal, showToast } from '../ui/components.js';

let currentOrder = [];
let audioContext;
let winSoundBuffer;

// Otimização de áudio: pré-carrega o som da roleta
async function setupAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const response = await fetch('/sounds/win.mp3'); // Supondo que você tenha um som em /public/sounds/
        const arrayBuffer = await response.arrayBuffer();
        winSoundBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } catch (e) {
        console.warn("Não foi possível inicializar o Web Audio API. A roleta ficará sem som.", e);
    }
}

function playWinSound() {
    if (!audioContext || !winSoundBuffer) return;
    const source = audioContext.createBufferSource();
    source.buffer = winSoundBuffer;
    source.connect(audioContext.destination);
    source.start(0);
}

export async function renderCaixaView(container) {
    const user = getCurrentUser();
    container.innerHTML = `
        <h1 class="text-3xl font-bold mb-6">Caixa</h1>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-2 bg-white p-6 rounded-lg shadow">
                <h2 class="text-xl font-semibold mb-4">Adicionar Item</h2>
                <div class="flex gap-4 mb-4">
                    <input type="text" id="product-search" placeholder="Buscar produto pelo nome..." class="flex-grow p-2 border rounded">
                    <button id="add-manual-item-btn" class="bg-gray-200 p-2 rounded hover:bg-gray-300">Item Manual</button>
                </div>
                <div id="search-results" class="max-h-60 overflow-y-auto"></div>
            </div>

            <div class="bg-white p-6 rounded-lg shadow">
                <h2 class="text-xl font-semibold mb-4">Pedido Atual</h2>
                <div id="current-order-list" class="mb-4">
                    <p class="text-gray-500">Nenhum item adicionado.</p>
                </div>
                <hr class="my-4">
                <div class="flex justify-between text-2xl font-bold">
                    <span>Total:</span>
                    <span id="order-total">R$ 0,00</span>
                </div>
                <button id="finish-order-btn" class="mt-6 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded disabled:bg-gray-400" disabled>
                    Finalizar Pedido
                </button>
            </div>
        </div>
    `;

    // Carrega o áudio
    await setupAudio();

    const productSearchInput = document.getElementById('product-search');
    productSearchInput.addEventListener('keyup', handleProductSearch);

    document.getElementById('finish-order-btn').addEventListener('click', openCheckoutModal);

    updateOrderView(); // Renderiza a visão inicial do pedido
}

function updateOrderView() {
    const orderList = document.getElementById('current-order-list');
    const orderTotalEl = document.getElementById('order-total');
    const finishBtn = document.getElementById('finish-order-btn');

    if (currentOrder.length === 0) {
        orderList.innerHTML = `<p class="text-gray-500">Nenhum item adicionado.</p>`;
        finishBtn.disabled = true;
    } else {
        orderList.innerHTML = currentOrder.map((item, index) => `
            <div class="flex justify-between items-center py-2 border-b">
                <div>
                    <p class="font-semibold">${item.name}</p>
                    <p class="text-sm text-gray-600">${item.quantity} x R$ ${item.price.toFixed(2)}</p>
                </div>
                <div class="flex items-center gap-2">
                     <span class="font-bold">R$ ${(item.quantity * item.price).toFixed(2)}</span>
                     <button data-index="${index}" class="remove-item-btn text-red-500 hover:text-red-700">&times;</button>
                </div>
            </div>
        `).join('');
        finishBtn.disabled = false;
        
        // Add event listeners to new remove buttons
        document.querySelectorAll('.remove-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index, 10);
                currentOrder.splice(index, 1);
                updateOrderView();
            });
        });
    }

    const total = currentOrder.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    orderTotalEl.textContent = `R$ ${total.toFixed(2)}`;
}

async function handleProductSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const resultsContainer = document.getElementById('search-results');
    
    if (searchTerm.length < 3) {
        resultsContainer.innerHTML = '';
        return;
    }

    // Simples busca (sem paginação por ser uma busca rápida)
    const { docs } = await getPaginatedData('products', [
        { field: 'name_lowercase', '>=': searchTerm }, // Firestore não tem 'like', então buscamos por prefixo
        { field: 'name_lowercase', '<=': searchTerm + '\uf8ff' }
    ], null, 10);

    if (docs.length > 0) {
        resultsContainer.innerHTML = docs.map(product => `
            <div data-product='${JSON.stringify(product)}' class="add-product-btn p-2 border-b hover:bg-gray-100 cursor-pointer">
                <p class="font-semibold">${product.name}</p>
                <p class="text-sm">Estoque: ${product.quantity} | R$ ${product.price.toFixed(2)}</p>
            </div>
        `).join('');

        document.querySelectorAll('.add-product-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const product = JSON.parse(e.currentTarget.dataset.product);
                currentOrder.push({ ...product, quantity: 1 });
                updateOrderView();
                resultsContainer.innerHTML = '';
                document.getElementById('product-search').value = '';
            });
        });
    } else {
        resultsContainer.innerHTML = `<p class="p-2 text-gray-500">Nenhum produto encontrado.</p>`;
    }
}

function openCheckoutModal() {
    const total = currentOrder.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    
    const contentHTML = `
        <div>
            <label class="block mb-2">Cliente (Opcional)</label>
            <input type="text" id="customer-name" placeholder="Nome do Cliente" class="w-full p-2 border rounded mb-4">
            
            <label class="block mb-2">Forma de Pagamento</label>
            <select id="payment-method" class="w-full p-2 border rounded">
                <option>Dinheiro</option>
                <option>Pix</option>
                <option>Cartão de Crédito</option>
                <option>Cartão de Débito</option>
            </select>

            <div class="mt-4">
                <label class="block mb-2">Valor Pago</label>
                <input type="number" id="amount-paid" placeholder="${total.toFixed(2)}" class="w-full p-2 border rounded">
            </div>

            <p class="mt-4 text-lg">Troco: <span id="change-due" class="font-bold">R$ 0,00</span></p>
        </div>
    `;

    const footerHTML = `
        <button id="cancel-checkout" class="bg-gray-300 hover:bg-gray-400 text-black font-bold py-2 px-4 rounded mr-2">Cancelar</button>
        <button id="confirm-checkout" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Confirmar Venda</button>
    `;

    const { modalElement, closeModal } = createModal(`Finalizar Venda (Total: R$ ${total.toFixed(2)})`, contentHTML, footerHTML);

    const amountPaidInput = modalElement.querySelector('#amount-paid');
    const changeDueEl = modalElement.querySelector('#change-due');
    amountPaidInput.addEventListener('input', () => {
        const paid = parseFloat(amountPaidInput.value) || 0;
        const change = paid - total;
        changeDueEl.textContent = `R$ ${change > 0 ? change.toFixed(2) : '0.00'}`;
    });

    modalElement.querySelector('#cancel-checkout').addEventListener('click', closeModal);
    modalElement.querySelector('#confirm-checkout').addEventListener('click', async () => {
        // Lógica para salvar a venda
        const sale = {
            items: currentOrder,
            total,
            paymentMethod: modalElement.querySelector('#payment-method').value,
            customerName: modalElement.querySelector('#customer-name').value || 'Não informado',
            // ... outros dados
        };
        try {
            await addDocument('sales', sale);
            showToast('Venda finalizada com sucesso!', 'success');
            
            // Simulação da roleta
            playWinSound(); // Toca o som da roleta
            showToast('Parabéns! Você ganhou um prêmio!', 'success');
            
            currentOrder = []; // Limpa o pedido
            updateOrderView(); // Atualiza a tela do caixa
            closeModal();
        } catch (error) {
            console.error("Erro ao salvar venda:", error);
            showToast('Erro ao finalizar a venda.', 'error');
        }
    });
}