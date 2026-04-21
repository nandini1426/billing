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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
      <p className="text-gray-400">Loading...</p>
    </div>
  );

  const isAdmin   = user.role === "admin";
  const isManager = user.role === "manager";
  const isCashier = user.role === "cashier";

  const cards = [
    ...(isAdmin || isCashier ? [{
      title: "Cashier Control",
      desc: "Take orders, manage billing, print receipts",
      icon: "💰", color: "bg-orange-100 group-hover:bg-orange-500",
      textColor: "text-orange-500", route: "/cashier",
    }] : []),
    ...(isAdmin || isManager ? [{
      title: "Manager Control",
      desc: "Take table orders, manage floor operations",
      icon: "🧑‍💼", color: "bg-blue-100 group-hover:bg-blue-500",
      textColor: "text-blue-500", route: "/manager",
    }] : []),
    ...(isAdmin ? [{
      title: "Admin Control",
      desc: "Manage menu, categories and prices",
      icon: "⚙️", color: "bg-purple-100 group-hover:bg-purple-500",
      textColor: "text-purple-500", route: "/admin",
    }] : []),
    ...(isAdmin ? [{
      title: "Analytics",
      desc: "View daily, weekly and monthly sales reports",
      icon: "📊", color: "bg-green-100 group-hover:bg-green-500",
      textColor: "text-green-500", route: "/analytics",
    }] : []),
    {
      title: "Order History",
      desc: isAdmin ? "View and manage all orders" : "View your orders",
      icon: "📋", color: "bg-teal-100 group-hover:bg-teal-500",
      textColor: "text-teal-500", route: "/orders",
    },
    ...(isAdmin ? [{
      title: "Settings",
      desc: "Restaurant info, GSTIN, UPI, cashiers",
      icon: "🔧", color: "bg-gray-100 group-hover:bg-gray-500",
      textColor: "text-gray-500", route: "/settings",
    }] : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 py-6 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-orange-500 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-xl">🍽️</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-xl leading-none">BillEase</h1>
              <p className="text-xs text-gray-400 mt-0.5">Restaurant Billing System</p>
            </div>
          </div>

          {/* Right — user info + logout icon */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">{user.username}</p>
              <p className="text-xs text-orange-500 capitalize font-medium">{user.role}</p>
            </div>
            {/* User avatar */}
            <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold text-orange-600">
                {user.username.charAt(0).toUpperCase()}
              </span>
            </div>
            {/* Logout icon button */}
            <button
              onClick={logout}
              title="Logout"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 pb-10" style={{ paddingTop: "50px" }}>

        {/* Welcome */}
        <div className="mb-36 text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Welcome back, {user.username}! 👋
          </h2>
          <p className="text-gray-400 mt-1 text-sm capitalize" >
            Logged in as <span className="font-semibold text-orange-500">{user.role}</span>
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"style={{ paddingTop: "30px" }}>
          {cards.map((card, i) => (
            <button
              key={i}
              onClick={() => router.push(card.route)}
              className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-1 text-left"
            >
              <div className={`w-14 h-14 ${card.color} rounded-2xl flex items-center justify-center mb-4 transition-colors duration-200`}>
                <span className="text-2xl">{card.icon}</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{card.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{card.desc}</p>
              <div className={`mt-3 flex items-center ${card.textColor} text-sm font-semibold gap-1`}>
                Open
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}