import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBz7RER9q16FnvmM26nXYIsEGnkjATOmR4",
  authDomain: "papermobweb.firebaseapp.com",
  projectId: "papermobweb",
  storageBucket: "papermobweb.firebasestorage.app",
  messagingSenderId: "16213375375",
  appId: "1:16213375375:web:af185fd88f79af5aec73fa",
  measurementId: "G-N55TL4W619"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
