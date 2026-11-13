import { getApp, getApps, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type FirestoreError,
} from "firebase/firestore";

const firebaseConfig: Record<string, string | undefined> = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requiredConfig = Object.entries(firebaseConfig);
export const firebaseReady = requiredConfig.every(
  ([, value]) =>
    typeof value === "string" &&
    value.trim().length > 0 &&
    !value.trim().toUpperCase().startsWith("YOUR_"),
);
const app = firebaseReady
  ? getApps().some((existingApp) => existingApp.name === "[DEFAULT]")
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;
export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;

export async function uploadProductImage(file: File): Promise<string> {
  const image = new Image();
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read the selected image."));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("The selected file is not a valid image."));
    image.src = source;
  });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot prepare the selected image.");
  let scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
  let quality = 0.82;
  let result = "";
  do {
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    result = canvas.toDataURL("image/jpeg", quality);
    if (result.length <= 930_000) return result;
    if (quality > 0.5) quality -= 0.12;
    else scale *= 0.75;
  } while (scale >= 0.2);
  throw new Error("This image is too large to save. Choose a smaller image.");
}

export async function registerWithEmail(email: string, password: string) {
  if (!auth) throw new Error("Firebase is not configured. Add your Firebase web app settings and restart the app.");
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function loginWithEmail(email: string, password: string, remember = true) {
  if (!auth) throw new Error("Firebase is not configured. Add your Firebase web app settings and restart the app.");
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  if (!auth) throw new Error("Firebase is not configured.");
  await signOut(auth);
}

export async function requestPasswordReset(email: string) {
  if (!auth) throw new Error("Firebase is not configured.");
  await sendPasswordResetEmail(auth, email);
}

export type AccountRole = "customer" | "seller" | "admin";
export type AccountStatus = "active" | "pending" | "suspended" | "rejected";
export type UserProfile = {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: AccountRole;
  accountStatus: AccountStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
  shopName?: string;
  businessDescription?: string;
  village?: string;
  sellerStatus?: "pending" | "approved" | "rejected";
};

export type UserProfileDraft = Omit<UserProfile, "uid" | "createdAt" | "updatedAt">;

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!db) throw new Error("Firebase is not configured.");
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? snapshot.data() as UserProfile : null;
}

export function watchUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
  onError: (error: Error) => void,
) {
  if (!db) {
    onError(new Error("Firebase is not configured."));
    return () => undefined;
  }
  return onSnapshot(doc(db, "users", uid), (snapshot) => {
    onData(snapshot.exists() ? snapshot.data() as UserProfile : null);
  }, onError);
}

export async function createUserProfile(user: User, profile: UserProfileDraft): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  const profileRef = doc(db, "users", user.uid);
  if ((await getDoc(profileRef)).exists()) throw new Error("Your account profile already exists. Please sign in.");
  await setDoc(profileRef, {
    ...profile,
    uid: user.uid,
    email: user.email ?? profile.email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    termsAcceptedAt: serverTimestamp(),
  });
}

export async function updateOwnUserProfile(uid: string, updates: Pick<UserProfile, "firstName" | "lastName" | "phoneNumber">): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  await updateDoc(doc(db, "users", uid), { ...updates, updatedAt: serverTimestamp() });
}

export async function setSellerApproval(uid: string, approved: boolean): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  const userRef = doc(db, "users", uid);
  const user = await getDoc(userRef);
  if (!user.exists() || user.data().role !== "seller" || user.data().sellerStatus !== "pending") {
    throw new Error("This seller application is no longer pending.");
  }
  const sellerRef = doc(db, "sellers", uid);
  const batch = writeBatch(db);
  batch.update(userRef, {
    sellerStatus: approved ? "approved" : "rejected",
    accountStatus: approved ? "active" : "rejected",
    updatedAt: serverTimestamp(),
  });
  if (approved) {
    batch.set(sellerRef, {
      id: uid,
      name: user.data().shopName,
      place: user.data().village,
      image: "/assets/seller-firewood.png",
      sales: 0,
      active: true,
    });
  } else {
    batch.delete(sellerRef);
  }
  await batch.commit();
}

