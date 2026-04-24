import { 
  ref, 
  onValue, 
  set, 
  onDisconnect, 
  serverTimestamp as rtdbTimestamp 
} from 'firebase/database';
import { 
  doc, 
  setDoc, 
  serverTimestamp as firestoreTimestamp 
} from 'firebase/firestore';
import { rtdb, db, auth } from '../firebase';

export const presenceService = {
  setupPresence(uid: string) {
    if (!rtdb) return;
    const connectedRef = ref(rtdb, '.info/connected');
    const userStatusDatabaseRef = ref(rtdb, `/status/${uid}`);
    const userFirestoreRef = doc(db, 'users', uid);

    const isOfflineForDatabase = {
      state: 'offline',
      last_changed: rtdbTimestamp(),
    };

    const isOnlineForDatabase = {
      state: 'online',
      last_changed: rtdbTimestamp(),
    };

    onValue(connectedRef, (snapshot) => {
      if (snapshot.val() === false) {
        // Instead of setting offline here, we rely on onDisconnect
        return;
      }

      onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase).then(() => {
        set(userStatusDatabaseRef, isOnlineForDatabase);
        
        // Also update Firestore
        setDoc(userFirestoreRef, {
          status: 'online',
          lastSeen: firestoreTimestamp()
        }, { merge: true });
      });
    });

    // Handle offline state in Firestore when app is closed
    // This is tricky without a cloud function, but we can update Firestore on logout
  },

  async setOffline(uid: string) {
    const userFirestoreRef = doc(db, 'users', uid);

    if (rtdb) {
      const userStatusDatabaseRef = ref(rtdb, `/status/${uid}`);
      await set(userStatusDatabaseRef, {
        state: 'offline',
        last_changed: rtdbTimestamp(),
      });
    }

    await setDoc(userFirestoreRef, {
      status: 'offline',
      lastSeen: firestoreTimestamp()
    }, { merge: true });
  }
};
