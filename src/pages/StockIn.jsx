import { useEffect, useMemo, useState } from "react";
import {
  PackagePlus,
  RefreshCcw,
  Search,
  ClipboardList,
  Truck,
} from "lucide-react";
import { fetchSuppliers } from "../api/suppliers";
import { fetchMedicines } from "../api/medicines";
import { fetchStockIns, createStockIn } from "../api/stockIns";
import { toast } from "../components/toastStore";
import "./StockIn.css";

const emptyForm = {
  supplierId: "",
  medicineId: "",
  quantity: "",
  invoiceNumber: "",
  note: "",
  costPrice: "",
  name: "",
  batchNumber: "",
  category: "",
  manufacturer: "",
  expiryDate: "",
  price: "",
  reorderLevel: "",
};

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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

export default function StockIn() {
  const [suppliers, setSuppliers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [stockIns, setStockIns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("existing");
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const notifyInventoryUpdated = () => {
    try {
      localStorage.setItem("pharmacy_inventory_updated", String(Date.now()));
    } catch {
      // ignore storage errors
    }
    window.dispatchEvent(new Event("pharmacy:inventory-updated"));
  };

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [suppliersData, medicinesData, stockInData] = await Promise.all([
        fetchSuppliers(),
        fetchMedicines(),
        fetchStockIns(),
      ]);
      setSuppliers(suppliersData);
      setMedicines(medicinesData);
      setStockIns(stockInData);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load stock-in data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredMedicines = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return medicines;
    return medicines.filter((item) =>
      [item.name, item.batchNumber, item.manufacturer]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [medicines, search]);

  const selectedMedicine = useMemo(() => {
    if (!form.medicineId) return null;
    return medicines.find(
      (item) => String(item.id) === String(form.medicineId)
    );
  }, [form.medicineId, medicines]);

  const stats = useMemo(() => {
    const totalIns = stockIns.length;
    const totalQty = stockIns.reduce(
      (sum, entry) => sum + toNumber(entry.quantity),
      0
    );
    const totalValue = stockIns.reduce((sum, entry) => {
      const unitCost = entry.unitCost ?? entry.medicine?.costPrice ?? 0;
      return sum + toNumber(entry.quantity) * toNumber(unitCost);
    }, 0);
    return { totalIns, totalQty, totalValue };
  }, [stockIns]);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const resetForm = () => {
    setForm((prev) => ({
      ...emptyForm,
      supplierId: prev.supplierId,
    }));
    setSearch("");
    setFormError("");
  };

  const isNewMode = mode === "new";
  const costValue =
    form.costPrice === "" ? null : toNumber(form.costPrice, NaN);
  const priceValue = form.price === "" ? null : toNumber(form.price, NaN);
  const selectedPrice = selectedMedicine?.price ?? null;

  const isCostInvalid = (() => {
    if (isNewMode) {
      if (!Number.isFinite(costValue) || !Number.isFinite(priceValue)) return false;
      return costValue > priceValue;
    }
    if (!Number.isFinite(costValue)) return false;
    if (!Number.isFinite(Number(selectedPrice))) return false;
    return costValue > Number(selectedPrice);
  })();

  const isFormValid = (() => {
    if (!form.supplierId || !form.quantity) return false;
    if (isNewMode) {
      return (
        form.name.trim() &&
        form.batchNumber.trim() &&
        form.expiryDate &&
        form.price !== "" &&
        form.costPrice !== "" &&
        !isCostInvalid
      );
    }
    return !!form.medicineId && !isCostInvalid;
  })();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!form.supplierId) {
      setFormError("Supplier is required.");
      return;
    }
    if (!form.quantity) {
      setFormError("Quantity is required.");
      return;
    }
    if (isNewMode) {
      if (!form.name.trim() || !form.batchNumber.trim()) {
        setFormError("Name and batch number are required.");
        return;
      }
      if (!form.expiryDate) {
        setFormError("Expiry date is required.");
        return;
      }
      if (form.price === "" || form.costPrice === "") {
        setFormError("Price and cost price are required.");
        return;
      }
      if (isCostInvalid) {
        setFormError("Cost price must be less than or equal to price.");
        return;
      }
    } else if (!form.medicineId) {
      setFormError("Select an existing batch to stock in.");
      return;
    }

    const payload = {
      supplierId: Number(form.supplierId),
      quantity: toNumber(form.quantity),
      invoiceNumber: form.invoiceNumber.trim() || null,
      note: form.note.trim() || null,
    };

    if (form.costPrice !== "") {
      payload.costPrice = toNumber(form.costPrice);
    }

    if (isNewMode) {
      payload.name = form.name.trim();
      payload.batchNumber = form.batchNumber.trim();
      payload.category = form.category.trim() || null;
      payload.manufacturer = form.manufacturer.trim() || null;
      payload.expiryDate = form.expiryDate;
      payload.price = toNumber(form.price);
      payload.costPrice = toNumber(form.costPrice);
      payload.reorderLevel =
        form.reorderLevel === "" ? null : toNumber(form.reorderLevel);
    } else {
      payload.medicineId = Number(form.medicineId);
    }

    try {
      setSaving(true);
      await createStockIn(payload);
      toast.success("Stock-in recorded", {
        description: "Inventory updated successfully.",
      });
      await load();
      notifyInventoryUpdated();
      resetForm();
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to record stock-in.";
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stockin-page">
      <section className="stockin-hero">
        <div className="hero-copy">
          <span className="hero-kicker">Stock In</span>
          <h1>Purchase & restock</h1>
          <p>Record supplier deliveries and keep batch stock accurate.</p>
          <div className="hero-actions">
            <button type="button" className="hero-refresh" onClick={load}>
              <RefreshCcw size={16} />
              Refresh
            </button>
          </div>
        </div>
        <div className="hero-panel">
          <div className="hero-stat">
            <span>Stock-ins logged</span>
            <strong>{stats.totalIns}</strong>
          </div>
          <div className="hero-stat">
            <span>Total units</span>
            <strong>{stats.totalQty}</strong>
          </div>
          <div className="hero-stat">
            <span>Total value</span>
            <strong>{formatCurrency(stats.totalValue)}</strong>
          </div>
        </div>
      </section>

      {loading && <div className="state-card">Loading stock-in data...</div>}
      {!loading && error && <div className="state-card error">{error}</div>}

      {!loading && !error && (
        <div className="stockin-grid">
          <section className="stockin-card">
            <div className="card-header">
              <div>
                <h2>Record stock-in</h2>
                <p>Choose a supplier and add quantities for a batch.</p>
              </div>
              <div className="mode-toggle">
                <button
                  type="button"
                  className={mode === "existing" ? "active" : ""}
                  onClick={() => setMode("existing")}
                >
                  Existing batch
                </button>
                <button
                  type="button"
                  className={mode === "new" ? "active" : ""}
                  onClick={() => setMode("new")}
                >
                  New batch
                </button>
              </div>
            </div>

            <form className="stockin-form" onSubmit={handleSubmit}>
              {formError && <div className="form-error">{formError}</div>}
              <div className="form-grid">
                <label className="field">
                  <span>Supplier</span>
                  <select
                    value={form.supplierId}
                    onChange={handleChange("supplierId")}
                    required
                  >
                    <option value="">Select supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Quantity</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.quantity}
                    onChange={handleChange("quantity")}
                    required
                  />
                </label>

                {!isNewMode && (
                  <>
                    <label className="field wide">
                      <span>Search batch</span>
                      <div className="search-field">
                        <Search size={16} />
                        <input
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Search by name or batch"
                        />
                      </div>
                    </label>
                    <label className="field wide">
                      <span>Existing batch</span>
                      <select
                        value={form.medicineId}
                        onChange={handleChange("medicineId")}
                        required
                      >
                        <option value="">Select batch</option>
                        {filteredMedicines.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} · {item.batchNumber} · {formatDate(item.expiryDate)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}

                {isNewMode && (
                  <>
                    <label className="field">
                      <span>Name</span>
                      <input
                        value={form.name}
                        onChange={handleChange("name")}
                        required
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
                      <span>Reorder level</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={form.reorderLevel}
                        onChange={handleChange("reorderLevel")}
                      />
                    </label>
                  </>
                )}

                {!isNewMode && (
                  <label className={`field${isCostInvalid ? " invalid" : ""}`}>
                    <span>Unit cost (optional)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.costPrice}
                      onChange={handleChange("costPrice")}
                      placeholder="Defaults to current cost"
                    />
                  </label>
                )}

                <label className="field">
                  <span>Invoice number</span>
                  <input
                    value={form.invoiceNumber}
                    onChange={handleChange("invoiceNumber")}
                    placeholder="Optional"
                  />
                </label>

                <label className="field wide">
                  <span>Note</span>
                  <input
                    value={form.note}
                    onChange={handleChange("note")}
                    placeholder="Optional notes"
                  />
                </label>
              </div>

              {selectedMedicine && !isNewMode && (
                <div className="medicine-preview">
                  <div>
                    <strong>{selectedMedicine.name}</strong>
                    <span>Batch {selectedMedicine.batchNumber}</span>
                  </div>
                  <div>
                    <span>Expiry</span>
                    <strong>{formatDate(selectedMedicine.expiryDate)}</strong>
                  </div>
                  <div>
                    <span>Current stock</span>
                    <strong>{toNumber(selectedMedicine.quantity)} units</strong>
                  </div>
                  <div>
                    <span>Price</span>
                    <strong>{formatCurrency(selectedMedicine.price)}</strong>
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button type="button" className="btn ghost" onClick={resetForm}>
                  Clear
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={saving || !isFormValid}
                >
                  {saving ? "Saving..." : "Record stock-in"}
                </button>
              </div>
            </form>
          </section>

          <section className="stockin-card">
            <div className="card-header">
              <div>
                <h2>Recent stock-ins</h2>
                <p>Latest deliveries by supplier and batch.</p>
              </div>
              <div className="card-badge">
                <ClipboardList size={16} />
                {stockIns.length} records
              </div>
            </div>

            {stockIns.length === 0 ? (
              <div className="state-card">No stock-ins recorded yet.</div>
            ) : (
              <div className="table-scroll">
                <table className="stock-table">
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Supplier</th>
                      <th>Qty</th>
                      <th>Unit cost</th>
                      <th>Invoice</th>
                      <th>Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockIns.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <div className="stock-cell">
                            <PackagePlus size={16} />
                            <div>
                              <strong>{entry.medicine?.name || "--"}</strong>
                              <span>Batch {entry.medicine?.batchNumber || "--"}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="stock-cell">
                            <Truck size={16} />
                            <div>
                              <strong>{entry.supplier?.name || "--"}</strong>
                              <span>{entry.supplier?.phone || "--"}</span>
                            </div>
                          </div>
                        </td>
                        <td>{entry.quantity}</td>
                        <td>{formatCurrency(entry.unitCost ?? entry.medicine?.costPrice)}</td>
                        <td>{entry.invoiceNumber || "--"}</td>
                        <td>{formatDateTime(entry.receivedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
