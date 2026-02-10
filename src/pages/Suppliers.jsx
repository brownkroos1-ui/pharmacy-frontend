import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCcw, Search, Pencil, Trash2, Truck } from "lucide-react";
import {
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "../api/suppliers";
import { toast } from "../components/toastStore";
import "./Suppliers.css";

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  address: "",
};

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await fetchSuppliers();
      setSuppliers(data);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load suppliers."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((supplier) =>
      [supplier.name, supplier.email, supplier.phone, supplier.address]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [suppliers, query]);

  const stats = useMemo(() => {
    const total = suppliers.length;
    const withEmail = suppliers.filter((s) => s.email).length;
    const withPhone = suppliers.filter((s) => s.phone).length;
    return { total, withEmail, withPhone };
  }, [suppliers]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (supplier) => {
    setEditing(supplier);
    setForm({
      name: supplier.name ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
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
    if (!form.name.trim()) {
      setFormError("Supplier name is required.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
    };

    try {
      setSaving(true);
      if (editing?.id) {
        await updateSupplier(editing.id, payload);
        toast.success("Supplier updated", {
          description: `${payload.name} has been updated.`,
        });
      } else {
        await createSupplier(payload);
        toast.success("Supplier added", {
          description: `${payload.name} is now available for stock-in.`,
        });
      }
      await load();
      closeModal();
    } catch (err) {
      const status = err?.response?.status;
      const message =
        err?.response?.data?.message || err?.message || "Failed to save supplier.";
      if (status === 409) {
        setFormError("That supplier name already exists. Use a different name.");
      } else {
        setFormError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (supplier) => {
    if (!supplier?.id) return;
    const ok = window.confirm(
      `Archive ${supplier.name || "this supplier"}? You can add it again later.`
    );
    if (!ok) return;

    try {
      setDeletingId(supplier.id);
      await deleteSupplier(supplier.id);
      setSuppliers((prev) => prev.filter((item) => item.id !== supplier.id));
      toast.success("Supplier archived", {
        description: `${supplier.name || "Supplier"} removed from active list.`,
      });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to archive supplier."
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="suppliers-page">
      <section className="suppliers-hero">
        <div className="hero-copy">
          <span className="hero-kicker">Suppliers</span>
          <h1>Supplier management</h1>
          <p>Track trusted vendors and keep restocking organized.</p>
          <div className="hero-actions">
            <button type="button" className="hero-refresh" onClick={load}>
              <RefreshCcw size={16} />
              Refresh
            </button>
            <button type="button" className="hero-add" onClick={openAdd}>
              <Plus size={16} />
              Add supplier
            </button>
          </div>
        </div>
        <div className="hero-panel">
          <div className="hero-stat">
            <span>Total suppliers</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="hero-stat">
            <span>With email</span>
            <strong>{stats.withEmail}</strong>
          </div>
          <div className="hero-stat">
            <span>With phone</span>
            <strong>{stats.withPhone}</strong>
          </div>
        </div>
      </section>

      <section className="suppliers-panel">
        <div className="panel-header">
          <div>
            <h2>All suppliers</h2>
            <p>Search by name, phone, or email.</p>
          </div>
          <div className="panel-controls">
            <label className="search-field">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search suppliers"
              />
            </label>
          </div>
        </div>

        {loading && <div className="state-card">Loading suppliers...</div>}
        {!loading && error && <div className="state-card error">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="state-card">No suppliers found.</div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <>
            <div className="table-scroll">
              <table className="suppliers-table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Address</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((supplier) => (
                    <tr key={supplier.id}>
                      <td>
                        <div className="supplier-cell">
                          <Truck size={18} />
                          <div>
                            <strong>{supplier.name}</strong>
                            <span>Active supplier</span>
                          </div>
                        </div>
                      </td>
                      <td>{supplier.phone || "--"}</td>
                      <td>{supplier.email || "--"}</td>
                      <td>{supplier.address || "--"}</td>
                      <td className="actions">
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => openEdit(supplier)}
                          aria-label="Edit supplier"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn danger"
                          onClick={() => handleDelete(supplier)}
                          disabled={deletingId === supplier.id}
                          aria-label="Archive supplier"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="supplier-cards">
              {filtered.map((supplier) => (
                <article key={supplier.id} className="supplier-card">
                  <div className="supplier-card-header">
                    <div>
                      <h3>{supplier.name}</h3>
                      <p>{supplier.email || supplier.phone || "Active supplier"}</p>
                    </div>
                    <span className="pill ok">Active</span>
                  </div>
                  <div className="supplier-card-grid">
                    <div>
                      <span className="label">Phone</span>
                      <span className="value">{supplier.phone || "--"}</span>
                    </div>
                    <div>
                      <span className="label">Email</span>
                      <span className="value">{supplier.email || "--"}</span>
                    </div>
                    <div>
                      <span className="label">Address</span>
                      <span className="value">{supplier.address || "--"}</span>
                    </div>
                  </div>
                  <div className="supplier-card-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => openEdit(supplier)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger"
                      onClick={() => handleDelete(supplier)}
                      disabled={deletingId === supplier.id}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{editing ? "Edit supplier" : "Add supplier"}</h3>
                <p>Keep vendor records accurate for reorders.</p>
              </div>
              <button type="button" className="icon-btn ghost" onClick={closeModal}>
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
                  <span>Phone</span>
                  <input
                    value={form.phone}
                    onChange={handleChange("phone")}
                    placeholder="Optional"
                  />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={handleChange("email")}
                    placeholder="Optional"
                  />
                </label>
                <label className="field">
                  <span>Address</span>
                  <input
                    value={form.address}
                    onChange={handleChange("address")}
                    placeholder="Optional"
                  />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn ghost" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={saving}>
                  {saving ? "Saving..." : editing ? "Save changes" : "Add supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
