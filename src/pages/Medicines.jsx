import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Package,
  AlertTriangle,
  Calendar,
  RefreshCcw,
  Download,
  Upload,
} from "lucide-react";
import {
  fetchMedicines,
  createMedicine,
  updateMedicine,
  updateMedicineByBatch,
  deleteMedicine,
  fetchLowStockThreshold,
} from "../api/medicines";
import { fetchAdminDashboard } from "../api/adminDashboard";
import { toast } from "../components/toastStore";
import { downloadCsv } from "../utils/csv";
import "./Medicines.css";

const DEFAULT_LOW_STOCK_THRESHOLD = 10;

const emptyForm = {
  name: "",
  category: "",
  manufacturer: "",
  batchNumber: "",
  expiryDate: "",
  price: "",
  costPrice: "",
  stock: "",
  reorderLevel: "",
};

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const toInputDate = (value) => {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
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
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const toCsvNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : "";
};

const toIsoDate = (value) => {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const daysUntilExpiry = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const diff = date - startOfToday;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const formatDaysLeft = (days) => {
  if (!Number.isFinite(days)) return "--";
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
};

const getExpiryTone = (days) => {
  if (!Number.isFinite(days)) return "normal";
  if (days <= 7) return "urgent";
  if (days <= 14) return "warning";
  return "normal";
};

const normalizeMedicine = (item) => {
  if (!item) return null;
  const id = item.id ?? item.medicineId ?? item._id ?? item.uuid;
  return {
    id,
    name: item.name ?? item.medicineName ?? "",
    category: item.category ?? item.type ?? "",
    manufacturer: item.manufacturer ?? item.company ?? "",
    batchNumber: item.batchNumber ?? item.batch ?? "",
    expiryDate: toInputDate(item.expiryDate ?? item.expiry ?? item.expiration),
    price: item.price ?? item.unitPrice ?? "",
    costPrice: item.costPrice ?? item.cost ?? item.purchasePrice ?? "",
    stock: item.quantity ?? item.stock ?? item.qty ?? "",
    reorderLevel: item.reorderLevel ?? item.minStock ?? item.threshold ?? "",
  };
};

const getReorderLevel = (item, fallback = DEFAULT_LOW_STOCK_THRESHOLD) =>
  toNumber(
    item.reorderLevel === "" || item.reorderLevel === null
      ? fallback
      : item.reorderLevel,
    fallback
  );

const getStatus = (item, fallback) => {
  const stock = toNumber(item.stock);
  const reorder = getReorderLevel(item, fallback);
  if (stock <= 0) return "out";
  if (stock <= reorder) return "low";
  return "ok";
};

const getStatusLabel = (item, fallback) => {
  const status = getStatus(item, fallback);
  if (status === "out") return "Out";
  if (status === "low") return "Low";
  return "In stock";
};

const parseCsvLine = (line) => {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
};

const parseCsv = (text) => {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((line) => line.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((acc, header, index) => {
      acc[header] = values[index] ?? "";
      return acc;
    }, {});
  });
  return { headers, rows };
};

const normalizeHeader = (header) =>
  String(header || "").trim().toLowerCase();

const HEADER_MAP = {
  name: "name",
  "medicine name": "name",
  medicine: "name",
  category: "category",
  manufacturer: "manufacturer",
  "batch number": "batchNumber",
  batch: "batchNumber",
  "expiry date": "expiryDate",
  expiry: "expiryDate",
  price: "price",
  "cost price": "costPrice",
  cost: "costPrice",
  stock: "stock",
  quantity: "stock",
  "reorder level": "reorderLevel",
  reorder: "reorderLevel",
};

