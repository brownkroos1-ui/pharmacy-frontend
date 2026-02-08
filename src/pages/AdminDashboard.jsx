import React, { useEffect, useMemo, useState } from "react";
import {
  Users,
  Pill,
  AlertTriangle,
  XCircle,
  ShoppingBag,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Download,
  Clock,
} from "lucide-react";
import { fetchAdminDashboard } from "../api/adminDashboard";
import { fetchMonthlySalesRange, fetchProfitSummary } from "../api/sales";
import { fetchMedicines, fetchLowStockThreshold } from "../api/medicines";
import ProtectedRoute from "../components/ProtectedRoute";
import { downloadCsv } from "../utils/csv";
import "./AdminDashboard.css";

const formatNumber = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return number.toLocaleString("en-US");
};

const formatCurrency = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(number);
};

const formatTimestamp = (value) => {
  if (!value) return "--";
  return value.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const buildMonthRange = (count = 6) => {
  const now = new Date();
  const months = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      label: date.toLocaleString("en-US", { month: "short" }),
    });
  }
  return months;
};

const parseYearMonth = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const [year, month] = value.split("-").map(Number);
    if (year && month) {
      return { year, month };
    }
  }
  if (typeof value === "object") {
    const year = value.year ?? value.yearValue;
    const month = value.monthValue ?? value.month;
    if (year && month) {
      return { year, month };
    }
  }
  return null;
};

const formatMonthLabel = (year, month) =>
  new Date(year, month - 1, 1).toLocaleString("en-US", { month: "short" });

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getReorderLevel = (item, fallback = 10) =>
  toNumber(
    item?.reorderLevel === "" || item?.reorderLevel === null
      ? fallback
      : item?.reorderLevel,
    fallback
  );

const computeInventoryStats = (items, threshold) => {
  const low = items.filter((item) => {
    const stock = toNumber(item?.quantity ?? item?.stock ?? item?.qty);
    const reorder = getReorderLevel(item, threshold);
    return stock > 0 && stock <= reorder;
  }).length;
  const out = items.filter(
    (item) => toNumber(item?.quantity ?? item?.stock ?? item?.qty) <= 0
  ).length;
  return { low, out };
};

