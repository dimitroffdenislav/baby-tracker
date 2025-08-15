// js/db.js
import {
  collection, addDoc, deleteDoc, doc, updateDoc,
  serverTimestamp, query, where, onSnapshot, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from './firebaseConfig.js';

/* ---------- helper с error logging ---------- */
const handleSnap = (q, mapFn, cb, label) =>
  onSnapshot(
    q,
    snap => cb(snap.docs.map(d => mapFn(d))),
    err  => console.error(`${label || 'Firestore'} onSnapshot error:`, err)
  );

/* =============== FEEDING (entries) =============== */
export const addEntry = (userId, entry) =>
  addDoc(collection(db, 'babyData', userId, 'entries'), {
    ...entry,
    timestamp: serverTimestamp()
  });

export const deleteEntry = (userId, id) =>
  deleteDoc(doc(db, 'babyData', userId, 'entries', id));

export const updateEntry = (userId, id, data) =>
  updateDoc(doc(db, 'babyData', userId, 'entries', id), data);

export const getEntry = async (userId, id) => {
  const snap = await getDoc(doc(db, 'babyData', userId, 'entries', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// ✅ НЯМА orderBy → не иска композитен индекс
export const listenEntries = (userId, date, cb) => {
  const q = query(
    collection(db, 'babyData', userId, 'entries'),
    where('date', '==', date)
  );
  return handleSnap(
    q,
    d => ({ id: d.id, ...d.data() }),
    docs => {
      // клиентско сортиране: time ↑, после timestamp, после id
      const sorted = [...docs].sort((a, b) => {
        const ta = a.time || '', tb = b.time || '';
        if (ta !== tb) return ta.localeCompare(tb);
        const at = a.timestamp?.toMillis?.() ?? 0;
        const bt = b.timestamp?.toMillis?.() ?? 0;
        if (at !== bt) return at - bt;
        return a.id.localeCompare(b.id);
      });
      cb(sorted);
    },
    'entries'
  );
};

/* =================== SLEEP =================== */
export const addSleep = (userId, entry) =>
  addDoc(collection(db, 'babyData', userId, 'sleep'), {
    ...entry,
    timestamp: serverTimestamp()
  });

export const deleteSleep = (userId, id) =>
  deleteDoc(doc(db, 'babyData', userId, 'sleep', id));

export const updateSleep = (userId, id, data) =>
  updateDoc(doc(db, 'babyData', userId, 'sleep', id), data);

export const getSleepEntry = async (userId, id) => {
  const snap = await getDoc(doc(db, 'babyData', userId, 'sleep', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// ✅ НЯМА orderBy → не иска композитен индекс
export const listenSleep = (userId, date, cb) => {
  const q = query(
    collection(db, 'babyData', userId, 'sleep'),
    where('date', '==', date)
  );
  return handleSnap(
    q,
    d => ({ id: d.id, ...d.data() }),
    docs => {
      // клиентско сортиране: start ↑, после timestamp, после id
      const sorted = [...docs].sort((a, b) => {
        const sa = a.start || '', sb = b.start || '';
        if (sa !== sb) return sa.localeCompare(sb);
        const at = a.timestamp?.toMillis?.() ?? 0;
        const bt = b.timestamp?.toMillis?.() ?? 0;
        if (at !== bt) return at - bt;
        return a.id.localeCompare(b.id);
      });
      cb(sorted);
    },
    'sleep'
  );
};
