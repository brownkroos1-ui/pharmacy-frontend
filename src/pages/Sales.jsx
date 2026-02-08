import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Calendar,
  RefreshCcw,
  Receipt,
  BadgeCheck,
  BadgeX,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Eye,
  ShoppingCart,
  Plus,
  Minus,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchSales,
  createSale,
  fetchProfitSummary,
  fetchProfitSeries,
  fetchTopProfitMedicines,
} from "../api/sales";
import { fetchMedicines } from "../api/medicines";
import { toast } from "../components/toastStore";
import "./Sales.css";

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

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const normalizeStatus = (status) =>
  String(status || "").trim().toUpperCase();

const STATUS_LABELS = {
  VALID: "Valid",
  REJECTED_EXPIRED: "Rejected (Expired)",
  REJECTED_OUT_OF_STOCK: "Rejected (Out of stock)",
};

const STATUS_TONES = {
  VALID: "ok",
  REJECTED_EXPIRED: "warn",
  REJECTED_OUT_OF_STOCK: "bad",
};

const FILTER_TO_STATUS = {
  valid: "VALID",
  rejected_expired: "REJECTED_EXPIRED",
  rejected_out_of_stock: "REJECTED_OUT_OF_STOCK",
};

const normalizeSale = (sale) => {
  if (!sale) return null;
  const medicine = sale.medicine || {};
  const unitCost =
    medicine.costPrice ?? medicine.cost ?? medicine.purchasePrice ?? null;
  return {
    id: sale.id ?? sale.saleId ?? sale._id ?? null,
    medicineName: medicine.name ?? "Unknown medicine",
    medicineCategory: medicine.category ?? "",
    unitPrice: medicine.price ?? null,
    unitCost,
    quantity: sale.quantitySold ?? sale.quantity ?? sale.qty ?? 0,
    saleDate: sale.saleDate ?? sale.createdAt ?? sale.date ?? "",
    total: sale.totalPrice ?? sale.total ?? 0,
    status: normalizeStatus(sale.status),
    expiryDate: medicine.expiryDate ?? null,
    profit:
      normalizeStatus(sale.status) === "VALID" &&
      unitCost != null &&
      medicine.price != null
        ? (Number(medicine.price) - Number(unitCost)) *
          Number(sale.quantitySold ?? sale.quantity ?? sale.qty ?? 0)
        : 0,
  };
};

const normalizeMedicine = (item) => {
  if (!item) return null;
  return {
    id: item.id ?? item.medicineId ?? item._id ?? item.uuid ?? null,
    name: item.name ?? item.medicineName ?? "",
    category: item.category ?? item.type ?? "",
    manufacturer: item.manufacturer ?? item.company ?? "",
    batchNumber: item.batchNumber ?? item.batch ?? "",
    expiryDate: item.expiryDate ?? item.expiry ?? item.expiration ?? "",
    price: Number(item.price ?? item.unitPrice ?? 0),
    stock: Number(item.quantity ?? item.stock ?? item.qty ?? 0),
  };
};

const statusLabel = (status) => STATUS_LABELS[status] || "Unknown";
const statusTone = (status) => STATUS_TONES[status] || "neutral";

const getStockTone = (stock) => {
  if (stock <= 0) return "out";
  if (stock <= 5) return "low";
  return "ok";
};

const stockLabel = (stock) => {
  if (stock <= 0) return "Out";
  if (stock <= 5) return "Low";
  return "In stock";
};

