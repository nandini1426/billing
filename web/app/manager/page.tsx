"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import api from "@/lib/api";
import toast from "react-hot-toast";

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
  const { user, init, logout } = useAuthStore();

  const [tables,         setTables]         = useState<Table[]>([]);
  const [selectedTable,  setSelectedTable]  = useState<Table | null>(null);
  const [categories,     setCategories]     = useState<Category[]>([]);
  const [menuItems,      setMenuItems]      = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [orderItems,     setOrderItems]     = useState<OrderItem[]>([]);
  const [saving,         setSaving]         = useState(false);
  const [existingOrders, setExistingOrders] = useState<any[]>([]);

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
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-gray-400 hover:text-gray-600"
            >
              ← Back
            </button>
            <div className="w-px h-6 bg-gray-200" />
            <h1 className="font-bold text-gray-900 text-lg">🧑‍💼 Manager Control</h1>
          </div>

          {/* Right side — refresh + user + logout */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => { fetchTables(); fetchPendingOrders(); }}
              className="text-sm text-orange-500 hover:text-orange-600 font-medium"
            >
              🔄 Refresh
            </button>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{user.username}</p>
              <p className="text-xs text-gray-500 capitalize">{user.role}</p>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT — Tables + Categories + Items */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* Table selection */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-700">Select Table</p>
                <div className="flex gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-white border border-gray-300 rounded" />
                    Available
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-orange-500 rounded" />
                    Selected
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-red-100 border border-red-300 rounded" />
                    Occupied
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {tables.map(table => (
                  <button
                    key={table.id}
                    onClick={() => handleTableSelect(table)}
                    className={`rounded-xl border-2 p-3 transition-all duration-150 font-bold text-sm ${getTableStyle(table)}`}
                  >
                    <div className="text-lg mb-0.5">🪑</div>
                    <div>{table.label}</div>
                    <div className="text-xs font-normal opacity-70">
                      {table.status === "occupied" ? "occupied" : "free"}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Categories + Items */}
            {selectedTable && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  Adding items for {selectedTable.label}
                </p>

                {/* Category tabs */}
                <div className="flex gap-2 flex-wrap mb-4">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        activeCategory === cat.id
                          ? "bg-orange-500 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                {/* Items grid */}
                <div className="grid grid-cols-3 gap-2">
                  {menuItems.map(item => {
                    const qty = getQty(item.id);
                    return (
                      <div key={item.id}
                        className={`border rounded-xl p-3 ${qty > 0 ? "border-orange-400 bg-orange-50" : "border-gray-200"}`}>
                        <div className="font-medium text-xs text-gray-900 mb-1">{item.name}</div>
                        <div className="text-orange-500 font-bold text-sm mb-2">₹{item.price}</div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateQty(item.id, qty - 1)}
                            disabled={qty === 0}
                            className="w-6 h-6 rounded bg-red-100 text-red-500 text-sm font-bold disabled:opacity-30"
                          >−</button>
                          <span className="w-6 text-center text-xs font-bold">{qty}</span>
                          <button
                            onClick={() => addItem(item)}
                            className="w-6 h-6 rounded bg-orange-500 text-white text-sm font-bold"
                          >+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — Order summary */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-4 h-fit">
            <p className="text-sm font-semibold text-gray-700 mb-3">
              {selectedTable ? `Order — ${selectedTable.label}` : "No table selected"}
            </p>

            {orderItems.length === 0 ? (
              <div className="text-center py-10 text-gray-300 text-sm">
                Add items to order
              </div>
            ) : (
              <div className="flex flex-col gap-2 mb-4">
                {orderItems.map(item => (
                  <div key={item.id}
                    className="flex items-center justify-between text-sm border-b border-gray-50 pb-2">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-xs">{item.name}</div>
                      <div className="text-gray-400 text-xs">₹{item.price} × {item.quantity}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQty(item.id, item.quantity - 1)}
                        className="w-5 h-5 rounded bg-red-100 text-red-500 text-xs font-bold"
                      >−</button>
                      <span className="w-5 text-center text-xs font-bold">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.id, item.quantity + 1)}
                        className="w-5 h-5 rounded bg-orange-100 text-orange-500 text-xs font-bold"
                      >+</button>
                    </div>
                    <div className="ml-2 font-bold text-xs text-orange-500 min-w-12 text-right">
                      ₹{Math.round(item.price * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {orderItems.length > 0 && (
              <div className="border-t border-gray-100 pt-3 mb-4">
                <div className="flex justify-between text-sm font-bold text-gray-900">
                  <span>Subtotal</span>
                  <span className="text-orange-500">₹{Math.round(subtotal)}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  GST will be added at billing
                </div>
              </div>
            )}

            <button
              onClick={handleSaveOrder}
              disabled={saving || !selectedTable || !orderItems.length}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-xl transition text-sm"
            >
              {saving ? "Saving..." : "💾 Save Order"}
            </button>

            {orderItems.length > 0 && (
              <button
                onClick={() => setOrderItems([])}
                className="w-full py-2 mt-2 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-xl transition text-sm"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}