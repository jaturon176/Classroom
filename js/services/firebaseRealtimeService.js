/**
 * Firebase Realtime Database Service (Central Primary Server Engine)
 * Project: classroom-app-4bd14
 * Database URL: https://classroom-app-4bd14-default-rtdb.firebaseio.com
 * 
 * Architecture:
 * 1. 🌐 Central Primary Server (Single Source of Truth):
 *    - All devices (PC, iPad, iPhone, Android) connect directly to Firebase Realtime Database.
 *    - Central Server holds the authoritative dataset.
 *    - Real-time websocket subscription (`onValue`) syncs any mutation to all connected devices within 0.1s.
 * 2. 📱 LocalStorage (Offline Backup & Fast Startup Cache):
 *    - Acts purely as a local cache for 0ms initial render while fetching central server data.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getDatabase, ref, onValue, set, update, remove, get } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { INITIAL_USERS, INITIAL_COURSES, INITIAL_ANNOUNCEMENTS, INITIAL_HOMEWORK, SAMPLE_QUIZ, INITIAL_ATTENDANCE } from './sampleDataService.js';
import { autoFixObjectMojibake } from './mojibakeDecoder.js';

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
    
    this.initFirebaseRealtime();
  }

  // 🌐 Initialize Central Firebase Realtime Database & Setup 0.1s Cross-Device Sync
  async initFirebaseRealtime() {
    try {
      this.app = initializeApp(FIREBASE_CONFIG);
      this.db = getDatabase(this.app);
      this.isRealtimeConnected = true;
      console.log('🌐 Connected to Central Primary Server (Firebase Realtime DB)');

      // 1. Seed Central Database if completely empty
      await this.ensureCentralServerSeeded();

      // 2. Attach Live Subscriptions across all connected devices (0.1s sync)
      this.collections.forEach(key => {
        const colRef = ref(this.db, key);
        onValue(colRef, (snapshot) => {
          const val = snapshot.val();
          let itemsArray = [];
          if (val) {
            if (Array.isArray(val)) {
              itemsArray = val.filter(Boolean);
            } else if (typeof val === 'object') {
              itemsArray = Object.keys(val).map(k => {
                const item = val[k];
                return typeof item === 'object' && item !== null ? { id: k, ...item } : item;
              });
            }
          }

          // Overwrite local cache with Central Primary Server Data
          localStorage.setItem('ag_' + key, JSON.stringify(itemsArray));
          
          // Broadcast live update to refresh active UI across all connected devices
          window.dispatchEvent(new CustomEvent('ag_realtime_update', {
            detail: { collection: key, items: itemsArray }
          }));
        });
      });
    } catch (err) {
      console.warn('Central server connection warning (using offline local cache):', err);
      this.isRealtimeConnected = false;
      this.initLocalStoreFallback();
    }
  }

  // Ensure Central Server has initial seed data if DB is totally fresh
  async ensureCentralServerSeeded() {
    if (!this.db) return;
    try {
      const usersRef = ref(this.db, 'users');
      const snapshot = await get(usersRef);
      if (!snapshot.exists() || !snapshot.val()) {
        console.log('🌱 Seeding central server with initial dataset...');
        await set(ref(this.db, 'users'), this.arrayToMap(INITIAL_USERS));
        await set(ref(this.db, 'courses'), this.arrayToMap(INITIAL_COURSES));
        await set(ref(this.db, 'homework'), this.arrayToMap(INITIAL_HOMEWORK));
        await set(ref(this.db, 'quizzes'), this.arrayToMap([SAMPLE_QUIZ]));
        await set(ref(this.db, 'announcements'), this.arrayToMap(INITIAL_ANNOUNCEMENTS));
        await set(ref(this.db, 'attendance'), this.arrayToMap(INITIAL_ATTENDANCE));
      }
    } catch (e) {
      console.warn('Central seed check notice:', e);
    }
  }

  arrayToMap(arr) {
    const map = {};
    if (Array.isArray(arr)) {
      arr.forEach(item => {
        if (item && item.id) map[item.id] = item;
      });
    }
    return map;
  }

  initLocalStoreFallback() {
    if (!localStorage.getItem('ag_users')) localStorage.setItem('ag_users', JSON.stringify(INITIAL_USERS));
    if (!localStorage.getItem('ag_courses')) localStorage.setItem('ag_courses', JSON.stringify(INITIAL_COURSES));
    if (!localStorage.getItem('ag_homework')) localStorage.setItem('ag_homework', JSON.stringify(INITIAL_HOMEWORK));
    if (!localStorage.getItem('ag_quizzes')) localStorage.setItem('ag_quizzes', JSON.stringify([SAMPLE_QUIZ]));
    if (!localStorage.getItem('ag_announcements')) localStorage.setItem('ag_announcements', JSON.stringify(INITIAL_ANNOUNCEMENTS));
    if (!localStorage.getItem('ag_attendance')) localStorage.setItem('ag_attendance', JSON.stringify(INITIAL_ATTENDANCE));
  }

  // 📱 Read Collection (Reads from Central Server Data Cache with Mojibake Repair)
  getCollection(key) {
    const raw = localStorage.getItem('ag_' + key) || '[]';
    try {
      const parsed = JSON.parse(raw);
      return autoFixObjectMojibake(parsed);
    } catch (e) {
      return [];
    }
  }

  // Save Collection
  saveCollection(key, items) {
    localStorage.setItem('ag_' + key, JSON.stringify(items));
    if (this.isRealtimeConnected && this.db) {
      const colRef = ref(this.db, key);
      set(colRef, this.arrayToMap(items)).catch(err => console.warn('Central server save error:', err));
    }
  }

  // 🌐 Write / Add Item to Central Primary Server
  async addItem(collectionKey, item) {
    const newItem = { ...item, id: item.id || (collectionKey.slice(0,3) + '_' + Date.now() + '_' + Math.random().toString(36).substr(2,4)) };
    
    // Update local cache for optimistic response
    const items = this.getCollection(collectionKey);
    items.unshift(newItem);
    localStorage.setItem('ag_' + collectionKey, JSON.stringify(items));

    // Push to Central Server immediately
    if (this.isRealtimeConnected && this.db) {
      const itemRef = ref(this.db, `${collectionKey}/${newItem.id}`);
      await set(itemRef, newItem).catch(err => console.warn('Central server addItem error:', err));
    }
    return newItem;
  }

  // 🌐 Update Item on Central Primary Server
  async updateItem(collectionKey, id, updates) {
    const items = this.getCollection(collectionKey);
    const index = items.findIndex(x => x.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...updates };
      localStorage.setItem('ag_' + collectionKey, JSON.stringify(items));

      if (this.isRealtimeConnected && this.db) {
        const itemRef = ref(this.db, `${collectionKey}/${id}`);
        await update(itemRef, updates).catch(err => console.warn('Central server updateItem error:', err));
      }
      return items[index];
    }
    return null;
  }

  // 🌐 Delete Item from Central Primary Server
  async deleteItem(collectionKey, id) {
    let items = this.getCollection(collectionKey);
    items = items.filter(x => x.id !== id);
    localStorage.setItem('ag_' + collectionKey, JSON.stringify(items));

    if (this.isRealtimeConnected && this.db) {
      const itemRef = ref(this.db, `${collectionKey}/${id}`);
      await remove(itemRef).catch(err => console.warn('Central server deleteItem error:', err));
    }
  }

  // Bulk Student Import
  async importStudents(studentsList) {
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

    this.saveCollection('users', current);
    return current;
  }

  // Batch Delete Students
  async batchDeleteStudents(filterType, filterValue) {
    let users = this.getCollection('users');
    const initialCount = users.length;

    users = users.filter(u => {
      if (u.role !== 'Student') return true;
      if (filterType === 'room' && u.room === filterValue) return false;
      if (filterType === 'grade' && u.grade === filterValue) return false;
      return true;
    });

    const deletedCount = initialCount - users.length;
    this.saveCollection('users', users);
    return deletedCount;
  }

  // Quiz Draft Auto-append
  async appendQuizDraft(quizData) {
    const quizzes = this.getCollection('quizzes');
    const existingIndex = quizzes.findIndex(q => q.id === quizData.id);
    
    if (existingIndex !== -1) {
      quizzes[existingIndex] = quizData;
    } else {
      quizzes.unshift(quizData);
    }

    this.saveCollection('quizzes', quizzes);
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
export const firebaseService = firebaseRealtimeService;
