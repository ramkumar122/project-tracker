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
import { colors, spacing, radius, typography, columnConfig } from '../constants/theme';

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
}

interface TaskCardProps {
  task: Task;
  onPress: () => void;
  onMove: (newColumn: string) => void;
  onDelete: () => void;
}

const COLUMN_ORDER = ['todo', 'inprogress', 'onhold', 'done'];
const ALL_COLUMNS = Object.entries(columnConfig) as [string, { label: string; color: string }][];

export default function TaskCard({ task, onPress, onMove, onDelete }: TaskCardProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const swipeableRef = useRef<Swipeable>(null);

  const currentIndex = COLUMN_ORDER.indexOf(task.status);
  const nextStatus = COLUMN_ORDER[currentIndex + 1];
  const prevStatus = COLUMN_ORDER[currentIndex - 1];

  const nextConfig = nextStatus ? columnConfig[nextStatus as keyof typeof columnConfig] : null;
  const prevConfig = prevStatus ? columnConfig[prevStatus as keyof typeof columnConfig] : null;

  // Swipe RIGHT → move to next column (revealed on left side)
  const renderLeftActions = () => {
    if (!nextConfig) return null;
    return (
      <View style={[styles.swipeAction, { backgroundColor: nextConfig.color + '22', borderColor: nextConfig.color + '44' }]}>
        <Text style={[styles.swipeArrow, { color: nextConfig.color }]}>→</Text>
        <Text style={[styles.swipeLabel, { color: nextConfig.color }]}>{nextConfig.label}</Text>
      </View>
    );
  };

  // Swipe LEFT → move to previous column (revealed on right side)
  const renderRightActions = () => {
    if (!prevConfig) return null;
    return (
      <View style={[styles.swipeAction, styles.swipeRight, { backgroundColor: prevConfig.color + '22', borderColor: prevConfig.color + '44' }]}>
        <Text style={[styles.swipeLabel, { color: prevConfig.color }]}>{prevConfig.label}</Text>
        <Text style={[styles.swipeArrow, { color: prevConfig.color }]}>←</Text>
      </View>
    );
  };

  const handleSwipeOpen = (direction: 'left' | 'right') => {
    swipeableRef.current?.close();
    if (direction === 'left' && nextStatus) {
      onMove(nextStatus);
    } else if (direction === 'right' && prevStatus) {
      onMove(prevStatus);
    }
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
        containerStyle={styles.swipeContainer}
      >
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
          <Text style={styles.title} numberOfLines={2}>
            {task.title}
          </Text>
          {task.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {task.description}
            </Text>
          ) : null}
          <View style={styles.footer}>
            <View>
              {task.creator_name ? (
                <Text style={styles.creator}>{task.creator_name}</Text>
              ) : null}
              <Text style={styles.date}>
                {new Date(task.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setMenuVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.menuDots}>•••</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Swipeable>

      <Modal visible={menuVisible} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setMenuVisible(false)}>
          <Pressable onPress={() => {}} style={styles.menu}>
            <Text style={styles.menuTaskTitle} numberOfLines={1}>
              {task.title}
            </Text>
            <Text style={styles.sectionLabel}>MOVE TO</Text>
            {ALL_COLUMNS.filter(([key]) => key !== task.status).map(([key, cfg]) => (
              <TouchableOpacity
                key={key}
                style={styles.menuRow}
                onPress={() => {
                  onMove(key);
                  setMenuVisible(false);
                }}
              >
                <View style={[styles.dot, { backgroundColor: cfg.color }]} />
                <Text style={styles.menuRowText}>{cfg.label}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => {
                onDelete();
                setMenuVisible(false);
              }}
            >
              <Text style={styles.deleteText}>Delete Task</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  swipeContainer: {
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    minWidth: 90,
  },
  swipeRight: {
    flexDirection: 'row-reverse',
  },
  swipeArrow: {
    fontSize: 18,
    fontWeight: '700',
  },
  swipeLabel: {
    ...typography.label,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creator: {
    ...typography.label,
    color: colors.primaryLight,
    marginBottom: 2,
  },
  date: {
    ...typography.label,
    color: colors.textDim,
  },
  menuDots: {
    color: colors.textDim,
    fontSize: 12,
    letterSpacing: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menu: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    width: 240,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuTaskTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textDim,
    marginBottom: spacing.xs,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  menuRowText: {
    ...typography.body,
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  deleteText: {
    ...typography.body,
    color: colors.error,
  },
});
