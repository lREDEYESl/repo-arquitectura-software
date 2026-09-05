import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

/**
 * Reemplaza estos valores con los de tu proyecto Firebase
 * (Consola Firebase > Configuración del proyecto > Tus apps).
 */
const firebaseConfig = {
  apiKey: "AIzaSyA62y7ARo95dK6VLBv8U1zai8rI_YNOrfI",
  authDomain: "repo-tareas-universidad.firebaseapp.com",
  projectId: "repo-tareas-universidad",
  storageBucket: "repo-tareas-universidad.firebasestorage.app",
  messagingSenderId: "844847743763",
  appId: "1:844847743763:web:d21656573e5e7d9b6990e6"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
