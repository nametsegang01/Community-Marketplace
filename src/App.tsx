import { FormEvent, useEffect, useMemo, useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import {
  AccountUnavailablePage,
  CompleteProfilePage,
  LoginPage,
  PolicyPage,
  ProfilePage,
  RegisterPage,
  ResetPasswordPage,
  SellerPendingPage,
} from "./AuthPages";
import {
  placeOrder,
  removeRecord,
  removeSellerRecords,
  logout,
  saveRecord,
  setAccountSuspended,
  setSellerApproval,
  uploadProductImage,
  watchCollection,
  type SellerProductApplication,
  type UserProfile,
} from "./supabase";

type Role = "buyer" | "seller" | "admin";
type IconName =
  | "shop" | "store" | "shield" | "basket" | "search" | "pin" | "check"
  | "plus" | "phone" | "truck" | "edit" | "bell" | "close" | "minus"
  | "eye" | "box" | "cash" | "clock" | "trash" | "orders";

type Seller = {
  id: string;
  name: string;
  place: string;
  image: string;
  sales: number;
  active: boolean;
};

type Product = {
  id: string;
  sellerId: string;
  seller: string;
  name: string;
  detail: string;
  place: string;
  price: number;
  stock: number;
  unit: string;
  category: string;
  image: string;
};

type Category = { id: string; name: string };

type Order = {
  id: string;
  buyerId?: string;
  buyer: string;
  sellerId: string;
  seller: string;
  items: string;
  amount: number;
  delivery: "Yard pickup" | "Gate delivery";
  status: string;
  paid?: boolean;
  buyerReceived?: boolean;
  buyerPaid?: boolean;
  productLines?: { productId: string; quantity: number }[];
  createdAt: number;
};

type OrderDetailLine = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  unit: string;
};

const initialCategories: Category[] = [
  { id: "firewood", name: "Firewood" },
  { id: "fresh-milk", name: "Fresh Milk" },
  { id: "atchaar", name: "Atchaar" },
  { id: "beauty", name: "Beauty" },
  { id: "hair", name: "Hair" },
  { id: "other", name: "Other" },
];

const orderSteps = ["Order placed", "Seller confirmed", "Ready for pickup", "Out for delivery", "Completed"];
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    shop: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></>,
    store: <><path d="M4 9h16l-1.5-5h-13L4 9Z"/><path d="M5 9v11h14V9M9 20v-6h6v6M4 9c0 2 3 2 4 0 1 2 3 2 4 0 1 2 3 2 4 0 1 2 4 2 4 0"/></>,
    shield: <><path d="M12 3 5 6v5c0 4.8 2.7 8.1 7 10 4.3-1.9 7-5.2 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>,
    basket: <><path d="m5 9 3-5m11 5-3-5M4 9h16l-2 11H6L4 9Z"/><path d="M9 12v4m6-4v4"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    phone: <path d="M7 3H4.5C3.7 3 3 3.7 3 4.5 3 13.6 10.4 21 19.5 21c.8 0 1.5-.7 1.5-1.5V17l-4-1-1.2 2c-4.4-1.8-8-5.4-9.8-9.8L8 7 7 3Z"/>,
    truck: <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>,
    edit: <><path d="m4 20 4.5-1L19 8.5 15.5 5 5 15.5 4 20Z"/><path d="m13.5 7 3.5 3.5"/></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    minus: <path d="M5 12h14"/>,
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></>,
    box: <><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/></>,
    cash: <><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M7 9H6v1m11-1h1v1M7 15H6v-1m11 1h1v-1"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7M10 11v6m4-6v6"/></>,
    orders: <><path d="M6 3h12v18H6zM9 7h6M9 11h6M9 15h4"/></>,
  };
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function Header({ role }: { role: Role }) {
  const { profile } = useAuth();
  return <header className="topbar">
    <Link className="brand" to={role === "buyer" ? "/market" : `/${role}`}><span className="brand-mark"><img src="/assets/molelema-rise-mark.svg" alt="" /></span><span><strong>Molelema Rise</strong><small><Icon name="pin" size={12} /> Village marketplace</small></span></Link>
    <nav className="account-nav"><span>{profile?.firstName} {profile?.lastName}</span><Link to="/profile">My profile</Link><button className="auth-logout" onClick={() => void logout().catch((error: Error) => window.alert(`Could not log out: ${error.message}`))}>Log out</button></nav>
  </header>;
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="scrim" onClick={onClose}><aside className="drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><h2>{title}</h2><button className="icon-button" onClick={onClose}><Icon name="close" /></button></div>{children}</aside></div>;
}

