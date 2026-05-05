"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface Ingredient {
  id: string; name: string; unit: string;
  current_stock: number; min_stock: number;
  cost_per_unit: number; used_last_7_days: number;
}
interface RecipeItem {
  id: string; ingredient_id: string;
  ingredient_name: string; unit: string;
  quantity_used: number; current_stock: number;
}
interface MenuItem { id: string; name: string; category: string; price: number; }
interface Purchase {
  id: string; ingredient_name: string; unit: string;
  quantity: number; cost_per_unit: number;
  total_cost: number; supplier_name: string;
  notes: string; purchased_at: string;
}
interface Waste {
  id: string; ingredient_name: string; unit: string;
  quantity: number; reason: string;
  notes: string; wasted_at: string;
}
interface CanMake {
  id: string; name: string; category: string;
  price: number; can_make: number | null; has_recipe: boolean;
}

export default function InventoryPage() {
  const router = useRouter();
  const [user,        setUser]        = useState<any>(null);
  const [activeTab,   setActiveTab]   = useState<"stock"|"recipes"|"purchases"|"waste"|"canmake">("stock");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [menuItems,   setMenuItems]   = useState<MenuItem[]>([]);
  const [purchases,   setPurchases]   = useState<Purchase[]>([]);
  const [waste,       setWaste]       = useState<Waste[]>([]);
  const [canMake,     setCanMake]     = useState<CanMake[]>([]);
  const [alerts,      setAlerts]      = useState<Ingredient[]>([]);
  const [loading,     setLoading]     = useState(true);

  // Selected item for recipe view
  const [selectedItem,   setSelectedItem]   = useState<MenuItem | null>(null);
  const [itemRecipe,     setItemRecipe]     = useState<RecipeItem[]>([]);
  const [showRecipeModal,setShowRecipeModal] = useState(false);

  // Forms
  const [showIngForm,  setShowIngForm]  = useState(false);
  const [editingIng,   setEditingIng]   = useState<Ingredient | null>(null);
  const [ingForm,      setIngForm]      = useState({ name: "", unit: "kg", current_stock: "", min_stock: "", cost_per_unit: "" });

  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [purchaseForm,     setPurchaseForm]     = useState({ ingredient_id: "", quantity: "", cost_per_unit: "", supplier_name: "", notes: "" });

  const [showWasteForm, setShowWasteForm] = useState(false);
  const [wasteForm,     setWasteForm]     = useState({ ingredient_id: "", quantity: "", reason: "", notes: "" });

  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [recipeForm,     setRecipeForm]     = useState({ menu_item_id: "", ingredient_id: "", quantity_used: "" });

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push("/login"); return; }
    const u = JSON.parse(stored);
    setUser(u);
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [ingRes, menuRes, purchRes, wasteRes, alertRes] = await Promise.all([
        api.get("/inventory/ingredients"),
        api.get("/menu/items"),
        api.get("/inventory/purchases"),
        api.get("/inventory/waste"),
        api.get("/inventory/alerts"),
      ]);
      setIngredients(ingRes.data);
      setMenuItems(menuRes.data);
      setPurchases(purchRes.data);
      setWaste(wasteRes.data);
      setAlerts(alertRes.data);
    } catch { toast.error("Failed to load inventory"); }
    finally { setLoading(false); }
  };

  const fetchCanMake = async () => {
    try {
      const res = await api.get("/inventory/can-make");
      setCanMake(res.data);
    } catch { toast.error("Failed to load can-make data"); }
  };

  const fetchItemRecipe = async (item: MenuItem) => {
    setSelectedItem(item);
    try {
      const res = await api.get(`/inventory/recipe/${item.id}`);
      setItemRecipe(res.data);
      setShowRecipeModal(true);
    } catch { toast.error("Failed to load recipe"); }
  };

  // ── Ingredient CRUD ───────────────────────────────────────
  const handleAddIngredient = async () => {
    if (!ingForm.name) return toast.error("Name required");
    try {
      await api.post("/inventory/ingredients", {
        ...ingForm,
        current_stock: Number(ingForm.current_stock) || 0,
        min_stock: Number(ingForm.min_stock) || 0,
        cost_per_unit: Number(ingForm.cost_per_unit) || 0,
      });
      toast.success("Ingredient added!");
      setIngForm({ name: "", unit: "kg", current_stock: "", min_stock: "", cost_per_unit: "" });
      setShowIngForm(false);
      fetchAll();
    } catch { toast.error("Failed to add ingredient"); }
  };

  const handleUpdateIngredient = async () => {
    if (!editingIng) return;
    try {
      await api.put(`/inventory/ingredients/${editingIng.id}`, {
        name: ingForm.name,
        unit: ingForm.unit,
        min_stock: Number(ingForm.min_stock) || 0,
        cost_per_unit: Number(ingForm.cost_per_unit) || 0,
      });
      toast.success("Ingredient updated!");
      setEditingIng(null);
      setShowIngForm(false);
      fetchAll();
    } catch { toast.error("Failed to update ingredient"); }
  };

  const handleDeleteIngredient = async (id: string) => {
    if (!window.confirm("Delete this ingredient?")) return;
    try {
      await api.delete(`/inventory/ingredients/${id}`);
      toast.success("Ingredient deleted");
      fetchAll();
    } catch { toast.error("Failed to delete ingredient"); }
  };

  // ── Purchase ──────────────────────────────────────────────
  const handleAddPurchase = async () => {
    if (!purchaseForm.ingredient_id || !purchaseForm.quantity)
      return toast.error("Ingredient and quantity required");
    try {
      await api.post("/inventory/purchases", {
        ...purchaseForm,
        quantity: Number(purchaseForm.quantity),
        cost_per_unit: Number(purchaseForm.cost_per_unit) || 0,
      });
      toast.success("Stock purchase recorded!");
      setPurchaseForm({ ingredient_id: "", quantity: "", cost_per_unit: "", supplier_name: "", notes: "" });
      setShowPurchaseForm(false);
      fetchAll();
    } catch { toast.error("Failed to record purchase"); }
  };

  // ── Waste ─────────────────────────────────────────────────
  const handleAddWaste = async () => {
    if (!wasteForm.ingredient_id || !wasteForm.quantity || !wasteForm.reason)
      return toast.error("Ingredient, quantity and reason required");
    try {
      await api.post("/inventory/waste", {
        ...wasteForm,
        quantity: Number(wasteForm.quantity),
      });
      toast.success("Waste recorded!");
      setWasteForm({ ingredient_id: "", quantity: "", reason: "", notes: "" });
      setShowWasteForm(false);
      fetchAll();
    } catch (err: any) { toast.error(err.error || "Failed to record waste"); }
  };

  // ── Recipe ────────────────────────────────────────────────
  const handleAddRecipe = async () => {
    if (!recipeForm.menu_item_id || !recipeForm.ingredient_id || !recipeForm.quantity_used)
      return toast.error("All fields required");
    try {
      await api.post("/inventory/recipe", {
        ...recipeForm,
        quantity_used: Number(recipeForm.quantity_used),
      });
      toast.success("Recipe saved!");
      if (selectedItem) fetchItemRecipe(selectedItem);
      setShowRecipeForm(false);
    } catch { toast.error("Failed to save recipe"); }
  };

  const handleDeleteRecipe = async (id: string) => {
    if (!window.confirm("Remove this ingredient from recipe?")) return;
    try {
      await api.delete(`/inventory/recipe/${id}`);
      toast.success("Removed from recipe");
      if (selectedItem) fetchItemRecipe(selectedItem);
    } catch { toast.error("Failed to remove"); }
  };

  if (!user) return null;

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px",
    border: "1.5px solid #e5e7eb", borderRadius: 10,
    fontSize: 13, outline: "none", background: "#f9fafb",
    boxSizing: "border-box",
  };

  const getStockColor = (current: number, min: number) => {
    if (current <= 0) return { bg: "#fee2e2", color: "#ef4444", label: "Out of Stock" };
    if (current <= min) return { bg: "#fef9c3", color: "#ca8a04", label: "Low Stock" };
    return { bg: "#f0fdf4", color: "#16a34a", label: "In Stock" };
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>

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
          <div style={{ fontWeight: 800, fontSize: 17, color: "#111827" }}>📦 Inventory</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {alerts.length > 0 && (
            <div style={{ background: "#fee2e2", color: "#ef4444", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
              ⚠️ {alerts.length} Low Stock
            </div>
          )}
          <button onClick={fetchAll}
            style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 16, color: "#ea580c" }}>
            🔄
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

      <main style={{ padding: "16px", maxWidth: 700, margin: "0 auto" }}>

        {/* Low stock alerts */}
        {alerts.length > 0 && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 14, padding: 14, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#ef4444", marginBottom: 8 }}>⚠️ Low Stock Alerts</div>
            {alerts.map(a => (
              <div key={a.id} style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>
                • <strong>{a.name}</strong>: {a.current_stock} {a.unit} remaining (min: {a.min_stock} {a.unit})
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
          {[
            { id: "stock",     label: "📦 Stock" },
            { id: "canmake",   label: "🍽️ Can Make" },
            { id: "recipes",   label: "📋 Recipes" },
            { id: "purchases", label: "🛒 Purchases" },
            { id: "waste",     label: "🗑️ Waste" },
          ].map(tab => (
            <button key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                if (tab.id === "canmake") fetchCanMake();
              }}
              style={{
                padding: "8px 16px", borderRadius: 20, border: "none",
                cursor: "pointer", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
                background: activeTab === tab.id ? "#1e293b" : "#fff",
                color: activeTab === tab.id ? "#fff" : "#374151",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📦</div>
            Loading inventory...
          </div>
        ) : (
          <>

            {/* ── STOCK TAB ── */}
            {activeTab === "stock" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>
                    Ingredients ({ingredients.length})
                  </div>
                  {isAdmin && (
                    <button onClick={() => { setEditingIng(null); setIngForm({ name: "", unit: "kg", current_stock: "", min_stock: "", cost_per_unit: "" }); setShowIngForm(true); }}
                      style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                      + Add Ingredient
                    </button>
                  )}
                </div>

                {/* Add/Edit form */}
                {showIngForm && isAdmin && (
                  <div style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, border: "1px solid #f3f4f6", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 12 }}>
                      {editingIng ? "✏️ Edit Ingredient" : "➕ Add Ingredient"}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <input placeholder="Ingredient name *" value={ingForm.name}
                          onChange={e => setIngForm({ ...ingForm, name: e.target.value })}
                          style={inputStyle} />
                        <select value={ingForm.unit}
                          onChange={e => setIngForm({ ...ingForm, unit: e.target.value })}
                          style={{ ...inputStyle, background: "#fff" }}>
                          <option value="kg">kg</option>
                          <option value="g">grams (g)</option>
                          <option value="litre">litre</option>
                          <option value="ml">ml</option>
                          <option value="piece">piece</option>
                          <option value="dozen">dozen</option>
                        </select>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        {!editingIng && (
                          <input type="number" placeholder="Current stock" value={ingForm.current_stock}
                            onChange={e => setIngForm({ ...ingForm, current_stock: e.target.value })}
                            style={inputStyle} />
                        )}
                        <input type="number" placeholder="Min stock alert" value={ingForm.min_stock}
                          onChange={e => setIngForm({ ...ingForm, min_stock: e.target.value })}
                          style={inputStyle} />
                        <input type="number" placeholder="Cost per unit ₹" value={ingForm.cost_per_unit}
                          onChange={e => setIngForm({ ...ingForm, cost_per_unit: e.target.value })}
                          style={inputStyle} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={editingIng ? handleUpdateIngredient : handleAddIngredient}
                          style={{ flex: 1, padding: "11px 0", background: "#f97316", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                          {editingIng ? "Update" : "Add Ingredient"}
                        </button>
                        <button onClick={() => { setShowIngForm(false); setEditingIng(null); }}
                          style={{ flex: 1, padding: "11px 0", background: "#f1f5f9", color: "#374151", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Ingredients list */}
                {ingredients.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>📦</div>
                    <div>No ingredients added yet</div>
                    {isAdmin && <div style={{ fontSize: 12, marginTop: 4 }}>Click "+ Add Ingredient" to start</div>}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {ingredients.map(ing => {
                      const stockStatus = getStockColor(Number(ing.current_stock), Number(ing.min_stock));
                      return (
                        <div key={ing.id} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", border: "1px solid #f3f4f6", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{ing.name}</div>
                              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                                Cost: ₹{ing.cost_per_unit}/{ing.unit} · Min alert: {ing.min_stock} {ing.unit}
                              </div>
                            </div>
                            <span style={{ background: stockStatus.bg, color: stockStatus.color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                              {stockStatus.label}
                            </span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontSize: 20, fontWeight: 800, color: stockStatus.color }}>
                                {ing.current_stock} <span style={{ fontSize: 13, fontWeight: 600 }}>{ing.unit}</span>
                              </div>
                              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                                Used last 7 days: {Number(ing.used_last_7_days).toFixed(2)} {ing.unit}
                              </div>
                            </div>
                            {isAdmin && (
                              <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => { setEditingIng(ing); setIngForm({ name: ing.name, unit: ing.unit, current_stock: String(ing.current_stock), min_stock: String(ing.min_stock), cost_per_unit: String(ing.cost_per_unit) }); setShowIngForm(true); }}
                                  style={{ background: "#eff6ff", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, color: "#2563eb", fontWeight: 600 }}>
                                  Edit
                                </button>
                                <button onClick={() => handleDeleteIngredient(ing.id)}
                                  style={{ background: "#fee2e2", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, color: "#ef4444", fontWeight: 600 }}>
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                          {/* Stock bar */}
                          <div style={{ marginTop: 10, height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{
                              width: `${Math.min((Number(ing.current_stock) / Math.max(Number(ing.min_stock) * 2, 1)) * 100, 100)}%`,
                              height: "100%", background: stockStatus.color, borderRadius: 3,
                              transition: "width .3s",
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── CAN MAKE TAB ── */}
            {activeTab === "canmake" && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 14 }}>
                  How many dishes can be made with current stock?
                </div>
                {canMake.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>🍽️</div>
                    <div>No recipe data available</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Add recipes in the Recipes tab first</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {canMake.map(item => (
                      <div key={item.id} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", border: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{item.name}</div>
                          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{item.category} · ₹{item.price}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {!item.has_recipe ? (
                            <span style={{ background: "#f1f5f9", color: "#64748b", fontSize: 12, padding: "4px 10px", borderRadius: 20 }}>No recipe</span>
                          ) : item.can_make === 0 ? (
                            <span style={{ background: "#fee2e2", color: "#ef4444", fontSize: 13, fontWeight: 800, padding: "4px 12px", borderRadius: 20 }}>Cannot make</span>
                          ) : (
                            <span style={{ background: "#f0fdf4", color: "#16a34a", fontSize: 16, fontWeight: 800, padding: "4px 14px", borderRadius: 20 }}>
                              {item.can_make} portions
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── RECIPES TAB ── */}
            {activeTab === "recipes" && (
              <div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 4 }}>Menu Item Recipes</div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>Tap a menu item to view/edit its ingredients recipe</div>
                </div>

                {isAdmin && (
                  <div style={{ marginBottom: 14 }}>
                    <button onClick={() => setShowRecipeForm(!showRecipeForm)}
                      style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                      + Add Recipe
                    </button>
                  </div>
                )}

                {showRecipeForm && isAdmin && (
                  <div style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, border: "1px solid #f3f4f6", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 12 }}>Add Recipe Ingredient</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <select value={recipeForm.menu_item_id}
                        onChange={e => setRecipeForm({ ...recipeForm, menu_item_id: e.target.value })}
                        style={{ ...inputStyle, background: "#fff" }}>
                        <option value="">Select menu item *</option>
                        {menuItems.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <select value={recipeForm.ingredient_id}
                        onChange={e => setRecipeForm({ ...recipeForm, ingredient_id: e.target.value })}
                        style={{ ...inputStyle, background: "#fff" }}>
                        <option value="">Select ingredient *</option>
                        {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                      </select>
                      <input type="number" placeholder="Quantity used per serving *"
                        value={recipeForm.quantity_used}
                        onChange={e => setRecipeForm({ ...recipeForm, quantity_used: e.target.value })}
                        style={inputStyle} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={handleAddRecipe}
                          style={{ flex: 1, padding: "11px 0", background: "#f97316", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>
                          Save Recipe
                        </button>
                        <button onClick={() => setShowRecipeForm(false)}
                          style={{ flex: 1, padding: "11px 0", background: "#f1f5f9", color: "#374151", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {menuItems.map(item => (
                    <button key={item.id}
                      onClick={() => fetchItemRecipe(item)}
                      style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", border: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", textAlign: "left" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{item.name}</div>
                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{item.category} · ₹{item.price}</div>
                      </div>
                      <span style={{ fontSize: 18, color: "#94a3b8" }}>›</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── PURCHASES TAB ── */}
            {activeTab === "purchases" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>Stock Purchases</div>
                  {isAdmin && (
                    <button onClick={() => setShowPurchaseForm(!showPurchaseForm)}
                      style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                      + Add Purchase
                    </button>
                  )}
                </div>

                {showPurchaseForm && isAdmin && (
                  <div style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, border: "1px solid #f3f4f6", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 12 }}>🛒 Record Stock Purchase</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <select value={purchaseForm.ingredient_id}
                        onChange={e => setPurchaseForm({ ...purchaseForm, ingredient_id: e.target.value })}
                        style={{ ...inputStyle, background: "#fff" }}>
                        <option value="">Select ingredient *</option>
                        {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                      </select>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <input type="number" placeholder="Quantity *" value={purchaseForm.quantity}
                          onChange={e => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })}
                          style={inputStyle} />
                        <input type="number" placeholder="Cost per unit ₹" value={purchaseForm.cost_per_unit}
                          onChange={e => setPurchaseForm({ ...purchaseForm, cost_per_unit: e.target.value })}
                          style={inputStyle} />
                      </div>
                      <input placeholder="Supplier name" value={purchaseForm.supplier_name}
                        onChange={e => setPurchaseForm({ ...purchaseForm, supplier_name: e.target.value })}
                        style={inputStyle} />
                      <input placeholder="Notes (optional)" value={purchaseForm.notes}
                        onChange={e => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                        style={inputStyle} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={handleAddPurchase}
                          style={{ flex: 1, padding: "11px 0", background: "#16a34a", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>
                          ✅ Record Purchase
                        </button>
                        <button onClick={() => setShowPurchaseForm(false)}
                          style={{ flex: 1, padding: "11px 0", background: "#f1f5f9", color: "#374151", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {purchases.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>🛒</div>
                    <div>No purchases recorded yet</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {purchases.map(p => (
                      <div key={p.id} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", border: "1px solid #f3f4f6" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{p.ingredient_name}</div>
                          <div style={{ fontWeight: 800, fontSize: 14, color: "#16a34a" }}>₹{p.total_cost}</div>
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          Qty: {p.quantity} {p.unit} · ₹{p.cost_per_unit}/{p.unit}
                          {p.supplier_name ? ` · ${p.supplier_name}` : ""}
                        </div>
                        {p.notes && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{p.notes}</div>}
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                          {new Date(p.purchased_at).toLocaleString('en-IN')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── WASTE TAB ── */}
            {activeTab === "waste" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>Waste / Spoilage Records</div>
                  <button onClick={() => setShowWasteForm(!showWasteForm)}
                    style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                    + Record Waste
                  </button>
                </div>

                {showWasteForm && (
                  <div style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, border: "1px solid #fecaca", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#ef4444", marginBottom: 12 }}>🗑️ Record Waste / Spoilage</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <select value={wasteForm.ingredient_id}
                        onChange={e => setWasteForm({ ...wasteForm, ingredient_id: e.target.value })}
                        style={{ ...inputStyle, background: "#fff" }}>
                        <option value="">Select ingredient *</option>
                        {ingredients.map(i => (
                          <option key={i.id} value={i.id}>{i.name} ({i.current_stock} {i.unit} available)</option>
                        ))}
                      </select>
                      <input type="number" placeholder="Quantity wasted *" value={wasteForm.quantity}
                        onChange={e => setWasteForm({ ...wasteForm, quantity: e.target.value })}
                        style={inputStyle} />
                      <select value={wasteForm.reason}
                        onChange={e => setWasteForm({ ...wasteForm, reason: e.target.value })}
                        style={{ ...inputStyle, background: "#fff" }}>
                        <option value="">Select reason *</option>
                        <option value="Expired">Expired</option>
                        <option value="Rotten / Spoiled">Rotten / Spoiled</option>
                        <option value="Accidental Spill">Accidental Spill</option>
                        <option value="Overcooked / Burnt">Overcooked / Burnt</option>
                        <option value="Quality Issue">Quality Issue</option>
                        <option value="Other">Other</option>
                      </select>
                      <input placeholder="Additional notes (optional)" value={wasteForm.notes}
                        onChange={e => setWasteForm({ ...wasteForm, notes: e.target.value })}
                        style={inputStyle} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={handleAddWaste}
                          style={{ flex: 1, padding: "11px 0", background: "#ef4444", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>
                          Record Waste
                        </button>
                        <button onClick={() => setShowWasteForm(false)}
                          style={{ flex: 1, padding: "11px 0", background: "#f1f5f9", color: "#374151", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {waste.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
                    <div>No waste recorded</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {waste.map(w => (
                      <div key={w.id} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", border: "1px solid #fecaca" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{w.ingredient_name}</div>
                          <span style={{ background: "#fee2e2", color: "#ef4444", fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                            -{w.quantity} {w.unit}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: "#ef4444", fontWeight: 600, marginBottom: 2 }}>
                          Reason: {w.reason}
                        </div>
                        {w.notes && <div style={{ fontSize: 12, color: "#94a3b8" }}>{w.notes}</div>}
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                          {new Date(w.wasted_at).toLocaleString('en-IN')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── RECIPE MODAL ── */}
      {showRecipeModal && selectedItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 600, maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17, color: "#111827" }}>📋 {selectedItem.name}</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>Recipe ingredients</div>
              </div>
              <button onClick={() => setShowRecipeModal(false)}
                style={{ background: "#f1f5f9", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>

            {itemRecipe.length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                <div>No recipe defined for this item</div>
                {isAdmin && <div style={{ fontSize: 12, marginTop: 4 }}>Add ingredients from the Recipes tab</div>}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {itemRecipe.map(r => (
                  <div key={r.id} style={{ background: "#f8fafc", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{r.ingredient_name}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        Uses: <strong>{r.quantity_used} {r.unit}</strong> per serving
                      </div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>
                        Stock: {r.current_stock} {r.unit}
                      </div>
                    </div>
                    {isAdmin && (
                      <button onClick={() => handleDeleteRecipe(r.id)}
                        style={{ background: "#fee2e2", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, color: "#ef4444", fontWeight: 600 }}>
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => setShowRecipeModal(false)}
              style={{ width: "100%", marginTop: 16, padding: "12px 0", background: "#f1f5f9", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}