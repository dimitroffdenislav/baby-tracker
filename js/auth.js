import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { auth } from './firebaseConfig.js';

export const login = async (email, pwd, remember) => {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  try {
    return await signInWithEmailAndPassword(auth, email, pwd);
  } catch (e) {
    if (e.code === 'auth/user-not-found')
      return createUserWithEmailAndPassword(auth, email, pwd);
    throw e;
  }
};

console.log(1234)

export const logout = () => signOut(auth);