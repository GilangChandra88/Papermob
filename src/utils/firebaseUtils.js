import { db } from '../firebase'
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, serverTimestamp, onSnapshot, setDoc, orderBy, limit, writeBatch, deleteField } from 'firebase/firestore'

export const createProject = async (userId, projectData) => {
  try {
    const colors = projectData.colors && projectData.colors.length > 0 ? projectData.colors : ['#ffffff'];
    const positions = projectData.positions && projectData.positions.length > 0 ? projectData.positions : ['J'];
    const hasTransition = projectData.hasTransition || false;

    const grid = {};
    const transitions = {};

    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    let randomPos = positions[Math.floor(Math.random() * positions.length)];
    if (randomPos === 'jongkok') randomPos = 'J';
    else if (randomPos === 'berdiri') randomPos = 'B';

    for (let c = 1; c <= projectData.width; c++) {
      let colStr = '';
      let temp = c;
      while (temp > 0) {
        let m = (temp - 1) % 26;
        colStr = String.fromCharCode(65 + m) + colStr;
        temp = Math.floor((temp - m) / 26);
      }
      for (let r = 1; r <= projectData.height; r++) {
        const coord = `${colStr}${r}`;
        grid[coord] = { color: randomColor, pos: randomPos };
        if (hasTransition) {
          transitions[coord] = { step: 1 };
        }
      }
    }

    const defaultPattern = {
      id: 1,
      name: 'Pola 1 - Untitled',
      grid,
      transitions
    };

    const projectRef = doc(collection(db, 'projects'));
    const patternRef = doc(db, `projects/${projectRef.id}/patterns`, '1');
    const batch = writeBatch(db);

    batch.set(projectRef, {
      userId,
      ...projectData,
      patternOrder: [1],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      sharingSettings: { mode: 'restricted' }, // 'restricted', 'link_viewer', 'link_editor'
      sharedEmails: [],
      sharedWith: {} // email -> { role: 'editor' | 'viewer' }
    });
    
    batch.set(patternRef, defaultPattern);

    await batch.commit();
    return projectRef.id;
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

export const restoreProject = async (projectId, backupPatterns) => {
  try {
    const batch = writeBatch(db);
    const projectRef = doc(db, 'projects', projectId);
    
    // First, clear existing patterns to ensure no leftover ghost patterns
    const patternsRef = collection(db, `projects/${projectId}/patterns`);
    const existingPatterns = await getDocs(patternsRef);
    existingPatterns.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    
    // Write the new patterns
    const patternOrder = [];
    backupPatterns.forEach(pattern => {
      if (pattern && pattern.id) {
        const pRef = doc(db, `projects/${projectId}/patterns`, pattern.id.toString());
        batch.set(pRef, pattern);
        patternOrder.push(pattern.id);
      }
    });
    
    batch.update(projectRef, {
      patternOrder,
      updatedAt: serverTimestamp()
    });
    
    await batch.commit();
  } catch (e) {
    console.error("Error restoring project: ", e);
    throw e;
  }
}

// ==========================================
// DELTA UPDATES & BATCHING
// ==========================================

let pendingUpdates = {};
let isFlushing = false;

export const queueDeltaUpdate = (projectId, updates) => {
  // Merge new updates into the pending queue
  pendingUpdates = { ...pendingUpdates, ...updates };

  if (isFlushing) return; // If a batch is already scheduled, don't schedule another

  const flushQueue = () => {
    isFlushing = true;
    setTimeout(async () => {
      if (Object.keys(pendingUpdates).length === 0) {
        isFlushing = false;
        return;
      }

      const dataToSend = { ...pendingUpdates };
      pendingUpdates = {}; // Clear queue immediately
      
      try {
        const batch = writeBatch(db);
        const projectRef = doc(db, 'projects', projectId);
        const projectUpdates = { updatedAt: serverTimestamp() };
        
        const patternUpdatesMap = {}; 
        const patternsToSet = {}; 
        const patternsToDelete = new Set();

        for (const [key, value] of Object.entries(dataToSend)) {
          const match = key.match(/^patternsMap\.([^.]+)(?:\.(.*))?$/);
          
          if (match) {
            const patternId = match[1];
            const restPath = match[2];
            
            if (restPath) {
              if (!patternUpdatesMap[patternId]) patternUpdatesMap[patternId] = {};
              patternUpdatesMap[patternId][restPath] = value;
            } else {
              if (value === null) {
                patternsToDelete.add(patternId);
              } else {
                patternsToSet[patternId] = value;
              }
            }
          } else {
            projectUpdates[key] = value;
          }
        }
        
        for (const patternId of patternsToDelete) {
          const pRef = doc(db, `projects/${projectId}/patterns`, patternId);
          batch.delete(pRef);
        }
        
        for (const [patternId, fullObj] of Object.entries(patternsToSet)) {
          const pRef = doc(db, `projects/${projectId}/patterns`, patternId);
          batch.set(pRef, fullObj, { merge: true });
        }
        
        for (const [patternId, pUpdates] of Object.entries(patternUpdatesMap)) {
          const pRef = doc(db, `projects/${projectId}/patterns`, patternId);
          if (!patternsToSet[patternId] && !patternsToDelete.has(patternId)) {
            // Check if document exists first or use set with merge for dot-notation?
            // Actually, update will fail if doc doesn't exist, but it should exist.
            batch.update(pRef, pUpdates);
          }
        }
        
        batch.update(projectRef, projectUpdates);
        await batch.commit();
      } catch (e) {
        console.error("Error flushing delta updates:", e);
        window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Sync Error: ' + e.message }));
      } finally {
        isFlushing = false; // Mark as done AFTER Firestore confirms
        
        // If user queued more updates while we were flushing, trigger next batch immediately
        if (Object.keys(pendingUpdates).length > 0) {
          flushQueue();
        }
      }
    }, 1000); // 1-second batching window
  };

  flushQueue();
}

export const getPendingUpdates = () => {
  return { ...pendingUpdates };
}

export const hasPendingUpdates = () => {
  return Object.keys(pendingUpdates).length > 0 || isFlushing;
}

// ==========================================
// COLLABORATION & REAL-TIME
// ==========================================

export const subscribeToProject = (projectId, callback) => {
  const docRef = doc(db, 'projects', projectId);
  
  let projectData = null;
  let patternsMap = {};
  
  const notifyCallback = () => {
    if (projectData) {
      callback({
        ...projectData,
        patternsMap
      });
    }
  };

  const unsubscribeProject = onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = { id: docSnap.id, ...docSnap.data() };
      
      // Auto-migrate legacy patterns array to patternsMap & patternOrder
      if (data.patterns && Array.isArray(data.patterns) && !data.patternsMap) {
        const pMap = {};
        const patternOrder = [];
        data.patterns.forEach(p => {
          pMap[p.id] = p;
          patternOrder.push(p.id);
        });
        
        // Let the next migration block handle moving it to subcollections
        data.patternsMap = pMap;
        data.patternOrder = patternOrder;
        delete data.patterns;
      }

      // Auto-migrate monolithic patternsMap to subcollections
      if (data.patternsMap) {
        const batch = writeBatch(db);
        Object.values(data.patternsMap).forEach(pattern => {
          if (pattern && pattern.id) {
            const pRef = doc(db, `projects/${projectId}/patterns`, pattern.id.toString());
            batch.set(pRef, pattern);
          }
        });
        
        batch.update(docRef, { 
          patternsMap: deleteField(),
          patterns: deleteField() 
        });
        
        batch.commit().catch(e => console.error("Migration error:", e));
      }

      delete data.patternsMap; 
      projectData = data;
      notifyCallback();
    }
  });

  const patternsRef = collection(db, `projects/${projectId}/patterns`);
  const unsubscribePatterns = onSnapshot(patternsRef, (snapshot) => {
    const newPatternsMap = { ...patternsMap };
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added' || change.type === 'modified') {
        newPatternsMap[change.doc.id] = change.doc.data();
      }
      if (change.type === 'removed') {
        delete newPatternsMap[change.doc.id];
      }
    });
    patternsMap = newPatternsMap;
    notifyCallback();
  });

  return () => {
    unsubscribeProject();
    unsubscribePatterns();
  };
};

