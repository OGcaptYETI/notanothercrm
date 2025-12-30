'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Target, 
  DollarSign, 
  ShoppingCart, 
  Package,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Users
} from 'lucide-react';

interface SidebarProps {
  query?: string;
}

export default function Sidebar({ query = '' }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Update main content margin when sidebar collapses
  React.useEffect(() => {
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.style.marginLeft = isCollapsed ? '4rem' : '16rem';
    }
  }, [isCollapsed]);

  const sidebarItems = [
    {
      name: 'Goals',
      href: `/goals/dashboard${query}`,
      icon: Target,
      active: pathname?.startsWith('/goals')
    },
    {
      name: 'Commissions',
      href: `/commissions${query}`,
      icon: DollarSign,
      active: pathname?.startsWith('/commissions')
    },
    {
      name: 'Active Customers',
      href: `/customers${query}`,
      icon: Users,
      active: pathname?.startsWith('/customers')
    },
    {
      name: 'Quotes',
      href: `/quotes${query}`,
      icon: ShoppingCart,
      active: pathname?.startsWith('/quotes')
    },
    {
      name: 'Products',
      href: `/products${query}`,
      icon: BookOpen,
      active: pathname?.startsWith('/products')
    },
    {
      name: 'Shipments',
      href: `/shipments${query}`,
      icon: Package,
      active: pathname?.startsWith('/shipments')
    }
  ];

  return (
    <aside 
      className={`fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white border-r border-gray-200 transition-all duration-300 z-30 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Collapse Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? (
          <ChevronRight className="w-3 h-3 text-gray-600" />
        ) : (
          <ChevronLeft className="w-3 h-3 text-gray-600" />
        )}
      </button>

      {/* Sidebar Content */}
      <div className="flex flex-col h-full py-6">
        {!isCollapsed && (
          <div className="px-4 mb-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Tools
            </h2>
          </div>
        )}

        <nav className="flex-1 px-3 space-y-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  item.active
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title={isCollapsed ? item.name : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
