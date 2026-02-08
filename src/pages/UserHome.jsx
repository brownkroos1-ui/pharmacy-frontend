import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Filter,
  ShoppingCart,
  Plus,
  Minus,
  X,
  Package,
  UserCircle,
  Calendar,
  Receipt,
} from "lucide-react";
import ProtectedRoute from "../components/ProtectedRoute";
import { fetchMedicines } from "../api/medicines";
import { toast } from "../components/toastStore";
import "./UserHome.css";

const decodeJwtPayload = (token) => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    let normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    while (normalized.length % 4 !== 0) {
      normalized += "=";
    }
    const decoded = atob(normalized);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

const formatCurrency = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(number);
};

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const normalizeMedicine = (item) => {
  if (!item) return null;
  const fallbackId = `${item.name ?? "medicine"}-${item.batchNumber ?? "batch"}`;
  return {
    id: item.id ?? item.medicineId ?? item._id ?? item.uuid ?? fallbackId,
    name: item.name ?? item.medicineName ?? "",
    category: item.category ?? item.type ?? "",
    manufacturer: item.manufacturer ?? item.company ?? "",
    batchNumber: item.batchNumber ?? item.batch ?? "",
    expiryDate: item.expiryDate ?? item.expiry ?? item.expiration ?? "",
    price: Number(item.price ?? item.unitPrice ?? 0),
    stock: Number(item.quantity ?? item.stock ?? item.qty ?? 0),
  };
};

const getStatus = (item) => {
  if (item.stock <= 0) return "out";
  if (item.stock <= 5) return "low";
  return "ok";
};

const statusLabel = (status) => {
  if (status === "out") return "Out";
  if (status === "low") return "Low";
  return "In stock";
};

const buildKey = (username, suffix) =>
  `pharmacy_${suffix}_${username || "guest"}`;

const readStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
};