export async function setAccountSuspended(uid: string, suspended: boolean): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  const userRef = doc(db, "users", uid);
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists() || snapshot.data().role === "admin") {
    throw new Error("This account cannot be changed here.");
  }
  const data = snapshot.data();
  const restoredStatus = data.role === "seller"
    ? data.sellerStatus === "approved" ? "active" : data.sellerStatus === "rejected" ? "rejected" : "pending"
    : "active";
  const batch = writeBatch(db);
  batch.update(userRef, {
    accountStatus: suspended ? "suspended" : restoredStatus,
    updatedAt: serverTimestamp(),
  });
  if (data.role === "seller" && data.sellerStatus === "approved") {
    const sellerRef = doc(db, "sellers", uid);
    if ((await getDoc(sellerRef)).exists()) batch.update(sellerRef, { active: !suspended });
  }
  await batch.commit();
}

export function watchAuthState(callback: (user: User | null) => void, onError: (error: Error) => void) {
  if (!auth) {
    onError(new Error("Firebase is not configured. Add Firebase settings to enable account access."));
    return () => undefined;
  }
  return onAuthStateChanged(auth, callback, onError);
}

export async function placeOrder<T extends { id: string; stock: number }, O extends { id: string }>(
  order: O,
  productUpdates: { productId: string; quantity: number }[],
  products: T[],
): Promise<T[]> {
  const quantities = new Map<string, number>();
  for (const { productId, quantity } of productUpdates) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Order quantities must be positive whole numbers.");
    }
    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
  }
  if (quantities.size === 0) throw new Error("Your basket is empty.");

  if (db) {
    return runTransaction(db, async (transaction) => {
      const productRefs = [...quantities.keys()].map((id) => doc(db, "products", id));
      const orderRef = doc(db, "orders", order.id);
      const [productSnapshots, existingOrder] = await Promise.all([
        Promise.all(productRefs.map((productRef) => transaction.get(productRef))),
        transaction.get(orderRef),
      ]);
      if (existingOrder.exists()) throw new Error("This order was already submitted.");

      const updatedProducts = productSnapshots.map((snapshot, index) => {
        const quantity = quantities.get(snapshot.id);
        const data = snapshot.data();
        if (!snapshot.exists() || !data || typeof data.stock !== "number" || quantity === undefined) {
          throw new Error("A product in your basket is no longer available.");
        }
        if (data.stock < quantity) {
          throw new Error(`${String(data.name ?? "A product")} only has ${data.stock} left in stock.`);
        }
        const updated = { ...data, id: snapshot.id, stock: data.stock - quantity } as T;
        transaction.set(productRefs[index], { ...data, stock: updated.stock, stockOrderId: order.id });
        return updated;
      });

      transaction.set(orderRef, order);
      return updatedProducts;
    });
  }

  return [...quantities].map(([productId, quantity]) => {
    const product = products.find((item) => item.id === productId);
    if (!product) throw new Error("A product in your basket is no longer available.");
    if (product.stock < quantity) {
      throw new Error(`${productId} only has ${product.stock} left in stock.`);
    }
    return { ...product, stock: product.stock - quantity };
  });
}

export function watchCollection<T extends { id: string }>(
  name: string,
  onData: (items: T[]) => void,
  onError: (error: FirestoreError) => void,
  filter?: { field: string; value: string },
) {
  if (!db) return () => undefined;
  const collectionRef = collection(db, name);
  const target = filter ? query(collectionRef, where(filter.field, "==", filter.value)) : collectionRef;
  return onSnapshot(
    target,
    (snapshot) => {
      onData(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as T));
    },
    onError,
  );
}

export async function saveRecord<T extends { id: string }>(name: string, item: T) {
  if (!db) return;
  await setDoc(doc(db, name, item.id), item);
}

export async function removeRecord(name: string, id: string) {
  if (!db) return;
  await deleteDoc(doc(db, name, id));
}

export async function removeSellerRecords(sellerId: string, productIds: string[]) {
  if (!db) return;
  const batch = writeBatch(db);
  batch.delete(doc(db, "sellers", sellerId));
  productIds.forEach((id) => batch.delete(doc(db, "products", id)));
  await batch.commit();
}
