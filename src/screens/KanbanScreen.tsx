import React, { useState, useEffect, useCallback } from 'react';
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
import { colors, spacing, radius, typography } from '../constants/theme';
import KanbanColumn from '../components/KanbanColumn';
import { Task } from '../components/TaskCard';
import MembersModal from '../components/MembersModal';
import { RootStackParamList } from '../types/navigation';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'Kanban'>;
  route: RouteProp<RootStackParamList, 'Kanban'>;
};

const COLUMNS = ['todo', 'inprogress', 'onhold', 'done'];
const HEADER_HEIGHT = Platform.OS === 'ios' ? 100 : Platform.OS === 'android' ? 80 : 64;

export default function KanbanScreen({ navigation, route }: Props) {
  const { projectId, projectName } = route.params;
  const { user } = useAuth();
  const { height } = useWindowDimensions();
  const columnHeight = height - HEADER_HEIGHT - spacing.md * 2;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectOwnerId, setProjectOwnerId] = useState('');
  const [membersVisible, setMembersVisible] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColumn, setNewColumn] = useState('todo');
  const [creating, setCreating] = useState(false);

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('order', { ascending: true });

    if (error) { Alert.alert('Error', error.message); setLoading(false); return; }

    const tasks = data || [];
    const creatorIds = [...new Set(tasks.map((t) => t.created_by))];
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', creatorIds);
      const map = new Map(profiles?.map((p) => [p.id, p.full_name]) || []);
      setTasks(tasks.map((t) => ({ ...t, creator_name: map.get(t.created_by) || 'Unknown' })));
    } else {
      setTasks(tasks);
    }
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

  useEffect(() => {
    fetchTasks();
    fetchProjectOwner();

    const channel = supabase
      .channel(`tasks-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${projectId}`,
        },
        fetchTasks
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, fetchTasks]);

  const handleCreateTask = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);

    const maxOrder = tasks.filter((t) => t.status === newColumn).length;

    const { error } = await supabase.from('tasks').insert({
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      status: newColumn,
      order: maxOrder,
      project_id: projectId,
      created_by: user!.id,
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setNewTitle('');
      setNewDesc('');
      setCreateVisible(false);
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

  const openCreate = (col: string) => {
    setNewColumn(col);
    setCreateVisible(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.projectName} numberOfLines={1}>
          {projectName}
        </Text>
        <TouchableOpacity style={styles.membersBtn} onPress={() => setMembersVisible(true)}>
          <Text style={styles.membersBtnText}>👥 Members</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.newTaskBtn} onPress={() => openCreate('todo')}>
          <Text style={styles.newTaskText}>+ New Task</Text>
        </TouchableOpacity>
      </View>

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
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col}
              column={col}
              tasks={tasks.filter((t) => t.status === col)}
              height={columnHeight}
              onCreateTask={openCreate}
              onMoveTask={handleMoveTask}
              onDeleteTask={handleDeleteTask}
              onOpenTask={(task) =>
                navigation.navigate('TaskDetail', {
                  taskId: task.id,
                  taskTitle: task.title,
                })
              }
            />
          ))}
        </ScrollView>
      )}

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
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setCreateVisible(false)}
              >
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

      <MembersModal
        visible={membersVisible}
        onClose={() => setMembersVisible(false)}
        projectId={projectId}
        projectOwnerId={projectOwnerId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 50 : Platform.OS === 'android' ? 32 : spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: {
    ...typography.body,
    color: colors.primary,
    marginRight: spacing.md,
  },
  projectName: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
  },
  membersBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  membersBtnText: {
    ...typography.body,
    color: colors.textMuted,
  },
  newTaskBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  newTaskText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  board: {
    flex: 1,
  },
  boardContent: {
    padding: spacing.md,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '90%',
    maxWidth: 480,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    ...typography.body,
    marginBottom: spacing.sm,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
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
  cancelText: {
    ...typography.body,
    color: colors.textMuted,
  },
  createBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    minWidth: 80,
    alignItems: 'center',
  },
  createText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
});
