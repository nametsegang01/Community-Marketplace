import { createClient, type User } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabaseReady = Boolean(
  supabaseUrl &&
  supabasePublishableKey &&
  !supabaseUrl.startsWith("YOUR_") &&
  !supabasePublishableKey.startsWith("YOUR_"),
);

const sessionOnlyKey = "molelema-session-only";
const authStorage = {
  async getItem(key: string) {
    const storage = sessionStorage.getItem(sessionOnlyKey) === "true" ? sessionStorage : localStorage;
    return storage.getItem(key);
  },
  async setItem(key: string, value: string) {
    const storage = sessionStorage.getItem(sessionOnlyKey) === "true" ? sessionStorage : localStorage;
    storage.setItem(key, value);
  },
  async removeItem(key: string) {
    const storage = sessionStorage.getItem(sessionOnlyKey) === "true" ? sessionStorage : localStorage;
    storage.removeItem(key);
  },
};

export const supabase = supabaseReady
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        storage: authStorage,
        storageKey: "molelema-supabase-auth-token",
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const auth = supabase?.auth ?? null;

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
export type AuthUser = User & { uid: string };
export type SellerProductDraft = {
  name: string;
  detail: string;
  price: number;
  stock: number;
  unit: string;
  category: string;
  image: string;
};
export type SellerProductApplication = SellerProductDraft & {
  id: string;
  sellerId: string;
};

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add your project URL and publishable key to .env.local, then restart the app.");
  }
  return supabase;
}

function throwOnError(error: { message: string; code?: string } | null) {
  if (error) {
    const detail = error.code ? `${error.message} (${error.code})` : error.message;
    throw new Error(detail);
  }
}

type JsonValue = null | string | number | boolean | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue | undefined };

function toDatabase(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toDatabase);
  if (typeof value === "object") {
    const result: JsonObject = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) {
        result[key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)] = toDatabase(item);
      }
    }
    return result;
  }
  throw new Error("This value cannot be saved to Supabase.");
}

function toDatabaseRecord(value: object): JsonObject {
  const record = toDatabase(value);
  if (record === null || Array.isArray(record) || typeof record !== "object") {
    throw new Error("Supabase expected a database record.");
  }
  return record;
}

function fromDatabase<T>(value: unknown): T {
  if (Array.isArray(value)) return value.map((item) => fromDatabase(item)) as T;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
        fromDatabase(item),
      ]),
    ) as T;
  }
  return value as T;
}

export async function registerWithEmail(
  email: string,
  password: string,
  profile: UserProfileDraft,
  applicationProducts: SellerProductDraft[] = [],
) {
  const client = requireSupabase();
  const metadata = profile.role === "seller"
    ? { ...profile, applicationProducts }
    : profile;
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: toDatabaseRecord(metadata),
    },
  });
  throwOnError(error);
  return data;
}

export async function loginWithEmail(email: string, password: string, remember = true) {
  const client = requireSupabase();
  const storageKey = "molelema-supabase-auth-token";
  if (remember) {
    sessionStorage.removeItem(storageKey);
    sessionStorage.removeItem(sessionOnlyKey);
  } else {
    localStorage.removeItem(storageKey);
    sessionStorage.setItem(sessionOnlyKey, "true");
  }
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  throwOnError(error);
  return data;
}

export async function logout() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  throwOnError(error);
  sessionStorage.removeItem(sessionOnlyKey);
}

export async function requestPasswordReset(email: string) {
  const client = requireSupabase();
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  throwOnError(error);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const client = requireSupabase();
  const { data, error } = await client.from("users").select("*").eq("uid", uid).maybeSingle();
  throwOnError(error);
  return data ? fromDatabase<UserProfile>(data) : null;
}

