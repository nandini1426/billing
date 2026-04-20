"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Read directly from localStorage — no store
    const stored = localStorage.getItem('user');
    const token  = localStorage.getItem('token');

    if (!stored || !token) {
      router.push("/login");
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      setUser(parsed);
    } catch {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      router.push("/login");
    }
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
      icon: "💰",
      color: "bg-orange-100 group-hover:bg-orange-500",
      textColor: "text-orange-500",
      route: "/cashier",
    }] : []),
    ...(isAdmin || isManager ? [{
      title: "Manager Control",
      desc: "Take table orders, manage floor operations",
      icon: "🧑‍💼",
      color: "bg-blue-100 group-hover:bg-blue-500",
      textColor: "text-blue-500",
      route: "/manager",
    }] : []),
    ...(isAdmin ? [{
      title: "Admin Control",
      desc: "Manage menu, categories and prices",
      icon: "⚙️",
      color: "bg-purple-100 group-hover:bg-purple-500",
      textColor: "text-purple-500",
      route: "/admin",
    }] : []),
    ...(isAdmin ? [{
      title: "Analytics",
      desc: "View daily, weekly and monthly sales reports",
      icon: "📊",
      color: "bg-green-100 group-hover:bg-green-500",
      textColor: "text-green-500",
      route: "/analytics",
    }] : []),
    {
      title: "Order History",
      desc: isAdmin ? "View and manage all orders" : "View your orders",
      icon: "📋",
      color: "bg-teal-100 group-hover:bg-teal-500",
      textColor: "text-teal-500",
      route: "/orders",
    },
    ...(isAdmin ? [{
      title: "Settings",
      desc: "Restaurant info, GSTIN, UPI, cashiers",
      icon: "🔧",
      color: "bg-gray-100 group-hover:bg-gray-500",
      textColor: "text-gray-500",
      route: "/settings",
    }] : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
              <span className="text-xl">🍽️</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-lg">BillEase</h1>
              <p className="text-xs text-gray-500">Restaurant Billing System</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{user.username}</p>
              <p className="text-xs text-gray-500 capitalize">{user.role}</p>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition font-medium border border-red-100"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            Welcome back, {user.username}! 👋
          </h2>
          <p className="text-gray-500 mt-2 capitalize">
            Logged in as{" "}
            <span className="font-semibold text-orange-500">{user.role}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {cards.map((card, i) => (
            <button
              key={i}
              onClick={() => router.push(card.route)}
              className="group bg-white rounded-2xl p-8 border border-gray-100 shadow-md hover:shadow-xl transition-all duration-200 hover:-translate-y-1 text-left"
            >
              <div className={`w-16 h-16 ${card.color} rounded-2xl flex items-center justify-center mb-4 transition-colors`}>
                <span className="text-3xl">{card.icon}</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{card.title}</h3>
              <p className="text-gray-500 text-sm">{card.desc}</p>
              <div className={`mt-4 flex items-center ${card.textColor} text-sm font-medium`}>
                Open →
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}