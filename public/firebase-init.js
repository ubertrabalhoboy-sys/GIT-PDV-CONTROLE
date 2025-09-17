// public/firebase-init.js

// Importa as funções necessárias do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- ATENÇÃO ---
// COPIE SUAS CHAVES DO ARQUIVO script.js E COLE AQUI DENTRO
const firebaseConfig = {
  apiKey: "[...SUA CHAVE APIKEY...]",
  authDomain: "[...SEU AUTH DOMAIN...]",
  projectId: "[...SEU PROJECT ID...]",
  storageBucket: "[...SEU STORAGE BUCKET...]",
  messagingSenderId: "[...SEU MESSAGING SENDER ID...]",
  appId: "[...SEU APP ID...]",
  measurementId: "[...SEU MEASUREMENT ID...]"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta as variáveis 'db' e 'auth' para que o script.js possa usá-las
export const db = getFirestore(app);
export const auth = getAuth(app);