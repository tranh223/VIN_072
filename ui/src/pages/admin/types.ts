import type { ReactNode } from 'react';

export type AdminSection = 'dashboard' | 'users' | 'rag' | 'feedback' | 'stats';

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | string;
  stores: number;
  lastLogin: string;
  status: 'active' | 'inactive' | 'locked' | 'pending' | string;
  createdAt?: string | null;
};

export type SelectProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
};

export type GrowthRange = 'day' | 'month' | 'year';

export type Totals = {
  totalUsers: number;
  activeUsers: number;
  lockedUsers: number;
  newThisMonth: number;
  totalContent: number;
  activeContent: number;
  pendingContent: number;
  lastUpdated: string;
  totalFeedback: number;
  newFeedback: number;
  processingFeedback: number;
  resolvedFeedback: number;
};
