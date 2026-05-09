import Link from 'next/link';
import React from 'react';
import { useAuth } from '@/lib/AuthContext';

const Navbar: React.FC = () => {
  const { user, supabase } = useAuth();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <nav className="bg-gray-800 text-white p-4 flex items-center justify-between">
      <div>
        <Link href="/">
          <span className="font-bold text-lg cursor-pointer">Festival Scheduler</span>
        </Link>
      </div>
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <span className="hidden sm:inline">{user.email}</span>
            <button
              onClick={handleSignOut}
              className="bg-red-600 hover:bg-red-700 rounded px-3 py-1 text-sm"
            >
              Sign out
            </button>
          </>
        ) : (
          <Link href="/login">
            <span className="bg-blue-600 hover:bg-blue-700 rounded px-3 py-1 text-sm cursor-pointer">
              Login
            </span>
          </Link>
        )}
      </div>
    </nav>
  );
};

export default Navbar;