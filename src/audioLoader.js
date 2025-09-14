/**
 * Carregador de Áudio Sob Demanda.
 * Instancia o AudioContext e o Tone.js apenas quando necessário (primeiro clique na roleta),
 * para melhorar a performance de carregamento inicial.
 *
 * @file Gestor de áudio preguiçoso.
 * @summary Evita a inicialização de áudio no arranque da aplicação.
 */

let audioContext = null;
let synth = null;
let isInitialized = false;

/**
 * Inicializa e retorna o AudioContext global.
 * @returns {Promise<AudioContext>}
 */
export async function getAudioContext() {
    if (!isInitialized) {
        await initializeAudio();
    }
    return audioContext;
}

/**
 * Inicializa e retorna a instância do sintetizador Tone.js.
 * @returns {Tone.Synth}
 */
export const getSynth = () => {
    // Garante que a inicialização ocorreu, mesmo que getAudioContext não tenha sido chamado antes.
    if (!isInitialized) {
        console.warn("Audio not initialized. Call getAudioContext() on a user gesture first.");
        return null;
    }
    return synth;
};

/**
 * Inicializa o contexto de áudio e o sintetizador. Deve ser chamado por um gesto do usuário.
 */
async function initializeAudio() {
    if (isInitialized) return;
    try {
        // Tone.start() anexa o AudioContext a um gesto do usuário
        await Tone.start();
        audioContext = Tone.context;
        synth = new Tone.Synth().toDestination();
        isInitialized = true;
        console.log("Audio context and synth initialized successfully.");
    } catch (error) {
        console.error("Failed to initialize audio:", error);
    }
}