'use client';

import { ReactNode, useCallback, useState } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const handleMenuClick = useCallback(() => {
    setSidebarOpen((open) => !open);
  }, []);
  const handleSidebarClose = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <div className="app-shell min-h-screen overflow-x-hidden">
      <div className="app-grid-mask fixed inset-0 -z-10" />
      <Navbar onMenuClick={handleMenuClick} />
      <Sidebar isOpen={sidebarOpen} onClose={handleSidebarClose} />
      <main className="px-3 pb-8 pt-4 transition-all duration-300 sm:px-6 sm:pt-6 lg:ml-72 lg:px-8">
        <div className="mx-auto max-w-7xl min-w-0">{children}</div>
      </main>
    </div>
  );
}