export function watchUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
  onError: (error: Error) => void,
) {
  const client = requireSupabase();
  let stopped = false;
  const channel = client
    .channel(`profile:${uid}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "users",
      filter: `uid=eq.${uid}`,
    }, (payload) => {
      onData(payload.eventType === "DELETE" ? null : fromDatabase<UserProfile>(payload.new));
    })
    .subscribe((status, error) => {
      if (!stopped && (status === "CHANNEL_ERROR" || status === "TIMED_OUT")) {
        onError(error ?? new Error(`Supabase profile subscription failed: ${status}`));
      }
    });

  void getUserProfile(uid).then((profile) => {
    if (!stopped) onData(profile);
  }).catch((error: unknown) => {
    if (!stopped) onError(error instanceof Error ? error : new Error("Could not load your profile."));
  });

  return () => {
    stopped = true;
    void client.removeChannel(channel);
  };
}

export async function createUserProfile(
  user: User,
  profile: UserProfileDraft,
  applicationProducts: SellerProductDraft[] = [],
): Promise<void> {
  const client = requireSupabase();
  const row = toDatabaseRecord({
    ...profile,
    uid: user.id,
    email: user.email ?? profile.email,
  });
  if (profile.role === "seller") {
    const { error } = await client.rpc("complete_seller_application", {
      p_profile: row,
      p_products: toDatabase(applicationProducts),
    });
    throwOnError(error);
    return;
  }
  const { error } = await client.from("users").upsert(row, {
    onConflict: "uid",
    ignoreDuplicates: true,
  });
  throwOnError(error);
}

export async function updateOwnUserProfile(
  uid: string,
  updates: Pick<UserProfile, "firstName" | "lastName" | "phoneNumber">,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from("users").update(toDatabaseRecord(updates)).eq("uid", uid);
  throwOnError(error);
}

export async function setSellerApproval(uid: string, approved: boolean): Promise<void> {
  const { error } = await requireSupabase().rpc("review_seller_application", {
    p_uid: uid,
    p_approved: approved,
  });
  throwOnError(error);
}

export async function setAccountSuspended(uid: string, suspended: boolean): Promise<void> {
  const { error } = await requireSupabase().rpc("set_account_suspended", {
    p_uid: uid,
    p_suspended: suspended,
  });
  throwOnError(error);
}

export function watchAuthState(callback: (user: AuthUser | null) => void, onError: (error: Error) => void) {
  if (!supabase) {
    onError(new Error("Supabase is not configured. Add your project URL and publishable key to .env.local."));
    return () => undefined;
  }
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user;
    callback(user ? { ...user, uid: user.id } : null);
  });
  return () => data.subscription.unsubscribe();
}

export async function placeOrder<T extends { id: string; stock: number }, O extends { id: string }>(
  order: O,
  productUpdates: { productId: string; quantity: number }[],
  _products: T[],
): Promise<T[]> {
  const quantities = new Map<string, number>();
  for (const { productId, quantity } of productUpdates) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Order quantities must be positive whole numbers.");
    }
    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
  }
  if (quantities.size === 0) throw new Error("Your basket is empty.");

  const { data, error } = await requireSupabase().rpc("place_order", {
    p_order: toDatabase(order),
    p_product_updates: toDatabase([...quantities].map(([productId, quantity]) => ({ productId, quantity }))),
  });
  throwOnError(error);
  return fromDatabase<T[]>(data);
}

export function watchCollection<T extends { id: string }>(
  name: string,
  onData: (items: T[]) => void,
  onError: (error: Error) => void,
  filter?: { field: string; value: string },
) {
  const client = requireSupabase();
  let stopped = false;
  const load = async () => {
    let request = client.from(name).select("*");
    if (filter) {
      const field = filter.field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      request = request.eq(field, filter.value);
    }
    const { data, error } = await request;
    if (error) {
      if (!stopped) onError(new Error(`${error.message}${error.code ? ` (${error.code})` : ""}`));
      return;
    }
    if (!stopped) {
      onData((data ?? []).map((row) => {
        const item = fromDatabase<Record<string, unknown>>(row);
        return { ...item, id: String(item.id ?? item.uid ?? "") } as T;
      }));
    }
  };
  const channel = client
    .channel(`table:${name}:${filter?.field ?? "all"}:${filter?.value ?? ""}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: name,
      ...(filter ? {
        filter: `${filter.field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}=eq.${filter.value}`,
      } : {}),
    }, () => {
      void load();
    })
    .subscribe((status, error) => {
      if (!stopped && (status === "CHANNEL_ERROR" || status === "TIMED_OUT")) {
        onError(error ?? new Error(`Supabase ${name} subscription failed: ${status}`));
      }
    });
  void load();
  return () => {
    stopped = true;
    void client.removeChannel(channel);
  };
}

export async function saveRecord<T extends { id: string }>(name: string, item: T) {
  const client = requireSupabase();
  const record = toDatabaseRecord(item);
  const { error } = name === "orders"
    ? await client.from(name).update(record).eq("id", item.id)
    : await client.from(name).upsert(record);
  throwOnError(error);
}

export async function removeRecord(name: string, id: string) {
  const { error } = await requireSupabase().from(name).delete().eq("id", id);
  throwOnError(error);
}

export async function removeSellerRecords(sellerId: string, _productIds: string[]) {
  const { error } = await requireSupabase().rpc("remove_seller_records", {
    p_seller_id: sellerId,
  });
  throwOnError(error);
}
