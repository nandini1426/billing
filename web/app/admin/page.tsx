"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface Category {
  id: string; name: string; icon_url: string;
  sort_order: number; is_active: boolean;
}
interface MenuItem {
  id: string; category_id: string; name: string;
  price: number; is_available: boolean;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, init } = useAuthStore();

  const [activeTab,       setActiveTab]       = useState<"categories" | "items">("categories");
  const [categories,      setCategories]      = useState<Category[]>([]);
  const [items,           setItems]           = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [loading,         setLoading]         = useState(false);

  const [catForm,    setCatForm]    = useState({ name: "", icon_url: "", sort_order: 0 });
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [showCatForm, setShowCatForm] = useState(false);

  const [itemForm,    setItemForm]    = useState({ name: "", price: "", category_id: "" });
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);

  useEffect(() => { init(); }, []);
  useEffect(() => {
    if (user && user.role !== "admin") {
      toast.error("Admin access only");
      router.push("/dashboard");
    }
  }, [user]);

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { if (selectedCategory) fetchItems(selectedCategory); }, [selectedCategory]);

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
      setShowCatForm(false);
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
      setShowCatForm(false);
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
    setShowCatForm(true);
  };

  const handleAddItem = async () => {
    if (!itemForm.name.trim()) return toast.error("Item name required");
    if (!itemForm.price) return toast.error("Price required");
    if (!itemForm.category_id) return toast.error("Select a category");
    try {
      await api.post("/menu/items", { ...itemForm, price: Number(itemForm.price) });
      toast.success("Item added!");
      setItemForm(f => ({ ...f, name: "", price: "" }));
      setShowItemForm(false);
      fetchItems(itemForm.category_id);
    } catch { toast.error("Failed to add item"); }
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;
    try {
      await api.put(`/menu/items/${editingItem.id}`, {
        name: itemForm.name, price: Number(itemForm.price),
      });
      toast.success("Item updated!");
      setEditingItem(null);
      setItemForm(f => ({ ...f, name: "", price: "" }));
      setShowItemForm(false);
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
    setShowItemForm(true);
  };

  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)" }}>

      {/* Header */}
      <header style={{
        background: "#fff", borderBottom: "1px solid #e2e8f0",
        padding: "0 16px", height: 70, display: "flex",
        alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 10,
        boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.push("/dashboard")}
            style={{ background: "#f1f5f9", border: "none", cursor: "pointer", fontSize: 16, color: "#374151", padding: "10px 16px", borderRadius: 10, fontWeight: 700 }}>
            ← Back
          </button>
          <div style={{ fontWeight: 800, fontSize: 17, color: "#111827" }}>⚙️ Admin</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push("/settings")}
            style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontSize: 13, color: "#ea580c", fontWeight: 600 }}>
            ⚙️ Settings
          </button>
          <button onClick={() => router.push("/orders")}
            style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontSize: 13, color: "#2563eb", fontWeight: 600 }}>
            📋 Orders
          </button>
          <button
            onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); router.push('/login'); }}
            style={{ width: 40, height: 40, borderRadius: "50%", background: "#fee2e2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </header>

      <main style={{ padding: "16px", maxWidth: 600, margin: "0 auto" }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[
            { id: "categories", label: "📂 Categories" },
            { id: "items",      label: "🍽️ Menu Items" },
          ].map(tab => (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                flex: 1, padding: "12px 0", borderRadius: 12, fontWeight: 700, fontSize: 14,
                border: "none", cursor: "pointer", transition: "all .15s",
                background: activeTab === tab.id ? "#f97316" : "#fff",
                color: activeTab === tab.id ? "#fff" : "#374151",
                boxShadow: activeTab === tab.id ? "0 4px 12px rgba(249,115,22,0.3)" : "none",
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── CATEGORIES TAB ── */}
        {activeTab === "categories" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
                Categories ({categories.length})
              </div>
              <button
                onClick={() => { setEditingCat(null); setCatForm({ name: "", icon_url: "", sort_order: 0 }); setShowCatForm(true); }}
                style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                + Add
              </button>
            </div>

            {/* Add/Edit form */}
            {showCatForm && (
              <div style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, border: "1px solid #f3f4f6", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 12 }}>
                  {editingCat ? "✏️ Edit Category" : "➕ Add Category"}
                </div>
                <input type="text" placeholder="Category name *" value={catForm.name}
                  onChange={e => setCatForm({ ...catForm, name: e.target.value })}
                  style={{ width: "100%", padding: "12px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 14, marginBottom: 10, outline: "none", boxSizing: "border-box" as any }}
                />
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <input type="text" placeholder="Icon (emoji)" value={catForm.icon_url}
                    onChange={e => setCatForm({ ...catForm, icon_url: e.target.value })}
                    style={{ flex: 1, padding: "12px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 14, outline: "none" }}
                  />
                  <input type="number" placeholder="Sort order" value={catForm.sort_order}
                    onChange={e => setCatForm({ ...catForm, sort_order: Number(e.target.value) })}
                    style={{ flex: 1, padding: "12px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 14, outline: "none" }}
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={editingCat ? handleUpdateCategory : handleAddCategory}
                    style={{ flex: 1, padding: "12px 0", background: "#f97316", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                    {editingCat ? "Update" : "Add Category"}
                  </button>
                  <button onClick={() => { setShowCatForm(false); setEditingCat(null); }}
                    style={{ flex: 1, padding: "12px 0", background: "#f1f5f9", color: "#374151", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Categories list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {categories.map(cat => (
                <div key={cat.id}
                  style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", border: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 26 }}>{cat.icon_url || "📂"}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{cat.name}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>Sort: {cat.sort_order}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => startEditCategory(cat)}
                      style={{ background: "#eff6ff", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, color: "#2563eb", fontWeight: 600 }}>
                      Edit
                    </button>
                    <button onClick={() => handleDeleteCategory(cat.id)}
                      style={{ background: "#fee2e2", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, color: "#ef4444", fontWeight: 600 }}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ITEMS TAB ── */}
        {activeTab === "items" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
                Items ({items.length})
              </div>
              <button
                onClick={() => { setEditingItem(null); setItemForm(f => ({ ...f, name: "", price: "" })); setShowItemForm(true); }}
                style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                + Add
              </button>
            </div>

            {/* Add/Edit form */}
            {showItemForm && (
              <div style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, border: "1px solid #f3f4f6", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 12 }}>
                  {editingItem ? "✏️ Edit Item" : "➕ Add Item"}
                </div>
                <select value={itemForm.category_id}
                  onChange={e => { setItemForm({ ...itemForm, category_id: e.target.value }); setSelectedCategory(e.target.value); }}
                  style={{ width: "100%", padding: "12px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 14, marginBottom: 10, outline: "none", background: "#fff", boxSizing: "border-box" as any }}>
                  <option value="">Select category *</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <input type="text" placeholder="Item name *" value={itemForm.name}
                  onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                  style={{ width: "100%", padding: "12px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 14, marginBottom: 10, outline: "none", boxSizing: "border-box" as any }}
                />
                <input type="number" placeholder="Price (₹) *" value={itemForm.price}
                  onChange={e => setItemForm({ ...itemForm, price: e.target.value })}
                  style={{ width: "100%", padding: "12px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 14, marginBottom: 12, outline: "none", boxSizing: "border-box" as any }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={editingItem ? handleUpdateItem : handleAddItem}
                    style={{ flex: 1, padding: "12px 0", background: "#f97316", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                    {editingItem ? "Update" : "Add Item"}
                  </button>
                  <button onClick={() => { setShowItemForm(false); setEditingItem(null); }}
                    style={{ flex: 1, padding: "12px 0", background: "#f1f5f9", color: "#374151", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Category filter */}
            <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 12, paddingBottom: 4 }}>
              {categories.map(cat => (
                <button key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    padding: "7px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                    fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
                    background: selectedCategory === cat.id ? "#f97316" : "#fff",
                    color: selectedCategory === cat.id ? "#fff" : "#374151",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  }}>
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Items list */}
            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading...</div>
            ) : items.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🍽️</div>
                <div>No items in this category</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {items.map(item => (
                  <div key={item.id}
                    style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", border: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{item.name}</div>
                      <div style={{ fontSize: 15, color: "#f97316", fontWeight: 800, marginTop: 2 }}>₹{item.price}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => startEditItem(item)}
                        style={{ background: "#eff6ff", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, color: "#2563eb", fontWeight: 600 }}>
                        Edit
                      </button>
                      <button onClick={() => handleDeleteItem(item.id)}
                        style={{ background: "#fee2e2", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, color: "#ef4444", fontWeight: 600 }}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}