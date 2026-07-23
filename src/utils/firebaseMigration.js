import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db as newDb } from "../firebase";

const firebaseConfigOld = {
  apiKey: "AIzaSyBz7RER9q16FnvmM26nXYIsEGnkjATOmR4",
  authDomain: "papermobweb.firebaseapp.com",
  projectId: "papermobweb",
  storageBucket: "papermobweb.firebasestorage.app",
  messagingSenderId: "16213375375",
  appId: "1:16213375375:web:af185fd88f79af5aec73fa",
  measurementId: "G-N55TL4W619"
};

// Initialize secondary app
const oldApp = initializeApp(firebaseConfigOld, "oldApp");
export const oldAuth = getAuth(oldApp);
export const oldDb = getFirestore(oldApp);

export const getOldProjects = async (oldUserId) => {
  const q = query(collection(oldDb, 'projects'), where('userId', '==', oldUserId));
  const querySnapshot = await getDocs(q);
  const projects = [];
  querySnapshot.forEach((doc) => {
    projects.push({ id: doc.id, ...doc.data() });
  });
  return projects;
};

export const migrateProjectToNewDb = async (newUserId, oldProjectData) => {
  const { id: oldId, ...projectWithoutId } = oldProjectData;
  
  // Overwrite userId with new userId
  const newProjectData = {
    ...projectWithoutId,
    userId: newUserId,
    createdAt: oldProjectData.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(newDb, 'projects'), newProjectData);
  return docRef.id;
};
