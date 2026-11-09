import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration

const firebaseConfig = {
  apiKey: "AIzaSyCRNmP2YpQDvaGm6UmWObhiZCr3_s_qheM",
  authDomain: "mobile-6375f.firebaseapp.com",
  databaseURL: "https://mobile-6375f-default-rtdb.firebaseio.com",
  projectId: "mobile-6375f",
  storageBucket: "mobile-6375f.firebasestorage.app",
  messagingSenderId: "115104863084",
  appId: "1:115104863084:web:7e2aadca5d00296a0d1949"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
