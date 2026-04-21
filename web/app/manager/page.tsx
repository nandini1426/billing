"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import api from "@/lib/api";
import toast from "react-hot-toast";
import LogoutButton from "@/components/LogoutButton";

interface Table {
  id: string;
  label: string;
  capacity: number;
  status: "available" | "occupied" | "reserved";
}

interface Category { id: string; name: string; }
interface MenuItem  { id: string; name: string; price: number; }

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export default function ManagerPage() {
  const router = useRouter();
  const { user, init } = useAuthStore();

  const [tables,         setTables]         = useState<Table[]>([]);
  const [selectedTable,  setSelectedTable]  = useState<Table | null>(null);
  const [categories,     setCategories]     = useState<Category[]>([]);
  const [menuItems,      setMenuItems]      = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [orderItems,     setOrderItems]     = useState<OrderItem[]>([]);
  const [saving,         setSaving]         = useState(false);
  const [existingOrders, setExistingOrders] = useState<any[]>([]);
  const [view,           setView]           = useState<"tables" | "order">("tables");

  useEffect(() => { init(); }, []);
  useEffect(() => {
    if (user && user.role === "cashier") {
      toast.error("Access denied");
      router.push("/dashboard");
    }
  }, [user]);

  useEffect(() => {
    fetchTables();
    fetchCategories();
    fetchPendingOrders();
  }, []);

  useEffect(() => {
    if (activeCategory) fetchItems(activeCategory);
  }, [activeCategory]);

  const fetchTables = async () => {
    try {
      const res = await api.get("/tables");
      setTables(res.data);
    } catch { toast.error("Failed to load tables"); }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get("/menu/categories");
      setCategories(res.data);
      if (res.data.length > 0) setActiveCategory(res.data[0].id);
    } catch { toast.error("Failed to load categories"); }
  };

  const fetchItems = async (categoryId: string) => {
    try {
      const res = await api.get(`/menu/categories/${categoryId}/items`);
      setMenuItems(res.data);
    } catch { toast.error("Failed to load items"); }
  };

  const fetchPendingOrders = async () => {
    try {
      const res = await api.get("/orders?status=pending");
      setExistingOrders(res.data);
    } catch { toast.error("Failed to load orders"); }
  };

  const handleTableSelect = async (table: Table) => {
    setSelectedTable(table);
    setOrderItems([]);

    if (table.status === "occupied") {
      const existing = existingOrders.find(o => o.table_id === table.id);
      if (existing) {
        try {
          const res = await api.get(`/orders/${existing.id}`);
          const order = res.data;
          if (order.items && order.items[0] !== null) {
            setOrderItems(order.items.map((item: any) => ({
              id: item.item_id,
              name: item.name,
              price: Number(item.unit_price),
              quantity: Number(item.quantity),
            })));
          }
          toast.success(`Loaded order for ${table.label}`);
        } catch { toast.error("Failed to load existing order"); }
      }
    }
    setView("order");
  };

  const addItem = (item: MenuItem) => {
    setOrderItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id
          ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) {
      setOrderItems(prev => prev.filter(i => i.id !== id));
    } else {
      setOrderItems(prev => prev.map(i =>
        i.id === id ? { ...i, quantity: qty } : i
      ));
    }
  };

  const getQty = (id: string) =>
    orderItems.find(i => i.id === id)?.quantity ?? 0;

  const subtotal = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);

  const handleSaveOrder = async () => {
    if (!selectedTable) return toast.error("Select a table first");
    if (!orderItems.length) return toast.error("No items added");
    setSaving(true);
    try {
      await api.post("/orders", {
        table_id: selectedTable.id,
        order_type: "table",
        items: orderItems.map(i => ({
          menu_item_id: i.id,
          quantity: i.quantity,
        })),
        cgst: 2.5,
        sgst: 2.5,
      });
      toast.success(`Order saved for ${selectedTable.label}!`);
      setOrderItems([]);
      setSelectedTable(null);
      setView("tables");
      fetchTables();
      fetchPendingOrders();
    } catch (err: any) {
      toast.error(err.error || "Failed to save order");
    } finally { setSaving(false); }
  };

  const getTableStyle = (table: Table) => {
    if (table.status === "occupied")
      return "bg-red-100 border-red-300 text-red-700";
    if (selectedTable?.id === table.id)
      return "bg-orange-500 border-orange-500 text-white shadow-lg scale-105";
    return "bg-white border-gray-200 text-gray-800 hover:border-orange-400 hover:shadow-md cursor-pointer";
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view === "order" ? (
              <button
                onClick={() => { setView("tables"); setSelectedTable(null); setOrderItems([]); }}
                className="text-gray-400 hover:text-gray-600"
              >
                ← Tables
              </button>
            ) : (
              <button
                onClick={() => router.push("/dashboard")}
                className="text-gray-400 hover:text-gray-600"
              >
                ← Back
              </button>
            )}
            <div className="w-px h-6 bg-gray-200" />
            <h1 className="font-bold text-gray-900 text-lg">
              🧑‍💼 Manager Control
              {selectedTable && (
                <span className="ml-2 text-orange-500">— {selectedTable.label}</span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { fetchTables(); fetchPendingOrders(); }}
              className="text-sm text-orange-500 hover:text-orange-600 font-medium"
            >
              🔄 Refresh
            </button>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* ── TABLE SELECTION VIEW ── */}
      {view === "tables" && (
        <main className="max-w-4xl mx-auto px-6 py-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Select a Table</h2>
            <p className="text-gray-500 text-sm mt-1">
              Tap a table to start or edit an order
            </p>
          </div>

          {/* Legend */}
          <div className="flex gap-4 justify-center mb-6 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-white border-2 border-gray-300" />
              Available
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-red-100 border-2 border-red-300" />
              Occupied
            </span>
          </div>

          <div className="grid grid-cols-5 gap-4">
            {tables.map(table => (
              <button
                key={table.id}
                onClick={() => handleTableSelect(table)}
                className={`rounded-2xl border-2 p-6 transition-all duration-200 font-bold text-lg hover:-translate-y-1 hover:shadow-md ${getTableStyle(table)}`}
              >
                <div className="text-3xl mb-2">🪑</div>
                <div>{table.label}</div>
                <div className="text-xs font-normal mt-1 opacity-70">
                  {table.capacity} seats
                </div>
                <div className="text-xs font-normal capitalize opacity-70 mt-0.5">
                  {table.status === "occupied" ? "📋 has order" : "free"}
                </div>
              </button>
            ))}
          </div>
        </main>
      )}

      {/* ── ORDER VIEW ── */}
      {view === "order" && selectedTable && (
        <main className="max-w-6xl mx-auto px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* LEFT — Categories + Items */}
            <div className="lg:col-span-2 flex flex-col gap-4">

              {/* Category tabs */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Categories
                </p>
                <div className="flex gap-2 flex-wrap">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                        activeCategory === cat.id
                          ? "bg-orange-500 text-white shadow-md"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items grid */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Items
                </p>
                {menuItems.length === 0 ? (
                  <div className="text-center py-10 text-gray-300">
                    No items in this category
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {menuItems.map(item => {
                      const qty = getQty(item.id);
                      return (
                        <div
                          key={item.id}
                          className={`border rounded-xl p-4 transition ${
                            qty > 0
                              ? "border-orange-400 bg-orange-50"
                              : "border-gray-200 bg-white hover:border-orange-300"
                          }`}
                        >
                          <div className="font-semibold text-sm text-gray-900 mb-1 leading-tight">
                            {item.name}
                          </div>
                          <div className="text-orange-500 font-bold text-base mb-3">
                            ₹{item.price}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQty(item.id, qty - 1)}
                              disabled={qty === 0}
                              className="w-8 h-8 rounded-lg bg-red-100 text-red-500 font-bold text-lg disabled:opacity-30 hover:bg-red-200 transition"
                            >
                              −
                            </button>
                            <span className="w-8 text-center font-bold text-sm">
                              {qty}
                            </span>
                            <button
                              onClick={() => addItem(item)}
                              className="w-8 h-8 rounded-lg bg-orange-500 text-white font-bold text-lg hover:bg-orange-600 transition"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT — Order summary */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-4 h-fit sticky top-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Order — {selectedTable.label}
              </p>

              {orderItems.length === 0 ? (
                <div className="text-center py-8 text-gray-300 text-sm">
                  No items added yet
                </div>
              ) : (
                <div className="flex flex-col gap-2 mb-4 max-h-64 overflow-y-auto">
                  {orderItems.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-2 border-b border-gray-50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-xs truncate">
                          {item.name}
                        </div>
                        <div className="text-gray-400 text-xs">
                          ₹{item.price} × {item.quantity}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mx-2">
                        <button
                          onClick={() => updateQty(item.id, item.quantity - 1)}
                          className="w-6 h-6 rounded bg-red-100 text-red-500 text-xs font-bold hover:bg-red-200"
                        >−</button>
                        <span className="w-5 text-center text-xs font-bold">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQty(item.id, item.quantity + 1)}
                          className="w-6 h-6 rounded bg-orange-100 text-orange-500 text-xs font-bold hover:bg-orange-200"
                        >+</button>
                      </div>
                      <div className="font-bold text-xs text-orange-500 min-w-12 text-right">
                        ₹{Math.round(item.price * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Subtotal */}
              {orderItems.length > 0 && (
                <div className="border-t border-gray-100 pt-3 mb-4">
                  <div className="flex justify-between font-bold text-gray-900">
                    <span>Subtotal</span>
                    <span className="text-orange-500">₹{Math.round(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Items</span>
                    <span>{orderItems.reduce((s, i) => s + i.quantity, 0)}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    GST will be added at cashier billing
                  </p>
                </div>
              )}

              {/* Save button */}
              <button
                onClick={handleSaveOrder}
                disabled={saving || !orderItems.length}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-xl transition"
              >
                {saving ? "Saving..." : "💾 Save Order"}
              </button>

              {orderItems.length > 0 && (
                <button
                  onClick={() => setOrderItems([])}
                  className="w-full py-2 mt-2 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-xl transition text-sm"
                >
                  🗑️ Clear All
                </button>
              )}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}