function OrderTracker({ order, confirmReceived }: { order: Order; confirmReceived: (order: Order) => Promise<void> }) {
  const current = Math.max(0, orderSteps.indexOf(order.status));
  const [received, setReceived] = useState(Boolean(order.buyerReceived));
  const [paid, setPaid] = useState<"yes" | "no" | "">(
    order.buyerPaid === undefined ? "" : order.buyerPaid ? "yes" : "no",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setReceived(Boolean(order.buyerReceived));
    setPaid(order.buyerPaid === undefined ? "" : order.buyerPaid ? "yes" : "no");
  }, [order.id, order.buyerReceived, order.buyerPaid]);
  const canConfirmReceipt = order.status === "Ready for pickup" || order.status === "Out for delivery" || order.status === "Completed";
  return <div className="tracker">
    <div className="track-summary"><span>{order.id}</span><strong>R{order.amount.toFixed(2)}</strong><p>{order.items}</p><small><Icon name="cash" size={14} /> Cash on {order.delivery.toLowerCase()}</small></div>
    <div className="timeline">{orderSteps.map((step, index) => <div className={index <= current ? "done" : ""} key={step}><i>{index < current ? <Icon name="check" size={13} /> : index + 1}</i><span><strong>{step}</strong><small>{index === current ? "Current status" : index < current ? "Done" : "Waiting"}</small></span></div>)}</div>
    {canConfirmReceipt && (!order.buyerReceived || !order.buyerPaid) && <div className="receipt-confirmation">
      <strong>Have you received your order?</strong>
      <label className="paid-toggle"><input type="checkbox" checked={received} onChange={(event) => setReceived(event.target.checked)} /><span><strong>Yes, I received the items</strong></span></label>
      <strong>Have you paid the seller?</strong>
      <label className="paid-toggle"><input type="radio" name={`buyer-paid-${order.id}`} checked={paid === "yes"} onChange={() => setPaid("yes")} /><span><strong>Yes, I paid in cash</strong></span></label>
      <label className="paid-toggle"><input type="radio" name={`buyer-paid-${order.id}`} checked={paid === "no"} onChange={() => setPaid("no")} /><span><strong>No, I have not paid yet</strong></span></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="primary wide" disabled={!received || !paid || saving} onClick={() => {
        setSaving(true);
        setError("");
        void confirmReceived({ ...order, buyerReceived: true, buyerPaid: paid === "yes" })
          .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not save your confirmation. Please try again."))
          .finally(() => setSaving(false));
      }}>{saving ? "Saving confirmation..." : "Confirm my answers"}</button>
    </div>}
    {order.buyerReceived && order.buyerPaid && <p className="receipt-status">You confirmed that you received the order and paid the seller.</p>}
    {order.buyerReceived && !order.buyerPaid && <p className="receipt-status">You confirmed receipt. Please pay the seller before confirming payment and completing the order.</p>}
  </div>;
}

function OrderDialog({
  order,
  lines,
  mode,
  onShowDetails,
  onTrack,
  onClose,
}: {
  order: Order;
  lines: OrderDetailLine[];
  mode: "success" | "details";
  onShowDetails: () => void;
  onTrack: () => void;
  onClose: () => void;
}) {
  return <div className="order-dialog-scrim" onClick={onClose}>
    <section className="order-dialog" role="dialog" aria-modal="true" aria-labelledby="order-dialog-title" onClick={(event) => event.stopPropagation()}>
      <button className="icon-button order-dialog-close" aria-label="Close order message" onClick={onClose}><Icon name="close" /></button>
      {mode === "success" ? <>
        <span className="order-dialog-mark"><Icon name="check" size={27} /></span>
        <span className="eyebrow">Order confirmed</span>
        <h2 id="order-dialog-title">Thank you for your order!</h2>
        <p>Your cash order <strong>{order.id}</strong> has been placed. What would you like to do next?</p>
        <div className="order-dialog-actions">
          <button className="primary wide" onClick={onShowDetails}>View order details</button>
          <button className="order-dialog-secondary" onClick={onTrack}>Track order</button>
          <button className="order-dialog-okay" onClick={onClose}>Okay</button>
        </div>
      </> : <>
        <span className="eyebrow">Order details</span>
        <h2 id="order-dialog-title">Your purchase</h2>
        <p className="order-dialog-reference">{order.id} · {order.seller}</p>
        <div className="order-detail-lines">
          {lines.map((line) => <div className="order-detail-line" key={line.productId}>
            <span><strong>{line.name}</strong><small>{line.quantity} × R{line.unitPrice.toFixed(2)} per {line.unit}</small></span>
            <b>R{(line.quantity * line.unitPrice).toFixed(2)}</b>
          </div>)}
          {order.delivery === "Gate delivery" && <div className="order-detail-line"><span><strong>Gate delivery</strong></span><b>R15.00</b></div>}
        </div>
        <div className="order-detail-total"><span>Total · {order.delivery}</span><strong>R{order.amount.toFixed(2)}</strong></div>
        <p>Would you like to track this order?</p>
        <div className="order-dialog-actions order-detail-actions">
          <button className="primary wide" onClick={onTrack}>Track this order</button>
          <button className="order-dialog-okay" onClick={onClose}>Not now · Okay</button>
        </div>
      </>}
    </section>
  </div>;
}

