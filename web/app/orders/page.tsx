"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import api from "@/lib/api";
import toast from "react-hot-toast";
import LogoutButton from "@/components/LogoutButton";

interface Order {
  id: string;
  order_number: string;
  order_type: string;
  status: string;
  table_id: string;
  customer_name: string;
  customer_phone: string;
  subtotal: number;
  cgst: number;
  sgst: number;
  discount_pct: number;
  discount_fixed: number;
  delivery_fee: number;
  grand_total: number;
  is_printed: boolean;
  created_at: string;
  items: any[];
}

export default function OrdersPage() {
  const router = useRouter();
  const { user, init } = useAuthStore();

  const [orders,        setOrders]        = useState<Order[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [filterStatus,  setFilterStatus]  = useState("");
  const [filterType,    setFilterType]    = useState("");
  const [filterDate,    setFilterDate]    = useState("");
  const [searchQuery,   setSearchQuery]   = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => { init(); }, []);
  useEffect(() => { if (!user) router.push("/login"); }, [user]);
  useEffect(() => { fetchOrders(); }, [filterStatus, filterType, filterDate]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append("status", filterStatus);
      if (filterType)   params.append("order_type", filterType);
      if (filterDate)   params.append("date", filterDate);
      const res = await api.get(`/orders?${params.toString()}`);
      setOrders(res.data);
    } catch {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (id: string) => {
    if (!window.confirm("Cancel this order?")) return;
    try {
      await api.delete(`/orders/${id}`);
      toast.success("Order cancelled");
      fetchOrders();
    } catch {
      toast.error("Failed to cancel order");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":  return "bg-green-100 text-green-700";
      case "pending":    return "bg-yellow-100 text-yellow-700";
      case "preparing":  return "bg-blue-100 text-blue-700";
      case "cancelled":  return "bg-red-100 text-red-700";
      default:           return "bg-gray-100 text-gray-700";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "table":    return "🪑";
      case "takeaway": return "🛍️";
      case "delivery": return "🛵";
      case "fast":     return "⚡";
      default:         return "📋";
    }
  };

  const filtered = orders.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.order_number?.toLowerCase().includes(q) ||
      o.customer_name?.toLowerCase().includes(q) ||
      o.customer_phone?.includes(q)
    );
  });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              ← Back
            </button>
            <div className="w-px h-6 bg-gray-200" />
            <h1 className="font-bold text-gray-900 text-lg">📋 Order History</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchOrders}
              className="text-sm text-orange-500 hover:text-orange-600 font-medium"
            >
              🔄 Refresh
            </button>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Search by name, phone, order no..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="col-span-2 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm"
            />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm bg-white"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="preparing">Preparing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm bg-white"
            >
              <option value="">All Types</option>
              <option value="table">Table</option>
              <option value="takeaway">Takeaway</option>
              <option value="delivery">Delivery</option>
              <option value="fast">Fast Billing</option>
            </select>
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="col-span-2 md:col-span-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm"
            />
            <button
              onClick={() => {
                setFilterStatus("");
                setFilterType("");
                setFilterDate("");
                setSearchQuery("");
              }}
              className="col-span-2 md:col-span-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Orders",   value: filtered.length,                                                                                           color: "bg-blue-50 text-blue-700" },
            { label: "Completed",      value: filtered.filter(o => o.status === "completed").length,                                                     color: "bg-green-50 text-green-700" },
            { label: "Pending",        value: filtered.filter(o => o.status === "pending").length,                                                       color: "bg-yellow-50 text-yellow-700" },
            { label: "Total Revenue",  value: `₹${filtered.filter(o => o.status === "completed").reduce((s, o) => s + Number(o.grand_total), 0).toLocaleString()}`, color: "bg-orange-50 text-orange-700" },
          ].map((card, i) => (
            <div key={i} className={`${card.color} rounded-2xl p-4`}>
              <p className="text-xs font-medium opacity-70">{card.label}</p>
              <p className="text-2xl font-bold mt-1">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Orders table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden">
          {loading ? (
            <div className="text-center py-20 text-gray-400">Loading orders...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <p className="text-4xl mb-3">📋</p>
              <p>No orders found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Order No</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Customer</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Items</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Time</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(order => (
                    <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        #{order.order_number}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {getTypeIcon(order.order_type)} {order.order_type}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">{order.customer_name || "—"}</div>
                        <div className="text-xs text-gray-400">{order.customer_phone || ""}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {order.items?.[0] !== null ? order.items?.length : 0} items
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-orange-500">
                        ₹{order.grand_total}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {new Date(order.created_at).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition"
                          >
                            View
                          </button>
                          {order.status !== "cancelled" && order.status !== "completed" && (
                            <button
                              onClick={() => handleCancelOrder(order.id)}
                              className="px-2.5 py-1 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100 transition"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Order detail modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Order #{selectedOrder.order_number}</h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >✕</button>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-4 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span className="font-medium capitalize">{selectedOrder.order_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(selectedOrder.status)}`}>
                  {selectedOrder.status}
                </span>
              </div>
              {selectedOrder.customer_name && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Customer</span>
                  <span className="font-medium">{selectedOrder.customer_name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span>{new Date(selectedOrder.created_at).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="border border-gray-100 rounded-xl overflow-hidden mb-4">
              <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500 grid grid-cols-4">
                <span className="col-span-2">Item</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Total</span>
              </div>
              {selectedOrder.items?.filter(i => i !== null).map((item: any, i: number) => (
                <div key={i} className="px-3 py-2 text-sm grid grid-cols-4 border-t border-gray-50">
                  <span className="col-span-2">{item.name}</span>
                  <span className="text-center">{item.quantity}</span>
                  <span className="text-right font-medium">₹{item.line_total}</span>
                </div>
              ))}
            </div>

            <div className="text-sm space-y-2">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span><span>₹{selectedOrder.subtotal}</span>
              </div>
              {Number(selectedOrder.cgst) > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>CGST</span><span>₹{selectedOrder.cgst}</span>
                </div>
              )}
              {Number(selectedOrder.sgst) > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>SGST</span><span>₹{selectedOrder.sgst}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-100">
                <span>Total</span>
                <span className="text-orange-500">₹{selectedOrder.grand_total}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedOrder(null)}
              className="w-full mt-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}