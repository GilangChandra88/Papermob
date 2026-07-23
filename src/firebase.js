import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCbW7TUcI8ST0g9Otih7n1gZQxyepXd1n0",
  authDomain: "papermob-database.firebaseapp.com",
  projectId: "papermob-database",
  storageBucket: "papermob-database.firebasestorage.app",
  messagingSenderId: "1002832159484",
  appId: "1:1002832159484:web:309d17900a76e36e0c2d79",
  measurementId: "G-NYLRS3ZLVM"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
