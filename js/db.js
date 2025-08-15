// js/db.js
import {
  collection, addDoc, deleteDoc, doc, updateDoc,
  serverTimestamp, query, where, orderBy, onSnapshot, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from './firebaseConfig.js';

/* -------------------------------------------
   Helper за onSnapshot с error handler
--------------------------------------------*/
const handleSnap = (q, mapFn, cb, label) =>
  onSnapshot(
    q,
    snap => cb(snap.docs.map(d => mapFn(d))),
    err  => {
      console.error(`${label || 'Firestore'} onSnapshot error:`, err);
      // По желание: alert за по-видима обратна връзка
      // alert('Грешка при зареждане на данните. Виж конзолата.');
    }
  );

/* -------------------------------------------
   FEEDING (entries)
   Колекция: babyData/{userId}/entries
--------------------------------------------*/
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

// ✅ where(date == X) + orderBy(time) → използва наличния ти индекс (date + time [+ timestamp])
export const listenEntries = (userId, date, cb) => {
  const q = query(
    collection(db, 'babyData', userId, 'entries'),
    where('date', '==', date),
    orderBy('time')
  );
  return handleSnap(
    q,
    d => ({ id: d.id, ...d.data() }),
    // стабилен клиентски тийбрейк при еднакъв time
    docs => {
      const sorted = [...docs].sort((a, b) => {
        if ((a.time || '') === (b.time || '')) {
          const at = a.timestamp?.toMillis?.() ?? 0;
          const bt = b.timestamp?.toMillis?.() ?? 0;
          if (at !== bt) return at - bt;
          return a.id.localeCompare(b.id);
        }
        return 0; // server вече е сортирал по time
      });
      cb(sorted);
    },
    'entries'
  );
};

/* -------------------------------------------
   SLEEP
   Колекция: babyData/{userId}/sleep
--------------------------------------------*/
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

// ✅ where(date == X) + orderBy(start) → използва индекса (sleep: date + start [+ timestamp])
export const listenSleep = (userId, date, cb) => {
  const q = query(
    collection(db, 'babyData', userId, 'sleep'),
    where('date', '==', date),
    orderBy('start')
  );
  return handleSnap(
    q,
    d => ({ id: d.id, ...d.data() }),
    docs => {
      const sorted = [...docs].sort((a, b) => {
        if ((a.start || '') === (b.start || '')) {
          const at = a.timestamp?.toMillis?.() ?? 0;
          const bt = b.timestamp?.toMillis?.() ?? 0;
          if (at !== bt) return at - bt;
          return a.id.localeCompare(b.id);
        }
        return 0;
      });
      cb(sorted);
    },
    'sleep'
  );
};
