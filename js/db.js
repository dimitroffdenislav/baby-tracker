import {
  collection, addDoc, deleteDoc, doc, updateDoc,
  serverTimestamp, query, where, orderBy, onSnapshot, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from './firebaseConfig.js';

/* ===================== FEEDING ===================== */
export const addEntry = (userId, entry) =>
  addDoc(collection(db, 'babyData', userId, 'entries'), { ...entry, timestamp: serverTimestamp() });

export const deleteEntry = (userId, id) =>
  deleteDoc(doc(db, 'babyData', userId, 'entries', id));

export const updateEntry = (userId, id, data) =>
  updateDoc(doc(db, 'babyData', userId, 'entries', id), data);

export const getEntry = async (userId, id) => {
  const snap = await getDoc(doc(db, 'babyData', userId, 'entries', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const listenEntries = (userId, date, cb) => {
  const q = query(
    collection(db, 'babyData', userId, 'entries'),
    where('date', '==', date),
    orderBy('timestamp')
  );
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
};

/* ====================== SLEEP ====================== */
/* Колекция: babyData/{userId}/sleep */
export const addSleep = (userId, entry) =>
  addDoc(collection(db, 'babyData', userId, 'sleep'), { ...entry, timestamp: serverTimestamp() });

export const deleteSleep = (userId, id) =>
  deleteDoc(doc(db, 'babyData', userId, 'sleep', id));

export const updateSleep = (userId, id, data) =>
  updateDoc(doc(db, 'babyData', userId, 'sleep', id), data);

export const getSleepEntry = async (userId, id) => {
  const snap = await getDoc(doc(db, 'babyData', userId, 'sleep', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const listenSleep = (userId, date, cb) => {
  const q = query(
    collection(db, 'babyData', userId, 'sleep'),
    where('date', '==', date),
    orderBy('start')
  );
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
};
