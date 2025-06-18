import { initializeApp } from "firebase/app";
import {
    getAuth,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithPopup,
    signOut,
    type User,
} from "firebase/auth";
import {
    doc,
    getDoc,
    getFirestore,
    onSnapshot,
    setDoc,
} from "firebase/firestore";
import { firebaseConfig } from "./firebase-config";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const provider = new GoogleAuthProvider();

let currentUser: User | null = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
});

const signIn = async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Error signing in:", error);
  }
};

const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
  }
};

const getBangsRef = () => {
  if (!currentUser) return null;
  return doc(db, "users", currentUser.uid);
}

const saveBangsToFirestore = async (bangs: Map<string, any>) => {
  const userBangsRef = getBangsRef();
  if (!userBangsRef) return;
  await setDoc(userBangsRef, { bangs: JSON.stringify(Array.from(bangs.entries())) });
};

const getBangsFromFirestore = async (): Promise<Map<string, any>> => {
  const userBangsRef = getBangsRef();
  if (!userBangsRef) return new Map();

  const docSnap = await getDoc(userBangsRef);
  if (docSnap.exists()) {
    return new Map(JSON.parse(docSnap.data().bangs));
  }
  return new Map();
};

const onBangsSnapshot = (callback: (bangs: Map<string, any>) => void) => {
  const userBangsRef = getBangsRef();
  if (!userBangsRef) return () => {}; // Return an empty unsubscribe function
  
  return onSnapshot(userBangsRef, (doc) => {
    if (doc.exists()) {
      callback(new Map(JSON.parse(doc.data().bangs)));
    }
  });
}

export { auth, getBangsFromFirestore, logOut, onAuthStateChanged, onBangsSnapshot, saveBangsToFirestore, signIn };