export const updateCursor = async (projectId, userId, cursorData) => {
  if (!userId) return;
  const cursorRef = doc(db, `projects/${projectId}/cursors`, userId);
  await setDoc(cursorRef, {
    ...cursorData,
    updatedAt: serverTimestamp()
  });
};

export const subscribeToCursors = (projectId, callback) => {
  const cursorsRef = collection(db, `projects/${projectId}/cursors`);
  return onSnapshot(cursorsRef, (snapshot) => {
    const cursors = {};
    snapshot.forEach((docSnap) => {
      cursors[docSnap.id] = docSnap.data();
    });
    callback(cursors);
  });
};

export const getSharedProjects = async (email) => {
  if (!email) return [];
  try {
    const q = query(collection(db, 'projects'), where('sharedEmails', 'array-contains', email));
    const querySnapshot = await getDocs(q);
    const projects = [];
    querySnapshot.forEach((doc) => {
      projects.push({ id: doc.id, ...doc.data() });
    });
    return projects.sort((a, b) => b.updatedAt?.toMillis() - a.updatedAt?.toMillis());
  } catch (e) {
    console.error("Error getting shared projects: ", e);
    return [];
  }
};

// ==========================================
// RECOVERY MODE (BACKUPS)
// ==========================================

export const createBackup = async (projectId, patterns, description = "Auto Backup") => {
  try {
    const backupsRef = collection(db, `projects/${projectId}/backups`);
    await addDoc(backupsRef, {
      patterns,
      description,
      createdAt: serverTimestamp()
    });
    
    // Update lastBackupAt in project
    await updateDoc(doc(db, 'projects', projectId), {
      lastBackupAt: serverTimestamp()
    });
  } catch (e) {
    console.error("Error creating backup: ", e);
  }
};

export const getBackups = async (projectId) => {
  try {
    const q = query(collection(db, `projects/${projectId}/backups`), orderBy('createdAt', 'desc'), limit(20));
    const querySnapshot = await getDocs(q);
    const backups = [];
    querySnapshot.forEach((doc) => {
      backups.push({ id: doc.id, ...doc.data() });
    });
    return backups;
  } catch (e) {
    console.error("Error getting backups: ", e);
    return [];
  }
};
