"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import api from "@/lib/api";
import toast from "react-hot-toast";
import LogoutButton from "@/components/LogoutButton";

interface PendingOrder {
  id: string;
  order_number: string;
  table_id: string;
  grand_total: number;
  items: any[];
  created_at: string;
}

interface Table {
  id: string;
  label: string;
  status: string;
}

export default function CashierPage() {
  const router = useRouter();
  const { user, init } = useAuthStore();
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [showFastBilling, setShowFastBilling] = useState(false);

  useEffect(() => { init(); }, []);
  useEffect(() => {
    if (user && user.role === "manager") {
      toast.error("Access denied");
      router.push("/dashboard");
    }
  }, [user]);

  useEffect(() => {
    fetchPendingOrders();
    fetchTables();
  }, []);

  const fetchPendingOrders = async () => {
    try {
      const res = await api.get("/orders?status=pending&order_type=table");
      setPendingOrders(res.data.filter((o: any) => o.table_id));
    } catch { toast.error("Failed to load pending orders"); }
  };

  const fetchTables = async () => {
    try {
      const res = await api.get("/tables");
      setTables(res.data);
    } catch { toast.error("Failed to load tables"); }
  };

  const getTableLabel = (tableId: string) =>
    tables.find(t => t.id === tableId)?.label || "—";

  const handleFastBillingTable = async (order: PendingOrder) => {
    try {
      const res = await api.get(`/orders/${order.id}`);
      const fullOrder = res.data;
      const itemsParam = encodeURIComponent(JSON.stringify(fullOrder.items));
      router.push(
        `/cashier/order?mode=fast&orderId=${order.id}&tableLabel=${getTableLabel(order.table_id)}&tableId=${order.table_id}&savedItems=${itemsParam}`
      );
    } catch {
      toast.error("Failed to load order");
    }
  };

  if (!user) return null;

  const modes = [
    { id: "table",    label: "Table Booking", icon: "🪑", desc: "Dine-in orders with table selection",    color: "bg-orange-50 border-orange-200 hover:bg-orange-100", textColor: "text-orange-600" },
    { id: "takeaway", label: "Take Away",      icon: "🛍️", desc: "Quick orders to go",                    color: "bg-blue-50 border-blue-200 hover:bg-blue-100",       textColor: "text-blue-600" },
    { id: "delivery", label: "Delivery",       icon: "🛵", desc: "Home delivery with delivery fee",       color: "bg-green-50 border-green-200 hover:bg-green-100",    textColor: "text-green-600" },
    { id: "fast",     label: "Fast Billing",   icon: "⚡", desc: "Print bills for manager saved orders", color: "bg-purple-50 border-purple-200 hover:bg-purple-100", textColor: "text-purple-600" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/dashboard")} className="text-gray-400 hover:text-gray-600 transition">
              ← Back
            </button>
            <div className="w-px h-6 bg-gray-200" />
            <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center">
              <span className="text-lg">🍽️</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900">Cashier Control</h1>
              <p className="text-xs text-gray-500">Select billing mode</p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">

        {!showFastBilling && (
          <>
            <div className="text-center mb-8" style={{ paddingTop: "30px" }}>
              <h2 className="text-2xl font-bold text-gray-900">Choose Billing Mode</h2>
              <p className="text-gray-500 mt-2">Select how you want to take the order</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6" style={{ paddingTop: "30px" }}>
              {modes.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => {
                    if (mode.id === "fast") setShowFastBilling(true);
                    else if (mode.id === "table") router.push("/cashier/table");
                    else router.push(`/cashier/order?mode=${mode.id}`);
                  }}
                  className={`group rounded-2xl p-8 border-2 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg text-left ${mode.color}`}
                >
                  <div className="w-16 h-16 bg-white/60 rounded-2xl flex items-center justify-center mb-4">
                    <span className="text-3xl">{mode.icon}</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{mode.label}</h3>
                  <p className="text-gray-500 text-sm">{mode.desc}</p>
                  <div className={`mt-4 text-sm font-medium ${mode.textColor}`}>Start →</div>
                </button>
              ))}
            </div>
          </>
        )}

        {showFastBilling && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setShowFastBilling(false)} className="text-gray-400 hover:text-gray-600">
                ← Back
              </button>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">⚡ Fast Billing</h2>
                <p className="text-gray-500 text-sm">Manager saved orders ready for billing</p>
              </div>
              <button onClick={fetchPendingOrders} className="ml-auto text-sm text-orange-500 hover:text-orange-600 font-medium">
                🔄 Refresh
              </button>
            </div>

            {pendingOrders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-16 text-center">
                <p className="text-5xl mb-4">⚡</p>
                <p className="text-lg font-medium text-gray-900">No pending orders</p>
                <p className="text-sm text-gray-400 mt-1">Manager needs to save orders first</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pendingOrders.map(order => (
                  <button
                    key={order.id}
                    onClick={() => handleFastBillingTable(order)}
                    className="bg-white rounded-2xl border border-gray-100 shadow-md p-6 text-left hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🪑</span>
                        <span className="text-xl font-bold text-gray-900">
                          {getTableLabel(order.table_id)}
                        </span>
                      </div>
                      <span className="bg-yellow-100 text-yellow-700 text-xs font-medium px-2.5 py-1 rounded-full">
                        Pending
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mb-2">Order #{order.order_number}</div>
                    <div className="text-sm text-gray-600 mb-3">
                      {order.items?.[0] !== null ? `${order.items?.length} items` : "0 items"}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold text-orange-500">₹{order.grand_total}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(order.created_at).toLocaleTimeString('en-IN')}
                      </span>
                    </div>
                    <div className="mt-3 w-full py-2 bg-purple-50 text-purple-600 rounded-xl text-sm font-semibold text-center">
                      ⚡ Bill This Order →
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}