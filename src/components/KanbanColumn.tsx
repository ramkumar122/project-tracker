import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors, spacing, radius, typography, columnConfig } from '../constants/theme';
import TaskCard, { Task } from './TaskCard';

interface KanbanColumnProps {
  column: string;
  tasks: Task[];
  height: number;
  onCreateTask: (column: string) => void;
  onMoveTask: (taskId: string, newColumn: string) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenTask: (task: Task) => void;
}

export default function KanbanColumn({
  column,
  tasks,
  height,
  onCreateTask,
  onMoveTask,
  onDeleteTask,
  onOpenTask,
}: KanbanColumnProps) {
  const cfg = columnConfig[column as keyof typeof columnConfig];

  return (
    <View style={[styles.column, { height }]}>
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: cfg.color }]} />
        <Text style={styles.columnTitle}>{cfg.label}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{tasks.length}</Text>
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
            onPress={() => onOpenTask(task)}
            onMove={(newColumn) => onMoveTask(task.id, newColumn)}
            onDelete={() => onDeleteTask(task.id)}
          />
        ))}
        {tasks.length === 0 && (
          <Text style={styles.emptyText}>No tasks here</Text>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => onCreateTask(column)}
      >
        <Text style={styles.addButtonText}>+ Add Task</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    width: 280,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  columnTitle: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
  },
  countBadge: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  countText: {
    ...typography.label,
    color: colors.textMuted,
  },
  taskList: {
    flex: 1,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  addButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  addButtonText: {
    ...typography.body,
    color: colors.textMuted,
  },
});
