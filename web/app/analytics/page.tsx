"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import api from "@/lib/api";
import toast from "react-hot-toast";
import LogoutButton from "@/components/LogoutButton";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

interface Summary {
  total_orders: number;
  total_revenue: number;
  avg_bill: number;
  table_orders: number;
  takeaway_orders: number;
  delivery_orders: number;
  fast_orders: number;
}

interface DailyData {
  date: string;
  orders: number;
  revenue: number;
}

interface CategoryData {
  category: string;
  qty_sold: number;
  revenue: number;
}

const COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#f59e0b", "#06b6d4"];

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, init } = useAuthStore();

  const [period,       setPeriod]       = useState<"today" | "week" | "month">("today");
  const [summary,      setSummary]      = useState<Summary | null>(null);
  const [dailyData,    setDailyData]    = useState<DailyData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => { init(); }, []);
  useEffect(() => {
    if (user && user.role !== "admin") {
      toast.error("Admin access only");
      router.push("/dashboard");
    }
  }, [user]);
  useEffect(() => { fetchAll(); }, [period]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [summaryRes, dailyRes, categoryRes] = await Promise.all([
        api.get(`/analytics/summary?period=${period}`),
        api.get(`/analytics/daily?days=${period === "today" ? 1 : period === "week" ? 7 : 30}`),
        api.get(`/analytics/categories?period=${period}`),
      ]);
      setSummary(summaryRes.data);
      setDailyData(dailyRes.data);
      setCategoryData(categoryRes.data);
    } catch {
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  const orderTypeData = summary ? [
    { name: "Table",    value: Number(summary.table_orders) },
    { name: "Takeaway", value: Number(summary.takeaway_orders) },
    { name: "Delivery", value: Number(summary.delivery_orders) },
    { name: "Fast",     value: Number(summary.fast_orders) },
  ].filter(d => d.value > 0) : [];

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              ← Back
            </button>
            <div className="w-px h-6 bg-gray-200" />
            <h1 className="font-bold text-gray-900 text-lg">📊 Analytics</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchAll}
              className="text-sm text-orange-500 hover:text-orange-600 font-medium"
            >
              🔄 Refresh
            </button>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* Period selector */}
        <div className="flex gap-2 mb-6">
          {[
            { id: "today", label: "Today" },
            { id: "week",  label: "This Week" },
            { id: "month", label: "This Month" },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id as any)}
              className={`px-6 py-2.5 rounded-xl font-medium text-sm transition ${
                period === p.id
                  ? "bg-orange-500 text-white shadow-md"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading analytics...</div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Total Orders",    value: summary?.total_orders || 0,                                icon: "📋", color: "bg-blue-50 text-blue-700" },
                { label: "Total Revenue",   value: `₹${Number(summary?.total_revenue || 0).toLocaleString()}`, icon: "💰", color: "bg-green-50 text-green-700" },
                { label: "Avg Bill",        value: `₹${Math.round(Number(summary?.avg_bill || 0))}`,          icon: "🧾", color: "bg-purple-50 text-purple-700" },
                { label: "Categories Sold", value: categoryData.length,                                       icon: "📂", color: "bg-orange-50 text-orange-700" },
              ].map((card, i) => (
                <div key={i} className={`${card.color} rounded-2xl p-5`}>
                  <div className="text-2xl mb-2">{card.icon}</div>
                  <p className="text-xs font-medium opacity-70">{card.label}</p>
                  <p className="text-2xl font-bold mt-1">{card.value}</p>
                </div>
              ))}
            </div>

            {/* Order type breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Table",    value: summary?.table_orders    || 0, icon: "🪑", color: "bg-orange-100 text-orange-700" },
                { label: "Takeaway", value: summary?.takeaway_orders || 0, icon: "🛍️", color: "bg-blue-100 text-blue-700" },
                { label: "Delivery", value: summary?.delivery_orders || 0, icon: "🛵", color: "bg-green-100 text-green-700" },
                { label: "Fast",     value: summary?.fast_orders     || 0, icon: "⚡", color: "bg-purple-100 text-purple-700" },
              ].map((card, i) => (
                <div key={i} className={`${card.color} rounded-2xl p-4 text-center`}>
                  <div className="text-2xl mb-1">{card.icon}</div>
                  <p className="text-xl font-bold">{card.value}</p>
                  <p className="text-xs font-medium opacity-70">{card.label}</p>
                </div>
              ))}
            </div>

            {/* Revenue line chart */}
            {dailyData.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6 mb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Revenue Trend</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val: any) => [`₹${val}`, "Revenue"]}
                      labelFormatter={d => new Date(d).toLocaleDateString('en-IN')}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#f97316"
                      strokeWidth={2.5}
                      dot={{ fill: "#f97316", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

              {/* Category bar chart */}
              {categoryData.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Sales by Category</h2>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={categoryData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(val: any) => [`₹${val}`, "Revenue"]} />
                      <Bar dataKey="revenue" fill="#f97316" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Order type pie chart */}
              {orderTypeData.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Orders by Type</h2>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={orderTypeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {orderTypeData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Category performance table */}
            {categoryData.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900">Category Performance</h2>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500">Category</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500">Qty Sold</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500">Revenue</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryData.map((cat, i) => {
                      const totalRevenue = categoryData.reduce((s, c) => s + Number(c.revenue), 0);
                      const share = totalRevenue > 0
                        ? Math.round(Number(cat.revenue) / totalRevenue * 100) : 0;
                      return (
                        <tr key={i} className="border-t border-gray-50 hover:bg-gray-50 transition">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                              <span className="font-medium text-sm text-gray-900">{cat.category}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-right text-sm text-gray-600">{cat.qty_sold}</td>
                          <td className="px-6 py-3 text-right text-sm font-bold text-orange-500">
                            ₹{Number(cat.revenue).toLocaleString()}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-orange-400" style={{ width: `${share}%` }} />
                              </div>
                              <span className="text-xs text-gray-500">{share}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Empty state */}
            {categoryData.length === 0 && dailyData.length === 0 && (
              <div className="text-center py-20 text-gray-400">
                <p className="text-5xl mb-4">📊</p>
                <p className="text-lg font-medium">No data for this period</p>
                <p className="text-sm mt-1">Complete some orders to see analytics</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}