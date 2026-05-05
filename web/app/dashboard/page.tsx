"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token  = localStorage.getItem('token');
    if (!stored || !token) { router.push("/login"); return; }
    try { setUser(JSON.parse(stored)); }
    catch { localStorage.clear(); router.push("/login"); }
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push("/login");
  };

  if (!user) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff7ed" }}>
      <p style={{ color: "#9ca3af" }}>Loading...</p>
    </div>
  );

  const isAdmin   = user.role === "admin";
  const isManager = user.role === "manager";
  const isCashier = user.role === "cashier";

  const cards = [
    ...(isAdmin || isCashier ? [{
      title: "Cashier Control",
      desc: "Take orders, manage billing, print receipts",
      icon: "💰", bg: "#fff7ed", iconBg: "#fed7aa", textColor: "#ea580c", route: "/cashier",
    }] : []),
    ...(isAdmin || isManager ? [{
      title: "Manager Control",
      desc: "Take table orders, manage floor operations",
      icon: "🧑‍💼", bg: "#eff6ff", iconBg: "#bfdbfe", textColor: "#2563eb", route: "/manager",
    }] : []),
    ...(isAdmin ? [{
      title: "Admin Control",
      desc: "Manage menu, categories and prices",
      icon: "⚙️", bg: "#faf5ff", iconBg: "#e9d5ff", textColor: "#7c3aed", route: "/admin",
    }] : []),
    ...(isAdmin ? [{
      title: "Analytics",
      desc: "View daily, weekly and monthly sales reports",
      icon: "📊", bg: "#f0fdf4", iconBg: "#bbf7d0", textColor: "#16a34a", route: "/analytics",
    }] : []),
    {
      title: "Order History",
      desc: isAdmin ? "View and manage all orders" : "View your orders",
      icon: "📋", bg: "#f0fdfa", iconBg: "#99f6e4", textColor: "#0d9488", route: "/orders",
    },
    ...(isAdmin ? [{
      title: "Settings",
      desc: "Restaurant info, GSTIN, UPI, cashiers",
      icon: "🔧", bg: "#f9fafb", iconBg: "#e5e7eb", textColor: "#374151", route: "/settings",
    }] : []),
    ...(isAdmin ? [{
  title: "Inventory",
  desc: "Track ingredients, stock levels and waste",
  icon: "📦", bg: "#f0fdf4", iconBg: "#bbf7d0", textColor: "#16a34a", route: "/inventory",
}] : []),
  ];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)" }}>

      {/* Header */}
      <header style={{
        background: "#fff",
        borderBottom: "1px solid #f3f4f6",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 40, height: 40, background: "#f97316",
            borderRadius: 12, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 20, flexShrink: 0,
          }}>🍽️</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#111827", lineHeight: 1.2 }}>BillEase</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>Restaurant Billing System</div>
          </div>
        </div>

        {/* User + Logout */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>{user.username}</div>
            <div style={{ fontSize: 11, color: "#f97316", fontWeight: 600, textTransform: "capitalize" }}>{user.role}</div>
          </div>
          <div style={{
            width: 36, height: 36, background: "#fff7ed",
            borderRadius: "50%", display: "flex", alignItems: "center",
            justifyContent: "center", fontWeight: 800, fontSize: 14, color: "#f97316",
            border: "2px solid #fed7aa", flexShrink: 0,
          }}>
            {user.username.charAt(0).toUpperCase()}
          </div>
          <button onClick={logout} title="Logout"
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "#fee2e2", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Main */}
      <main style={{ padding: "20px 16px", maxWidth: 600, margin: "0 auto" }}>

        {/* Welcome */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>
            Welcome back, {user.username}! 👋
          </h2>
          <p style={{ color: "#9ca3af", marginTop: 4, fontSize: 13 }}>
            Logged in as <span style={{ fontWeight: 700, color: "#f97316", textTransform: "capitalize" }}>{user.role}</span>
          </p>
        </div>

        {/* Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {cards.map((card, i) => (
            <button key={i} onClick={() => router.push(card.route)}
              style={{
                background: "#fff",
                border: "1px solid #f3f4f6",
                borderRadius: 16,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                cursor: "pointer",
                textAlign: "left",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                transition: "all .15s",
                width: "100%",
              }}>
              {/* Icon */}
              <div style={{
                width: 52, height: 52, background: card.bg,
                borderRadius: 14, display: "flex",
                alignItems: "center", justifyContent: "center",
                fontSize: 24, flexShrink: 0,
                border: `1px solid ${card.iconBg}`,
              }}>
                {card.icon}
              </div>
              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 2 }}>{card.title}</div>
                <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.4 }}>{card.desc}</div>
              </div>
              {/* Arrow */}
              <div style={{ color: card.textColor, fontWeight: 700, fontSize: 18, flexShrink: 0 }}>›</div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}