import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing, radius, typography } from '../constants/theme';
import TaskCard, { Task } from './TaskCard';

export interface ColumnDef {
  slug: string;
  name: string;
  color: string;
}

interface KanbanColumnProps {
  columnSlug: string;
  columnName: string;
  columnColor: string;
  tasks: Task[];
  height: number;
  allColumns: ColumnDef[];
  onCreateTask: (column: string) => void;
  onMoveTask: (taskId: string, newColumn: string) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenTask: (task: Task) => void;
  canDelete?: boolean;
  onDeleteColumn?: () => void;
}

export default function KanbanColumn({
  columnSlug,
  columnName,
  columnColor,
  tasks,
  height,
  allColumns,
  onCreateTask,
  onMoveTask,
  onDeleteTask,
  onOpenTask,
  canDelete,
  onDeleteColumn,
}: KanbanColumnProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.column,
        { height, backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {/* Colored top accent bar */}
      <View style={[styles.topAccent, { backgroundColor: columnColor }]} />

      {/* Column header */}
      <View style={styles.header}>
        <View style={[styles.headerPill, { backgroundColor: columnColor + '18' }]}>
          <View style={[styles.dot, { backgroundColor: columnColor }]} />
          <Text style={[styles.columnTitle, { color: columnColor }]}>{columnName}</Text>
        </View>

        <View style={styles.headerRight}>
          <View style={[styles.countBadge, { backgroundColor: columnColor + '20' }]}>
            <Text style={[styles.countText, { color: columnColor }]}>{tasks.length}</Text>
          </View>
          {/* Delete button — custom columns only, owner only */}
          {canDelete && (
            <TouchableOpacity
              onPress={onDeleteColumn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.deleteColBtn}
            >
              <Text style={[styles.deleteColText, { color: colors.textDim }]}>×</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.taskList}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            allColumns={allColumns}
            onPress={() => onOpenTask(task)}
            onMove={(newColumn) => onMoveTask(task.id, newColumn)}
            onDelete={() => onDeleteTask(task.id)}
          />
        ))}
        {tasks.length === 0 && (
          <View style={[styles.emptyBox, { borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.textDim }]}>No tasks</Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.addButton, { borderTopColor: colors.border }]}
        onPress={() => onCreateTask(columnSlug)}
      >
        <Text style={[styles.addButtonText, { color: columnColor }]}>+ Add Task</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    width: 288,
    borderRadius: radius.lg,
    marginRight: spacing.md,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  topAccent: {
    height: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  columnTitle: {
    ...typography.label,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  countText: {
    ...typography.label,
    fontWeight: '700',
  },
  deleteColBtn: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteColText: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '400',
  },
  taskList: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  emptyBox: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.caption,
  },
  addButton: {
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: spacing.xs,
  },
  addButtonText: {
    ...typography.body,
    fontWeight: '500',
  },
});