function Buyer({ uid, products, orders, createOrder, updateOrder, notify }: { uid: string; products: Product[]; orders: Order[]; createOrder: (order: Order, productUpdates: { productId: string; quantity: number }[]) => Promise<void>; updateOrder: (order: Order) => Promise<void>; notify: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<string[]>([]);
  const [sheet, setSheet] = useState<"cart" | "track" | null>(null);
  const [delivery, setDelivery] = useState<"Yard pickup" | "Gate delivery">("Yard pickup");
  const [tracked, setTracked] = useState<Order | null>(null);
  const [orderDialog, setOrderDialog] = useState<{ order: Order; lines: OrderDetailLine[]; mode: "success" | "details" } | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const categories = ["All", ...new Set(products.map((product) => product.category))];
  const shown = useMemo(() => products.filter((product) => product.stock > 0 && (category === "All" || product.category === category) && `${product.name} ${product.seller}`.toLowerCase().includes(query.toLowerCase())), [products, category, query]);
  const total = cart.reduce((sum, id) => sum + (products.find((product) => product.id === id)?.price ?? 0), delivery === "Gate delivery" ? 15 : 0);

  async function checkout() {
    if (placingOrder) return;
    setCheckoutError("");
    if (cart.length === 0) {
      setCheckoutError("Your basket is empty. Add a product before checking out.");
      return;
    }
    const unavailable = cart.find((productId) => !products.some((product) => product.id === productId));
    if (unavailable) {
      setCheckoutError("A product in your basket is no longer available. Remove it and try again.");
      return;
    }
    const productUpdates = [...new Set(cart)].map((productId) => ({
      productId,
      quantity: cart.filter((id) => id === productId).length,
    }));
    const outOfStock = productUpdates.find(({ productId, quantity }) => {
      const product = products.find((item) => item.id === productId);
      return !product || quantity > product.stock;
    });
    if (outOfStock) {
      setCheckoutError(`${products.find((product) => product.id === outOfStock.productId)?.name ?? "A product"} no longer has enough stock. Update your basket and try again.`);
      return;
    }
    const sellerIds = new Set(productUpdates.map(({ productId }) => products.find((product) => product.id === productId)?.sellerId));
    if (sellerIds.size !== 1) {
      setCheckoutError("Place one seller's order at a time. Remove products from other sellers and try again.");
      return;
    }
    const lines = productUpdates.map(({ productId, quantity }) => {
      const product = products.find((item) => item.id === productId);
      return product ? `${quantity}× ${product.name}` : "";
    }).filter(Boolean);
    const first = products.find((product) => product.id === cart[0]);
    if (!first) {
      setCheckoutError("Your basket is empty. Add a product before checking out.");
      return;
    }
    const order: Order = { id: `MLM-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`, buyerId: uid, buyer: "You", sellerId: first.sellerId, seller: first.seller, items: lines.join(", "), productLines: productUpdates, amount: Number(total.toFixed(2)), delivery, status: "Order placed", paid: false, createdAt: Date.now() };
    const detailLines = productUpdates.map(({ productId, quantity }) => {
      const product = products.find((item) => item.id === productId);
      return product ? { productId, name: product.name, quantity, unitPrice: product.price, unit: product.unit } : null;
    }).filter((line): line is OrderDetailLine => line !== null);
    setPlacingOrder(true);
    try {
      await createOrder(order, productUpdates);
      setTracked(order);
      setCart([]);
      setSheet(null);
      setOrderDialog({ order, lines: detailLines, mode: "success" });
      notify("Cash order placed. Stock has been updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not place your order. Please try again.";
      setCheckoutError(message);
      notify(`Order not placed: ${message}`);
    } finally {
      setPlacingOrder(false);
    }
  }

  return <main className="page buyer-page">
    <section className="market-banner"><img src="/assets/village-center.png" alt="Molelema Village Center" /><div><span>Molelema Village • Taung</span><h1>Shop local goods</h1></div></section>
    <div className="buyer-actions"><label className="search"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the village market" /></label><button onClick={() => { setTracked(null); setSheet("track"); }}><Icon name="orders" /><span>Track order</span></button></div>
    <div className="chips">{categories.map((item) => <button className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
    <div className="section-heading"><div><span className="eyebrow">Village market</span><h2>Available now</h2></div><span>{shown.length} products</span></div>
    <section className="product-grid">{shown.map((product) => <article className="product-card" key={product.id}>
      <div className="product-image"><img src={product.image} alt={product.name} /><span>{product.stock} left</span></div>
      <div className="product-body"><span className="seller-name">{product.seller}</span><h3>{product.name}</h3><p>{product.detail}</p><div className="product-footer"><div><strong>R{product.price.toFixed(2)}</strong><small>{product.unit}</small></div><button disabled={cart.filter((id) => id === product.id).length >= product.stock} onClick={() => { const currentSellerIds = new Set(cart.map((id) => products.find((item) => item.id === id)?.sellerId).filter(Boolean)); if (currentSellerIds.size && !currentSellerIds.has(product.sellerId)) { notify("Please place one seller's order at a time. Finish your current basket first."); return; } setCart((items) => [...items, product.id]); notify("Added to basket"); }}><Icon name="plus" /> {cart.filter((id) => id === product.id).length >= product.stock ? "Max in basket" : "Add"}</button></div></div>
    </article>)}</section>
    <section className="history-section">
      <div className="section-heading"><div><span className="eyebrow">Your activity</span><h2>Your previous orders</h2></div><span>{orders.filter((order) => order.buyerId === uid).length} orders</span></div>
      {orders.filter((order) => order.buyerId === uid).length ? <div className="history-list">{orders.filter((order) => order.buyerId === uid).sort((a,b) => b.createdAt-a.createdAt).map((order) => <article className="history-card" key={order.id}><div><span className="order-id">{order.id}</span><span className="status">{order.status}</span><h3>{order.seller}</h3><p>{order.items}</p><small>{new Date(order.createdAt).toLocaleDateString()} · {order.delivery}</small></div><div className="history-side"><strong>R{order.amount.toFixed(2)}</strong><button onClick={() => { setTracked(order); setSheet("track"); }}>View progress</button></div></article>)}</div> : <div className="empty history-empty"><Icon name="orders" size={30} /><h3>Your orders will appear here</h3><p>When you buy from a local seller, you can come back here to check its progress.</p></div>}
    </section>
    {cart.length > 0 && <button className="floating-cart" onClick={() => setSheet("cart")}><span><b>{cart.length}</b><span>View basket<small>Cash only</small></span></span><strong>R{total.toFixed(2)} <Icon name="basket" /></strong></button>}
    {sheet === "cart" && <Sheet title="Your basket" onClose={() => setSheet(null)}>
      <div className="cart-items">{products.filter((product) => cart.includes(product.id)).map((product) => { const count = cart.filter((id) => id === product.id).length; return <div className="cart-item" key={product.id}><img src={product.image} alt="" /><div><strong>{product.name}</strong><small>{product.seller} · {product.stock} in stock</small><b>R{(product.price * count).toFixed(2)}</b></div><div className="quantity"><button onClick={() => { setCheckoutError(""); setCart((items) => items.filter((_, index) => index !== items.indexOf(product.id))); }}><Icon name="minus" size={14} /></button><span>{count}</span><button disabled={count >= product.stock} onClick={() => { setCheckoutError(""); setCart((items) => [...items, product.id]); }}><Icon name="plus" size={14} /></button></div></div>; })}</div>
      <div className="delivery-choice"><button className={delivery === "Yard pickup" ? "active" : ""} onClick={() => setDelivery("Yard pickup")}><Icon name="store" /><span>Yard pickup<small>Free</small></span></button><button className={delivery === "Gate delivery" ? "active" : ""} onClick={() => setDelivery("Gate delivery")}><Icon name="truck" /><span>Gate delivery<small>+ R15</small></span></button></div>
      <div className="cash-note"><Icon name="cash" /><span><strong>Cash payment only</strong><small>Pay the seller on collection or delivery. After placing your order, you can track it and confirm payment.</small></span></div>
      <div className="total-row"><span>Total cash due</span><strong>R{total.toFixed(2)}</strong></div>
      {checkoutError && <p className="auth-error" role="alert" aria-live="assertive">{checkoutError}</p>}
      <button type="button" className="primary wide" disabled={placingOrder || cart.length === 0} onClick={() => void checkout()}>{placingOrder ? "Placing your order..." : "Place cash order"}</button>
    </Sheet>}
    {sheet === "track" && <Sheet title="Track your order" onClose={() => setSheet(null)}>{tracked ? <OrderTracker order={orders.find((order) => order.id === tracked.id) ?? tracked} confirmReceived={async (order) => {
      await updateOrder(order);
      notify(order.buyerPaid ? "Thank you for confirming receipt and payment." : "Receipt confirmed. Please pay the seller before confirming payment.");
    }} /> : <div className="empty"><Icon name="orders" size={36} /><h3>No orders yet</h3><p>Your cash orders will appear here after checkout.</p></div>}</Sheet>}
    {orderDialog && <OrderDialog order={orderDialog.order} lines={orderDialog.lines} mode={orderDialog.mode}
      onShowDetails={() => setOrderDialog((current) => current ? { ...current, mode: "details" } : null)}
      onTrack={() => { setTracked(orderDialog.order); setOrderDialog(null); setSheet("track"); }}
      onClose={() => setOrderDialog(null)} />}
  </main>;
}

function ProductForm({ product, categories, onSave, onClose }: { product?: Product; categories: Category[]; onSave: (product: Product) => void; onClose: () => void }) {
  const [form, setForm] = useState<Product>(product ?? { id: `product-${Date.now()}`, sellerId: "motsamai", seller: "Mr Motsamai Firewood", name: "", detail: "", place: "Masakaneng", price: 0, stock: 0, unit: "each", category: "Other", image: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!imageFile && !form.image) {
      setImageError("Choose a product photo from your device.");
      return;
    }
    setSaving(true);
    setImageError("");
    try {
      const image = imageFile ? await uploadProductImage(imageFile) : form.image;
      onSave({ ...form, image, price: Number(form.price), stock: Number(form.stock) });
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "The product photo could not be uploaded.");
    } finally {
      setSaving(false);
    }
  }
  return <Sheet title={product ? "Edit product" : "Add new product"} onClose={onClose}><form className="product-form" onSubmit={submit}>
    <label>Product name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
    <label>Description<input required value={form.detail} onChange={(event) => setForm({ ...form, detail: event.target.value })} /></label>
    <div className="form-row"><label>Price (R)<input required min="0" type="number" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} /></label><label>Stock on hand<input required min="0" type="number" value={form.stock} onChange={(event) => setForm({ ...form, stock: Number(event.target.value) })} /></label></div>
    <div className="form-row"><label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((category) => <option key={category.id}>{category.name}</option>)}</select></label><label>Sold by<select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}><option>each</option><option>per litre</option><option>per bundle</option><option>per tub</option><option>per bakkie</option></select></label></div>
    <label>Product photo<input type="file" accept="image/*" required={!form.image} onChange={(event) => {
      const file = event.target.files?.[0] ?? null;
      if (file && !file.type.startsWith("image/")) {
        setImageError("Choose an image file.");
        event.target.value = "";
        return;
      }
      if (file && file.size > 5 * 1024 * 1024) {
        setImageError("Choose an image smaller than 5 MB.");
        event.target.value = "";
        return;
      }
      setImageError("");
      setImageFile(file);
    }} />{imageFile && <small>{imageFile.name}</small>}{form.image && !imageFile && <img className="product-photo-preview" src={form.image} alt="Current product" />}{imageError && <small className="form-error">{imageError}</small>}</label>
    <button className="primary wide" type="submit" disabled={saving}>{saving ? "Saving product..." : "Save product"}</button>
  </form></Sheet>;
}