const Sparkline = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="sparkline-empty">No trend data</div>;
  }

  const values = data.map((item) => Number(item.value) || 0);
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
    const y = 36 - (value / max) * 28;
    return { x, y };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${line} 100,40 0,40`;

  return (
    <svg className="sparkline" viewBox="0 0 100 40" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparklineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#sparklineFill)" />
      <polyline
        points={line}
        fill="none"
        stroke="#0f766e"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const TrendBars = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="trend-chart-empty">No trend data</div>;
  }

  const values = data.map((item) => Number(item.value) || 0);
  const max = Math.max(...values, 1);

  return (
    <div className="trend-chart">
      {data.map((item, index) => {
        const value = Number(item.value) || 0;
        const height = max === 0 ? 0 : (value / max) * 100;
        return (
          <div className="trend-bar" key={`${item.label}-${index}`}>
            <div
              className="trend-bar-fill"
              style={{ height: `${height}%` }}
              title={formatCurrency(value)}
            />
            <span className="trend-bar-label">{item.label}</span>
            <span className="trend-bar-value">{formatCurrency(value)}</span>
          </div>
        );
      })}
    </div>
  );
};

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [trend, setTrend] = useState([]);
  const [trendError, setTrendError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [trendCount, setTrendCount] = useState(6);

  const fetchTrend = async (count = 6) => {
    const months = buildMonthRange(count);
    const now = new Date();
    try {
      const summaries = await fetchMonthlySalesRange(
        now.getFullYear(),
        now.getMonth() + 1,
        count
      );
      if (!Array.isArray(summaries) || summaries.length === 0) {
        return months.map((item) => ({
          label: item.label,
          value: 0,
          totalSales: 0,
          ok: false,
        }));
      }

      return summaries.map((summary, index) => {
        const ym = parseYearMonth(summary?.month);
        const label = ym
          ? formatMonthLabel(ym.year, ym.month)
          : months[index]?.label || "--";
        return {
          label,
          value: Number(summary?.totalRevenue ?? 0),
          totalSales: Number(summary?.totalSales ?? 0),
          ok: true,
        };
      });
    } catch {
      return months.map((item) => ({
        label: item.label,
        value: 0,
        totalSales: 0,
        ok: false,
      }));
    }
  };

  const getDashboardData = async ({ silent = false, count = trendCount } = {}) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const today = getTodayDateString();
      const [response, trendResults, medicines, threshold, todaySummary] = await Promise.all([
        fetchAdminDashboard(),
        fetchTrend(count),
        fetchMedicines().catch(() => []),
        fetchLowStockThreshold().catch(() => null),
        fetchProfitSummary({ start: today, end: today }).catch(() => null),
      ]);
      const list = Array.isArray(medicines) ? medicines : [];
      const resolvedThreshold = Number.isFinite(Number(threshold))
        ? Number(threshold)
        : 10;
      const inventory = list.length
        ? computeInventoryStats(list, resolvedThreshold)
        : null;
      const resolvedTodayProfit = toNumber(
        todaySummary?.totalProfit ??
          todaySummary?.profit ??
          response?.todayProfit ??
          response?.todayRevenue ??
          0
      );
      setData({
        ...response,
        lowStock: inventory ? inventory.low : response?.lowStock,
        outOfStock: inventory ? inventory.out : response?.outOfStock,
        todayProfit: resolvedTodayProfit,
      });
      setLastUpdated(new Date());
      setTrend(trendResults);
      setTrendError(trendResults.some((item) => item.ok) ? null : "unavailable");
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    getDashboardData();
  }, []);

  useEffect(() => {
    if (!data) return;
    getDashboardData({ silent: true, count: trendCount });
  }, [trendCount]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        getDashboardData({ silent: true, count: trendCount });
      }
    };
    const handleInventoryUpdated = () => {
      getDashboardData({ silent: true, count: trendCount });
    };
    const handleSalesUpdated = () => {
      getDashboardData({ silent: true, count: trendCount });
    };
    const handleStorage = (event) => {
      if (event.key === "pharmacy_inventory_updated") {
        handleInventoryUpdated();
      }
      if (event.key === "pharmacy_sales_updated") {
        handleSalesUpdated();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pharmacy:inventory-updated", handleInventoryUpdated);
    window.addEventListener("pharmacy:sales-updated", handleSalesUpdated);
    window.addEventListener("storage", handleStorage);
    const intervalId = window.setInterval(() => {
      getDashboardData({ silent: true, count: trendCount });
    }, 30000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener(
        "pharmacy:inventory-updated",
        handleInventoryUpdated
      );
      window.removeEventListener("pharmacy:sales-updated", handleSalesUpdated);
      window.removeEventListener("storage", handleStorage);
      window.clearInterval(intervalId);
    };
  }, [trendCount]);

  const trendTotal = useMemo(() => {
    return trend.reduce((sum, item) => sum + Number(item.value || 0), 0);
  }, [trend]);

  const trendAverage = useMemo(() => {
    if (!trend.length) return 0;
    return trendTotal / trend.length;
  }, [trend, trendTotal]);

  const trendPeak = useMemo(() => {
    return trend.reduce(
      (best, item) => {
        const value = Number(item.value || 0);
        if (value > best.value) {
          return { label: item.label, value };
        }
        return best;
      },
      { label: "--", value: 0 }
    );
  }, [trend]);

  const exportDashboardCsv = () => {
    if (!data) return;
    const headers = ["Section", "Metric", "Value"];
    const rows = [
      ["Summary", "Total users", Number(data?.totalUsers ?? 0)],
      ["Summary", "Total medicines", Number(data?.totalMedicines ?? 0)],
      ["Summary", "Low stock alerts", Number(data?.lowStock ?? 0)],
      ["Summary", "Out of stock", Number(data?.outOfStock ?? 0)],
      ["Summary", "Total sales", Number(totalSales)],
      ["Summary", "Completed sales", Number(completedSales)],
      ["Summary", "Cancelled sales", Number(cancelledSales)],
      ["Summary", "Completion rate (%)", Number(completionRate)],
      ["Summary", "Today's profit", Number(data?.todayProfit ?? 0)],
      ["Summary", "Trend months", Number(trendCount)],
      ["Summary", "Trend total revenue", Number(trendTotal)],
      [
        "Summary",
        "Last updated",
        lastUpdated ? lastUpdated.toISOString() : "",
      ],
      ...trend.map((item) => [
        "Trend",
        item.label,
        Number(item.value || 0),
      ]),
    ];

    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`admin-dashboard-${stamp}.csv`, headers, rows);
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="dashboard-state">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-dashboard">
        <div className="dashboard-state error">Error: {error}</div>
      </div>
    );
  }

  const totalSales = Number(data?.totalSales ?? 0);
  const completedSales = Number(data?.completedSales ?? 0);
  const cancelledSales = Number(data?.cancelledSales ?? 0);
  const completionRate = totalSales > 0
    ? Math.round((completedSales / totalSales) * 100)
    : 0;

  const cards = [
    {
      label: "Total users",
      value: formatNumber(data?.totalUsers),
      icon: Users,
      tone: "blue",
    },
    {
      label: "Total medicines",
      value: formatNumber(data?.totalMedicines),
      icon: Pill,
      tone: "teal",
    },
    {
      label: "Low stock alerts",
      value: formatNumber(data?.lowStock),
      icon: AlertTriangle,
      tone: "amber",
    },
    {
      label: "Out of stock",
      value: formatNumber(data?.outOfStock),
      icon: XCircle,
      tone: "rose",
    },
    {
      label: "Total sales",
      value: formatNumber(totalSales),
      icon: ShoppingBag,
      tone: "indigo",
    },
    {
      label: "Completion rate",
      value: `${completionRate}%`,
      meta: `${formatNumber(completedSales)} completed`,
      icon: CheckCircle2,
      tone: "green",
    },
  ];

  return (
    <div className="admin-dashboard">
      <section className="dashboard-hero">
        <div className="hero-copy">
          <span className="hero-kicker">Admin overview</span>
          <h1>Pharmacy Command Center</h1>
          <p>
            Track sales momentum, inventory health, and team activity in one
            focused view.
          </p>
          <div className="hero-tag">
            <TrendingUp size={16} />
            Live dashboard
          </div>
          <div className="hero-actions">
            <button
              type="button"
              className="hero-refresh"
              onClick={() => getDashboardData({ silent: true })}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh data"}
            </button>
            <button
              type="button"
              className="hero-export"
              onClick={exportDashboardCsv}
              disabled={!data}
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>
          <div className="hero-updated">
            <Clock size={16} />
            Last updated <strong>{formatTimestamp(lastUpdated)}</strong>
          </div>
        </div>
        <div className="hero-panel">
          <div className="hero-revenue">
            <div className="hero-badge">
              <DollarSign size={18} />
              Today&apos;s profit
            </div>
            <div className="hero-amount">
              {formatCurrency(data?.todayProfit)}
            </div>
          </div>
          <div className="hero-metrics">
            <div>
              <span className="metric-label">Completed sales</span>
              <span className="metric-value">{formatNumber(completedSales)}</span>
            </div>
            <div>
              <span className="metric-label">Cancelled sales</span>
              <span className="metric-value">{formatNumber(cancelledSales)}</span>
            </div>
            <div>
              <span className="metric-label">Total sales</span>
              <span className="metric-value">{formatNumber(totalSales)}</span>
            </div>
          </div>
          <div className="hero-trend">
            <div className="trend-header">
              <div className="trend-title">
                <span>{trendCount}-month revenue trend</span>
                <span className="trend-total">{formatCurrency(trendTotal)}</span>
              </div>
              <div className="trend-toggle">
                <button
                  type="button"
                  className={
                    trendCount === 6 ? "trend-toggle-btn active" : "trend-toggle-btn"
                  }
                  onClick={() => setTrendCount(6)}
                  disabled={refreshing}
                >
                  6m
                </button>
                <button
                  type="button"
                  className={
                    trendCount === 12
                      ? "trend-toggle-btn active"
                      : "trend-toggle-btn"
                  }
                  onClick={() => setTrendCount(12)}
                  disabled={refreshing}
                >
                  12m
                </button>
              </div>
            </div>
            {trendError ? (
              <div className="sparkline-empty">Trend unavailable</div>
            ) : (
              <Sparkline data={trend} />
            )}
            <div className="trend-labels">
              {trend.map((item, index) => (
                <span key={`${item.label}-${index}`}>{item.label}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className={`dashboard-card tone-${card.tone}`}>
              <div className="card-icon">
                <Icon size={20} />
              </div>
              <div className="card-label">{card.label}</div>
              <div className="card-value">{card.value}</div>
              {card.meta && <div className="card-meta">{card.meta}</div>}
            </article>
          );
        })}
      </section>

      <section className="trend-section">
        <div className="trend-card">
          <div className="trend-card-header">
            <div>
              <h2>Sales trend</h2>
              <p>Monthly revenue over the last {trendCount} months.</p>
            </div>
            <div className="trend-summary">
              <div>
                <span className="metric-label">Avg monthly</span>
                <span className="metric-value">{formatCurrency(trendAverage)}</span>
              </div>
              <div>
                <span className="metric-label">Peak month</span>
                <span className="metric-value">
                  {trendPeak.label} · {formatCurrency(trendPeak.value)}
                </span>
              </div>
            </div>
          </div>
          {trendError ? (
            <div className="trend-chart-empty">Trend unavailable</div>
          ) : (
            <TrendBars data={trend} />
          )}
        </div>
      </section>
    </div>
  );
};

export default function ProtectedAdminDashboard() {
  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminDashboard />
    </ProtectedRoute>
  );
}
