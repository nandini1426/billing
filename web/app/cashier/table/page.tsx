"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import useOrderStore from "@/store/orderStore";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface Table {
  id: string;
  label: string;
  capacity: number;
  status: "available" | "occupied" | "reserved";
}

interface ExistingOrder {
  id: string;
  order_number: string;
  grand_total: number;
  items: any[];
}

export default function TableSelectionPage() {
  const router = useRouter();
  const { user, init } = useAuthStore();
  const { addItem, addItemWithQty, clearOrder, updateQty } = useOrderStore();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Table | null>(null);
  const [existingOrder, setExistingOrder] = useState<ExistingOrder | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);

  useEffect(() => { init(); }, []);
  useEffect(() => { if (!user) router.push("/login"); }, [user]);
  useEffect(() => { fetchTables(); }, []);

  const fetchTables = async () => {
    try {
      const res = await api.get("/tables");
      setTables(res.data);
    } catch {
      toast.error("Failed to load tables");
    } finally {
      setLoading(false);
    }
  };

  const handleTableClick = async (table: Table) => {
  if (table.status === "reserved") {
    toast.error(`Table ${table.label} is reserved`);
    return;
  }

  if (table.status === "occupied") {
    try {
      const res = await api.get(`/orders?order_type=table&status=pending`);
      const order = res.data.find((o: any) => o.table_id === table.id);
      if (order) {
        setExistingOrder(order);
        setSelected(table);
        setShowOrderModal(true);
      } else {
        toast.error("Could not find existing order for this table");
      }
    } catch {
      toast.error("Failed to fetch existing order");
    }
    return;
  }

  // Single click — just highlight
  setSelected(table);
};
const handleTableDoubleClick = (table: Table) => {
  if (table.status === "reserved") {
    toast.error(`Table ${table.label} is reserved`);
    return;
  }
  if (table.status === "occupied") return;

  // Double click on available table — go directly to order
  router.push(
    `/cashier/order?mode=table&tableId=${table.id}&tableLabel=${table.label}`
  );
};

  

  const handleResumeOrder = async () => {
  if (!existingOrder || !selected) return;
  try {
    const res = await api.get(`/orders/${existingOrder.id}`);
    const order = res.data;

    setShowOrderModal(false);
    toast.success(`Resuming order ${order.order_number}`);

    // Pass items as encoded URL param instead of store
    const itemsParam = encodeURIComponent(JSON.stringify(order.items));

    router.push(
      `/cashier/order?mode=table&tableId=${selected.id}&tableLabel=${selected.label}&orderId=${existingOrder.id}&savedItems=${itemsParam}`
    );
  } catch (err) {
    console.error("Resume error:", err);
    toast.error("Failed to resume order");
  }
};

  const handleCancelExisting = async () => {
    if (!existingOrder) return;
    try {
      await api.delete(`/orders/${existingOrder.id}`);
      toast.success("Previous order cancelled");
      setShowOrderModal(false);
      setExistingOrder(null);
      fetchTables();
    } catch {
      toast.error("Failed to cancel order");
    }
  };

  const getTableStyle = (table: Table) => {
    if (table.status === "occupied")
      return "bg-red-100 border-red-300 text-red-700";
    if (table.status === "reserved")
      return "bg-yellow-100 border-yellow-300 text-yellow-700 cursor-not-allowed";
    if (selected?.id === table.id)
      return "bg-orange-500 border-orange-500 text-white shadow-lg scale-105";
    return "bg-white border-gray-200 text-gray-800 hover:border-orange-400 hover:shadow-md cursor-pointer";
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">

      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/cashier")}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              ← Back
            </button>
            <div className="w-px h-6 bg-gray-200" />
            <h1 className="font-bold text-gray-900">Select Table</h1>
          </div>
          <button
            onClick={fetchTables}
            className="text-sm text-orange-500 hover:text-orange-600 font-medium"
          >
            🔄 Refresh
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">

        <div className="flex items-center gap-6 mb-8 justify-center flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-white border-2 border-gray-200" />
            <span className="text-sm text-gray-600">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-orange-500" />
            <span className="text-sm text-gray-600">Selected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-100 border-2 border-red-300" />
            <span className="text-sm text-gray-600">Occupied — tap to edit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-100 border-2 border-yellow-300" />
            <span className="text-sm text-gray-600">Reserved</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading tables...</div>
        ) : (
          <div className="grid grid-cols-5 gap-4 mb-10">
            {tables.map((table) => (
  <button
    key={table.id}
    onClick={() => handleTableClick(table)}
    onDoubleClick={() => handleTableDoubleClick(table)}
    className={`rounded-2xl border-2 p-6 transition-all duration-200 font-bold text-xl ${getTableStyle(table)}`}
  >
    <div className="text-2xl mb-1">🪑</div>
    <div>{table.label}</div>
    <div className="text-xs font-normal mt-1 opacity-70">
      {table.capacity} seats
    </div>
    <div className="text-xs font-normal capitalize opacity-70">
      {table.status === "occupied" ? "tap to edit" : table.status}
    </div>
  </button>
))}
          </div>
        )}

        {/* Bottom hint */}
<div className="bg-white rounded-2xl border border-gray-100 shadow-md p-4 text-center">
  <p className="text-sm text-gray-400">
    Double-click an available table to start billing · Click occupied table to edit
  </p>
</div>
      </main>

      {/* OCCUPIED TABLE MODAL */}
      {showOrderModal && existingOrder && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Table {selected.label} is Occupied
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              There is an existing saved order for this table.
            </p>

            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">Order Number</span>
                <span className="font-semibold">{existingOrder.order_number}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">Items</span>
                <span className="font-semibold">
                  {existingOrder.items?.[0] !== null
                    ? existingOrder.items?.length
                    : 0} items
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total</span>
                <span className="font-bold text-orange-500">
                  ₹{existingOrder.grand_total}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleResumeOrder}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition"
              >
                ✏️ Edit / Continue This Order
              </button>
              <button
                onClick={handleCancelExisting}
                className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl transition"
              >
                🗑️ Cancel & Start Fresh
              </button>
              <button
                onClick={() => {
                  setShowOrderModal(false);
                  setSelected(null);
                }}
                className="w-full py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl transition"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}