export default function Sales() {
  const { role } = useAuth();
  const normalizedRole = String(role || "").toUpperCase();
  const isCashier = normalizedRole === "CASHIER";
  const isAdmin = normalizedRole === "ADMIN";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedSale, setSelectedSale] = useState(null);

  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutNote, setCheckoutNote] = useState(null);

  const notifySalesUpdated = () => {
    try {
      localStorage.setItem("pharmacy_sales_updated", String(Date.now()));
    } catch {
      // ignore storage errors
    }
    window.dispatchEvent(new Event("pharmacy:sales-updated"));
  };

  const getDefaultProfitRange = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  };

  const defaultProfitRange = useMemo(() => getDefaultProfitRange(), []);
  const [profitFrom, setProfitFrom] = useState(defaultProfitRange.start);
  const [profitTo, setProfitTo] = useState(defaultProfitRange.end);
  const [profitPeriod, setProfitPeriod] = useState("MONTHLY");
  const [profitSummary, setProfitSummary] = useState(null);
  const [profitSeries, setProfitSeries] = useState([]);
  const [profitTop, setProfitTop] = useState([]);
  const [profitLoading, setProfitLoading] = useState(false);
  const [profitError, setProfitError] = useState("");

  const profitBarData = useMemo(() => {
    if (!profitSeries.length) return [];
    const values = profitSeries.map((point) => Number(point.profit || 0));
    const max = Math.max(...values, 1);
    return profitSeries.map((point, index) => ({
      key: `${point.label}-${index}`,
      label: point.label,
      profit: Number(point.profit || 0),
      revenue: Number(point.revenue || 0),
      cost: Number(point.cost || 0),
      height: (Number(point.profit || 0) / max) * 100,
    }));
  }, [profitSeries]);

  const load = async (filter = statusFilter) => {
    try {
      setLoading(true);
      setError("");
      const list = await fetchSales({ status: filter });
      const normalized = list.map(normalizeSale).filter(Boolean);
      const sorted = normalized.sort((a, b) => {
        const aDate = new Date(a.saleDate || 0).getTime();
        const bDate = new Date(b.saleDate || 0).getTime();
        return bDate - aDate;
      });
      setItems(sorted);
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to load sales."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadCatalog = async () => {
    if (!isCashier) return;
    try {
      setCatalogLoading(true);
      setCatalogError("");
      const list = await fetchMedicines();
      const normalized = list.map(normalizeMedicine).filter(Boolean);
      setCatalog(normalized);
    } catch (err) {
      setCatalogError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load medicines."
      );
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    load(statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    loadCatalog();
  }, [isCashier]);

  useEffect(() => {
    if (!isAdmin) return;
    const loadProfit = async () => {
      try {
        setProfitLoading(true);
        setProfitError("");
        const [summary, series, top] = await Promise.all([
          fetchProfitSummary({ start: profitFrom, end: profitTo }),
          fetchProfitSeries({
            start: profitFrom,
            end: profitTo,
            period: profitPeriod,
          }),
          fetchTopProfitMedicines({ start: profitFrom, end: profitTo, limit: 5 }),
        ]);
        setProfitSummary(summary);
        setProfitSeries(Array.isArray(series) ? series : []);
        setProfitTop(Array.isArray(top) ? top : []);
      } catch (err) {
        setProfitError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to load profit analytics."
        );
      } finally {
        setProfitLoading(false);
      }
    };
    loadProfit();
  }, [isAdmin, profitFrom, profitTo, profitPeriod]);

  const refreshAll = () => {
    load(statusFilter);
    if (isCashier) {
      loadCatalog();
    }
  };

  const suggestions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return [];
    return catalog
      .filter((item) =>
        [item.name, item.category, item.manufacturer, item.batchNumber]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [catalog, searchTerm]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`) : null;

    return items.filter((sale) => {
      const matchesQuery =
        !q ||
        [sale.medicineName, String(sale.id)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));

      if (!matchesQuery) return false;

      if (statusFilter !== "all") {
        const expected = FILTER_TO_STATUS[statusFilter];
        if (expected && sale.status !== expected) return false;
      }

      if (from || to) {
        if (!sale.saleDate) return false;
        const date = new Date(sale.saleDate);
        if (Number.isNaN(date.getTime())) return false;
        if (from && date < from) return false;
        if (to && date > to) return false;
      }

      return true;
    });
  }, [items, query, statusFilter, fromDate, toDate]);

  const stats = useMemo(() => {
    const total = items.length;
    const valid = items.filter((sale) => sale.status === "VALID").length;
    const rejectedExpired = items.filter(
      (sale) => sale.status === "REJECTED_EXPIRED"
    ).length;
    const rejectedOut = items.filter(
      (sale) => sale.status === "REJECTED_OUT_OF_STOCK"
    ).length;
    const revenue = items.reduce(
      (sum, sale) => sum + Number(sale.total || 0),
      0
    );
    const average = total > 0 ? revenue / total : 0;
    return { total, valid, rejectedExpired, rejectedOut, revenue, average };
  }, [items]);

  const cartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const closeModal = () => setSelectedSale(null);

  const selectMedicine = (item) => {
    setSelectedMedicine(item);
    setSearchTerm(item.name || "");
    setQuantity(1);
  };

  const addToCart = () => {
    if (!selectedMedicine) {
      setCheckoutNote({ type: "error", message: "Select a medicine first." });
      return;
    }

    if (!selectedMedicine.id) {
      setCheckoutNote({
        type: "error",
        message: "Selected medicine is missing an id.",
      });
      return;
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setCheckoutNote({ type: "error", message: "Enter a valid quantity." });
      return;
    }

    if (selectedMedicine.stock <= 0) {
      toast.warning("Out of stock", {
        description: `${selectedMedicine.name} is unavailable.`,
      });
      return;
    }

    if (qty > selectedMedicine.stock) {
      toast.warning("Stock limit reached", {
        description: `Only ${selectedMedicine.stock} units available.`,
      });
      return;
    }

    setCart((prev) => {
      const existing = prev.find((entry) => entry.id === selectedMedicine.id);
      if (existing) {
        const nextQty = Math.min(existing.quantity + qty, selectedMedicine.stock);
        return prev.map((entry) =>
          entry.id === selectedMedicine.id
            ? { ...entry, quantity: nextQty }
            : entry
        );
      }
      return [...prev, { ...selectedMedicine, quantity: qty }];
    });

    toast.success("Added to cart", { description: selectedMedicine.name });
    setCheckoutNote(null);
    setSelectedMedicine(null);
    setSearchTerm("");
    setQuantity(1);
  };

  const updateCartQty = (id, delta) => {
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

  const submitSales = async () => {
    if (cart.length === 0) {
      setCheckoutNote({ type: "warn", message: "Cart is empty." });
      return;
    }

    setSubmitting(true);
    setCheckoutNote(null);

    try {
      const results = [];
      for (const item of cart) {
        const response = await createSale({
          medicineId: Number(item.id),
          quantity: item.quantity,
        });
        results.push(response);
      }

      const normalizedResults = results.map(normalizeSale).filter(Boolean);
      const valid = normalizedResults.filter((sale) => sale.status === "VALID")
        .length;
      const rejectedExpired = normalizedResults.filter(
        (sale) => sale.status === "REJECTED_EXPIRED"
      ).length;
      const rejectedOut = normalizedResults.filter(
        (sale) => sale.status === "REJECTED_OUT_OF_STOCK"
      ).length;

      setCheckoutNote({
        type: "success",
        message: `Submitted ${results.length} sale(s). Valid: ${valid}, Rejected expired: ${rejectedExpired}, Rejected out: ${rejectedOut}.`,
      });

      setCart([]);
      await load(statusFilter);
      await loadCatalog();
      notifySalesUpdated();
    } catch (err) {
      const msg =
        err?.response?.data?.message || err?.message || "Failed to submit sales.";
      setCheckoutNote({ type: "error", message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sales-page">
      <section className="sales-hero">
        <div className="hero-copy">
          <span className="hero-kicker">Sales operations</span>
          <h1>{isCashier ? "Cashier Checkout" : "Medicine Sales Tracker"}</h1>
          <p>
            {isCashier
              ? "Scan or search medicines, build the cart, and submit sales instantly."
              : "Monitor valid sales, rejected orders, and daily revenue in one view."}
          </p>
          <div className="hero-actions">
            <button type="button" className="btn primary" onClick={refreshAll}>
              <RefreshCcw size={18} />
              Refresh
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setQuery("");
                setStatusFilter("all");
                setFromDate("");
                setToDate("");
              }}
            >
              Reset filters
            </button>
          </div>
        </div>
        <div className="hero-panel">
          <div className="hero-row">
            <div>
              <div className="hero-label">Total revenue</div>
              <div className="hero-value">{formatCurrency(stats.revenue)}</div>
            </div>
            <div className="hero-chip">
              <TrendingUp size={18} />
              {stats.total} sales
            </div>
          </div>
          <div className="hero-grid">
            <div>
              <span className="metric-label">Valid sales</span>
              <span className="metric-value">{stats.valid}</span>
            </div>
            <div>
              <span className="metric-label">Rejected expired</span>
              <span className="metric-value">{stats.rejectedExpired}</span>
            </div>
            <div>
              <span className="metric-label">Rejected out of stock</span>
              <span className="metric-value">{stats.rejectedOut}</span>
            </div>
          </div>
        </div>
      </section>

      {isAdmin && (
        <section className="profit-panel">
          <div className="profit-header">
            <div>
              <span className="profit-kicker">Profit analytics</span>
              <h2>Margin intelligence</h2>
              <p>Compare revenue, cost, and profit across time windows.</p>
            </div>
            <div className="profit-controls">
              <label className="date-field">
                <Calendar size={16} />
                <input
                  type="date"
                  value={profitFrom}
                  onChange={(event) => setProfitFrom(event.target.value)}
                />
                <span>to</span>
                <input
                  type="date"
                  value={profitTo}
                  onChange={(event) => setProfitTo(event.target.value)}
                />
              </label>
              <div className="profit-periods">
                {["DAILY", "WEEKLY", "MONTHLY"].map((period) => (
                  <button
                    key={period}
                    type="button"
                    className={
                      period === profitPeriod
                        ? "profit-period active"
                        : "profit-period"
                    }
                    onClick={() => setProfitPeriod(period)}
                  >
                    {period.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {profitLoading && (
            <div className="state-card">Loading profit analytics...</div>
          )}

          {!profitLoading && profitError && (
            <div className="state-card error">{profitError}</div>
          )}

          {!profitLoading && !profitError && profitSummary && (
            <div className="profit-grid">
              <article className="profit-card highlight">
                <span className="label">Total profit</span>
                <span className="value">
                  {formatCurrency(profitSummary.totalProfit)}
                </span>
                <span className="meta">
                  {profitSummary.saleCount ?? 0} valid sales
                </span>
              </article>
              <article className="profit-card">
                <span className="label">Revenue</span>
                <span className="value">
                  {formatCurrency(profitSummary.totalRevenue)}
                </span>
                <span className="meta">Gross inflow</span>
              </article>
              <article className="profit-card">
                <span className="label">Cost</span>
                <span className="value">
                  {formatCurrency(profitSummary.totalCost)}
                </span>
                <span className="meta">Inventory outlay</span>
              </article>
              <article className="profit-card">
                <span className="label">Profit ratio</span>
                <span className="value">
                  {profitSummary.totalRevenue > 0
                    ? `${Math.round(
                        (Number(profitSummary.totalProfit || 0) /
                          Number(profitSummary.totalRevenue || 1)) *
                          100
                      )}%`
                    : "0%"}
                </span>
                <span className="meta">Profit / revenue</span>
              </article>
            </div>
          )}

          {!profitLoading && !profitError && (
            <div className="profit-split">
              <div className="profit-list">
                <div className="profit-list-header">
                  <h3>Trend</h3>
                  <span className="profit-pill">
                    {profitPeriod.toLowerCase()} view
                  </span>
                </div>
                {profitSeries.length === 0 && (
                  <div className="empty-state">No profit data.</div>
                )}
                {profitPeriod === "DAILY" ? (
                  <div className="profit-tiles">
                    {profitBarData.map((item) => (
                      <div className="profit-tile" key={item.key}>
                        <span className="profit-tile-day">{item.label}</span>
                        <span className="profit-tile-value">
                          {formatCurrency(item.profit)}
                        </span>
                        <span className="profit-tile-meta">
                          {formatCurrency(item.revenue)} rev ·{" "}
                          {formatCurrency(item.cost)} cost
                        </span>
                        <div className="profit-tile-bar">
                          <div
                            className="profit-tile-fill"
                            style={{ width: `${item.height}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  profitSeries.map((point) => (
                    <div
                      key={`${point.label}-${point.startDate}`}
                      className="profit-row"
                    >
                      <div>
                        <strong>{point.label}</strong>
                        <span>
                          {formatCurrency(point.revenue)} revenue ·{" "}
                          {formatCurrency(point.cost)} cost
                        </span>
                      </div>
                      <span className="profit-value">
                        {formatCurrency(point.profit)}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="profit-list">
                <div className="profit-list-header">
                  <h3>Top medicines</h3>
                  <span className="profit-pill">profit leaders</span>
                </div>
                {profitTop.length === 0 && (
                  <div className="empty-state">No profit data.</div>
                )}
                {profitTop.map((item) => (
                  <div key={item.medicineId} className="profit-row">
                    <div>
                      <strong>{item.medicineName}</strong>
                      <span>
                        Qty {item.quantitySold ?? 0} ·{" "}
                        {formatCurrency(item.revenue)} revenue
                      </span>
                    </div>
                    <span className="profit-value">
                      {formatCurrency(item.profit)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {isCashier && (
        <section className="sales-checkout">
          <div className="checkout-card">
            <div className="section-header">
              <div>
                <h2>Sell medicine</h2>
                <p>Scan or search, set quantity, and add to cart.</p>
              </div>
              <ShoppingCart size={20} />
            </div>

            <div className="checkout-form">
              <label className="checkout-field">
                <span>Search medicine</span>
                <div className="input-pill">
                  <Search size={16} />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Scan barcode or type medicine name"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && suggestions.length > 0) {
                        event.preventDefault();
                        selectMedicine(suggestions[0]);
                      }
                    }}
                  />
                </div>
              </label>

              {catalogLoading && (
                <div className="empty-state">Loading medicines...</div>
              )}
              {catalogError && (
                <div className="empty-state">{catalogError}</div>
              )}

              {!catalogLoading && !catalogError && suggestions.length > 0 && (
                <div className="suggestion-list">
                  {suggestions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="suggestion-item"
                      onClick={() => selectMedicine(item)}
                    >
                      <div>
                        <strong>{item.name}</strong>
                        <span>
                          {item.category || "Uncategorized"} • {item.manufacturer || "-"}
                        </span>
                      </div>
                      <span className={`pill ${getStockTone(item.stock)}`}>
                        {stockLabel(item.stock)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {selectedMedicine && (
                <div className="selected-card">
                  <div>
                    <strong>{selectedMedicine.name}</strong>
                    <div className="selected-meta">
                      {selectedMedicine.category || "Uncategorized"} • Batch {selectedMedicine.batchNumber || "-"}
                    </div>
                  </div>
                  <div className="selected-meta">
                    Stock: {selectedMedicine.stock} • Price {formatCurrency(selectedMedicine.price)}
                  </div>
                </div>
              )}

              <label className="checkout-field">
                <span>Quantity</span>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </label>

              <button
                type="button"
                className="btn primary"
                onClick={addToCart}
                disabled={!selectedMedicine}
              >
                <Plus size={16} />
                Add to cart
              </button>
            </div>
          </div>

          <div className="checkout-card">
            <div className="section-header">
              <div>
                <h2>Cart</h2>
                <p>{cartCount} item(s) ready for checkout.</p>
              </div>
              <BadgeCheck size={20} />
            </div>

            {checkoutNote && (
              <div className={`checkout-note ${checkoutNote.type || "info"}`}>
                {checkoutNote.message}
              </div>
            )}

            {cart.length === 0 && (
              <div className="empty-state">Your cart is empty.</div>
            )}

            {cart.length > 0 && (
              <div className="cart-list">
                {cart.map((item) => (
                  <div key={item.id} className="cart-item">
                    <div className="cart-row">
                      <strong>{item.name}</strong>
                      <span>{formatCurrency(item.price)}</span>
                    </div>
                    <div className="cart-row">
                      <div className="qty-controls">
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => updateCartQty(item.id, -1)}
                        >
                          <Minus size={14} />
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => updateCartQty(item.id, 1)}
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
                    <span>Total</span>
                    <strong>{formatCurrency(cartTotal)}</strong>
                  </div>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={submitSales}
                    disabled={submitting}
                  >
                    {submitting ? "Submitting..." : "Submit sale"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="sales-stats">
        <article className="stat-card">
          <div className="stat-icon">
            <Receipt size={18} />
          </div>
          <div className="stat-label">Total sales</div>
          <div className="stat-value">{stats.total}</div>
        </article>
        <article className="stat-card">
          <div className="stat-icon ok">
            <BadgeCheck size={18} />
          </div>
          <div className="stat-label">Valid</div>
          <div className="stat-value">{stats.valid}</div>
        </article>
        <article className="stat-card">
          <div className="stat-icon warn">
            <AlertTriangle size={18} />
          </div>
          <div className="stat-label">Rejected expired</div>
          <div className="stat-value">{stats.rejectedExpired}</div>
        </article>
        <article className="stat-card">
          <div className="stat-icon bad">
            <BadgeX size={18} />
          </div>
          <div className="stat-label">Rejected out of stock</div>
          <div className="stat-value">{stats.rejectedOut}</div>
        </article>
        <article className="stat-card">
          <div className="stat-icon">
            <Wallet size={18} />
          </div>
          <div className="stat-label">Avg sale value</div>
          <div className="stat-value">{formatCurrency(stats.average)}</div>
        </article>
      </section>

      <section className="sales-panel">
        <div className="panel-header">
          <div>
            <h2>Sales history</h2>
            <p>Search by medicine name or sale ID.</p>
          </div>
          <div className="panel-controls">
            <label className="search-field">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search sales"
              />
            </label>
            <select
              className="select-field"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="valid">Valid</option>
              <option value="rejected_expired">Rejected expired</option>
              <option value="rejected_out_of_stock">Rejected out of stock</option>
            </select>
            <label className="date-field">
              <Calendar size={16} />
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
              <span>to</span>
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
              />
            </label>
          </div>
        </div>

        {loading && <div className="state-card">Loading sales...</div>}

        {!loading && error && <div className="state-card error">{error}</div>}

        {!loading && !error && filtered.length === 0 && (
          <div className="state-card">No sales match your filters.</div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <>
            <div className="table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Sale ID</th>
                    <th>Medicine</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Qty</th>
                    <th>Total</th>
                    {isAdmin && <th>Profit</th>}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sale, index) => {
                    const key = sale.id ?? index;
                    return (
                      <tr key={key}>
                        <td>
                          <div className="primary">#{sale.id ?? "--"}</div>
                        </td>
                        <td>{sale.medicineName}</td>
                        <td>{sale.medicineCategory || "--"}</td>
                        <td>{formatDateTime(sale.saleDate)}</td>
                        <td>
                          <span className={`pill ${statusTone(sale.status)}`}>
                            {statusLabel(sale.status)}
                          </span>
                        </td>
                        <td>{sale.quantity}</td>
                        <td>{formatCurrency(sale.total)}</td>
                        {isAdmin && (
                          <td>
                            {sale.status === "VALID"
                              ? formatCurrency(sale.profit)
                              : "--"}
                          </td>
                        )}
                        <td>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => setSelectedSale(sale)}
                          >
                            <Eye size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="sales-cards">
              {filtered.map((sale, index) => {
                const key = sale.id ?? index;
                return (
                  <article className="sales-card" key={key}>
                    <div className="card-head">
                      <div>
                        <h3>{sale.medicineName}</h3>
                        <p>Sale #{sale.id ?? "--"}</p>
                      </div>
                      <span className={`pill ${statusTone(sale.status)}`}>
                        {statusLabel(sale.status)}
                      </span>
                    </div>
                    <div className="card-meta">
                      <div>
                        <span className="label">Date</span>
                        <span className="value">{formatDate(sale.saleDate)}</span>
                      </div>
                      <div>
                        <span className="label">Quantity</span>
                        <span className="value">{sale.quantity}</span>
                      </div>
                      <div>
                        <span className="label">Total</span>
                        <span className="value">{formatCurrency(sale.total)}</span>
                      </div>
                      {isAdmin && (
                        <div>
                          <span className="label">Profit</span>
                          <span className="value">
                            {sale.status === "VALID"
                              ? formatCurrency(sale.profit)
                              : "--"}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="label">Category</span>
                        <span className="value">{sale.medicineCategory || "--"}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => setSelectedSale(sale)}
                    >
                      View details
                    </button>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      {selectedSale && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Sale details</h3>
                <p>Sale #{selectedSale.id ?? "--"}</p>
              </div>
              <button type="button" className="icon-btn ghost" onClick={closeModal}>
                x
              </button>
            </div>

            <div className="detail-grid">
              <div>
                <span className="label">Medicine</span>
                <span className="value">{selectedSale.medicineName}</span>
              </div>
              <div>
                <span className="label">Category</span>
                <span className="value">{selectedSale.medicineCategory || "--"}</span>
              </div>
              <div>
                <span className="label">Expiry date</span>
                <span className="value">{formatDate(selectedSale.expiryDate)}</span>
              </div>
              <div>
                <span className="label">Date</span>
                <span className="value">{formatDateTime(selectedSale.saleDate)}</span>
              </div>
              <div>
                <span className="label">Status</span>
                <span className={`pill ${statusTone(selectedSale.status)}`}>
                  {statusLabel(selectedSale.status)}
                </span>
              </div>
              <div>
                <span className="label">Quantity</span>
                <span className="value">{selectedSale.quantity}</span>
              </div>
              <div>
                <span className="label">Unit price</span>
                <span className="value">{formatCurrency(selectedSale.unitPrice)}</span>
              </div>
              {isAdmin && (
                <div>
                  <span className="label">Unit cost</span>
                  <span className="value">{formatCurrency(selectedSale.unitCost)}</span>
                </div>
              )}
              <div>
                <span className="label">Total</span>
                <span className="value">{formatCurrency(selectedSale.total)}</span>
              </div>
              {isAdmin && (
                <div>
                  <span className="label">Profit</span>
                  <span className="value">
                    {selectedSale.status === "VALID"
                      ? formatCurrency(selectedSale.profit)
                      : "--"}
                  </span>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={closeModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

