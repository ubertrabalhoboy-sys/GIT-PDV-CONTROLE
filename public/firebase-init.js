// public/firebase-init.js

// Importa as funções necessárias do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- ATENÇÃO ---
// COPIE SUAS CHAVES DO ARQUIVO script.js E COLE AQUI DENTRO
const firebaseConfig = {
  piKey: "AIzaSyByZ1r41crqOadLXwHH2v9LgveyCkL6erE",
        authDomain: "pdv-vendas-8a65a.firebaseapp.com",
        projectId: "pdv-vendas-8a65a",
        storageBucket: "pdv-vendas-8a65a.appspot.com",
        messagingSenderId: "37533259212",
        appId: "1:37533259212:web:9e79fecb52aa2b4765b969",
        measurementId: "G-7PYWX52SEG"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta as variáveis 'db' e 'auth' para que o script.js possa usá-las
export const db = getFirestore(app);
export const auth = getAuth(app);