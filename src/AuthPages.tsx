import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  auth,
  createUserProfile,
  getUserProfile,
  loginWithEmail,
  logout,
  registerWithEmail,
  requestPasswordReset,
  updateOwnUserProfile,
  uploadProductImage,
  type SellerProductDraft,
  type UserProfileDraft,
} from "./supabase";
import { useAuth } from "./auth";

function friendlyAuthError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";
  const messages: Record<string, string> = {
    user_already_exists: "This email already has an account. Try logging in instead.",
    invalid_credentials: "The email or password is incorrect.",
    email_not_confirmed: "Please verify your email using the confirmation link we sent, then try logging in again.",
    weak_password: "Choose a stronger password with at least 8 characters.",
    over_request_rate_limit: "Too many attempts. Please wait a while and try again.",
    over_email_send_rate_limit: "Too many email requests. Please wait a while and try again.",
    "42501": "Supabase denied this request. Check that the database setup and row-level security policies are installed.",
  };
  if (messages[code]) return messages[code];
  if (code === "PGRST301") return messages["42501"];
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

function routeForProfile(profile: NonNullable<ReturnType<typeof useAuth>["profile"]>) {
  if (profile.accountStatus === "suspended" || profile.accountStatus === "rejected") return "/account-unavailable";
  if (profile.role !== "seller" && profile.accountStatus !== "active") return "/account-unavailable";
  if (profile.role === "seller") return profile.sellerStatus === "rejected" ? "/account-unavailable" : profile.sellerStatus === "approved" && profile.accountStatus === "active" ? "/seller" : "/seller-pending";
  if (profile.role === "admin") return "/admin";
  return "/market";
}

function PasswordField({ label, value, onChange, required = true, autoComplete }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return <label className="auth-field">{label}
    <span className="password-input"><input required={required} minLength={label === "Password" ? 8 : undefined} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} /><button type="button" onClick={() => setVisible((shown) => !shown)} aria-label={visible ? "Hide password" : "Show password"}>{visible ? "Hide" : "Show"}</button></span>
  </label>;
}

type SellerProductForm = {
  name: string;
  detail: string;
  price: string;
  stock: string;
  unit: string;
  file: File | null;
};

function emptySellerProduct(): SellerProductForm {
  return { name: "", detail: "", price: "", stock: "", unit: "each", file: null };
}

function SellerProductEditor({
  products,
  onChange,
  onError,
}: {
  products: SellerProductForm[];
  onChange: (products: SellerProductForm[]) => void;
  onError: (message: string) => void;
}) {
  function updateProduct(index: number, updates: Partial<SellerProductForm>) {
    onChange(products.map((product, productIndex) => productIndex === index
      ? { ...product, ...updates }
      : product));
  }

  return <>
    <div className="seller-product-heading"><strong>Products to sell</strong><small>Add at least one product. You can list up to three to start.</small></div>
    {products.map((product, index) => <fieldset className="seller-product-form" key={index}>
      <legend>Product {index + 1}</legend>
      <label className="auth-field">Product name<input required value={product.name} onChange={(event) => updateProduct(index, { name: event.target.value })} /></label>
      <label className="auth-field">Description<input required value={product.detail} onChange={(event) => updateProduct(index, { detail: event.target.value })} /></label>
      <div className="auth-form-row">
        <label className="auth-field">Price (R)<input required min="0.01" step="0.01" type="number" value={product.price} onChange={(event) => updateProduct(index, { price: event.target.value })} /></label>
        <label className="auth-field">Stock<input required min="1" step="1" type="number" value={product.stock} onChange={(event) => updateProduct(index, { stock: event.target.value })} /></label>
      </div>
      <label className="auth-field">Unit<select value={product.unit} onChange={(event) => updateProduct(index, { unit: event.target.value })}><option>each</option><option>per litre</option><option>per bundle</option><option>per tub</option><option>per bakkie</option></select></label>
      <label className="auth-field">Product photo<input required type="file" accept="image/*" onChange={(event) => {
        const file = event.target.files?.[0] ?? null;
        if (file && (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)) {
          onError(file.type.startsWith("image/") ? "Choose an image smaller than 5 MB." : "Choose an image file.");
          event.target.value = "";
          return;
        }
        onError("");
        updateProduct(index, { file });
      }} />{product.file && <small>{product.file.name}</small>}</label>
      {products.length > 1 && <button className="auth-secondary" type="button" onClick={() => onChange(products.filter((_, productIndex) => productIndex !== index))}>Remove product</button>}
    </fieldset>)}
    {products.length < 3 && <button className="auth-secondary" type="button" onClick={() => onChange([...products, emptySellerProduct()])}>Add another product</button>}
  </>;
}

