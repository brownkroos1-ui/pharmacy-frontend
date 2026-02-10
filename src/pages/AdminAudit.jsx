import { useEffect, useMemo, useState } from "react";
import { Search, RefreshCcw, ShieldCheck } from "lucide-react";
import { fetchAuditLogs } from "../api/adminAudit";
import "./AdminAudit.css";

const ACTION_LABELS = {
  CREATE: "Create",
  UPDATE: "Update",
  DELETE: "Delete",
  STOCK_IN: "Stock in",
  SALE: "Sale",
  SALE_REJECTED: "Sale rejected",
  UPDATE_ROLE: "Role change",
  UPDATE_STATUS: "Status change",
  RESET_PASSWORD: "Password reset",
};

const ACTION_TONES = {
  CREATE: "good",
  STOCK_IN: "good",
  SALE: "good",
  UPDATE: "info",
  UPDATE_ROLE: "info",
  UPDATE_STATUS: "info",
  RESET_PASSWORD: "warn",
  DELETE: "bad",
  SALE_REJECTED: "bad",
};

const ENTITY_OPTIONS = ["all", "MEDICINE", "SALE", "STOCK_IN", "USER"];

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatEntity = (log) => {
  if (!log?.entityType) return "--";
  if (!log?.entityId) return log.entityType;
  return `${log.entityType} #${log.entityId}`;
};

export default function AdminAudit() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actorQuery, setActorQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [limit, setLimit] = useState(100);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setError("");
      const params = {
        actor: actorQuery.trim() || undefined,
        entityType: entityFilter === "all" ? undefined : entityFilter,
        action: actionFilter === "all" ? undefined : actionFilter,
        limit,
      };
      const data = await fetchAuditLogs(params);
      setLogs(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load audit log."
      );
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    load({ silent: true });
  }, [entityFilter, actionFilter, limit]);

  const counts = useMemo(() => {
    const total = logs.length;
    const actors = new Set(logs.map((log) => log.actor).filter(Boolean)).size;
    const latest = logs[0];
    return {
      total,
      actors,
      latest: latest ? formatDate(latest.createdAt) : "--",
    };
  }, [logs]);

  const handleSearch = () => {
    load();
  };

  const actionOptions = useMemo(() => ["all", ...Object.keys(ACTION_LABELS)], []);

  return (
    <div className="admin-audit">
      <section className="audit-hero">
        <div className="hero-copy">
          <span className="hero-kicker">Admin audit</span>
          <h1>Audit log</h1>
          <p>Track who changed stock, users, and sales across the system.</p>
          <div className="hero-actions">
            <button type="button" className="hero-refresh" onClick={() => load()}>
              <RefreshCcw size={16} />
              Refresh
            </button>
          </div>
        </div>
        <div className="hero-panel">
          <div className="hero-stat">
            <span>Total events</span>
            <strong>{counts.total}</strong>
          </div>
          <div className="hero-stat">
            <span>Actors</span>
            <strong>{counts.actors}</strong>
          </div>
          <div className="hero-stat">
            <span>Latest activity</span>
            <strong>{counts.latest}</strong>
          </div>
        </div>
      </section>

      <section className="audit-panel">
        <div className="panel-header">
          <div>
            <h2>Activity feed</h2>
            <p>Filter by actor, entity, or action.</p>
          </div>
          <div className="panel-controls">
            <label className="search-field">
              <Search size={16} />
              <input
                value={actorQuery}
                onChange={(event) => setActorQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSearch();
                }}
                placeholder="Search by actor"
              />
            </label>
            <select
              className="select-field"
              value={entityFilter}
              onChange={(event) => setEntityFilter(event.target.value)}
            >
              {ENTITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All entities" : option}
                </option>
              ))}
            </select>
            <select
              className="select-field"
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
            >
              {actionOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All actions" : ACTION_LABELS[option] || option}
                </option>
              ))}
            </select>
            <select
              className="select-field"
              value={String(limit)}
              onChange={(event) => setLimit(Number(event.target.value))}
            >
              {[50, 100, 200, 300, 500].map((size) => (
                <option key={size} value={size}>
                  Last {size}
                </option>
              ))}
            </select>
            <button type="button" className="btn ghost" onClick={handleSearch}>
              Search
            </button>
          </div>
        </div>

        {lastUpdated && (
          <div className="audit-updated">
            <ShieldCheck size={16} />
            Last refreshed {formatDate(lastUpdated)}
          </div>
        )}

        {loading && <div className="state-card">Loading audit log...</div>}
        {!loading && error && <div className="state-card error">{error}</div>}
        {!loading && !error && logs.length === 0 && (
          <div className="state-card">No audit events yet.</div>
        )}

        {!loading && !error && logs.length > 0 && (
          <>
            <div className="table-scroll">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDate(log.createdAt)}</td>
                      <td>{log.actor || "--"}</td>
                      <td>
                        <span className={`tag ${ACTION_TONES[log.action] || "info"}`}>
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td>{formatEntity(log)}</td>
                      <td className="message">{log.message || "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="audit-cards">
              {logs.map((log) => (
                <article key={log.id} className="audit-card">
                  <div className="audit-card-header">
                    <div>
                      <h3>{log.actor || "Unknown"}</h3>
                      <p>{formatDate(log.createdAt)}</p>
                    </div>
                    <span className={`tag ${ACTION_TONES[log.action] || "info"}`}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </div>
                  <div className="audit-card-grid">
                    <div>
                      <span className="label">Entity</span>
                      <span className="value">{formatEntity(log)}</span>
                    </div>
                    <div>
                      <span className="label">Message</span>
                      <span className="value">{log.message || "--"}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
