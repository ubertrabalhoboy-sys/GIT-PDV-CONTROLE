/**
 * Script de Verificação de Sanidade para Desenvolvimento.
 * Executa pequenos testes de fumaça para verificar se os módulos principais estão funcionando.
 *
 * @file Script de teste de fumo em desenvolvimento.
 * @summary Verifica as importações e a funcionalidade básica para acelerar o desenvolvimento.
 */
import { auth, db } from './firebaseConfig.js';
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { buildPaginatedQuery } from './pagination.js';
import { collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { DEBUG } from './utils.js';

export function runChecks() {
    if (!DEBUG) return;
    
    console.group("🚀 Development Sanity Checks 🚀");

    // 1. Firebase SDK
    try {
        getAuth();
        console.log("✅ Firebase Auth SDK imported successfully.");
    } catch (e) {
        console.error("❌ Firebase Auth SDK import failed.", e);
    }

    // 2. Auth Persistence Check
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log(`✅ Auth Persistence: User ${user.email} is signed in.`);
        } else {
            console.log("✅ Auth Persistence: No user is signed in.");
        }
    });

    // 3. Pagination Function Check
    try {
        const ref = collection(db, 'products');
        const q = buildPaginatedQuery(ref, { storeId: 'test-store-id' });
        if (q) {
            console.log("✅ Pagination: buildPaginatedQuery function created a query successfully.");
        } else {
            throw new Error("Query is undefined");
        }
    } catch (e) {
        console.error("❌ Pagination: buildPaginatedQuery function failed.", e);
    }

    console.groupEnd();
}