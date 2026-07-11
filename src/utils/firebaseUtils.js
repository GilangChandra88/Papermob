import { db } from '../firebase'
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore'

export const createProject = async (userId, projectData) => {
  try {
    const docRef = await addDoc(collection(db, 'projects'), {
      userId,
      ...projectData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return docRef.id
  } catch (e) {
    console.error("Error adding document: ", e)
    throw e
  }
}

export const getProjects = async (userId) => {
  try {
    const q = query(collection(db, 'projects'), where('userId', '==', userId))
    const querySnapshot = await getDocs(q)
    const projects = []
    querySnapshot.forEach((doc) => {
      projects.push({ id: doc.id, ...doc.data() })
    })
    return projects.sort((a, b) => b.updatedAt?.toMillis() - a.updatedAt?.toMillis())
  } catch (e) {
    console.error("Error getting documents: ", e)
    throw e
  }
}

export const getProjectById = async (projectId) => {
  try {
    const docRef = doc(db, 'projects', projectId)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() }
    } else {
      throw new Error("Project not found")
    }
  } catch (e) {
    console.error("Error getting document: ", e)
    throw e
  }
}

export const updateProjectData = async (projectId, updateData) => {
  try {
    const docRef = doc(db, 'projects', projectId)
    await updateDoc(docRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    })
  } catch (e) {
    console.error("Error updating document: ", e)
    throw e
  }
}
