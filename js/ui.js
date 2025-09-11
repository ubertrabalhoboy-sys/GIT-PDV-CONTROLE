// js/ui.js
// Modal de WhatsApp, Roleta (bonus wheel) e Prêmio (código fiel ao original)
// Baseado em funções extraídas de scriptoficial.js: showWhatsAppModal, showBonusWheelModal, showPrizeWonModal :contentReference[oaicite:4]{index=4} :contentReference[oaicite:5]{index=5}.

import { db } from './firebase.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { formatCurrency } from './utils.js';

// showWhatsAppModal(saleData, state)
export function showWhatsAppModal(saleData, state) {
  const modal = document.getElementById('whatsapp-confirm-modal');
  if (!modal) return;

  const storeName = state.db.settings.storeName || state.selectedStore?.name || '';
  const saleDate = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  let itemsText = saleData.items.map(item =>
    `- ${item.name} (${item.exchange}) - ${formatCurrency(item.value)}`
  ).join('\n');

  let paymentText = (saleData.paymentMethods || [])
    .map(p => {
      let paymentString = `- ${p.method}: ${formatCurrency(p.amount)}`;
      if (p.installments) paymentString += ` (em ${p.installments})`;
      return paymentString;
    }).join('\n');
  if (!paymentText) {
    paymentText = `- ${saleData.paymentMethod}: ${formatCurrency(saleData.total)}`;
  }

  let prizeText = '';
  if (saleData.prizeWon) {
    prizeText = `\n\n🎁 *Prêmio Ganho na Roleta!*\nParabéns! Você ganhou: *${saleData.prizeWon}*`;
  }

  const couponText = `🧾 *Comprovante de Venda* 🧾\n\n*${storeName}*\n\n*Data:* ${saleDate}\n*Cliente:* ${saleData.clientName}\n\n*Itens:*\n${itemsText}\n\n*Pagamento:*\n${paymentText}\n\n*Total:* *${formatCurrency(saleData.total)}*\n*Vendedor:* ${saleData.vendedor}${prizeText}\n\nObrigado pela sua compra!`;

  const whatsAppNumber = (saleData.clientPhone || '').replace(/\D/g, '');
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
        <button id="send-whatsapp-btn" class="bg-green-500 text-white py-2 px-4 rounded-md ${!whatsAppNumber ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-600'}" ${!whatsAppNumber ? 'disabled' : ''}>Enviar via WhatsApp</button>
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
    }, { once: true });
  }
}

// showBonusWheelModal(saleData, state)
// Reproduz a roleta com som (Tone.js) e lógica de probabilidades igual ao original.
// Ao terminar, atualiza o documento da venda com prizeWon usando updateDoc (mesma lógica do original) :contentReference[oaicite:6]{index=6}.
export async function showBonusWheelModal(saleData, state) {
  const modal = document.getElementById('bonus-wheel-modal');
  if (!modal) return;
  const wheelConfig = state.db.settings?.bonusWheel || { enabled: false, prizes: [] };
  const prizes = wheelConfig.prizes || [];
  if (prizes.length === 0) return;

  const segmentAngle = 360 / prizes.length;
  const segmentsHTML = prizes.map(p => `<div class="wheel-segment" style="transform: rotate(${prizes.indexOf(p) * segmentAngle}deg)">${p.name}</div>`).join('');

  modal.innerHTML = `
    <div class="custom-card rounded-lg shadow-xl w-full max-w-md p-6 m-4 fade-in text-center">
      <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-2">Parabéns!</h2>
      <p class="text-slate-600 dark:text-slate-400 mb-4">O cliente ganhou o direito de girar a roleta!</p>
      <div class="wheel-container">
        <div class="wheel-pointer"></div>
        <div class="wheel">${segmentsHTML}</div>
        <div class="wheel-center"></div>
      </div>
      <button id="spin-wheel-btn" class="w-full bg-brand-secondary text-white py-3 px-4 rounded-md hover:bg-green-700 transition-colors text-lg font-bold mt-4">GIRAR A ROLETA</button>
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

    // start audio (Tone.js) — igual ao original
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

    // sorteio ponderado por probability (igual original)
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
      clearInterval(slowDownInterval);

      try {
        await updateDoc(doc(db, "sales", saleData.id), { prizeWon: winningPrize.name });
        saleData.prizeWon = winningPrize.name;
      } catch (error) {
        console.error("Erro ao atualizar a venda com o prêmio:", error);
      }

      modal.classList.add('hidden');
      showPrizeWonModal(winningPrize, saleData);
    }, 6000);
  }, { once: true });
}

// showPrizeWonModal
export function showPrizeWonModal(prize, saleData) {
  const modal = document.getElementById('prize-won-modal');
  if (!modal) return;
  modal.innerHTML = `
    <div class="custom-card rounded-lg shadow-xl w-full max-w-md p-6 m-4 fade-in text-center">
      <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-2">🎉 Prêmio!</h2>
      <p class="text-slate-600 dark:text-slate-400 mb-4">O cliente ganhou: <strong>${prize.name}</strong></p>
      <p class="text-sm text-slate-500 mb-4">${prize.description || ''}</p>
      <div class="flex gap-3 justify-center">
        <button id="close-prize-modal" class="bg-brand-primary text-white py-2 px-4 rounded-md">Fechar</button>
      </div>
    </div>
  `;
  modal.classList.remove('hidden');
  modal.querySelector('#close-prize-modal')?.addEventListener('click', () => modal.classList.add('hidden'), { once: true });
}