async function prepareSellerProducts(products: SellerProductForm[]): Promise<SellerProductDraft[]> {
  const prepared = await Promise.all(products.map(async (product) => {
    if (!product.file) throw new Error("Choose a photo for each product.");
    const price = Number(product.price);
    const stock = Number(product.stock);
    if (!Number.isFinite(price) || price <= 0 || !Number.isInteger(stock) || stock <= 0) {
      throw new Error("Each product needs a price above zero and a positive whole-number stock count.");
    }
    return {
      name: product.name.trim(),
      detail: product.detail.trim(),
      price,
      stock,
      unit: product.unit,
      image: await uploadProductImage(product.file),
    };
  }));
  if (prepared.reduce((total, product) => total + product.image.length, 0) > 1_200_000) {
    throw new Error("The combined product photos are too large. Choose smaller images and try again.");
  }
  return prepared;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && profile) navigate(routeForProfile(profile), { replace: true });
  }, [loading, navigate, profile]);
  if (!loading && profile) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const credential = await loginWithEmail(email.trim(), password, remember);
      if (!credential.user) throw new Error("Supabase did not return the signed-in account.");
      const userProfile = await getUserProfile(credential.user.id);
      if (!userProfile) {
        navigate("/complete-profile", { replace: true });
        return;
      }
      if (userProfile.accountStatus === "suspended" || userProfile.accountStatus === "rejected") {
        await logout();
        setMessage("This account is currently suspended or rejected. Contact marketplace support for help.");
        return;
      }
      navigate(routeForProfile(userProfile), { replace: true });
    } catch (error) {
      setMessage(friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  return <AuthLayout title="Welcome back" subtitle="Log in to shop and manage your Molelema Rise account.">
    {location.state?.message && <p className="auth-note">{String(location.state.message)}</p>}
    <form className="auth-form" onSubmit={submit}>
      <label className="auth-field">Email address<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
      <div className="auth-inline"><label><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Keep me logged in</label><Link to="/reset-password">Forgot password?</Link></div>
      {message && <p className="auth-error" role="alert">{message}</p>}
      <button className="auth-submit" disabled={busy || !auth}>{busy ? "Logging in..." : "Log in"}</button>
      {!auth && <p className="auth-help">Supabase is not configured. Add your project URL and publishable key to `.env.local`.</p>}
    </form>
    <p className="auth-footer">New to Molelema Rise? <Link to="/register">Create an account</Link></p>
  </AuthLayout>;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { user, profile, loading, error: profileError, reloadProfile } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"customer" | "seller">("customer");
  const [village, setVillage] = useState("");
  const [sellerProducts, setSellerProducts] = useState<SellerProductForm[]>([emptySellerProduct()]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && profile) navigate(routeForProfile(profile), { replace: true });
    else if (!loading && user && !profileError) navigate("/complete-profile", { replace: true });
  }, [loading, navigate, profile, user, profileError]);
  if (!loading && profile) return null;
  if (!loading && user && profileError) return <AuthLayout title="Could not load your profile" subtitle={profileError}><button className="auth-submit" onClick={() => void reloadProfile()}>Try again</button></AuthLayout>;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const digits = phoneNumber.replace(/[\s()-]/g, "");
    if (!/^(?:\+27|0)[1-8]\d{8}$/.test(digits)) {
      setMessage("Enter a valid South African phone number, for example 082 123 4567 or +27 82 123 4567.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }
    if (role === "seller" && !village.trim()) {
      setMessage("Enter your village or location.");
      return;
    }
    if (role === "seller" && sellerProducts.length === 0) {
      setMessage("Add at least one product to your seller application.");
      return;
    }
    if (!termsAccepted) {
      setMessage("Please accept the Terms and Privacy Policy to continue.");
      return;
    }

    const draft: UserProfileDraft = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phoneNumber: digits.startsWith("+27") ? digits : `+27${digits.slice(1)}`,
      role,
      accountStatus: role === "seller" ? "pending" : "active",
      ...(role === "seller" ? {
        village: village.trim(),
        sellerStatus: "pending" as const,
      } : {}),
    };

    setBusy(true);
    try {
      const applicationProducts = role === "seller" ? await prepareSellerProducts(sellerProducts) : [];
      const credential = await registerWithEmail(draft.email, password, draft, applicationProducts);
      if (!credential.user) throw new Error("Supabase did not return the new account.");
      if (!credential.session) {
        navigate("/login", {
          replace: true,
          state: {
            message: role === "seller"
              ? "Your application is saved. Check your email and verify your address, then log in. Your products will be available after an administrator approves them."
              : "Your account is saved. Check your email and verify your address before logging in.",
          },
        });
        return;
      }
      navigate(role === "seller" ? "/seller-pending" : "/market", { replace: true });
    } catch (error) {
      setMessage(friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  return <AuthLayout title="Join the community" subtitle="Create an account to shop or sell with Molelema Rise.">
    <form className="auth-form" onSubmit={submit}>
      <div className="auth-form-row"><label className="auth-field">First name<input required autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label><label className="auth-field">Last name<input required autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} /></label></div>
      <label className="auth-field">Email address<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label className="auth-field">Phone number<input required type="tel" autoComplete="tel" placeholder="082 123 4567" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} /><small>South African phone number</small></label>
      <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="new-password" />
      <PasswordField label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
      <fieldset className="account-choice"><legend>Account type</legend><label><input type="radio" name="role" checked={role === "customer"} onChange={() => setRole("customer")} /> Customer</label><label><input type="radio" name="role" checked={role === "seller"} onChange={() => setRole("seller")} /> Seller</label></fieldset>
      {role === "seller" && <div className="seller-fields">
        <p>Verify your email after registering. You can then log in to see when an administrator approves your products.</p>
        <label className="auth-field">Village or location<input required value={village} onChange={(event) => setVillage(event.target.value)} /></label>
        <SellerProductEditor products={sellerProducts} onChange={setSellerProducts} onError={setMessage} />
      </div>}
      <label className="terms-check"><input required type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /> I accept the <a href="/terms" target="_blank" rel="noreferrer">Terms</a> and <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.</label>
      {message && <p className="auth-error" role="alert">{message}</p>}
      <button className="auth-submit" disabled={busy || !auth}>{busy ? role === "seller" ? "Preparing application..." : "Creating account..." : role === "seller" ? "Submit seller application" : "Create customer account"}</button>
      {!auth && <p className="auth-help">Supabase is not configured. Add your project URL and publishable key to `.env.local`.</p>}
    </form>
    <p className="auth-footer">Already have an account? <Link to="/login">Log in</Link></p>
  </AuthLayout>;
}

