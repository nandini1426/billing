"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import api from "@/lib/api";
import toast from "react-hot-toast";
import LogoutButton from "@/components/LogoutButton";

interface Category {
  id: string;
  name: string;
  icon_url: string;
  sort_order: number;
  is_active: boolean;
}

interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  price: number;
  is_available: boolean;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, init } = useAuthStore();

  const [activeTab, setActiveTab] = useState<"categories" | "items">("categories");
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [catForm, setCatForm] = useState({ name: "", icon_url: "", sort_order: 0 });
  const [editingCat, setEditingCat] = useState<Category | null>(null);

  const [itemForm, setItemForm] = useState({ name: "", price: "", category_id: "" });
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  useEffect(() => { init(); }, []);
  useEffect(() => {
    if (user && user.role !== "admin") {
      toast.error("Admin access only");
      router.push("/dashboard");
    }
  }, [user]);

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => {
    if (selectedCategory) fetchItems(selectedCategory);
  }, [selectedCategory]);

  const fetchCategories = async () => {
    try {
      const res = await api.get("/menu/categories");
      setCategories(res.data);
      if (res.data.length > 0 && !selectedCategory) {
        setSelectedCategory(res.data[0].id);
        setItemForm(f => ({ ...f, category_id: res.data[0].id }));
      }
    } catch { toast.error("Failed to load categories"); }
  };

  const fetchItems = async (categoryId: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/menu/categories/${categoryId}/items`);
      setItems(res.data);
    } catch { toast.error("Failed to load items"); }
    finally { setLoading(false); }
  };

  const handleAddCategory = async () => {
    if (!catForm.name.trim()) return toast.error("Category name required");
    try {
      await api.post("/menu/categories", catForm);
      toast.success("Category added!");
      setCatForm({ name: "", icon_url: "", sort_order: 0 });
      fetchCategories();
    } catch { toast.error("Failed to add category"); }
  };

  const handleUpdateCategory = async () => {
    if (!editingCat) return;
    try {
      await api.put(`/menu/categories/${editingCat.id}`, catForm);
      toast.success("Category updated!");
      setEditingCat(null);
      setCatForm({ name: "", icon_url: "", sort_order: 0 });
      fetchCategories();
    } catch { toast.error("Failed to update category"); }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm("Delete this category?")) return;
    try {
      await api.delete(`/menu/categories/${id}`);
      toast.success("Category removed");
      fetchCategories();
    } catch { toast.error("Failed to delete category"); }
  };

  const startEditCategory = (cat: Category) => {
    setEditingCat(cat);
    setCatForm({ name: cat.name, icon_url: cat.icon_url, sort_order: cat.sort_order });
  };

  const handleAddItem = async () => {
    if (!itemForm.name.trim()) return toast.error("Item name required");
    if (!itemForm.price) return toast.error("Price required");
    if (!itemForm.category_id) return toast.error("Select a category");
    try {
      await api.post("/menu/items", { ...itemForm, price: Number(itemForm.price) });
      toast.success("Item added!");
      setItemForm(f => ({ ...f, name: "", price: "" }));
      fetchItems(itemForm.category_id);
    } catch { toast.error("Failed to add item"); }
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;
    try {
      await api.put(`/menu/items/${editingItem.id}`, {
        name: itemForm.name,
        price: Number(itemForm.price),
      });
      toast.success("Item updated!");
      setEditingItem(null);
      setItemForm(f => ({ ...f, name: "", price: "" }));
      fetchItems(selectedCategory);
    } catch { toast.error("Failed to update item"); }
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm("Delete this item?")) return;
    try {
      await api.delete(`/menu/items/${id}`);
      toast.success("Item removed");
      fetchItems(selectedCategory);
    } catch { toast.error("Failed to delete item"); }
  };

  const startEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemForm(f => ({ ...f, name: item.name, price: String(item.price) }));
  };

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
            <h1 className="font-bold text-gray-900 text-lg">⚙️ Admin Control</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/settings")}
              className="px-4 py-2 bg-orange-50 text-orange-600 rounded-xl text-sm font-medium border border-orange-200 hover:bg-orange-100 transition"
            >
              ⚙️ Settings
            </button>
            <button
              onClick={() => router.push("/orders")}
              className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-medium border border-blue-200 hover:bg-blue-100 transition"
            >
              📋 All Orders
            </button>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: "categories", label: "📂 Categories" },
            { id: "items",      label: "🍽️ Menu Items" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-2.5 rounded-xl font-medium text-sm transition ${
                activeTab === tab.id
                  ? "bg-orange-500 text-white shadow-md"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Categories Tab */}
        {activeTab === "categories" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                {editingCat ? "✏️ Edit Category" : "➕ Add Category"}
              </h2>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={catForm.name}
                    onChange={e => setCatForm({ ...catForm, name: e.target.value })}
                    placeholder="e.g. Biriyani"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Icon (emoji)</label>
                    <input
                      type="text"
                      value={catForm.icon_url}
                      onChange={e => setCatForm({ ...catForm, icon_url: e.target.value })}
                      placeholder="e.g. 🍛"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                    <input
                      type="number"
                      value={catForm.sort_order}
                      onChange={e => setCatForm({ ...catForm, sort_order: Number(e.target.value) })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={editingCat ? handleUpdateCategory : handleAddCategory}
                    className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition"
                  >
                    {editingCat ? "Update Category" : "Add Category"}
                  </button>
                  {editingCat && (
                    <button
                      onClick={() => { setEditingCat(null); setCatForm({ name: "", icon_url: "", sort_order: 0 }); }}
                      className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-xl transition"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                All Categories ({categories.length})
              </h2>
              <div className="flex flex-col gap-3">
                {categories.map(cat => (
                  <div key={cat.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{cat.icon_url || "📂"}</span>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{cat.name}</p>
                        <p className="text-xs text-gray-400">Order: {cat.sort_order}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditCategory(cat)}
                        className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Items Tab */}
        {activeTab === "items" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                {editingItem ? "✏️ Edit Item" : "➕ Add Item"}
              </h2>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={itemForm.category_id}
                    onChange={e => {
                      setItemForm({ ...itemForm, category_id: e.target.value });
                      setSelectedCategory(e.target.value);
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Item Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={itemForm.name}
                    onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                    placeholder="e.g. Chicken Biriyani"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price (₹) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={itemForm.price}
                    onChange={e => setItemForm({ ...itemForm, price: e.target.value })}
                    placeholder="e.g. 180"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={editingItem ? handleUpdateItem : handleAddItem}
                    className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition"
                  >
                    {editingItem ? "Update Item" : "Add Item"}
                  </button>
                  {editingItem && (
                    <button
                      onClick={() => { setEditingItem(null); setItemForm(f => ({ ...f, name: "", price: "" })); }}
                      className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-xl transition"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Items ({items.length})</h2>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {loading ? (
                <div className="text-center py-10 text-gray-400">Loading...</div>
              ) : (
                <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
                  {items.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">No items in this category</div>
                  ) : (
                    items.map(item => (
                      <div key={item.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
                          <p className="text-orange-500 font-bold text-sm">₹{item.price}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditItem(item)}
                            className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100 transition"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}