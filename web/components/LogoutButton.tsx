"use client";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const userStr = typeof window !== 'undefined'
    ? localStorage.getItem('user') : null;
  const user = userStr ? JSON.parse(userStr) : null;

  return (
    <div className="flex items-center gap-3">
      {user && (
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">{user.username}</p>
          <p className="text-xs text-gray-500 capitalize">{user.role}</p>
        </div>
      )}
      <button
        onClick={handleLogout}
        className="px-4 py-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition font-medium border border-red-100"
      >
        Logout
      </button>
    </div>
  );
}