export function CompleteProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading, error: profileError, reloadProfile } = useAuth();
  const draft = location.state?.draft as (UserProfileDraft & { termsAccepted?: boolean }) | undefined;
  const [firstName, setFirstName] = useState(draft?.firstName ?? "");
  const [lastName, setLastName] = useState(draft?.lastName ?? "");
  const [phoneNumber, setPhoneNumber] = useState(draft?.phoneNumber ?? "");
  const [role, setRole] = useState<"customer" | "seller">(draft?.role === "seller" ? "seller" : "customer");
  const [village, setVillage] = useState(draft?.village ?? "");
  const [sellerProducts, setSellerProducts] = useState<SellerProductForm[]>([emptySellerProduct()]);
  const [termsAccepted, setTermsAccepted] = useState(Boolean(draft?.termsAccepted));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && profile) navigate(routeForProfile(profile), { replace: true });
  }, [loading, navigate, profile]);
  if (!loading && profile) return null;
  if (!loading && !user) return <Navigate to="/login" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    const digits = phoneNumber.replace(/[\s()-]/g, "");
    if (!/^(?:\+27|0)[1-8]\d{8}$/.test(digits)) {
      setMessage("Enter a valid South African phone number.");
      return;
    }
    if (role === "seller" && !village.trim()) {
      setMessage("Enter your village or location.");
      return;
    }
    if (!termsAccepted) {
      setMessage("Please accept the Terms and Privacy Policy to continue.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const applicationProducts = role === "seller" ? await prepareSellerProducts(sellerProducts) : [];
      await createUserProfile(user, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: user.email ?? "",
        phoneNumber: digits.startsWith("+27") ? digits : `+27${digits.slice(1)}`,
        role,
        accountStatus: role === "seller" ? "pending" : "active",
        ...(role === "seller" ? { village: village.trim(), sellerStatus: "pending" as const } : {}),
      }, applicationProducts);
      await reloadProfile();
      navigate(role === "seller" ? "/seller-pending" : "/market", { replace: true });
    } catch (error) {
      setMessage(friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  return <AuthLayout title="Finish your profile" subtitle="Your account already exists. Complete this profile to continue.">
    {location.state?.message && <p className="auth-note">{String(location.state.message)}</p>}
    {profileError && <p className="auth-error" role="alert">Could not load the saved profile: {profileError}. Check your Supabase policies or network, then retry.</p>}
    <form className="auth-form" onSubmit={submit}>
      <label className="auth-field">Email address<input readOnly value={user?.email ?? ""} /></label>
      <div className="auth-form-row"><label className="auth-field">First name<input required value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label><label className="auth-field">Last name<input required value={lastName} onChange={(event) => setLastName(event.target.value)} /></label></div>
      <label className="auth-field">Phone number<input required type="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} /></label>
      <fieldset className="account-choice"><legend>Account type</legend><label><input type="radio" name="recovery-role" checked={role === "customer"} onChange={() => setRole("customer")} /> Customer</label><label><input type="radio" name="recovery-role" checked={role === "seller"} onChange={() => setRole("seller")} /> Seller</label></fieldset>
      {role === "seller" && <><label className="auth-field">Village or location<input required value={village} onChange={(event) => setVillage(event.target.value)} /></label><SellerProductEditor products={sellerProducts} onChange={setSellerProducts} onError={setMessage} /></>}
      <label className="terms-check"><input required type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /> I accept the <a href="/terms" target="_blank" rel="noreferrer">Terms</a> and <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.</label>
      {message && <p className="auth-error" role="alert">{message}</p>}
      <button className="auth-submit" disabled={busy}>{busy ? "Saving profile..." : "Save profile"}</button>
      <button className="auth-secondary" type="button" onClick={() => void logout().catch((error: Error) => setMessage(friendlyAuthError(error)))}>Sign out</button>
    </form>
  </AuthLayout>;
}

export function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await requestPasswordReset(email.trim());
      setMessage("If an account exists for this email, a password reset link has been sent.");
    } catch (error) {
      setMessage(friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  }
  return <AuthLayout title="Reset your password" subtitle="We’ll send a password reset link to your email address.">
    <form className="auth-form" onSubmit={submit}>
      <label className="auth-field">Email address<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      {message && <p className={message.startsWith("If an account") ? "auth-note" : "auth-error"} role="status">{message}</p>}
      <button className="auth-submit" disabled={busy || !auth}>{busy ? "Sending..." : "Send reset link"}</button>
    </form>
    <p className="auth-footer"><Link to="/login">Back to login</Link></p>
  </AuthLayout>;
}

