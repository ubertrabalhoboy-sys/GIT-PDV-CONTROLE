import { doc, writeBatch, collection, Timestamp, increment, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, state, updateState } from '../main.js';
import { showToast, formatCurrency } from '../ui/utils.js';

function showPrizeWonModal(prize, saleData) {
    const modal = document.getElementById('prize-won-modal');
    modal.classList.remove('hidden');

    modal.innerHTML = `
        <div class="custom-card rounded-lg shadow-xl w-full max-w-sm p-8 m-4 fade-in text-center relative overflow-hidden">
            <div class="confetti-container"></div>
            <i data-lucide="party-popper" class="w-16 h-16 mx-auto mb-4 text-amber-400"></i>
            <h2 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Parabéns!</h2>
            <p class="text-slate-600 dark:text-slate-400 mt-2">Você ganhou:</p>
            <p class="text-2xl sm:text-3xl font-bold text-brand-secondary my-4">${prize.name}</p>
            <button id="close-prize-modal" class="w-full bg-brand-primary text-white py-2.5 px-4 rounded-md hover:bg-blue-700 transition-colors">Continuar</button>
        </div>
    `;
    window.lucide.createIcons();

    const confettiContainer = modal.querySelector('.confetti-container');
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        const colors = ['#3b82f6', '#22c55e', '#ec4899', '#f59e0b', '#8b5cf6'];
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.left = `${Math.random() * 100}%`;
        confetti.style.animationDelay = `${Math.random() * 3}s`;
        confetti.style.width = `${Math.random() * 8 + 5}px`;
        confetti.style.height = confetti.style.width;
        confettiContainer.appendChild(confetti);
    }

    modal.querySelector('#close-prize-modal').addEventListener('click', () => {
        modal.classList.add('hidden');
        if (saleData.clientPhone) {
            showWhatsAppModal(saleData);
        }
    }, { once: true });
}

async function showBonusWheelModal(saleData) {
    const modal = document.getElementById('bonus-wheel-modal');
    const prizes = state.db.settings.bonusWheel.prizes;

    if (!prizes || prizes.length === 0) {
        if (saleData.clientPhone) showWhatsAppModal(saleData);
        return;
    }

    const segmentAngle = 360 / prizes.length;

    const segmentsHTML = prizes.map((prize, index) => {
        const rotation = segmentAngle * index;
        return `
            <div class="wheel-segment" style="transform: rotate(${rotation}deg) skewY(${segmentAngle - 90}deg);">
                <span class="segment-label">🎁</span>
            </div>
        `;
    }).join('');

    modal.innerHTML = `
        <div class="custom-card rounded-lg shadow-xl w-full max-w-md p-6 m-4 fade-in text-center">
            <h2 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">Parabéns!</h2>
            <p class="text-slate-600 dark:text-slate-400 mb-4">O cliente ganhou o direito de girar a roleta!</p>
            <div class="wheel-container">
                <div class="wheel-pointer"></div>
                <div class="wheel">${segmentsHTML}</div>
                <div class="wheel-center"></div>
            </div>
            <button id="spin-wheel-btn" class="w-full bg-brand-secondary text-white py-3 px-4 rounded-md hover:bg-green-700 transition-colors text-lg font-bold">GIRAR A ROLETA</button>
        </div>
    `;
    modal.classList.remove('hidden');

    const spinBtn = modal.querySelector('#spin-wheel-btn');
    const wheel = modal.querySelector('.wheel');
    let isSpinning = false;
    
    spinBtn.addEventListener('click', async () => {
        if (isSpinning) return;
        isSpinning = true;
        spinBtn.disabled = true;
        spinBtn.textContent = 'GIRANDO...';

        await window.Tone.start(); 
        const synth = new window.Tone.Synth().toDestination();
        const notes = ["C4", "D4", "E4", "G4", "A4", "G4", "E4", "D4"];
        let noteIndex = 0;
        const loop = new window.Tone.Loop(time => {
            synth.triggerAttackRelease(notes[noteIndex % notes.length], "16n", time);
            noteIndex++;
        }, "16n").start(0);

        window.Tone.Transport.bpm.value = 180;
        window.Tone.Transport.start();

        const slowDownInterval = setInterval(() => {
            if (window.Tone.Transport.bpm.value > 40) {
                window.Tone.Transport.bpm.value -= 5;
            } else {
                clearInterval(slowDownInterval);
            }
        }, 200);


        let cumulativeProbability = 0;
        const weightedPrizes = prizes.map(p => ({ ...p, cumulative: cumulativeProbability += p.probability }));
        const random = Math.random() * 100;
        const winningPrize = weightedPrizes.find(p => random < p.cumulative) || prizes[prizes.length - 1];
        const winningIndex = prizes.findIndex(p => p.name === winningPrize.name);

        const randomOffset = (Math.random() - 0.5) * (segmentAngle * 0.8);
        const targetAngle = (winningIndex * segmentAngle) + (segmentAngle / 2) + randomOffset;
        const spinCycles = 5;
        const finalRotation = (360 * spinCycles) - targetAngle;

        wheel.style.transform = `rotate(${finalRotation}deg)`;

        setTimeout(async () => {
            loop.stop();
            window.Tone.Transport.stop();
            noteIndex = 0;
            clearInterval(slowDownInterval);

            try {
                await updateDoc(doc(db, "sales", saleData.id), { prizeWon: winningPrize.name });
                saleData.prizeWon = winningPrize.name;
            } catch (error) {
                console.error("Erro ao atualizar a venda com o prêmio:", error);
                showToast('Erro ao salvar o prêmio.', 'error');
            }

            modal.classList.add('hidden');
            showPrizeWonModal(winningPrize, saleData);

        }, 6000);
    });
}

