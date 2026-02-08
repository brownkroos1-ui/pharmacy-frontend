import { useEffect, useMemo, useState } from "react";
import {
  UserCircle2,
  Search,
  RefreshCcw,
  UserX,
  UserCheck,
  UserPlus,
  KeyRound,
} from "lucide-react";
import {
  fetchAdminUsers,
  updateAdminUserRole,
  updateAdminUserStatus,
  createAdminUser,
  resetAdminUserPassword,
} from "../api/adminUsers";
import "./AdminUsers.css";

const ROLE_LABELS = {
  ADMIN: "Admin",
  CASHIER: "Cashier",
};

const STATUS_LABELS = {
  true: "Active",
  false: "Disabled",
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [formError, setFormError] = useState("");
  const [createForm, setCreateForm] = useState({
    username: "",
    name: "",
    email: "",
    password: "",
    role: "CASHIER",
    active: true,
  });
  const [resetPassword, setResetPassword] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const params = {
        query: query.trim() || undefined,
        role: roleFilter === "all" ? undefined : roleFilter,
        active:
          statusFilter === "all" ? undefined : statusFilter === "active",
      };
      const data = await fetchAdminUsers(params);
      setUsers(data);
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Failed to load users."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    load();
  }, [roleFilter, statusFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) =>
      [user.username, user.name, user.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [users, query]);

  const counts = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role === "ADMIN").length;
    const cashiers = users.filter((u) => u.role === "CASHIER").length;
    const active = users.filter((u) => u.active).length;
    return { total, admins, cashiers, active };
  }, [users]);

  const handleRoleChange = async (user, role) => {
    if (!user?.id) return;
    try {
      setBusyId(user.id);
      const updated = await updateAdminUserRole(user.id, role);
      setUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? updated : u))
      );
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update role."
      );
    } finally {
      setBusyId(null);
    }
  };

  const toggleStatus = async (user) => {
    if (!user?.id) return;
    try {
      setBusyId(user.id);
      const updated = await updateAdminUserStatus(user.id, !user.active);
      setUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? updated : u))
      );
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update status."
      );
    } finally {
      setBusyId(null);
    }
  };

  const openCreate = () => {
    setFormError("");
    setCreateForm({
      username: "",
      name: "",
      email: "",
      password: "",
      role: "CASHIER",
      active: true,
    });
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
  };

  const openReset = (user) => {
    setFormError("");
    setResetTarget(user);
    setResetPassword("");
    setResetOpen(true);
  };

  const closeReset = () => {
    setResetOpen(false);
    setResetTarget(null);
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setFormError("");
    if (!createForm.username.trim() || !createForm.password.trim()) {
      setFormError("Username and password are required.");
      return;
    }
    try {
      setBusyId("create");
      const payload = {
        username: createForm.username.trim(),
        name: createForm.name.trim() || null,
        email: createForm.email.trim() || null,
        password: createForm.password,
        role: createForm.role,
        active: createForm.active,
      };
      await createAdminUser(payload);
      await load();
      closeCreate();
    } catch (err) {
      setFormError(
        err?.response?.data?.message || err?.message || "Failed to add user."
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setFormError("");
    if (!resetTarget?.id) return;
    if (!resetPassword.trim()) {
      setFormError("Password is required.");
      return;
    }
    try {
      setBusyId(resetTarget.id);
      await resetAdminUserPassword(resetTarget.id, resetPassword);
      closeReset();
    } catch (err) {
      setFormError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to reset password."
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-users">
      <section className="users-hero">
        <div className="hero-copy">
          <span className="hero-kicker">Admin users</span>
          <h1>User management</h1>
          <p>Manage pharmacy accounts, roles, and access status in one place.</p>
          <div className="hero-actions">
            <button type="button" className="hero-refresh" onClick={load}>
              <RefreshCcw size={16} />
              Refresh
            </button>
            <button type="button" className="hero-add" onClick={openCreate}>
              <UserPlus size={16} />
              Add user
            </button>
          </div>
        </div>
        <div className="hero-panel">
          <div className="hero-stat">
            <span>Total users</span>
            <strong>{counts.total}</strong>
          </div>
          <div className="hero-stat">
            <span>Admins</span>
            <strong>{counts.admins}</strong>
          </div>
          <div className="hero-stat">
            <span>Cashiers</span>
            <strong>{counts.cashiers}</strong>
          </div>
          <div className="hero-stat">
            <span>Active</span>
            <strong>{counts.active}</strong>
          </div>
        </div>
      </section>

      <section className="users-panel">
        <div className="panel-header">
          <div>
            <h2>All users</h2>
            <p>Search by name, username, or email.</p>
          </div>
          <div className="panel-controls">
            <label className="search-field">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search users"
              />
            </label>
            <select
              className="select-field"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
            >
              <option value="all">All roles</option>
              <option value="ADMIN">Admins</option>
              <option value="CASHIER">Cashiers</option>
            </select>
            <select
              className="select-field"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
        </div>

        {loading && <div className="state-card">Loading users...</div>}
        {!loading && error && <div className="state-card error">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="state-card">No users found.</div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <>
            <div className="table-scroll">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="user-cell">
                          <UserCircle2 size={18} />
                          <div>
                            <strong>{user.name || user.username}</strong>
                            <span>@{user.username}</span>
                          </div>
                        </div>
                      </td>
                      <td>{user.email || "--"}</td>
                      <td>
                        <span className={`pill role-${user.role}`}>
                          {ROLE_LABELS[user.role] || user.role}
                        </span>
                      </td>
                      <td>
                        <span className={`pill ${user.active ? "ok" : "bad"}`}>
                          {STATUS_LABELS[user.active]}
                        </span>
                      </td>
                      <td className="actions">
                        <select
                          className="select-field compact"
                          value={user.role}
                          onChange={(event) =>
                            handleRoleChange(user, event.target.value)
                          }
                          disabled={busyId === user.id}
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="CASHIER">Cashier</option>
                        </select>
                        <button
                          type="button"
                          className={`btn ${user.active ? "ghost" : "primary"}`}
                          onClick={() => toggleStatus(user)}
                          disabled={busyId === user.id}
                        >
                          {user.active ? <UserX size={16} /> : <UserCheck size={16} />}
                          {user.active ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => openReset(user)}
                          disabled={busyId === user.id}
                        >
                          <KeyRound size={16} />
                          Reset
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="user-cards">
              {filtered.map((user) => (
                <article key={user.id} className="user-card">
                  <div className="user-card-header">
                    <div>
                      <h3>{user.name || user.username}</h3>
                      <p>@{user.username}</p>
                    </div>
                    <span className={`pill ${user.active ? "ok" : "bad"}`}>
                      {STATUS_LABELS[user.active]}
                    </span>
                  </div>
                  <div className="user-card-grid">
                    <div>
                      <span className="label">Email</span>
                      <span className="value">{user.email || "--"}</span>
                    </div>
                    <div>
                      <span className="label">Role</span>
                      <span className="value">
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                    </div>
                  </div>
                  <div className="user-card-actions">
                    <select
                      className="select-field compact"
                      value={user.role}
                      onChange={(event) =>
                        handleRoleChange(user, event.target.value)
                      }
                      disabled={busyId === user.id}
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="CASHIER">Cashier</option>
                    </select>
                    <button
                      type="button"
                      className={`btn ${user.active ? "ghost" : "primary"}`}
                      onClick={() => toggleStatus(user)}
                      disabled={busyId === user.id}
                    >
                      {user.active ? <UserX size={16} /> : <UserCheck size={16} />}
                      {user.active ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => openReset(user)}
                      disabled={busyId === user.id}
                    >
                      <KeyRound size={16} />
                      Reset
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {createOpen && (
        <div className="modal-overlay" onClick={closeCreate}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Add user</h3>
                <p>Create a new admin or cashier account.</p>
              </div>
              <button type="button" className="icon-btn ghost" onClick={closeCreate}>
                x
              </button>
            </div>
            <form className="modal-form" onSubmit={handleCreate}>
              {formError && <div className="form-error">{formError}</div>}
              <div className="form-grid">
                <label className="field">
                  <span>Username</span>
                  <input
                    value={createForm.username}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, username: e.target.value }))
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>Name</span>
                  <input
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Password</span>
                  <input
                    type="password"
                    value={createForm.password}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, password: e.target.value }))
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>Role</span>
                  <select
                    className="select-field"
                    value={createForm.role}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, role: e.target.value }))
                    }
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="CASHIER">Cashier</option>
                  </select>
                </label>
                <label className="field checkbox">
                  <span>Active</span>
                  <input
                    type="checkbox"
                    checked={createForm.active}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, active: e.target.checked }))
                    }
                  />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn ghost" onClick={closeCreate}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={busyId === "create"}>
                  {busyId === "create" ? "Saving..." : "Create user"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetOpen && (
        <div className="modal-overlay" onClick={closeReset}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Reset password</h3>
                <p>Set a new password for {resetTarget?.username}.</p>
              </div>
              <button type="button" className="icon-btn ghost" onClick={closeReset}>
                x
              </button>
            </div>
            <form className="modal-form" onSubmit={handleResetPassword}>
              {formError && <div className="form-error">{formError}</div>}
              <label className="field">
                <span>New password</span>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  required
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn ghost" onClick={closeReset}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={busyId === resetTarget?.id}>
                  {busyId === resetTarget?.id ? "Saving..." : "Reset password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