export default function Medicines() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState(
    DEFAULT_LOW_STOCK_THRESHOLD
  );
  const [lowStockOverride, setLowStockOverride] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const notifyInventoryUpdated = () => {
    try {
      localStorage.setItem("pharmacy_inventory_updated", String(Date.now()));
    } catch {
      // ignore storage errors (private mode, quota, etc.)
    }
    window.dispatchEvent(new Event("pharmacy:inventory-updated"));
  };

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [list, threshold, dashboard] = await Promise.all([
        fetchMedicines(),
        fetchLowStockThreshold(),
        fetchAdminDashboard().catch(() => null),
      ]);
      const normalized = list.map(normalizeMedicine).filter(Boolean);
      setItems(normalized);
      if (Number.isFinite(Number(threshold))) {
        setLowStockThreshold(Number(threshold));
      }
      if (Number.isFinite(Number(dashboard?.lowStock))) {
        setLowStockOverride(Number(dashboard.lowStock));
      } else {
        setLowStockOverride(null);
      }
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

  useEffect(() => {
    load();
  }, []);

  const handleImportClick = () => {
    if (importing) return;
    fileInputRef.current?.click();
  };

  const mapCsvRow = (row) => {
    const mapped = {};
    Object.entries(row || {}).forEach(([header, value]) => {
      const key = HEADER_MAP[normalizeHeader(header)];
      if (key) mapped[key] = value;
    });
    return mapped;
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    setImporting(true);
    setFormError("");

    try {
      const textContent = await file.text();
      const { rows } = parseCsv(textContent);
      if (!rows.length) {
        throw new Error("No data rows found in CSV.");
      }

      const errors = [];
      const payloads = [];
      const seenBatches = new Map();

      rows.forEach((row, index) => {
        const line = index + 2;
        const data = mapCsvRow(row);
        const name = String(data.name || "").trim();
        const batchNumber = String(data.batchNumber || "").trim();
        const batchKey = batchNumber.toLowerCase();
        const expiryDate = toIsoDate(data.expiryDate || "");
        const priceValue = data.price === "" ? 0 : toNumber(data.price, NaN);
        const costValue =
          data.costPrice === "" ? 0 : toNumber(data.costPrice, NaN);
        const stockValue = data.stock === "" ? 0 : toNumber(data.stock, NaN);
        const reorderValue =
          data.reorderLevel === "" || data.reorderLevel === undefined
            ? null
            : toNumber(data.reorderLevel, NaN);

        if (!name) errors.push(`Row ${line}: Name is required.`);
        if (!batchNumber) errors.push(`Row ${line}: Batch number is required.`);
        if (!expiryDate) errors.push(`Row ${line}: Expiry date is required.`);
        if (batchNumber) {
          if (seenBatches.has(batchKey)) {
            errors.push(
              `Row ${line}: Duplicate batch number in CSV (also row ${seenBatches.get(
                batchKey
              )}).`
            );
          } else {
            seenBatches.set(batchKey, line);
          }
        }
        if (!Number.isFinite(priceValue))
          errors.push(`Row ${line}: Price is invalid.`);
        if (!Number.isFinite(costValue))
          errors.push(`Row ${line}: Cost price is invalid.`);
        if (!Number.isFinite(stockValue))
          errors.push(`Row ${line}: Stock is invalid.`);
        if (Number.isFinite(reorderValue) && reorderValue < 0) {
          errors.push(`Row ${line}: Reorder level cannot be negative.`);
        }
        if (
          Number.isFinite(costValue) &&
          Number.isFinite(priceValue) &&
          costValue > priceValue
        ) {
          errors.push(`Row ${line}: Cost price must be <= price.`);
        }

        payloads.push({
          payload: {
            name,
            category: String(data.category || "").trim(),
            manufacturer: String(data.manufacturer || "").trim() || null,
            batchNumber,
            expiryDate,
            price: priceValue,
            costPrice: costValue,
            quantity: stockValue,
            reorderLevel: Number.isFinite(reorderValue) ? reorderValue : null,
          },
          batchKey,
        });
      });

      if (errors.length) {
        const preview = errors.slice(0, 3).join(" ");
        const extra = errors.length > 3 ? ` (+${errors.length - 3} more)` : "";
        toast.error("Import failed", {
          description: `${preview}${extra}`,
        });
        return;
      }

      let created = 0;
      let updated = 0;
      let failed = 0;
      const failMessages = [];

      const existingList = await fetchMedicines().catch(() => []);
      const existingByBatch = new Map();
      existingList.forEach((item) => {
        const key = String(
          item?.batchNumber ?? item?.batch ?? ""
        )
          .trim()
          .toLowerCase();
        if (!key) return;
        const id = item?.id ?? item?.medicineId ?? item?._id;
        if (id) existingByBatch.set(key, id);
      });

      for (const entry of payloads) {
        try {
          const { payload, batchKey } = entry;
          const existingId = batchKey ? existingByBatch.get(batchKey) : null;
          if (existingId) {
            await updateMedicine(existingId, payload);
            updated += 1;
          } else {
            try {
              await createMedicine(payload);
              created += 1;
            } catch (err) {
              if (err?.response?.status === 409 && batchKey) {
                await updateMedicineByBatch(batchKey, payload);
                updated += 1;
              } else {
                throw err;
              }
            }
          }
        } catch (err) {
          failed += 1;
          const message =
            err?.response?.data?.message ||
            err?.message ||
            "Failed to import";
          failMessages.push(message);
        }
      }

      await load();
      notifyInventoryUpdated();

      const totalDone = created + updated;

      if (failed === 0) {
        toast.success("Import complete", {
          description: `Created ${created}, updated ${updated}.`,
        });
      } else {
        toast.error("Import completed with errors", {
          description: `Created ${created}, updated ${updated}, failed ${failed}. ${
            failMessages[0] || ""
          }`.trim(),
        });
      }
    } catch (err) {
      toast.error("Import failed", {
        description: err?.message || "Unable to read CSV file.",
      });
    } finally {
      setImporting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery =
        !q ||
        [item.name, item.category, item.batchNumber, item.manufacturer]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      if (!matchesQuery) return false;
      if (statusFilter === "all") return true;
      return getStatus(item, lowStockThreshold) === statusFilter;
    });
  }, [items, query, statusFilter, lowStockThreshold]);

  const stats = useMemo(() => {
    const total = items.length;
    const lowComputed = items.filter((item) => {
      const stock = toNumber(item.stock);
      const reorder = getReorderLevel(item, lowStockThreshold);
      return stock > 0 && stock <= reorder;
    }).length;
    const low = Number.isFinite(lowStockOverride)
      ? lowStockOverride
      : lowComputed;
    const out = items.filter((item) => toNumber(item.stock) <= 0).length;
    const expiring = items.filter((item) => {
      const days = daysUntilExpiry(item.expiryDate);
      return days !== null && days >= 0 && days <= 30;
    }).length;
    const value = items.reduce((sum, item) => {
      return sum + toNumber(item.price) * toNumber(item.stock);
    }, 0);
    return {
      total,
      low,
      out,
      expiring,
      value,
    };
  }, [items, lowStockThreshold, lowStockOverride]);

  const expiringItems = useMemo(() => {
    return items
      .map((item) => {
        const days = daysUntilExpiry(item.expiryDate);
        return { ...item, daysUntil: days };
      })
      .filter(
        (item) =>
          item.daysUntil !== null && item.daysUntil >= 0 && item.daysUntil <= 30
      )
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [items]);

  const openAdd = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      reorderLevel: DEFAULT_LOW_STOCK_THRESHOLD,
    });
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name ?? "",
      category: item.category ?? "",
      manufacturer: item.manufacturer ?? "",
      batchNumber: item.batchNumber ?? "",
      expiryDate: toInputDate(item.expiryDate),
      price: item.price ?? "",
      costPrice: item.costPrice ?? "",
      stock: item.stock ?? "",
      reorderLevel:
        item.reorderLevel ?? DEFAULT_LOW_STOCK_THRESHOLD,
    });
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
  };

  const handleChange = (field) => (event) => {
    setForm((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (editing && !editing.id) {
      setFormError("Missing medicine id for update.");
      return;
    }

    const priceValue = form.price === "" ? 0 : toNumber(form.price);
    const costValue = form.costPrice === "" ? 0 : toNumber(form.costPrice);

    if (costValue > priceValue) {
      setFormError("Cost price must be less than or equal to price.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      manufacturer: form.manufacturer.trim() || null,
      batchNumber: form.batchNumber.trim(),
      expiryDate: form.expiryDate || null,
      price: priceValue,
      costPrice: costValue,
      quantity: form.stock === "" ? 0 : toNumber(form.stock),
      reorderLevel:
        form.reorderLevel === "" ? null : toNumber(form.reorderLevel),
    };

    try {
      setSaving(true);
      if (editing?.id) {
        await updateMedicine(editing.id, payload);
        toast.success("Medicine updated", {
          description: `${payload.name} has been updated.`,
        });
      } else {
        await createMedicine(payload);
        toast.success("Medicine added", {
          description: `${payload.name} has been added to inventory.`,
        });
      }
      await load();
      notifyInventoryUpdated();
      closeModal();
    } catch (err) {
      const status = err?.response?.status;
      const apiMessage = err?.response?.data?.message || err?.message;
      if (status === 409) {
        setFormError(
          "That batch number is already used. Please enter a different batch number."
        );
      } else {
        setFormError(apiMessage || "Failed to save medicine.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!item.id) {
      setError("Missing medicine id for deletion.");
      return;
    }
    const ok = window.confirm(
      `Delete ${item.name || "this medicine"}? This cannot be undone.`
    );
    if (!ok) return;

    try {
      setDeletingId(item.id);
      await deleteMedicine(item.id);
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
      toast.success("Medicine deleted", {
        description: `${item.name || "Medicine"} was removed.`,
      });
      notifyInventoryUpdated();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 409) {
        setError(
          "Cannot delete this medicine because it already has sales. Archive it or set stock to 0."
        );
      } else {
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to delete medicine."
        );
      }
    } finally {
      setDeletingId(null);
    }
  };

  const isCostInvalid =
    form.costPrice !== "" &&
    form.price !== "" &&
    toNumber(form.costPrice) > toNumber(form.price);

  const isFormValid =
    form.name.trim() &&
    form.batchNumber.trim() &&
    form.price !== "" &&
    form.costPrice !== "" &&
    form.stock !== "" &&
    form.expiryDate &&
    !isCostInvalid;

  const exportMedicinesCsv = () => {
    const headers = [
      "Name",
      "Category",
      "Manufacturer",
      "Batch Number",
      "Expiry Date",
      "Price",
      "Cost Price",
      "Stock",
      "Reorder Level",
      "Status",
      "Inventory Value",
    ];
    const rows = filtered.map((item) => [
      item.name,
      item.category,
      item.manufacturer,
      item.batchNumber,
      toIsoDate(item.expiryDate),
      toCsvNumber(item.price),
      toCsvNumber(item.costPrice),
      toCsvNumber(item.stock),
      toCsvNumber(getReorderLevel(item, lowStockThreshold)),
      getStatusLabel(item, lowStockThreshold),
      toCsvNumber(toNumber(item.price) * toNumber(item.stock)),
    ]);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`medicines-${stamp}.csv`, headers, rows);
  };

  return (
    <div className="medicines-page">
      <section className="medicines-hero">
        <div className="hero-copy">
          <span className="hero-kicker">Inventory</span>
          <h1>Medicines Control Center</h1>
          <p>Track stock, expiry, and value with a clear, action-ready view.</p>
          <div className="hero-actions">
            <button type="button" className="btn primary" onClick={openAdd}>
              <Plus size={18} />
              Add medicine
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={load}
              disabled={loading}
            >
              <RefreshCcw size={18} />
              Refresh
            </button>
          </div>
        </div>
        <div className="hero-panel">
          <div className="hero-badge">
            <Package size={20} />
            Inventory value
          </div>
          <div className="hero-value">{formatCurrency(stats.value)}</div>
          <div className="hero-metrics">
            <div>
              <span className="metric-label">Low stock</span>
              <span className="metric-value">{stats.low}</span>
            </div>
            <div>
              <span className="metric-label">Out of stock</span>
              <span className="metric-value">{stats.out}</span>
            </div>
            <div>
              <span className="metric-label">Expiring soon</span>
              <span className="metric-value">{stats.expiring}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <Package size={18} />
          </div>
          <div className="stat-label">Total medicines</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon warning">
            <AlertTriangle size={18} />
          </div>
          <div className="stat-label">Low stock alerts</div>
          <div className="stat-value">{stats.low}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon danger">
            <AlertTriangle size={18} />
          </div>
          <div className="stat-label">Out of stock</div>
          <div className="stat-value">{stats.out}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <Calendar size={18} />
          </div>
          <div className="stat-label">Expiring in 30 days</div>
          <div className="stat-value">{stats.expiring}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <Package size={18} />
          </div>
          <div className="stat-label">Inventory value</div>
          <div className="stat-value">{formatCurrency(stats.value)}</div>
        </div>
      </section>

      <section className="expiring-panel">
        <div className="expiring-header">
          <div>
            <h2>Expiring soon</h2>
            <p>Medicines expiring within the next 30 days.</p>
          </div>
          <div className="expiring-count">{expiringItems.length} items</div>
        </div>
        {expiringItems.length === 0 ? (
          <div className="state-card">No medicines expiring soon.</div>
        ) : (
          <div className="expiring-list">
            {expiringItems.map((item, index) => {
              const key =
                item.id ?? item.batchNumber ?? `${item.name}-${index}`;
              return (
                <div className="expiring-row" key={key}>
                  <div className="expiring-main">
                    <span className="expiring-name">
                      {item.name || "Unnamed"}
                    </span>
                    <span className="expiring-meta">
                      Batch {item.batchNumber || "--"} ·{" "}
                      {toNumber(item.stock)} units
                    </span>
                  </div>
                  <div className="expiring-meta">
                    <span className="expiring-date">
                      {formatDate(item.expiryDate)}
                    </span>
                    <span
                      className={`expiring-tag ${getExpiryTone(
                        item.daysUntil
                      )}`}
                    >
                      {formatDaysLeft(item.daysUntil)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="medicines-panel">
        <div className="panel-header">
          <div>
            <h2>All medicines</h2>
            <p>Search by name, batch number, or manufacturer.</p>
          </div>
          <div className="panel-controls">
            <label className="search-field">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search medicines"
              />
            </label>
            <select
              className="select-field"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="ok">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
            <button
              type="button"
              className="btn ghost"
              onClick={handleImportClick}
              disabled={importing}
            >
              <Upload size={16} />
              {importing ? "Importing..." : "Import CSV"}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={exportMedicinesCsv}
              disabled={filtered.length === 0}
            >
              <Download size={16} />
              Export CSV
            </button>
            <button type="button" className="btn secondary" onClick={openAdd}>
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>

        {loading && <div className="state-card">Loading medicines...</div>}

        {!loading && error && <div className="state-card error">{error}</div>}

        {!loading && !error && filtered.length === 0 && (
          <div className="state-card">No medicines match your filters.</div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <>
            <div className="table-scroll">
              <table className="medicines-table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Manufacturer</th>
                    <th>Batch</th>
                    <th>Expiry</th>
                    <th>Stock</th>
                    <th>Price</th>
                    <th>Cost</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, index) => {
                    const status = getStatus(item, lowStockThreshold);
                    const key = item.id ?? item.batchNumber ?? `${item.name}-${index}`;
                    return (
                      <tr key={key}>
                        <td>
                          <div className="name-cell">
                            <span className="name">
                              {item.name || "Unnamed"}
                            </span>
                            <span className="sub">
                              {item.category || "Uncategorized"}
                            </span>
                          </div>
                        </td>
                        <td>{item.manufacturer || "--"}</td>
                        <td>{item.batchNumber || "--"}</td>
                        <td>{formatDate(item.expiryDate)}</td>
                        <td>
                          <div className={`pill ${status}`}>
                            {getStatusLabel(item, lowStockThreshold)}
                          </div>
                          <div className="sub">{toNumber(item.stock)} units</div>
                        </td>
                        <td>{formatCurrency(item.price)}</td>
                        <td>{formatCurrency(item.costPrice)}</td>
                        <td>
                          <div className="actions">
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => openEdit(item)}
                              aria-label="Edit medicine"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn danger"
                              onClick={() => handleDelete(item)}
                              disabled={deletingId === item.id}
                              aria-label="Delete medicine"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="medicine-cards">
              {filtered.map((item, index) => {
                const status = getStatus(item, lowStockThreshold);
                const key = item.id ?? item.batchNumber ?? `${item.name}-${index}`;
                return (
                  <article className="medicine-card" key={key}>
                    <div className="card-title">
                      <div>
                        <h3>{item.name || "Unnamed"}</h3>
                        <p>{item.category || "Uncategorized"}</p>
                      </div>
                      <span className={`pill ${status}`}>
                        {getStatusLabel(item, lowStockThreshold)}
                      </span>
                    </div>
                    <div className="card-grid">
                      <div>
                        <span className="label">Manufacturer</span>
                        <span className="value">
                          {item.manufacturer || "--"}
                        </span>
                      </div>
                      <div>
                        <span className="label">Batch</span>
                        <span className="value">{item.batchNumber || "--"}</span>
                      </div>
                      <div>
                        <span className="label">Expiry</span>
                        <span className="value">{formatDate(item.expiryDate)}</span>
                      </div>
                      <div>
                        <span className="label">Stock</span>
                        <span className="value">{toNumber(item.stock)} units</span>
                      </div>
                      <div>
                        <span className="label">Price</span>
                        <span className="value">{formatCurrency(item.price)}</span>
                      </div>
                      <div>
                        <span className="label">Cost price</span>
                        <span className="value">{formatCurrency(item.costPrice)}</span>
                      </div>
                      <div>
                        <span className="label">Reorder level</span>
                        <span className="value">
                          {getReorderLevel(item, lowStockThreshold)}
                        </span>
                      </div>
                    </div>
                    <div className="card-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn danger"
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{editing ? "Edit medicine" : "Add medicine"}</h3>
                <p>Keep stock, pricing, and expiry up to date.</p>
              </div>
              <button
                type="button"
                className="icon-btn ghost"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close"
              >
                x
              </button>
            </div>
            <form className="modal-form" onSubmit={handleSubmit}>
              {formError && <div className="form-error">{formError}</div>}
              <div className="form-grid">
                <label className="field">
                  <span>Name</span>
                  <input
                    value={form.name}
                    onChange={handleChange("name")}
                    required
                  />
                </label>
                <label className="field">
                  <span>Category</span>
                  <input
                    value={form.category}
                    onChange={handleChange("category")}
                  />
                </label>
                <label className="field">
                  <span>Manufacturer</span>
                  <input
                    value={form.manufacturer}
                    onChange={handleChange("manufacturer")}
                  />
                </label>
                <label className="field">
                  <span>Batch number</span>
                  <input
                    value={form.batchNumber}
                    onChange={handleChange("batchNumber")}
                    required
                  />
                </label>
                <label className="field">
                  <span>Expiry date</span>
                  <input
                    type="date"
                    value={form.expiryDate}
                    onChange={handleChange("expiryDate")}
                    required
                  />
                </label>
                <label className="field">
                  <span>Price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={handleChange("price")}
                    required
                  />
                </label>
                <label className={`field${isCostInvalid ? " invalid" : ""}`}>
                  <span>Cost price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.costPrice}
                    onChange={handleChange("costPrice")}
                    required
                    className={isCostInvalid ? "invalid" : ""}
                  />
                </label>
                <label className="field">
                  <span>Stock</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.stock}
                    onChange={handleChange("stock")}
                    required
                  />
                </label>
                <label className="field">
                  <span>Reorder level</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.reorderLevel}
                    onChange={handleChange("reorderLevel")}
                  />
                </label>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={saving || !isFormValid}
                >
                  {saving ? "Saving..." : editing ? "Save changes" : "Add medicine"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