export function ProfilePage() {
  const { user, profile, reloadProfile } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState(profile?.firstName ?? "");
  const [lastName, setLastName] = useState(profile?.lastName ?? "");
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber ?? "");
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    const digits = phoneNumber.replace(/[\s()-]/g, "");
    if (!/^(?:\+27|0)[1-8]\d{8}$/.test(digits)) {
      setMessage("Enter a valid South African phone number.");
      return;
    }
    try {
      await updateOwnUserProfile(user.uid, { firstName: firstName.trim(), lastName: lastName.trim(), phoneNumber: digits.startsWith("+27") ? digits : `+27${digits.slice(1)}` });
      await reloadProfile();
      setMessage("Your profile has been updated.");
    } catch (error) {
      setMessage(friendlyAuthError(error));
    }
  }
  return <AuthLayout title="Your profile" subtitle="Keep your contact details up to date.">
    <form className="auth-form" onSubmit={submit}>
      <label className="auth-field">Email address<input readOnly value={profile?.email ?? ""} /></label>
      <label className="auth-field">Account type<input readOnly value={profile?.role ?? ""} /></label>
      <div className="auth-form-row"><label className="auth-field">First name<input required value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label><label className="auth-field">Last name<input required value={lastName} onChange={(event) => setLastName(event.target.value)} /></label></div>
      <label className="auth-field">Phone number<input required value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} /></label>
      {message && <p className="auth-note" role="status">{message}</p>}
      <button className="auth-submit">Save changes</button>
      <button className="auth-secondary" type="button" onClick={() => navigate(-1)}>Back to marketplace</button>
    </form>
  </AuthLayout>;
}

