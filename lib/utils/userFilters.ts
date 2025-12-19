// User Filter Utilities

import { User } from '@/types';

export interface UserFilter {
  role?: string | string[];
  isActive?: boolean;
  search?: string;
}

export function filterUsers(users: User[], filters: UserFilter): User[] {
  let filtered = [...users];

  if (filters.role) {
    const roles = Array.isArray(filters.role) ? filters.role : [filters.role];
    filtered = filtered.filter(u => roles.includes(u.role));
  }

  if (filters.search) {
    const search = filters.search.toLowerCase();
    filtered = filtered.filter(u => 
      u.name?.toLowerCase().includes(search) ||
      u.email?.toLowerCase().includes(search)
    );
  }

  return filtered;
}

export function sortUsers(users: User[], sortBy: 'name' | 'email' | 'role' = 'name'): User[] {
  return [...users].sort((a, b) => {
    const aVal = a[sortBy] || '';
    const bVal = b[sortBy] || '';
    return String(aVal).localeCompare(String(bVal));
  });
}

export function getUserDisplayName(user: User): string {
  return user.name || user.email?.split('@')[0] || 'Unknown User';
}

export function getUserInitials(user: User): string {
  const name = user.name || user.email?.split('@')[0] || 'U';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}
