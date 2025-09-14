# PDV Modular - Ponto de Venda Refatorado

Este é um sistema de Ponto de Venda (PDV) completo, refatorado a partir de um código legado para uma arquitetura moderna de ES Módulos. Ele usa Vanilla JavaScript, TailwindCSS e Firebase.

## Como Executar Localmente

1.  **Servidor Local**: Como este projeto usa ES Modules, você precisa servi-lo a partir de um servidor web local. Você não pode simplesmente abrir o `index.html` pelo sistema de arquivos (`file://`).
    * Se você tem o VS Code, a extensão **Live Server** é a maneira mais fácil de fazer isso. Clique com o botão direito no `index.html` e selecione "Open with Live Server".
    * Alternativamente, se você tiver o Node.js instalado, pode usar um pacote como o `serve`:
        ```bash
        npm install -g serve
        serve .
        ```

2.  **Configuração do Firebase**:
    * Abra o arquivo `src/firebaseConfig.js`.
    * Substitua o objeto `firebaseConfig` de placeholder pelo objeto de configuração real do seu projeto Firebase.

    ```javascript
    // src/firebaseConfig.js

    // COLE AQUI O OBJETO DE CONFIGURAÇÃO DO SEU FIREBASE
    const firebaseConfig = {
      apiKey: "AIza...",
      authDomain: "your-project.firebaseapp.com",
      projectId: "your-project",
      storageBucket: "your-project.appspot.com",
      messagingSenderId: "...",
      appId: "1:...:web:...",
      measurementId: "G-..."
    };
    ```

## Regras de Segurança do Firestore (Recomendação)

**IMPORTANTE**: Para produção, você **DEVE** configurar as Regras de Segurança no console do Firebase para proteger seus dados. As regras abaixo são um ponto de partida básico e não devem ser usadas em produção sem uma análise de segurança completa.

```js
// Exemplo de regras de segurança para o Firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper function to check if user has a specific role in a store
    function isRoleInStore(storeId, role) {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.storeId == storeId
             && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == role;
    }

    function isManagerOrSuperAdmin(storeId) {
       let userRole = get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
       return (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.storeId == storeId && userRole == 'gerente') || userRole == 'superadmin';
    }

    // Stores and Settings can be read by any authenticated user, but only written by superadmin
    match /stores/{storeId} {
      allow read: if request.auth != null;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'superadmin';
    }
    match /settings/{storeId} {
      allow read: if request.auth != null;
      allow write: if isManagerOrSuperAdmin(storeId);
    }

    // Data is scoped by storeId
    match /{collection}/{docId} {
      allow read: if request.auth != null && resource.data.storeId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.storeId;

      // Allow create if the data belongs to the user's store
      allow create: if request.auth != null && request.resource.data.storeId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.storeId;

      // Allow update/delete for managers of that store
      allow update, delete: if isManagerOrSuperAdmin(resource.data.storeId);
    }

     // Sales can be created by vendedores
    match /sales/{saleId} {
        allow create: if request.auth != null && request.resource.data.storeId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.storeId;
    }
  }
}