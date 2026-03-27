import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { useTheme } from '../context/ThemeContext';
import { spacing, radius, typography } from '../constants/theme';
import { getDueDateInfo } from '../utils/dueDate';
import { getAvatarColor } from '../utils/avatarColor';
import { ColumnDef } from './KanbanColumn';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  order: number;
  project_id: string;
  created_by: string;
  created_at: string;
  creator_name?: string;
  due_date?: string | null;
  subtask_total?: number;
  subtask_done?: number;
  assigned_to?: string | null;
  assignee_name?: string | null;
}

interface TaskCardProps {
  task: Task;
  onPress: () => void;
  onMove: (newColumn: string) => void;
  onDelete: () => void;
  allColumns: ColumnDef[];
}

export default function TaskCard({ task, onPress, onMove, onDelete, allColumns }: TaskCardProps) {
  const { colors } = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  const swipeableRef = useRef<Swipeable>(null);

  const currentIndex = allColumns.findIndex((c) => c.slug === task.status);
  const nextCol = currentIndex >= 0 && currentIndex < allColumns.length - 1
    ? allColumns[currentIndex + 1]
    : null;
  const prevCol = currentIndex > 0 ? allColumns[currentIndex - 1] : null;

  const dueInfo = getDueDateInfo(task.due_date, colors);
  const creatorInitial = task.creator_name ? task.creator_name.charAt(0).toUpperCase() : '?';
  const assigneeInitial = task.assignee_name ? task.assignee_name.charAt(0).toUpperCase() : null;
  const assigneeColor = task.assignee_name ? getAvatarColor(task.assignee_name) : '#10b981';
  const hasSubtasks = (task.subtask_total ?? 0) > 0;

  const renderLeftActions = () => {
    if (!nextCol) return null;
    return (
      <View style={[swipeStyles.action, { backgroundColor: nextCol.color + '22', borderColor: nextCol.color + '55' }]}>
        <Text style={[swipeStyles.arrow, { color: nextCol.color }]}>→</Text>
        <Text style={[swipeStyles.label, { color: nextCol.color }]}>{nextCol.name}</Text>
      </View>
    );
  };

  const renderRightActions = () => {
    if (!prevCol) return null;
    return (
      <View style={[swipeStyles.action, swipeStyles.actionRight, { backgroundColor: prevCol.color + '22', borderColor: prevCol.color + '55' }]}>
        <Text style={[swipeStyles.label, { color: prevCol.color }]}>{prevCol.name}</Text>
        <Text style={[swipeStyles.arrow, { color: prevCol.color }]}>←</Text>
      </View>
    );
  };

  const handleSwipeOpen = (direction: 'left' | 'right') => {
    swipeableRef.current?.close();
    if (direction === 'left' && nextCol) onMove(nextCol.slug);
    else if (direction === 'right' && prevCol) onMove(prevCol.slug);
  };

  return (
    <>
      <Swipeable
        ref={swipeableRef}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        onSwipeableOpen={handleSwipeOpen}
        overshootLeft={false}
        overshootRight={false}
        friction={2}
        containerStyle={{ marginBottom: spacing.sm, borderRadius: radius.md, overflow: 'hidden' }}
      >
        <TouchableOpacity
          style={[cardStyle.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={onPress}
          activeOpacity={0.85}
        >
          <Text style={[cardStyle.title, { color: colors.text }]} numberOfLines={2}>
            {task.title}
          </Text>

          {task.description ? (
            <Text style={[cardStyle.description, { color: colors.textMuted }]} numberOfLines={2}>
              {task.description}
            </Text>
          ) : null}

          {/* Due date badge */}
          {dueInfo && (
            <View style={[cardStyle.dueBadge, { backgroundColor: dueInfo.color + '18', borderColor: dueInfo.color + '40' }]}>
              <Text style={[cardStyle.dueText, { color: dueInfo.color }]}>
                {dueInfo.status === 'overdue' ? '⚠ ' : '📅 '}{dueInfo.label}
              </Text>
            </View>
          )}

          {/* Subtask progress — only shown if subtasks exist */}
          {hasSubtasks && (
            <View style={cardStyle.subtaskRow}>
              <View style={[cardStyle.subtaskBar, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    cardStyle.subtaskFill,
                    {
                      backgroundColor: colors.success,
                      width: `${((task.subtask_done ?? 0) / (task.subtask_total ?? 1)) * 100}%` as any,
                    },
                  ]}
                />
              </View>
              <Text style={[cardStyle.subtaskCount, { color: colors.textDim }]}>
                {task.subtask_done}/{task.subtask_total}
              </Text>
            </View>
          )}

          <View style={cardStyle.footer}>
            <Text style={[cardStyle.date, { color: colors.textDim }]}>
              {new Date(task.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </Text>
            <View style={cardStyle.footerRight}>
              {assigneeInitial && (
                <View style={[cardStyle.avatar, { backgroundColor: assigneeColor + '30' }]}>
                  <Text style={[cardStyle.avatarText, { color: assigneeColor }]}>
                    {assigneeInitial}
                  </Text>
                </View>
              )}
              <View style={[cardStyle.avatar, { backgroundColor: colors.primary + '30' }]}>
                <Text style={[cardStyle.avatarText, { color: colors.primary }]}>
                  {creatorInitial}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setMenuVisible(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[cardStyle.menuDots, { color: colors.textDim }]}>•••</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>

      <Modal visible={menuVisible} transparent animationType="fade">
        <Pressable style={menuStyle.overlay} onPress={() => setMenuVisible(false)}>
          <Pressable
            onPress={() => {}}
            style={[menuStyle.menu, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text
              style={[menuStyle.taskTitle, { color: colors.text, borderBottomColor: colors.border }]}
              numberOfLines={1}
            >
              {task.title}
            </Text>
            <Text style={[menuStyle.sectionLabel, { color: colors.textDim }]}>MOVE TO</Text>
            {allColumns
              .filter((c) => c.slug !== task.status)
              .map((col) => (
                <TouchableOpacity
                  key={col.slug}
                  style={menuStyle.menuRow}
                  onPress={() => { onMove(col.slug); setMenuVisible(false); }}
                >
                  <View style={[menuStyle.dot, { backgroundColor: col.color }]} />
                  <Text style={[menuStyle.menuRowText, { color: colors.text }]}>{col.name}</Text>
                </TouchableOpacity>
              ))}
            <View style={[menuStyle.divider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={menuStyle.menuRow}
              onPress={() => { onDelete(); setMenuVisible(false); }}
            >
              <Text style={[menuStyle.deleteText, { color: colors.error }]}>Delete Task</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const swipeStyles = StyleSheet.create({
  action: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    minWidth: 90,
  },
  actionRight: { flexDirection: 'row-reverse' },
  arrow: { fontSize: 18, fontWeight: '700' },
  label: { ...typography.label, fontWeight: '600' },
});

const cardStyle = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
  description: {
    ...typography.caption,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  dueBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: spacing.sm,
  },
  dueText: { ...typography.label, fontWeight: '500' },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  subtaskBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  subtaskFill: {
    height: '100%',
    borderRadius: 2,
  },
  subtaskCount: {
    ...typography.label,
    minWidth: 28,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  date: { ...typography.label },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 10, fontWeight: '700' },
  menuDots: { fontSize: 12, letterSpacing: 1 },
});

const menuStyle = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menu: {
    borderRadius: radius.lg,
    padding: spacing.md,
    width: 240,
    borderWidth: 1,
  },
  taskTitle: {
    ...typography.body,
    fontWeight: '600',
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  sectionLabel: { ...typography.label, marginBottom: spacing.xs },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  menuRowText: { ...typography.body },
  divider: { height: 1, marginVertical: spacing.xs },
  deleteText: { ...typography.body },
});
