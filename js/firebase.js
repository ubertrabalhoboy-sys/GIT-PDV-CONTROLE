// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyByZ1r41crqOadLXwHH2v9LgveyCkL6erE",
    authDomain: "pdv-vendas-8a65a.firebaseapp.com",
    projectId: "pdv-vendas-8a65a",
    storageBucket: "pdv-vendas-8a65a.appspot.com",
    messagingSenderId: "37533259212",
    appId: "1:37533259212:web:9e79fecb52aa2b4765b969",
    measurementId: "G-7PYWX52SEG"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