const UserHome = () => {
  const token = localStorage.getItem("token");
  const payload = decodeJwtPayload(token || "");
  const username = payload?.sub || "";
  const role = payload?.role || payload?.roles || "CASHIER";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selected, setSelected] = useState(null);

  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [profile, setProfile] = useState({ name: "", email: "" });

  const profileKey = buildKey(username, "profile");
  const cartKey = buildKey(username, "cart");
  const orderKey = buildKey(username, "orders");

  useEffect(() => {
    setProfile((prev) => {
      const stored = readStorage(profileKey, null);
      if (stored) return stored;
      const emailGuess = username.includes("@") ? username : "";
      return { ...prev, email: emailGuess };
    });
    setCart(readStorage(cartKey, []));
    setOrders(readStorage(orderKey, []));
  }, [profileKey, cartKey, orderKey, username]);

  useEffect(() => {
    writeStorage(cartKey, cart);
  }, [cartKey, cart]);

  useEffect(() => {
    writeStorage(orderKey, orders);
  }, [orderKey, orders]);

  useEffect(() => {
    writeStorage(profileKey, profile);
  }, [profileKey, profile]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const list = await fetchMedicines();
        const normalized = list.map(normalizeMedicine).filter(Boolean);
        setItems(normalized);
      } catch (err) {
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to load medicines."
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const categories = useMemo(() => {
    const set = new Set();
    items.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return ["all", ...Array.from(set).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = minPrice === "" ? null : Number(minPrice);
    const max = maxPrice === "" ? null : Number(maxPrice);

    return items.filter((item) => {
      if (
        q &&
        ![item.name, item.category, item.manufacturer]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))
      ) {
        return false;
      }

      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }

      if (statusFilter !== "all" && getStatus(item) !== statusFilter) {
        return false;
      }

      if (min !== null && item.price < min) return false;
      if (max !== null && item.price > max) return false;

      return true;
    });
  }, [items, query, categoryFilter, statusFilter, minPrice, maxPrice]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const summary = useMemo(() => {
    return {
      total: items.length,
      inStock: items.filter((item) => getStatus(item) === "ok").length,
      low: items.filter((item) => getStatus(item) === "low").length,
      out: items.filter((item) => getStatus(item) === "out").length,
    };
  }, [items]);

  const addToCart = (item) => {
    if (item.stock <= 0) {
      toast.warning("Out of stock", {
        description: `${item.name} is not available right now.`,
      });
      return;
    }

    setCart((prev) => {
      const existing = prev.find((entry) => entry.id === item.id);
      if (existing) {
        if (existing.quantity >= item.stock) {
          toast.warning("Stock limit reached", {
            description: `Only ${item.stock} units available.`,
          });
          return prev;
        }
        return prev.map((entry) =>
          entry.id === item.id
            ? { ...entry, quantity: entry.quantity + 1 }
            : entry
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    toast.success("Added to cart", { description: item.name });
  };

  const updateQuantity = (id, delta) => {
    setCart((prev) =>
      prev
        .map((entry) => {
          if (entry.id !== id) return entry;
          const nextQty = entry.quantity + delta;
          if (nextQty <= 0) return null;
          if (nextQty > entry.stock) {
            toast.warning("Stock limit reached", {
              description: `Only ${entry.stock} units available.`,
            });
            return entry;
          }
          return { ...entry, quantity: nextQty };
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((entry) => entry.id !== id));
  };

  const placeOrder = () => {
    if (cart.length === 0) {
      toast.warning("Cart is empty", {
        description: "Add at least one medicine before checking out.",
      });
      return;
    }

    const order = {
      id: `ORD-${Date.now().toString(36).toUpperCase()}`,
      date: new Date().toISOString(),
      items: cart,
      total: cartTotal,
      status: "Placed",
    };

    setOrders((prev) => [order, ...prev]);
    setCart([]);
    toast.success("Order placed", {
      description: `Order ${order.id} has been created.`,
    });
  };

  const saveProfile = () => {
    toast.success("Profile saved", {
      description: "Your profile preferences were updated locally.",
    });
  };

  return (
    <div className="user-home">
      <section className="user-hero">
        <div>
          <span className="hero-kicker">Welcome back</span>
          <h1>Browse & manage your pharmacy essentials</h1>
          <p>
            Discover medicines, build your cart, and track recent orders without
            leaving your dashboard.
          </p>
          <div className="hero-chip">
            <ShoppingCart size={16} /> {cart.length} items in cart
          </div>
        </div>
        <div className="hero-card">
          <h3>Inventory snapshot</h3>
          <div className="hero-metrics">
            <div className="hero-metric">
              <span>Total medicines</span>
              <strong>{summary.total}</strong>
            </div>
            <div className="hero-metric">
              <span>In stock</span>
              <strong>{summary.inStock}</strong>
            </div>
            <div className="hero-metric">
              <span>Low stock</span>
              <strong>{summary.low}</strong>
            </div>
            <div className="hero-metric">
              <span>Out of stock</span>
              <strong>{summary.out}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="user-grid">
        <div className="section-card">
          <div className="section-header">
            <div>
              <h2>Browse medicines</h2>
              <p>Search, filter, and add medicines to your cart.</p>
            </div>
            <div className="filter-row">
              <label className="input-pill">
                <Search size={16} />
                <input
                  placeholder="Search medicines"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <select
                className="select-pill"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category === "all" ? "All categories" : category}
                  </option>
                ))}
              </select>
              <select
                className="select-pill"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All stock</option>
                <option value="ok">In stock</option>
                <option value="low">Low stock</option>
                <option value="out">Out of stock</option>
              </select>
              <div className="price-range">
                <Filter size={14} />
                <input
                  type="number"
                  min="0"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(event) => setMinPrice(event.target.value)}
                />
                <span>–</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(event.target.value)}
                />
              </div>
            </div>
          </div>

          {loading && <div className="empty-state">Loading medicines...</div>}
          {!loading && error && <div className="empty-state">{error}</div>}
          {!loading && !error && filtered.length === 0 && (
            <div className="empty-state">No medicines match your filters.</div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="medicine-grid">
              {filtered.map((item) => {
                const status = getStatus(item);
                return (
                  <article className="medicine-card" key={item.id}>
                    <div>
                      <h3>{item.name || "Unnamed"}</h3>
                      <div className="medicine-meta">
                        {item.category || "Uncategorized"} • {item.manufacturer || "-"}
                      </div>
                    </div>
                    <span className={`pill ${status}`}>{statusLabel(status)}</span>
                    <div className="medicine-meta">
                      Price: <strong>{formatCurrency(item.price)}</strong>
                    </div>
                    <div className="medicine-meta">
                      Stock: {item.stock} units
                    </div>
                    <div className="card-actions">
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => setSelected(item)}
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => addToCart(item)}
                      >
                        Add
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: "1.6rem" }}>
          <div className="section-card">
            <div className="section-header">
              <div>
                <h2>Your cart</h2>
                <p>Adjust quantities and place your order.</p>
              </div>
              <ShoppingCart size={20} />
            </div>

            {cart.length === 0 && (
              <div className="empty-state">Your cart is empty.</div>
            )}

            {cart.length > 0 && (
              <div className="cart-list">
                {cart.map((item) => (
                  <div className="cart-item" key={item.id}>
                    <div className="cart-row">
                      <strong>{item.name}</strong>
                      <span>{formatCurrency(item.price)}</span>
                    </div>
                    <div className="cart-row">
                      <div className="qty-controls">
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => updateQuantity(item.id, -1)}
                        >
                          <Minus size={14} />
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => updateQuantity(item.id, 1)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="icon-btn danger"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="cart-summary">
                  <div className="cart-row">
                    <span>Subtotal</span>
                    <strong>{formatCurrency(cartTotal)}</strong>
                  </div>
                  <button type="button" className="btn secondary" onClick={placeOrder}>
                    Place order
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="section-card">
            <div className="section-header">
              <div>
                <h2>Profile</h2>
                <p>Quick view of your account details.</p>
              </div>
              <UserCircle size={20} />
            </div>
            <div className="profile-card">
              <div className="profile-chip">
                <Package size={16} /> {username || "User"}
              </div>
              <div className="profile-field">
                <span>Name</span>
                <input
                  className="input-pill"
                  value={profile.name}
                  onChange={(event) =>
                    setProfile((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Add your name"
                />
              </div>
              <div className="profile-field">
                <span>Email</span>
                <input
                  className="input-pill"
                  value={profile.email}
                  onChange={(event) =>
                    setProfile((prev) => ({ ...prev, email: event.target.value }))
                  }
                  placeholder="Add your email"
                />
              </div>
              <div className="profile-field">
                <span>Role</span>
                <strong>{String(role).toUpperCase()}</strong>
              </div>
              <button type="button" className="btn ghost" onClick={saveProfile}>
                Save profile
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="section-card" style={{ marginTop: "1.6rem" }}>
        <div className="section-header">
          <div>
            <h2>Order history</h2>
            <p>Recent orders placed from your cart.</p>
          </div>
          <Receipt size={20} />
        </div>

        {orders.length === 0 && (
          <div className="empty-state">No orders yet.</div>
        )}

        {orders.length > 0 && (
          <div className="order-history">
            {orders.map((order) => (
              <div className="order-card" key={order.id}>
                <div className="cart-row">
                  <strong>{order.id}</strong>
                  <span>{formatCurrency(order.total)}</span>
                </div>
                <div className="order-items">
                  {order.items.length} items • {order.status}
                </div>
                <div className="order-items">
                  <Calendar size={14} /> {formatDate(order.date)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <div className="drawer-overlay" onClick={() => setSelected(null)}>
          <aside className="drawer" onClick={(event) => event.stopPropagation()}>
            <div className="cart-row">
              <div>
                <h3>{selected.name}</h3>
                <div className="drawer-meta">{selected.category || "Uncategorized"}</div>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setSelected(null)}
              >
                <X size={14} />
              </button>
            </div>
            <div className="drawer-meta">
              Manufacturer: {selected.manufacturer || "-"}
            </div>
            <div className="drawer-meta">Batch: {selected.batchNumber || "-"}</div>
            <div className="drawer-meta">Expiry: {formatDate(selected.expiryDate)}</div>
            <div className="drawer-meta">Stock: {selected.stock} units</div>
            <div className="drawer-meta">
              Price: <strong>{formatCurrency(selected.price)}</strong>
            </div>
            <span className={`pill ${getStatus(selected)}`}>
              {statusLabel(getStatus(selected))}
            </span>
            <div className="drawer-footer">
              <button type="button" className="btn ghost" onClick={() => setSelected(null)}>
                Close
              </button>
              <button type="button" className="btn primary" onClick={() => addToCart(selected)}>
                Add to cart
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default function ProtectedUserHome() {
  return (
    <ProtectedRoute allowedRoles={["CASHIER"]}>
      <UserHome />
    </ProtectedRoute>
  );
}