function showWhatsAppModal(saleData) {
    const modal = document.getElementById('whatsapp-confirm-modal');
    if (!modal) return;

    const storeName = state.db.settings.storeName;
    const saleDate = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

    let itemsText = saleData.items.map(item =>
        `- ${item.name} (${item.exchange}) - ${formatCurrency(item.value)}`
    ).join('\n');

    let paymentText = (saleData.paymentMethods || [])
        .map(p => {
            let paymentString = `- ${p.method}: ${formatCurrency(p.amount)}`;
            if (p.installments) {
                paymentString += ` (em ${p.installments})`;
            }
            return paymentString;
        })
        .join('\n');
    if (!paymentText) {
        paymentText = `- ${saleData.paymentMethod}: ${formatCurrency(saleData.total)}`;
    }

    let prizeText = '';
    if (saleData.prizeWon) {
        prizeText = `\n\n🎁 *Prêmio Ganho na Roleta!*\nParabéns! Você ganhou: *${saleData.prizeWon}*`;
    }

    const couponText = `🧾 *Comprovante de Venda* 🧾\n\n*${storeName}*\n\n*Data:* ${saleDate}\n*Cliente:* ${saleData.clientName}\n\n*Itens:*\n${itemsText}\n\n*Pagamento:*\n${paymentText}\n\n*Total:* *${formatCurrency(saleData.total)}*\n*Vendedor:* ${saleData.vendedor}${prizeText}\n\nObrigado pela sua compra!`;

    const whatsAppNumber = saleData.clientPhone.replace(/\D/g, '');
    const encodedText = encodeURIComponent(couponText);
    const whatsappUrl = `https://wa.me/55${whatsAppNumber}?text=${encodedText}`;

    modal.innerHTML = `
        <div class="custom-card rounded-lg shadow-xl w-full max-w-md p-6 m-4 fade-in">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-bold text-slate-900 dark:text-white">Venda Finalizada</h3>
                <button id="close-whatsapp-modal" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-full">&times;</button>
            </div>
            <p class="text-sm text-slate-600 dark:text-slate-400 mb-4">Deseja enviar o comprovante para o cliente via WhatsApp?</p>
            <div class="bg-slate-200/50 dark:bg-slate-800/50 p-4 rounded-md mb-6 whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-300 font-mono overflow-auto max-h-48">${couponText.replace(/\*/g, '')}</div>
            <div class="flex flex-col sm:flex-row justify-end gap-3">
                <button id="close-whatsapp-modal-btn" class="bg-slate-200 dark:bg-slate-600 py-2 px-4 rounded-md">Fechar</button>
                <button id="send-whatsapp-btn" class="bg-green-500 text-white py-2 px-4 rounded-md flex items-center justify-center gap-2 ${!whatsAppNumber ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-600'}" ${!whatsAppNumber ? 'disabled' : ''}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943s-.182-.133-.38-.232z"/></svg>
                    Enviar via WhatsApp
                </button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');

    const close = () => modal.classList.add('hidden');
    modal.querySelector('#close-whatsapp-modal').addEventListener('click', close);
    modal.querySelector('#close-whatsapp-modal-btn').addEventListener('click', close);
    if (whatsAppNumber) {
        modal.querySelector('#send-whatsapp-btn').addEventListener('click', () => {
            window.open(whatsappUrl, '_blank');
            close();
        });
    }
}

export function renderCaixa() {
    const view = document.getElementById('caixa-view');
    const itemsContainer = view.querySelector('#current-order-items');
    const totalEl = view.querySelector('#current-order-total');
    const finalizeBtn = view.querySelector('#finalize-order-button');
    const addForm = view.querySelector('#add-item-form');
    const modalContainer = document.getElementById('finalize-order-modal');
    
    const productSearchInput = view.querySelector('#product-search');
    const searchResultsContainer = view.querySelector('#product-search-results');
    let selectedProduct = null;

    const updateUI = () => {
        itemsContainer.innerHTML = '';
        if (state.currentOrder.length === 0) {
            itemsContainer.innerHTML = '<p id="no-items-message" class="text-slate-500 dark:text-slate-400 text-center py-4">Nenhum item adicionado.</p>';
            finalizeBtn.disabled = true;
        } else {
            state.currentOrder.forEach((item, i) => {
                const el = document.createElement('div');
                el.className = 'flex justify-between items-center bg-slate-200/50 dark:bg-slate-800/50 p-3 rounded-md';
                const stockIcon = item.productId ? `<i data-lucide="package" class="w-4 h-4 text-slate-500 mr-2" title="Item do Estoque"></i>` : '';
                el.innerHTML = `
                    <div class="flex items-center">
                        ${stockIcon}
                        <div>
                            <p class="font-semibold text-slate-800 dark:text-slate-200">${item.name}</p>
                            <p class="text-xs text-slate-500 dark:text-slate-400">Troca: ${item.exchange || 'N/A'}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        <span class="font-semibold text-slate-800 dark:text-slate-200">${formatCurrency(item.value)}</span>
                        <button data-index="${i}" class="remove-item-btn text-red-500 hover:text-red-700 transition-colors">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>`;
                itemsContainer.appendChild(el);
            });
            finalizeBtn.disabled = false;
        }
        totalEl.textContent = formatCurrency(state.currentOrder.reduce((sum, i) => sum + i.value, 0));
        window.lucide.createIcons();
    };

    addForm.addEventListener('submit', e => {
        e.preventDefault();
        const newItem = {
            name: view.querySelector('#item-name').value,
            value: parseFloat(view.querySelector('#item-value').value),
            exchange: view.querySelector('#item-exchange').value
        };
        if (selectedProduct) {
            newItem.productId = selectedProduct.id;
        }
        const newOrder = [...state.currentOrder, newItem];
        updateState({ currentOrder: newOrder });
        updateUI();
        addForm.reset();
        productSearchInput.value = '';
        selectedProduct = null;
        view.querySelector('#item-name').focus();
    });

    itemsContainer.addEventListener('click', e => {
        const b = e.target.closest('.remove-item-btn');
        if (b) {
            const newOrder = [...state.currentOrder];
            newOrder.splice(b.dataset.index, 1);
            updateState({ currentOrder: newOrder });
            updateUI();
        }
    });
    
    productSearchInput.addEventListener('input', () => {
        const searchTerm = productSearchInput.value.toLowerCase();
        if (searchTerm.length < 2) {
            searchResultsContainer.innerHTML = '';
            searchResultsContainer.classList.add('hidden');
            return;
        }
        const results = state.db.products.filter(p => p.name.toLowerCase().includes(searchTerm) && p.quantity > 0);
        if (results.length > 0) {
            searchResultsContainer.innerHTML = results.map(p => `
                <div class="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer" data-product-id="${p.id}">
                    <p class="font-semibold text-slate-800 dark:text-slate-200">${p.name}</p>
                    <p class="text-sm text-slate-500">Estoque: ${p.quantity} | ${formatCurrency(p.price)}</p>
                </div>
            `).join('');
            searchResultsContainer.classList.remove('hidden');
        } else {
            searchResultsContainer.classList.add('hidden');
        }
    });

    searchResultsContainer.addEventListener('click', (e) => {
        const resultDiv = e.target.closest('[data-product-id]');
        if (resultDiv) {
            const productId = resultDiv.dataset.productId;
            selectedProduct = state.db.products.find(p => p.id === productId);
            if (selectedProduct) {
                view.querySelector('#item-name').value = selectedProduct.name;
                view.querySelector('#item-value').value = selectedProduct.price;
            }
            productSearchInput.value = '';
            searchResultsContainer.classList.add('hidden');
        }
    });

    finalizeBtn.addEventListener('click', () => {
        modalContainer.classList.remove('hidden');
        const orderTotal = state.currentOrder.reduce((sum, i) => sum + i.value, 0);
        // ... Lógica para construir e popular o modal ...
        
        // Exemplo da lógica de submit do modal:
        modalContainer.querySelector('#finalize-order-form').addEventListener('submit', async e => {
            e.preventDefault();
            // ... (Toda a lógica de finalização da venda, batch, etc.)
            // No final:
            updateState({ currentOrder: [] });
            updateUI();
        }, { once: true }); // Adicione { once: true } para evitar múltiplos listeners
    });
    updateUI();
}