export function SellerPendingPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (profile?.sellerStatus === "approved" && profile.accountStatus === "active") return <Navigate to="/seller" replace />;
  async function returnToLogin() {
    setBusy(true);
    setMessage("");
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      setMessage(friendlyAuthError(error));
      setBusy(false);
    }
  }
  return <AuthLayout title="Seller application pending" subtitle="Your seller application is awaiting review.">
    <div className="approval-popup-backdrop">
      <section className="approval-popup" role="dialog" aria-modal="true" aria-labelledby="approval-popup-title">
        <span className="eyebrow">Seller application</span>
        <h2 id="approval-popup-title">Awaiting for products to be verified</h2>
        <p>Your submitted products are waiting for an administrator to review them. Press Okay to return to the login page.</p>
        {message && <p className="auth-error" role="alert">{message}</p>}
        <button className="auth-submit" disabled={busy} onClick={() => void returnToLogin()}>{busy ? "Returning to login..." : "Okay"}</button>
      </section>
    </div>
  </AuthLayout>;
}

export function AccountUnavailablePage() {
  return <AuthLayout title="Account unavailable" subtitle="This account is currently suspended or rejected. Please contact marketplace support for help.">
    <button className="auth-secondary" onClick={() => void logout().catch((error: Error) => window.alert(friendlyAuthError(error)))}>Log out</button>
  </AuthLayout>;
}

export function PolicyPage({ kind }: { kind: "terms" | "privacy" }) {
  const isTerms = kind === "terms";
  return <AuthLayout title={isTerms ? "Marketplace terms" : "Privacy policy"} subtitle="Molelema Rise Community Marketplace">
    {isTerms
      ? <div className="policy-copy"><h2>Using the marketplace</h2><p>Use accurate contact and shop information. Customers are responsible for confirming receipt and payment honestly. Sellers are responsible for product listings, stock counts, and order updates.</p><h2>Seller applications</h2><p>Seller tools are available only after an administrator approves the application. Do not list products you cannot supply.</p><h2>Cash orders</h2><p>Orders use cash at pickup or delivery. The marketplace does not process or hold payments.</p><h2>Fair use</h2><p>Do not misuse accounts, share another person’s private information, or post unlawful or misleading listings.</p></div>
      : <div className="policy-copy"><h2>Information we collect</h2><p>We store account name, email, phone number, and seller application details to operate the marketplace. Orders include the buyer, seller, products, and order status so both parties can fulfil and track a purchase.</p><h2>How information is used</h2><p>Account information is used to provide marketplace features, support orders, prevent misuse, and review seller applications. Customer profiles and order histories are restricted to the account owner and authorized administrators under Supabase row-level security policies.</p><h2>Your choices</h2><p>Keep your account details accurate. Contact the marketplace administrator to request help with your account or personal information.</p></div>}
    <p className="auth-footer"><Link to="/register">Back to registration</Link></p>
  </AuthLayout>;
}

function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <main className="auth-page">
    <Link className="auth-brand" to="/"><img src="/assets/molelema-rise-mark.svg" alt="" /><span><strong>Molelema Rise</strong><small>Village marketplace</small></span></Link>
    <section className="auth-card"><span className="eyebrow">Molelema Rise Marketplace</span><h1>{title}</h1><p className="auth-subtitle">{subtitle}</p>{children}</section>
    <p className="auth-trust">Your account details are protected and are never shared publicly.</p>
  </main>;
}
