// ATENÇÃO: Essas credenciais são públicas e devem ser trocadas no seu painel Firebase.
const firebaseConfig = {
    apiKey: "AIzaSyByZ1r41crqOadLXwHH2v9LgveyCkL6erE",
    authDomain: "pdv-vendas-8a65a.firebaseapp.com",
    projectId: "pdv-vendas-8a65a",
    storageBucket: "pdv-vendas-8a65a.appspot.com",
    messagingSenderId: "37533259212",
    appId: "1:37533259212:web:9e79fecb52aa2b4765b969",
    measurementId: "G-7PYWX52SEG"
};

// Função para inicializar o Firebase
export function initializeFirebase() {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
}

// Exporta as instâncias dos serviços para serem usadas em outros módulos
export const auth = firebase.auth();
export const db = firebase.firestore();

// Habilitar persistência para manter o usuário logado
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => {
    console.log("Persistência de autenticação habilitada.");
  })
  .catch((error) => {
    console.error("Erro ao habilitar persistência:", error);
  });