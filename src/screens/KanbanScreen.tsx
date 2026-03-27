import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Pressable,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { spacing, radius, typography } from '../constants/theme';
import KanbanColumn from '../components/KanbanColumn';
import { getAvatarColor } from '../utils/avatarColor';
import { Task } from '../components/TaskCard';
import MembersModal from '../components/MembersModal';
import { RootStackParamList } from '../types/navigation';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'Kanban'>;
  route: RouteProp<RootStackParamList, 'Kanban'>;
};

interface TeamMember {
  id: string;
  name: string;
}

export interface ProjectColumn {
  id: string;
  project_id: string;
  name: string;
  slug: string;
  color: string;
  position: number;
  is_default: boolean;
}

const HEADER_HEIGHT = Platform.OS === 'ios' ? 100 : Platform.OS === 'android' ? 80 : 64;

const PRESET_COLORS = [
  '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#64748b',
];

export default function KanbanScreen({ navigation, route }: Props) {
  const { projectId, projectName } = route.params;
  const { user } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { height } = useWindowDimensions();
  const columnHeight = height - HEADER_HEIGHT - spacing.md * 2;

  const [columns, setColumns] = useState<ProjectColumn[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Keep a ref of current task IDs so the subtask subscription can update counts
  // without depending on the tasks state (avoids stale-closure / infinite-loop issues)
  const taskIdsRef = useRef<string[]>([]);
  useEffect(() => {
    taskIdsRef.current = tasks.map((t) => t.id);
  }, [tasks]);
  const [projectOwnerId, setProjectOwnerId] = useState('');
  const isOwner = user?.id === projectOwnerId;

  // Members modal
  const [membersVisible, setMembersVisible] = useState(false);

  // Team members for assignee picker
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Create task modal
  const [createVisible, setCreateVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newColumn, setNewColumn] = useState('');
  const [newAssignee, setNewAssignee] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Task filter
  const [taskFilter, setTaskFilter] = useState<'all' | 'mine' | 'unassigned'>('all');

  // Add column modal
  const [addColVisible, setAddColVisible] = useState(false);
  const [insertAfterPosition, setInsertAfterPosition] = useState(-1);
  const [newColName, setNewColName] = useState('');
  const [newColColor, setNewColColor] = useState(PRESET_COLORS[9]);
  const [addingCol, setAddingCol] = useState(false);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  const allColumns = useMemo(
    () => columns.map((c) => ({ slug: c.slug, name: c.name, color: c.color })),
    [columns]
  );

  // ─── Fetchers ────────────────────────────────────────────────────────────────

  const fetchColumns = useCallback(async () => {
    const { data } = await supabase
      .from('project_columns')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true });
    if (data) setColumns(data);
  }, [projectId]);

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('order', { ascending: true });

    if (error) { Alert.alert('Error', error.message); setLoading(false); return; }

    const taskList = data || [];

    // Creator + assignee names (single profiles query)
    const creatorIds = [...new Set(taskList.map((t) => t.created_by))];
    const assigneeIds = [...new Set(taskList.filter((t) => t.assigned_to).map((t) => t.assigned_to as string))];
    const allProfileIds = [...new Set([...creatorIds, ...assigneeIds])];
    const profileMap = new Map<string, string>();
    if (allProfileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', allProfileIds);
      profiles?.forEach((p) => profileMap.set(p.id, p.full_name || 'Unknown'));
    }

    // Subtask counts
    const taskIds = taskList.map((t) => t.id);
    const subtaskMap = new Map<string, { total: number; done: number }>();
    if (taskIds.length > 0) {
      const { data: subtaskData } = await supabase
        .from('subtasks')
        .select('task_id, status')
        .in('task_id', taskIds);
      for (const s of subtaskData || []) {
        if (!subtaskMap.has(s.task_id)) subtaskMap.set(s.task_id, { total: 0, done: 0 });
        const entry = subtaskMap.get(s.task_id)!;
        entry.total++;
        if (s.status === 'done') entry.done++;
      }
    }

    setTasks(
      taskList.map((t) => ({
        ...t,
        creator_name: profileMap.get(t.created_by) || 'Unknown',
        assignee_name: t.assigned_to ? (profileMap.get(t.assigned_to) || 'Unknown') : null,
        subtask_total: subtaskMap.get(t.id)?.total ?? 0,
        subtask_done: subtaskMap.get(t.id)?.done ?? 0,
      }))
    );
    setLoading(false);
  }, [projectId]);

  const fetchProjectOwner = useCallback(async () => {
    const { data } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();
    if (data) setProjectOwnerId(data.owner_id);
  }, [projectId]);

  const fetchTeamMembers = useCallback(async () => {
    const [{ data: projectData }, { data: memberData }] = await Promise.all([
      supabase.from('projects').select('owner_id').eq('id', projectId).single(),
      supabase.from('project_members').select('user_id').eq('project_id', projectId),
    ]);
    const allIds = [
      ...(projectData ? [projectData.owner_id] : []),
      ...(memberData?.map((m: { user_id: string }) => m.user_id) || []),
    ];
    const uniqueIds = [...new Set(allIds)];
    if (uniqueIds.length === 0) return;
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', uniqueIds);
    setTeamMembers((profiles || []).map((p) => ({ id: p.id, name: p.full_name || 'Unknown' })));
  }, [projectId]);

  // Re-fetches only subtask counts and patches them into the existing tasks state.
  // Uses a ref for task IDs so this callback never goes stale.
  const refreshSubtaskCounts = useCallback(async () => {
    const ids = taskIdsRef.current;
    if (ids.length === 0) return;

    const { data: subtaskData } = await supabase
      .from('subtasks')
      .select('task_id, status')
      .in('task_id', ids);

    const map = new Map<string, { total: number; done: number }>();
    for (const s of subtaskData || []) {
      if (!map.has(s.task_id)) map.set(s.task_id, { total: 0, done: 0 });
      const entry = map.get(s.task_id)!;
      entry.total++;
      if (s.status === 'done') entry.done++;
    }

    setTasks((prev) =>
      prev.map((t) => ({
        ...t,
        subtask_total: map.get(t.id)?.total ?? 0,
        subtask_done: map.get(t.id)?.done ?? 0,
      }))
    );
  }, []); // stable — reads from ref, writes via setter

  useEffect(() => {
    Promise.all([fetchColumns(), fetchTasks(), fetchProjectOwner(), fetchTeamMembers()]);

    const taskChannel = supabase
      .channel(`tasks-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` },
        fetchTasks
      )
      .subscribe();

    const colChannel = supabase
      .channel(`columns-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_columns', filter: `project_id=eq.${projectId}` },
        fetchColumns
      )
      .subscribe();

    // Subtasks don't have a project_id so we can't filter by it in realtime.
    // Subscribe to all subtask changes and refresh counts for tasks on this board.
    const subtaskChannel = supabase
      .channel(`subtasks-board-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subtasks' },
        refreshSubtaskCounts
      )
      .subscribe();

    return () => {
      supabase.removeChannel(taskChannel);
      supabase.removeChannel(colChannel);
      supabase.removeChannel(subtaskChannel);
    };
  }, [projectId, fetchTasks, fetchColumns, fetchProjectOwner, fetchTeamMembers, refreshSubtaskCounts]);

  // ─── Task actions ─────────────────────────────────────────────────────────────

  const openCreate = (col: string) => {
    setNewColumn(col);
    setNewTitle('');
    setNewDesc('');
    setNewDueDate('');
    setNewAssignee(null);
    setCreateVisible(true);
  };

  const handleCreateTask = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);

    const maxOrder = tasks.filter((t) => t.status === newColumn).length;
    const parsedDue = newDueDate.trim() ? new Date(newDueDate.trim()) : null;
    const dueDateValue =
      parsedDue && !isNaN(parsedDue.getTime()) ? newDueDate.trim() : null;

    const { error } = await supabase.from('tasks').insert({
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      status: newColumn,
      order: maxOrder,
      project_id: projectId,
      created_by: user!.id,
      due_date: dueDateValue,
      assigned_to: newAssignee || null,
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setCreateVisible(false);
      fetchTasks();
    }
    setCreating(false);
  };

  const handleMoveTask = async (taskId: string, toColumn: string) => {
    const maxOrder = tasks.filter((t) => t.status === toColumn).length;
    await supabase
      .from('tasks')
      .update({ status: toColumn, order: maxOrder })
      .eq('id', taskId);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: toColumn, order: maxOrder } : t
      )
    );
  };

  const handleDeleteTask = (taskId: string) => {
    const doDelete = async () => {
      await supabase.from('tasks').delete().eq('id', taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this task?')) doDelete();
    } else {
      Alert.alert('Delete Task', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // ─── Column actions ───────────────────────────────────────────────────────────

  const openAddColumn = (afterPosition: number) => {
    setInsertAfterPosition(afterPosition);
    setNewColName('');
    setNewColColor(PRESET_COLORS[9]);
    setAddColVisible(true);
  };

  const handleAddColumn = async () => {
    if (!newColName.trim()) return;
    setAddingCol(true);

    const newPosition = insertAfterPosition + 1;
    const slug =
      newColName.toLowerCase().replace(/[^a-z0-9]+/g, '-') +
      '-' +
      Date.now().toString(36);

    // Shift columns that are at or after the new position
    const toShift = columns.filter((c) => c.position >= newPosition);
    for (const col of toShift) {
      await supabase
        .from('project_columns')
        .update({ position: col.position + 1 })
        .eq('id', col.id);
    }

    // Insert the new column
    const { error } = await supabase.from('project_columns').insert({
      project_id: projectId,
      name: newColName.trim(),
      slug,
      color: newColColor,
      position: newPosition,
      is_default: false,
    });

    if (error) Alert.alert('Error', error.message);
    else setAddColVisible(false);

    await fetchColumns();
    setAddingCol(false);
  };

  const handleDeleteColumn = (column: ProjectColumn) => {
    if (column.is_default) {
      Alert.alert('Cannot delete', 'Default columns cannot be removed.');
      return;
    }

    const idx = columns.findIndex((c) => c.id === column.id);
    const target = columns[idx - 1] || columns[idx + 1];
    if (!target) {
      Alert.alert('Cannot delete', 'You must have at least one column.');
      return;
    }

    const tasksInCol = tasks.filter((t) => t.status === column.slug).length;
    const msg =
      tasksInCol > 0
        ? `${tasksInCol} task(s) will be moved to "${target.name}". Delete "${column.name}"?`
        : `Delete column "${column.name}"?`;

    Alert.alert('Delete Column', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (tasksInCol > 0) {
            await supabase
              .from('tasks')
              .update({ status: target.slug })
              .eq('project_id', projectId)
              .eq('status', column.slug);
          }
          await supabase.from('project_columns').delete().eq('id', column.id);
          await fetchTasks();
          await fetchColumns();
        },
      },
    ]);
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.projectName} numberOfLines={1}>
          {projectName}
        </Text>
        <TouchableOpacity style={styles.iconBtn} onPress={toggleTheme}>
          <Text style={styles.iconBtnText}>{isDark ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setMembersVisible(true)}>
          <Text style={styles.iconBtnText}>👥</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.newTaskBtn} onPress={() => openCreate(columns[0]?.slug || 'todo')}>
          <Text style={styles.newTaskText}>+ New Task</Text>
        </TouchableOpacity>
      </View>

      {/* Filter bar */}
      {!loading && (
        <View style={styles.filterBar}>
          {(['all', 'mine', 'unassigned'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterChip,
                taskFilter === f && { backgroundColor: colors.primary + '20', borderColor: colors.primary },
              ]}
              onPress={() => setTaskFilter(f)}
            >
              <Text style={[
                styles.filterChipText,
                { color: taskFilter === f ? colors.primary : colors.textMuted },
              ]}>
                {f === 'all' ? 'All Tasks' : f === 'mine' ? 'Assigned to Me' : 'Unassigned'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          horizontal
          style={styles.board}
          contentContainerStyle={styles.boardContent}
          showsHorizontalScrollIndicator={false}
        >
          {columns.map((col) => (
            <React.Fragment key={col.id}>
              <KanbanColumn
                columnSlug={col.slug}
                columnName={col.name}
                columnColor={col.color}
                tasks={tasks.filter((t) => {
                  if (t.status !== col.slug) return false;
                  if (taskFilter === 'mine') return t.assigned_to === user?.id;
                  if (taskFilter === 'unassigned') return !t.assigned_to;
                  return true;
                })}
                height={columnHeight}
                allColumns={allColumns}
                onCreateTask={openCreate}
                onMoveTask={handleMoveTask}
                onDeleteTask={handleDeleteTask}
                onOpenTask={(task) =>
                  navigation.navigate('TaskDetail', {
                    taskId: task.id,
                    taskTitle: task.title,
                    projectId,
                  })
                }
                canDelete={!col.is_default && isOwner}
                onDeleteColumn={() => handleDeleteColumn(col)}
              />

              {/* Insert-between button — owner only */}
              {isOwner && (
                <TouchableOpacity
                  style={styles.addColTrigger}
                  onPress={() => openAddColumn(col.position)}
                >
                  <Text style={[styles.addColTriggerText, { color: colors.textDim }]}>+</Text>
                </TouchableOpacity>
              )}
            </React.Fragment>
          ))}

          {/* Add column at end — owner only */}
          {isOwner && (
            <TouchableOpacity
              style={[styles.addColEnd, { borderColor: colors.border }]}
              onPress={() => openAddColumn(columns[columns.length - 1]?.position ?? -1)}
            >
              <Text style={[styles.addColEndText, { color: colors.textDim }]}>+ Add Column</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Create Task Modal */}
      <Modal visible={createVisible} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setCreateVisible(false)}>
          <Pressable onPress={() => {}} style={styles.modal}>
            <Text style={styles.modalTitle}>New Task</Text>
            <TextInput
              style={styles.input}
              placeholder="Task title *"
              placeholderTextColor={colors.textDim}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description (optional)"
              placeholderTextColor={colors.textDim}
              value={newDesc}
              onChangeText={setNewDesc}
              multiline
              numberOfLines={3}
            />
            <TextInput
              style={styles.input}
              placeholder="Due date (YYYY-MM-DD, optional)"
              placeholderTextColor={colors.textDim}
              value={newDueDate}
              onChangeText={setNewDueDate}
            />
            {teamMembers.length > 0 && (
              <>
                <Text style={[styles.colorPickerLabel, { color: colors.textMuted }]}>Assign To</Text>
                <View style={styles.assigneeRow}>
                  <TouchableOpacity
                    style={[
                      styles.assigneeChip,
                      { borderColor: colors.border, backgroundColor: newAssignee === null ? colors.primary + '20' : 'transparent' },
                    ]}
                    onPress={() => setNewAssignee(null)}
                  >
                    <Text style={[styles.assigneeChipText, { color: newAssignee === null ? colors.primary : colors.textMuted }]}>
                      None
                    </Text>
                  </TouchableOpacity>
                  {teamMembers.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.assigneeChip,
                        { borderColor: newAssignee === m.id ? getAvatarColor(m.name) : colors.border, backgroundColor: newAssignee === m.id ? getAvatarColor(m.name) + '20' : 'transparent' },
                      ]}
                      onPress={() => setNewAssignee(m.id)}
                    >
                      <Text style={[styles.assigneeChipText, { color: newAssignee === m.id ? getAvatarColor(m.name) : colors.textMuted }]}>
                        {m.name.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, creating && styles.disabled]}
                onPress={handleCreateTask}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.createText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add Column Modal */}
      <Modal visible={addColVisible} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setAddColVisible(false)}>
          <Pressable onPress={() => {}} style={styles.modal}>
            <Text style={styles.modalTitle}>Add Column</Text>
            <TextInput
              style={styles.input}
              placeholder="Column name *"
              placeholderTextColor={colors.textDim}
              value={newColName}
              onChangeText={setNewColName}
              autoFocus
            />
            <Text style={[styles.colorPickerLabel, { color: colors.textMuted }]}>Color</Text>
            <View style={styles.colorGrid}>
              {PRESET_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: c },
                    newColColor === c && styles.colorSwatchSelected,
                  ]}
                  onPress={() => setNewColColor(c)}
                />
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddColVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, { backgroundColor: newColColor }, addingCol && styles.disabled]}
                onPress={handleAddColumn}
                disabled={addingCol}
              >
                {addingCol ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.createText}>Add Column</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <MembersModal
        visible={membersVisible}
        onClose={() => setMembersVisible(false)}
        projectId={projectId}
        projectOwnerId={projectOwnerId}
      />
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      paddingTop: Platform.OS === 'ios' ? 50 : Platform.OS === 'android' ? 32 : spacing.md,
      backgroundColor: colors.headerBg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    back: { ...typography.body, color: colors.primary },
    projectName: { ...typography.h3, color: colors.text, flex: 1 },
    iconBtn: {
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.border,
      justifyContent: 'center', alignItems: 'center',
    },
    iconBtnText: { fontSize: 15 },
    newTaskBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
    },
    newTaskText: { ...typography.body, color: '#fff', fontWeight: '600' },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    board: { flex: 1 },
    boardContent: { padding: spacing.md, alignItems: 'flex-start' },

    // Insert-between column button
    addColTrigger: {
      width: 28,
      alignSelf: 'stretch',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.border,
    },
    addColTriggerText: {
      fontSize: 20,
      fontWeight: '300',
      lineHeight: 24,
    },

    // Add column at end
    addColEnd: {
      width: 160,
      height: 80,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      marginTop: 0,
    },
    addColEndText: { ...typography.body, fontWeight: '500' },

    // Modals
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modal: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      width: '90%',
      maxWidth: 480,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 8,
    },
    modalTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
    input: {
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
      color: colors.text,
      ...typography.body,
      marginBottom: spacing.sm,
    },
    textArea: { height: 80, textAlignVertical: 'top' },
    colorPickerLabel: {
      ...typography.label,
      textTransform: 'uppercase',
      marginBottom: spacing.sm,
    },
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    colorSwatch: {
      width: 28,
      height: 28,
      borderRadius: 14,
    },
    colorSwatchSelected: {
      borderWidth: 3,
      borderColor: '#fff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 4,
    },
    assigneeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    assigneeChip: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    assigneeChipText: {
      ...typography.label,
      fontWeight: '500',
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    cancelBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelText: { ...typography.body, color: colors.textMuted },
    createBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      minWidth: 80,
      alignItems: 'center',
    },
    createText: { ...typography.body, color: '#fff', fontWeight: '600' },
    disabled: { opacity: 0.6 },

    // Filter bar
    filterBar: {
      flexDirection: 'row',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.headerBg,
    },
    filterChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipText: {
      ...typography.label,
      fontWeight: '600',
    },
  });
}