function SellerView({ uid, profile, products, orders, categories, saveProduct, deleteProduct, updateOrder, notify }: { uid: string; profile: UserProfile; products: Product[]; orders: Order[]; categories: Category[]; saveProduct: (product: Product) => void; deleteProduct: (id: string) => void; updateOrder: (order: Order) => Promise<void>; notify: (message: string) => void }) {
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const currentSeller: Seller = { id: uid, name: profile.shopName ?? `${profile.firstName} ${profile.lastName}`, place: profile.village ?? "Molelema", image: "/assets/seller-firewood.png", sales: 0, active: profile.sellerStatus === "approved" };
  const mine = products.filter((product) => product.sellerId === currentSeller?.id);
  const myOrders = orders.filter((order) => order.sellerId === currentSeller?.id);
  async function advance(order: Order) {
    const sequence = order.delivery === "Gate delivery" ? ["Order placed", "Seller confirmed", "Out for delivery", "Completed"] : ["Order placed", "Seller confirmed", "Ready for pickup", "Completed"];
    const next = sequence[Math.min(sequence.indexOf(order.status) + 1, sequence.length - 1)];
    if (next === "Completed" && (!order.paid || !order.buyerReceived || !order.buyerPaid)) {
      notify("To complete this order, confirm you received the cash and wait for the buyer's receipt and payment confirmation.");
      return;
    }
    await updateOrder({ ...order, status: next });
    notify(`Order updated to ${next}`);
  }
  return <main className="page">
    <section className="role-hero"><div><span className="eyebrow">Seller workspace</span><h1>{currentSeller.name}</h1><p><Icon name="pin" size={14} /> {currentSeller.place} • Molelema</p></div><button className="primary" onClick={() => setEditing("new")}><Icon name="plus" /> Add product</button></section>
    <section className="stats-grid">{[["Products", mine.length, "Listed"], ["Stock units", mine.reduce((sum, product) => sum + product.stock, 0), "On hand"], ["New orders", myOrders.filter((order) => order.status === "Order placed").length, "Needs action"], ["Cash due", `R${myOrders.filter((order) => order.status !== "Completed").reduce((sum, order) => sum + order.amount, 0)}`, "At handover"]].map(([label, value, note]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</section>
    <div className="dashboard-grid"><section><div className="section-heading"><div><span className="eyebrow">Your catalog</span><h2>Products & stock</h2></div><button className="text-action" onClick={() => setEditing("new")}><Icon name="plus" size={16} /> New</button></div>
      <div className="manage-list">{mine.map((product) => <article key={product.id}><img src={product.image} alt="" /><div><h3>{product.name}</h3><span>{product.stock} in stock</span><strong>R{product.price.toFixed(2)} {product.unit}</strong></div><div><button onClick={() => setEditing(product)}><Icon name="edit" size={16} /> Edit</button><button className="danger" onClick={() => deleteProduct(product.id)}><Icon name="trash" size={16} /></button></div></article>)}</div>
    </section><section><div className="section-heading"><div><span className="eyebrow">Cash orders</span><h2>Incoming</h2></div><span>{myOrders.length}</span></div><div className="order-list">{myOrders.map((order) => { const finalStep = order.delivery === "Gate delivery" ? order.status === "Out for delivery" : order.status === "Ready for pickup"; const canComplete = order.paid && order.buyerReceived && order.buyerPaid; const buyerConfirmation = order.buyerPaid ? "Buyer confirmed receipt and payment" : order.buyerReceived ? "Buyer received the order but says they have not paid" : "Waiting for buyer to confirm receipt and payment"; return <article className="order-card" key={order.id}><div className="order-head"><div><span className="order-id">{order.id}</span><span className="status">{order.status}</span><h3>{order.buyer}</h3></div><strong>R{order.amount.toFixed(2)}</strong></div><div className="order-detail"><strong>{order.items}</strong><small><Icon name="cash" size={15} /> Cash • {order.delivery}</small></div><label className="paid-toggle"><input type="checkbox" checked={Boolean(order.paid)} disabled={order.status === "Completed"} onChange={(event) => {
      const paid = event.target.checked;
      void updateOrder({ ...order, paid }).then(() => notify(paid ? "Payment marked as received" : "Payment marked as not received")).catch((error: Error) => notify(`Could not update payment: ${error.message}`));
    }} /><span><strong>I received the cash payment</strong><small>{buyerConfirmation}</small></span></label><button className="primary wide" disabled={order.status === "Completed" || (finalStep && !canComplete)} onClick={() => {
      void advance(order).catch((error: Error) => notify(`Could not update order: ${error.message}`));
    }}>{order.status === "Completed" ? "Order completed" : finalStep && !canComplete ? "Confirm receipt and payment first" : "Move to next step"}</button></article>; })}</div></section></div>
    {editing && <ProductForm categories={categories} product={editing === "new" ? { id: `product-${Date.now()}`, sellerId: currentSeller.id, seller: currentSeller.name, name: "", detail: "", place: currentSeller.place, price: 0, stock: 0, unit: "each", category: categories[0]?.name ?? "Other", image: "" } : editing} onClose={() => setEditing(null)} onSave={(product) => { saveProduct({ ...product, sellerId: currentSeller.id, seller: currentSeller.name, place: currentSeller.place }); setEditing(null); notify("Product saved to your catalog"); }} />}
  </main>;
}

function Admin({ sellers, products, orders, users, sellerApplications, categories, saveProduct, deleteSeller, deleteProduct, updateOrder, toggleSeller, addCategory, deleteCategory, notify }: { sellers: Seller[]; products: Product[]; orders: Order[]; users: UserProfile[]; sellerApplications: SellerProductApplication[]; categories: Category[]; saveProduct: (product: Product) => void; deleteSeller: (id: string) => void; deleteProduct: (id: string) => void; updateOrder: (order: Order) => Promise<void>; toggleSeller: (seller: Seller) => void; addCategory: (name: string) => Promise<void>; deleteCategory: (id: string) => void; notify: (message: string) => void }) {
  const [tab, setTab] = useState<"sellers" | "buyers" | "products" | "orders" | "categories">("sellers");
  const [categoryName, setCategoryName] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  return <main className="page"><section className="role-hero admin-hero"><div><span className="eyebrow">Admin console</span><h1>Marketplace control</h1><p>Manage every seller, product and cash order.</p></div></section>
    <section className="stats-grid">{[["Sellers", sellers.length, "Village businesses"], ["Products", products.length, "Live listings"], ["Orders", orders.length, "Cash only"], ["Sales", `R${orders.reduce((sum, order) => sum + order.amount, 0)}`, "Order value"]].map(([label, value, note]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</section>
    <div className="admin-tabs"><button className={tab === "sellers" ? "active" : ""} onClick={() => setTab("sellers")}>Sellers</button><button className={tab === "buyers" ? "active" : ""} onClick={() => setTab("buyers")}>Customers</button><button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}>Products</button><button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>Orders</button><button className={tab === "categories" ? "active" : ""} onClick={() => setTab("categories")}>Categories</button></div>
    {tab === "sellers" && <>
      <div className="section-heading">
        <div><span className="eyebrow">Applications</span><h2>Seller approval requests</h2></div>
        <span>{users.filter((user) => user.role === "seller" && user.sellerStatus === "pending").length} pending</span>
      </div>
      <div className="admin-list">
        {users.filter((user) => user.role === "seller" && user.sellerStatus === "pending").map((user) => (
          <article key={user.uid}>
            <span className="admin-order-icon"><Icon name="store" /></span>
            <div>
              <h3>{user.shopName}</h3>
              <span>{user.firstName} {user.lastName} · {user.email}</span>
              <small>{user.village} · {user.businessDescription}</small>
              <div className="seller-application-products">
                <strong>Submitted products</strong>
                {sellerApplications.filter((product) => product.sellerId === user.uid).map((product) => (
                  <div className="seller-application-product" key={product.id}>
                    <img src={product.image} alt="" />
                    <span>{product.name} · R{product.price.toFixed(2)} · {product.stock} {product.unit}</span>
                    <small>{product.category} · {product.detail}</small>
                  </div>
                ))}
              </div>
            </div>
            <div className="admin-actions">
              <button onClick={() => void setSellerApproval(user.uid, true).then(() => notify("Seller approved and submitted products published")).catch((error: Error) => notify(`Could not approve seller: ${error.message}`))}><Icon name="check" /> Approve</button>
              <button className="danger" onClick={() => void setSellerApproval(user.uid, false).then(() => notify("Seller application rejected")).catch((error: Error) => notify(`Could not reject seller: ${error.message}`))}>Reject</button>
            </div>
          </article>
        ))}
      </div>
      <div className="section-heading"><div><span className="eyebrow">Marketplace</span><h2>Seller shops</h2></div></div>
      <div className="admin-list">{sellers.map((seller) => <article key={seller.id}><img src={seller.image} alt="" /><div><h3>{seller.name}</h3><span>{seller.place}</span><small>{products.filter((product) => product.sellerId === seller.id).length} products · {orders.filter((order) => order.sellerId === seller.id).length} orders</small><small className={seller.active ? "seller-active" : "seller-paused"}>{seller.active ? "Active seller" : "Paused seller"}</small></div><div className="admin-actions"><label className="compact-toggle"><input type="checkbox" checked={seller.active} onChange={() => { toggleSeller(seller); notify(seller.active ? "Seller paused" : "Seller activated"); }} /><span>{seller.active ? "Active" : "Paused"}</span></label><button className="danger" onClick={() => { if (window.confirm(`Remove ${seller.name} and all their products?`)) { deleteSeller(seller.id); notify("Seller and their products removed"); } }}><Icon name="trash" /> Remove</button></div></article>)}</div>
    </>}
    {tab === "sellers" && <><div className="section-heading"><div><span className="eyebrow">Approved seller accounts</span><h2>Seller access</h2></div></div><div className="admin-list">{users.filter((user) => user.role === "seller" && user.sellerStatus === "approved").map((seller) => <article key={seller.uid}><span className="admin-order-icon"><Icon name="store" /></span><div><h3>{seller.shopName}</h3><span>{seller.firstName} {seller.lastName} · {seller.email}</span><small>{seller.accountStatus} · {seller.village}</small></div><button className={seller.accountStatus === "suspended" ? "" : "danger"} onClick={() => void setAccountSuspended(seller.uid, seller.accountStatus !== "suspended").then(() => notify(seller.accountStatus === "suspended" ? "Seller reactivated" : "Seller suspended")).catch((error: Error) => notify(`Could not update seller: ${error.message}`))}>{seller.accountStatus === "suspended" ? "Reactivate" : "Suspend"}</button></article>)}</div></>}
    {tab === "buyers" && <div className="admin-list">{users.filter((user) => user.role === "customer").map((customer) => <article key={customer.uid}><span className="admin-order-icon"><Icon name="orders" /></span><div><h3>{customer.firstName} {customer.lastName}</h3><span>{customer.email} · {customer.phoneNumber}</span><small>{customer.accountStatus} account · {orders.filter((order) => order.buyerId === customer.uid).length} orders</small></div><button className={customer.accountStatus === "suspended" ? "" : "danger"} onClick={() => void setAccountSuspended(customer.uid, customer.accountStatus !== "suspended").then(() => notify(customer.accountStatus === "suspended" ? "Customer account reactivated" : "Customer account suspended")).catch((error: Error) => notify(`Could not update customer: ${error.message}`))}>{customer.accountStatus === "suspended" ? "Reactivate" : "Suspend"}</button></article>)}</div>}
    {tab === "products" && <><div className="section-heading"><div><span className="eyebrow">Marketplace</span><h2>Product listings</h2></div><span>{products.length} products</span></div><div className="admin-list">{products.map((product) => <article key={product.id}><img src={product.image} alt="" /><div><h3>{product.name}</h3><span>{product.seller}</span><small>R{product.price} • {product.stock} in stock</small></div><div className="admin-actions"><button onClick={() => setEditingProduct(product)}><Icon name="edit" /> Edit</button><button className="danger" onClick={() => { deleteProduct(product.id); notify("Product removed from the market"); }}><Icon name="trash" /> Delete</button></div></article>)}</div></>}
    {tab === "orders" && <div className="admin-list">{orders.map((order) => <article key={order.id}><span className="admin-order-icon"><Icon name="orders" /></span><div><h3>{order.id} • {order.buyer}</h3><span>{order.items}</span><small>{order.status} • R{order.amount.toFixed(2)} cash • {order.paid ? "Paid" : "Payment not confirmed"}</small></div><div className="admin-actions"><label className="compact-toggle"><input type="checkbox" checked={Boolean(order.paid)} onChange={(event) => {
      const paid = event.target.checked;
      void updateOrder({ ...order, paid }).then(() => notify("Payment status updated")).catch((error: Error) => notify(`Could not update payment: ${error.message}`));
    }} /><span>Paid</span></label><button onClick={() => {
      void updateOrder({ ...order, status: "Completed" }).then(() => notify("Order marked completed")).catch((error: Error) => notify(`Could not complete order: ${error.message}`));
    }}><Icon name="check" /> Complete</button></div></article>)}</div>}
    {tab === "categories" && <><form className="category-form" onSubmit={(event) => { event.preventDefault(); void addCategory(categoryName).then(() => setCategoryName("")).catch((error: Error) => notify(`Could not add category: ${error.message}`)); }}><label className="auth-field">New category<input required maxLength={40} value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="e.g. Fresh produce" /></label><button className="primary">Add category</button></form><div className="admin-list">{categories.map((category) => <article key={category.id}><div><h3>{category.name}</h3></div><button className="danger" disabled={products.some((product) => product.category === category.name)} onClick={() => deleteCategory(category.id)}>{products.some((product) => product.category === category.name) ? "In use" : "Delete"}</button></article>)}</div></>}
    {editingProduct && <ProductForm product={editingProduct} categories={categories} onClose={() => setEditingProduct(null)} onSave={(product) => { saveProduct(product); setEditingProduct(null); notify("Product update submitted"); }} />}
  </main>;
}

export default function App() {
  return <BrowserRouter><AuthProvider><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/complete-profile" element={<CompleteProfilePage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/seller-pending" element={<SellerApplicationRoute />} />
    <Route path="/account-unavailable" element={<UnavailableRoute />} />
    <Route path="/terms" element={<PolicyPage kind="terms" />} />
    <Route path="/privacy" element={<PolicyPage kind="privacy" />} />
    <Route path="/profile" element={<RequireUser><ProfilePage /></RequireUser>} />
    <Route path="/market" element={<RequireRole roles={["customer"]}><MarketplaceApp role="buyer" /></RequireRole>} />
    <Route path="/seller" element={<RequireRole roles={["seller"]}><MarketplaceApp role="seller" /></RequireRole>} />
    <Route path="/admin" element={<RequireRole roles={["admin"]}><MarketplaceApp role="admin" /></RequireRole>} />
    <Route path="/" element={<Navigate to="/login" replace />} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes></AuthProvider></BrowserRouter>;
}

function RequireUser({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, error } = useAuth();
  if (loading) return <AuthLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return error ? <AuthProblem message={error} /> : <Navigate to="/complete-profile" replace />;
  if (profile.accountStatus === "suspended" || profile.accountStatus === "rejected" || profile.sellerStatus === "rejected") return <Navigate to="/account-unavailable" replace />;
  if (profile.accountStatus !== "active" && profile.role !== "seller") return <Navigate to="/account-unavailable" replace />;
  return <>{children}</>;
}

function UnavailableRoute() {
  const { user, profile, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <Navigate to="/complete-profile" replace />;
  if (profile.accountStatus === "suspended" || profile.accountStatus === "rejected" || profile.sellerStatus === "rejected" || (profile.role !== "seller" && profile.accountStatus !== "active")) return <AccountUnavailablePage />;
  return <Navigate to={profile.role === "admin" ? "/admin" : profile.role === "seller" ? "/seller" : "/market"} replace />;
}

function RequireRole({ roles, children }: { roles: UserProfile["role"][]; children: React.ReactNode }) {
  const { user, profile, loading, error } = useAuth();
  if (loading) return <AuthLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return error ? <AuthProblem message={error} /> : <Navigate to="/complete-profile" replace />;
  if (profile.accountStatus === "suspended" || profile.accountStatus === "rejected" || profile.sellerStatus === "rejected") return <Navigate to="/account-unavailable" replace />;
  if (profile.role !== "seller" && profile.accountStatus !== "active") return <Navigate to="/account-unavailable" replace />;
  if (profile.role === "seller" && (profile.sellerStatus !== "approved" || profile.accountStatus !== "active")) return <Navigate to="/seller-pending" replace />;
  if (!roles.includes(profile.role)) {
    const destination = profile.role === "admin" ? "/admin" : profile.role === "seller" ? "/seller" : "/market";
    return <Navigate to={destination} replace />;
  }
  return <>{children}</>;
}

function SellerApplicationRoute() {
  const { user, profile, loading, error } = useAuth();
  if (loading) return <AuthLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return error ? <AuthProblem message={error} /> : <Navigate to="/complete-profile" replace />;
  if (profile.role !== "seller") {
    return <Navigate to={profile.role === "admin" ? "/admin" : "/market"} replace />;
  }
  if (profile.accountStatus === "suspended" || profile.accountStatus === "rejected" || profile.sellerStatus === "rejected") {
    return <Navigate to="/account-unavailable" replace />;
  }
  if (profile.sellerStatus === "approved" && profile.accountStatus === "active") {
    return <Navigate to="/seller" replace />;
  }
  return <SellerPendingPage />;
}

function AuthLoading() {
  return <main className="auth-page"><section className="auth-card" role="status">Checking your account…</section></main>;
}

function AuthProblem({ message }: { message: string }) {
  return <main className="auth-page"><section className="auth-card"><h1>Could not load your account</h1><p className="auth-error">{message}</p><button className="auth-secondary" onClick={() => window.location.reload()}>Try again</button></section></main>;
}

function MarketplaceApp({ role }: { role: Role }) {
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [users, setUsers] = useState<(UserProfile & { id: string })[]>([]);
  const [sellerApplications, setSellerApplications] = useState<SellerProductApplication[]>([]);
  const [toast, setToast] = useState("");

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 3200); }

  useEffect(() => {
    if (!user) return;
    const fail = (error: Error) => notify(`Marketplace data error: ${error.message}`);
    let categorySnapshotReceived = false;
    const orderFilter = role === "admin" ? undefined : { field: role === "seller" ? "sellerId" : "buyerId", value: user.uid };
    const stops = [
      watchCollection<Product>("products", setProducts, fail),
      watchCollection<Seller>("sellers", setSellers, fail),
      watchCollection<Order>("orders", setOrders, fail, orderFilter),
      watchCollection<Category>("categories", (items) => {
        if (items.length) {
          categorySnapshotReceived = true;
          setCategories(items);
        } else if (role === "admin" && !categorySnapshotReceived) {
          categorySnapshotReceived = true;
          setCategories(initialCategories);
          void Promise.all(initialCategories.map((category) => saveRecord("categories", category))).catch(fail);
        } else if (role === "admin") {
          setCategories([]);
        }
      }, fail),
    ];
    if (role === "admin") {
      stops.push(watchCollection<UserProfile & { id: string }>("users", setUsers, fail));
      stops.push(watchCollection<SellerProductApplication>("seller_application_products", setSellerApplications, fail));
    }
    return () => stops.forEach((stop) => stop());
  }, [role, user]);

  function saveProduct(product: Product) {
    setProducts((items) => [...items.filter((item) => item.id !== product.id), product]);
    void saveRecord("products", product).catch((error: Error) => notify(`Could not save product: ${error.message}`));
  }
  function deleteProduct(id: string) {
    setProducts((items) => items.filter((item) => item.id !== id));
    void removeRecord("products", id).catch((error: Error) => notify(`Could not remove product: ${error.message}`));
  }
  async function createOrder(order: Order, productUpdates: { productId: string; quantity: number }[]) {
    const updatedProducts = await placeOrder<Product, Order>(order, productUpdates, products);
    const updatedById = new Map(updatedProducts.map((product) => [product.id, product]));
    setProducts((items) => items.map((product) => updatedById.get(product.id) ?? product));
    setOrders((items) => [order, ...items]);
  }
  async function updateOrder(order: Order): Promise<void> {
    await saveRecord("orders", order);
    setOrders((items) => items.map((item) => item.id === order.id ? order : item));
  }
  async function addCategory(name: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Enter a category name.");
    if (categories.some((category) => category.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error("That category already exists.");
    }
    const category = { id: trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || crypto.randomUUID(), name: trimmed };
    await saveRecord("categories", category);
    setCategories((items) => [...items, category]);
  }
  function deleteCategory(id: string) {
    setCategories((items) => items.filter((category) => category.id !== id));
    void removeRecord("categories", id).catch((error: Error) => notify(`Could not remove category: ${error.message}`));
  }
  function deleteSeller(id: string) {
    const productIds = products.filter((product) => product.sellerId === id).map((product) => product.id);
    setSellers((items) => items.filter((item) => item.id !== id));
    setProducts((items) => items.filter((item) => item.sellerId !== id));
    void removeSellerRecords(id, productIds).catch((error: Error) => notify(`Could not remove seller: ${error.message}`));
  }

  const sellerShop: Seller = {
    id: user?.uid ?? "",
    name: profile?.shopName ?? `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim(),
    place: profile?.village ?? "Molelema",
    image: "/assets/seller-firewood.png",
    sales: 0,
    active: profile?.sellerStatus === "approved",
  };
  const visibleSellers = role === "seller" ? [sellerShop] : sellers;

  return <div className="app-shell"><Header role={role} />
    {role === "buyer" && <Buyer uid={user?.uid ?? ""} products={products.filter((product) => sellers.some((seller) => seller.id === product.sellerId && seller.active))} orders={orders} createOrder={createOrder} updateOrder={updateOrder} notify={notify} />}
    {role === "seller" && profile && <SellerView uid={user?.uid ?? ""} profile={profile} products={products} orders={orders} categories={categories} saveProduct={saveProduct} deleteProduct={deleteProduct} updateOrder={updateOrder} notify={notify} />}
    {role === "admin" && <Admin sellers={visibleSellers} products={products} orders={orders} users={users} sellerApplications={sellerApplications} categories={categories} saveProduct={saveProduct} deleteSeller={deleteSeller} deleteProduct={deleteProduct} updateOrder={updateOrder} addCategory={addCategory} deleteCategory={deleteCategory} toggleSeller={(seller) => { const updated = { ...seller, active: !seller.active }; setSellers((items) => items.map((item) => item.id === seller.id ? updated : item)); void saveRecord("sellers", updated).catch((error: Error) => notify(`Could not update seller: ${error.message}`)); }} notify={notify} />}
    <nav className="mobile-nav"><Link to={role === "buyer" ? "/market" : `/${role}`}><Icon name={role === "buyer" ? "shop" : role === "seller" ? "store" : "shield"} /><span>{role === "buyer" ? "Shop" : role === "seller" ? "Seller" : "Admin"}</span></Link><Link to="/profile"><Icon name="eye" /><span>Profile</span></Link><button onClick={() => void logout().catch((error: Error) => notify(`Could not log out: ${error.message}`))}><Icon name="close" /><span>Log out</span></button></nav>
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}
