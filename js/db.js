// js/db.js
import {
  collection, addDoc, deleteDoc, doc, updateDoc,
  serverTimestamp, query, where, orderBy, onSnapshot, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from './firebaseConfig.js';

/* -------------------------------------------
   Helpers
--------------------------------------------*/
const handleSnap = (q, mapFn, cb) =>
  onSnapshot(
    q,
    snap => cb(snap.docs.map(d => mapFn(d))),
    err  => {
      console.error('Firestore onSnapshot error:', err);
      // по желание: alert за по-ясна обратна връзка
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

// Оптимизирано: where(date == X) + orderBy(time) (без втори orderBy)
// → не изисква композитен индекс
export const listenEntries = (userId, date, cb) => {
  const q = query(
    collection(db, 'babyData', userId, 'entries'),
    where('date', '==', date),
    orderBy('time')
  );

  // map + клиентски тийбрейк по timestamp/id ако times съвпадат
  return handleSnap(
    q,
    d => ({ id: d.id, ...d.data() }),
    docs => {
      const sorted = [...docs].sort((a, b) => {
        // time вече е сортирано от сървъра; тийбрейк само при равни стойности
        if ((a.time || '') === (b.time || '')) {
          // първо по timestamp (може да е undefined за много нов запис)
          const at = a.timestamp?.toMillis?.() ?? 0;
          const bt = b.timestamp?.toMillis?.() ?? 0;
          if (at !== bt) return at - bt;
          // втори тийбрейк по id, за стабилност
          return a.id.localeCompare(b.id);
        }
        return 0;
      });
      cb(sorted);
    }
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

// Оптимизирано: where(date == X) + orderBy(start) (без втори orderBy)
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
    }
  );
};
