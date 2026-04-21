// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDR7n7-IH5j-hzl0Z05sb9twXYPxx75UNM",
  authDomain: "urbanease-ap.firebaseapp.com",
  projectId: "urbanease-ap",
  storageBucket: "urbanease-ap.firebasestorage.app",
  messagingSenderId: "581499883957",
  appId: "1:581499883957:web:f91133558018cbe1c649fc",
  measurementId: "G-0BMPY8CQD6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);
export const auth = getAuth(app);