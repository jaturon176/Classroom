/**
 * Firebase Realtime Database Service (Cloud Real-Time NoSQL Database)
 * Project: classroom-app-4bd14
 * Database URL: https://classroom-app-4bd14-default-rtdb.firebaseio.com
 * 
 * Features:
 * 1. 🌐 Cloud Real-Time NoSQL DB: Heart of 0.1s live sync across all devices (PC, iPad, iPhone, Android).
 * 2. 📱 Browser LocalStorage Cache: Offline Local Key-Value storage fallback for 0ms initial load.
 * 3. 🔄 Automatic Event Dispatcher: Notifies active UI modules to update live when data changes remotely.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getDatabase, ref, onValue, set, update, remove } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { INITIAL_USERS, INITIAL_COURSES, INITIAL_ANNOUNCEMENTS, INITIAL_HOMEWORK, SAMPLE_QUIZ, INITIAL_ATTENDANCE } from './sampleDataService.js';
import { autoFixObjectMojibake } from './mojibakeDecoder.js';
import { syncEngine } from './syncEngine.js';

export const FIREBASE_CONFIG = {
  projectId: "classroom-app-4bd14",
  databaseURL: "https://classroom-app-4bd14-default-rtdb.firebaseio.com"
};

class FirebaseRealtimeService {
  constructor() {
    this.app = null;
    this.db = null;
    this.isRealtimeConnected = false;
    this.collections = ['users', 'courses', 'homework', 'quizzes', 'announcements', 'attendance'];
    
    this.initLocalStore();
    this.initFirebaseRealtime();
  }

  // 1. 📱 Browser LocalStorage Initialization (Cache & Offline Fallback)
  initLocalStore() {
    if (!localStorage.getItem('ag_users')) {
      localStorage.setItem('ag_users', JSON.stringify(INITIAL_USERS));
    }
    if (!localStorage.getItem('ag_courses')) {
      localStorage.setItem('ag_courses', JSON.stringify(INITIAL_COURSES));
    }
    if (!localStorage.getItem('ag_announcements')) {
      localStorage.setItem('ag_announcements', JSON.stringify(INITIAL_ANNOUNCEMENTS));
    }
    if (!localStorage.getItem('ag_homework')) {
      localStorage.setItem('ag_homework', JSON.stringify(INITIAL_HOMEWORK));
    }
    if (!localStorage.getItem('ag_quizzes')) {
      localStorage.setItem('ag_quizzes', JSON.stringify([SAMPLE_QUIZ]));
    }
    if (!localStorage.getItem('ag_attendance')) {
      localStorage.setItem('ag_attendance', JSON.stringify(INITIAL_ATTENDANCE));
    }
  }

  // 2. 🌐 Firebase Realtime Database Setup & 0.1s Live Sync Subscriptions
  initFirebaseRealtime() {
    try {
      this.app = initializeApp(FIREBASE_CONFIG);
      this.db = getDatabase(this.app);
      this.isRealtimeConnected = true;
      console.log('🌐 Firebase Realtime Database Connected (0.1s Live Sync Ready)');

      // Subscribe to all collection nodes for 0.1s Realtime Sync
      this.collections.forEach(key => {
        const colRef = ref(this.db, key);
        onValue(colRef, (snapshot) => {
          const val = snapshot.val();
          if (val) {
            let itemsArray = [];
            if (Array.isArray(val)) {
              itemsArray = val.filter(Boolean);
            } else if (typeof val === 'object') {
              itemsArray = Object.keys(val).map(k => {
                const item = val[k];
                return typeof item === 'object' && item !== null ? { id: k, ...item } : item;
              });
            }

            if (itemsArray.length > 0) {
              // Update local cache seamlessly
              this.saveCollection(key, itemsArray, false);
              
              // Broadcast realtime update event to refresh UI across all devices
              window.dispatchEvent(new CustomEvent('ag_realtime_update', {
                detail: { collection: key, items: itemsArray }
              }));
            }
          }
        }, (error) => {
          console.warn(`Realtime DB subscription notice for ${key}:`, error);
        });
      });
    } catch (err) {
      console.warn('Firebase Realtime Database offline/fallback mode active:', err);
      this.isRealtimeConnected = false;
    }
  }

  // 3. 📱 Read Collection from Local Storage Cache (with Mojibake Thai Repair)
  getCollection(key) {
    const raw = localStorage.getItem('ag_' + key) || '[]';
    try {
      const parsed = JSON.parse(raw);
      return autoFixObjectMojibake(parsed);
    } catch (e) {
      return [];
    }
  }

  // 4. Save Collection to Local Storage & Sync to Firebase Realtime DB
  saveCollection(key, items, syncToCloud = true) {
    localStorage.setItem('ag_' + key, JSON.stringify(items));

    if (syncToCloud && this.isRealtimeConnected && this.db) {
      try {
        const colRef = ref(this.db, key);
        // Store as array or object map
        const dataMap = {};
        items.forEach(item => {
          if (item && item.id) {
            dataMap[item.id] = item;
          }
        });
        set(colRef, dataMap).catch(err => console.warn('Cloud write notice:', err));
      } catch (e) {
        console.warn('Realtime cloud save fallback:', e);
      }
    }
  }

  // 5. Generic Item Operations (Optimistic UI + Realtime DB Sync)
  addItem(collectionKey, item) {
    const items = this.getCollection(collectionKey);
    const newItem = { ...item, id: item.id || (collectionKey.slice(0,3) + '_' + Date.now()) };
    items.unshift(newItem);
    this.saveCollection(collectionKey, items, true);

    // Push to Realtime DB node directly
    if (this.isRealtimeConnected && this.db) {
      const itemRef = ref(this.db, `${collectionKey}/${newItem.id}`);
      set(itemRef, newItem).catch(err => console.warn('Direct RTDB set notice:', err));
    } else {
      syncEngine.enqueue({ collection: collectionKey, action: 'add', item: newItem });
    }

    return newItem;
  }

  updateItem(collectionKey, id, updates) {
    const items = this.getCollection(collectionKey);
    const index = items.findIndex(x => x.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...updates };
      this.saveCollection(collectionKey, items, true);

      if (this.isRealtimeConnected && this.db) {
        const itemRef = ref(this.db, `${collectionKey}/${id}`);
        update(itemRef, updates).catch(err => console.warn('Direct RTDB update notice:', err));
      } else {
        syncEngine.enqueue({ collection: collectionKey, action: 'update', id, updates });
      }
      return items[index];
    }
    return null;
  }

  deleteItem(collectionKey, id) {
    let items = this.getCollection(collectionKey);
    items = items.filter(x => x.id !== id);
    this.saveCollection(collectionKey, items, true);

    if (this.isRealtimeConnected && this.db) {
      const itemRef = ref(this.db, `${collectionKey}/${id}`);
      remove(itemRef).catch(err => console.warn('Direct RTDB delete notice:', err));
    } else {
      syncEngine.enqueue({ collection: collectionKey, action: 'delete', id });
    }
  }

  // 6. Bulk Student Import
  importStudents(studentsList) {
    const current = this.getCollection('users');
    const fixedList = autoFixObjectMojibake(studentsList);
    
    fixedList.forEach(st => {
      const existingIdx = current.findIndex(u => u.studentId === st.studentId || u.email === st.email);
      if (existingIdx !== -1) {
        current[existingIdx] = { ...current[existingIdx], ...st };
      } else {
        current.push({ ...st, id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2,4) });
      }
    });

    this.saveCollection('users', current, true);
    return current;
  }

  // 7. Batch Delete Students by Room or Grade
  batchDeleteStudents(filterType, filterValue) {
    let users = this.getCollection('users');
    const initialCount = users.length;

    users = users.filter(u => {
      if (u.role !== 'Student') return true;
      if (filterType === 'room' && u.room === filterValue) return false;
      if (filterType === 'grade' && u.grade === filterValue) return false;
      return true;
    });

    const deletedCount = initialCount - users.length;
    this.saveCollection('users', users, true);
    return deletedCount;
  }

  // 8. Quiz Draft Auto-append
  appendQuizDraft(quizData) {
    const quizzes = this.getCollection('quizzes');
    const existingIndex = quizzes.findIndex(q => q.id === quizData.id);
    
    if (existingIndex !== -1) {
      quizzes[existingIndex] = quizData;
    } else {
      quizzes.unshift(quizData);
    }

    this.saveCollection('quizzes', quizzes, true);
    localStorage.setItem('antigravity_quiz_draft', JSON.stringify(quizData));
    return quizData;
  }

  getQuizDraft() {
    const raw = localStorage.getItem('antigravity_quiz_draft');
    if (!raw) return null;
    try {
      return autoFixObjectMojibake(JSON.parse(raw));
    } catch(e) {
      return null;
    }
  }

  clearQuizDraft() {
    localStorage.removeItem('antigravity_quiz_draft');
  }
}

export const firebaseRealtimeService = new FirebaseRealtimeService();
// Export as firebaseService for seamless backward compatibility
export const firebaseService = firebaseRealtimeService;
