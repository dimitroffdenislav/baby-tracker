import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const app = initializeApp({
  apiKey: "AIzaSyBgeoFmRG4PWgB4qNtp6u_AVLyoqD5m8CE",
  authDomain: "baby-tracker-fab40.firebaseapp.com",
  projectId: "baby-tracker-fab40",
  storageBucket: "baby-tracker-fab40.appspot.com",
  messagingSenderId: "60430088674",
  appId: "1:60430088674:web:4eaff3297a1411e70b21bb"
});

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false
});
