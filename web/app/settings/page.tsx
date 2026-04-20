"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/authStore";
import api from "@/lib/api";
import toast from "react-hot-toast";
import LogoutButton from "@/components/LogoutButton";

interface Settings {
  name: string;
  address: string;
  contact: string;
  gstin: string;
  upi_id: string;
  service_charge: number;
  footer_text: string;
}

interface Cashier {
  id: string;
  name: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, init } = useAuthStore();

  const [settings, setSettings] = useState<Settings>({
    name: "",
    address: "",
    contact: "",
    gstin: "",
    upi_id: "",
    service_charge: 0,
    footer_text: "Thank you! Visit again",
  });

  const [cashiers,   setCashiers]   = useState<Cashier[]>([]);
  const [newCashier, setNewCashier] = useState("");
  const [saving,     setSaving]     = useState(false);
  const [activeTab,  setActiveTab]  = useState<"restaurant" | "cashiers">("restaurant");

  useEffect(() => { init(); }, []);
  useEffect(() => {
    if (user && user.role !== "admin") {
      toast.error("Admin access only");
      router.push("/dashboard");
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
    fetchCashiers();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get("/settings");
      const data = res.data;
      setSettings({
        name:           data.name           || "",
        address:        data.address        || "",
        contact:        data.contact        || "",
        gstin:          data.gstin          || "",
        upi_id:         data.upi_id         || "",
        service_charge: data.service_charge || 0,
        footer_text:    data.footer_text    || "Thank you! Visit again",
      });
    } catch {
      toast.error("Failed to load settings");
    }
  };

  const fetchCashiers = async () => {
    try {
      const res = await api.get("/settings/cashiers");
      setCashiers(res.data);
    } catch {
      toast.error("Failed to load cashiers");
    }
  };

  const handleSaveSettings = async () => {
    if (!settings.name) return toast.error("Restaurant name is required");
    if (settings.contact && settings.contact.length !== 10)
      return toast.error("Contact must be 10 digits");
    if (settings.gstin && settings.gstin.length !== 15)
      return toast.error("GSTIN must be 15 characters");

    setSaving(true);
    try {
      await api.put("/settings", settings);
      toast.success("Settings saved successfully!");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleAddCashier = async () => {
    if (!newCashier.trim()) return toast.error("Enter cashier name");
    try {
      const res = await api.post("/settings/cashiers", { name: newCashier.trim() });
      setCashiers([...cashiers, res.data]);
      setNewCashier("");
      toast.success("Cashier added!");
    } catch {
      toast.error("Failed to add cashier");
    }
  };

  const handleDeleteCashier = async (id: string) => {
    if (!window.confirm("Remove this cashier?")) return;
    try {
      await api.delete(`/settings/cashiers/${id}`);
      setCashiers(cashiers.filter(c => c.id !== id));
      toast.success("Cashier removed");
    } catch {
      toast.error("Failed to remove cashier");
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              ← Back
            </button>
            <div className="w-px h-6 bg-gray-200" />
            <h1 className="font-bold text-gray-900 text-lg">⚙️ Restaurant Settings</h1>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("restaurant")}
            className={`px-6 py-2.5 rounded-xl font-medium text-sm transition ${
              activeTab === "restaurant"
                ? "bg-orange-500 text-white shadow-md"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            🏪 Restaurant Info
          </button>
          <button
            onClick={() => setActiveTab("cashiers")}
            className={`px-6 py-2.5 rounded-xl font-medium text-sm transition ${
              activeTab === "cashiers"
                ? "bg-orange-500 text-white shadow-md"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            👤 Cashiers
          </button>
        </div>

        {/* Restaurant Info Tab */}
        {activeTab === "restaurant" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-6">
              Restaurant Information
            </h2>
            <div className="grid grid-cols-1 gap-5">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Restaurant Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={settings.name}
                  onChange={e => setSettings({ ...settings, name: e.target.value })}
                  placeholder="e.g. Barkaas Arabic Restaurant"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Address
                </label>
                <textarea
                  value={settings.address}
                  onChange={e => setSettings({ ...settings, address: e.target.value })}
                  placeholder="Door No, Street, Area, City, State, PIN"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-900 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Contact Number
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={settings.contact}
                    onChange={e => setSettings({
                      ...settings,
                      contact: e.target.value.replace(/\D/g, '').slice(0, 10)
                    })}
                    placeholder="10-digit number"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={settings.gstin}
                    onChange={e => setSettings({
                      ...settings,
                      gstin: e.target.value.toUpperCase().slice(0, 15)
                    })}
                    placeholder="15-character GSTIN"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    UPI ID
                  </label>
                  <input
                    type="text"
                    value={settings.upi_id}
                    onChange={e => setSettings({ ...settings, upi_id: e.target.value })}
                    placeholder="e.g. restaurant@ybl"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Service Charge (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={settings.service_charge}
                    onChange={e => setSettings({
                      ...settings,
                      service_charge: Number(e.target.value)
                    })}
                    placeholder="e.g. 5"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Receipt Footer Text
                </label>
                <input
                  type="text"
                  value={settings.footer_text}
                  onChange={e => setSettings({ ...settings, footer_text: e.target.value })}
                  placeholder="e.g. Thank you! Visit again"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-900"
                />
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold rounded-xl transition shadow-md"
              >
                {saving ? "Saving..." : "💾 Save Settings"}
              </button>
            </div>
          </div>
        )}

        {/* Cashiers Tab */}
        {activeTab === "cashiers" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-6">
              Manage Cashiers
            </h2>

            <div className="flex gap-3 mb-6">
              <input
                type="text"
                value={newCashier}
                onChange={e => setNewCashier(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddCashier()}
                placeholder="Enter cashier name"
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-900"
              />
              <button
                onClick={handleAddCashier}
                className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition"
              >
                + Add
              </button>
            </div>

            {cashiers.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-3">👤</p>
                <p>No cashiers added yet</p>
                <p className="text-sm mt-1">Add cashier names above</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {cashiers.map(cashier => (
                  <div
                    key={cashier.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-sm">
                        {cashier.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{cashier.name}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteCashier(cashier.id)}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition text-sm font-medium"
                    >
                      Remove
                    </button>
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