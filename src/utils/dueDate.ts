import { ThemeColors } from '../constants/theme';

export interface DueDateInfo {
  label: string;
  color: string;
  status: 'overdue' | 'urgent' | 'soon' | 'ok';
}

export function getDueDateInfo(
  dueDate: string | null | undefined,
  colors: ThemeColors
): DueDateInfo | null {
  if (!dueDate) return null;

  const now = new Date();
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return null;

  // Compare at day granularity
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round((dueDay.getTime() - nowDay.getTime()) / 86400000);

  if (diffDays < 0) {
    const n = Math.abs(diffDays);
    return {
      label: `${n} day${n === 1 ? '' : 's'} overdue`,
      color: colors.error,
      status: 'overdue',
    };
  }
  if (diffDays === 0) {
    return { label: 'Due today', color: colors.error, status: 'urgent' };
  }
  if (diffDays === 1) {
    return { label: 'Due tomorrow', color: colors.error, status: 'urgent' };
  }
  if (diffDays <= 3) {
    return { label: `Due in ${diffDays} days`, color: colors.warning, status: 'soon' };
  }
  return {
    label: `Due ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    color: colors.textDim,
    status: 'ok',
  };
}
