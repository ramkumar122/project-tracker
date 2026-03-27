import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { spacing, radius, typography } from '../constants/theme';
import { getAvatarColor } from '../utils/avatarColor';
import { RootStackParamList } from '../types/navigation';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'TaskDetail'>;
  route: RouteProp<RootStackParamList, 'TaskDetail'>;
};

interface TeamMember {
  id: string;
  name: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  project_id: string;
  created_at: string;
  assigned_to?: string | null;
  assignee_name?: string | null;
}

interface ColumnInfo {
  name: string;
  color: string;
}

interface Subtask {
  id: string;
  title: string;
  status: 'todo' | 'inprogress' | 'done';
  created_by: string;
  created_at: string;
}

interface Note {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  profiles: { full_name: string | null } | null;
}

const SUBTASK_NEXT: Record<string, 'todo' | 'inprogress' | 'done'> = {
  todo: 'inprogress',
  inprogress: 'done',
  done: 'todo',
};

const SUBTASK_CONFIG = {
  todo:       { icon: '○', label: 'To Do' },
  inprogress: { icon: '●', label: 'In Progress' },
  done:       { icon: '✓', label: 'Done' },
};

export default function TaskDetailScreen({ navigation, route }: Props) {
  const { taskId, projectId } = route.params;
  const { user } = useAuth();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width > 768;

  const [task, setTask] = useState<Task | null>(null);
  const [columnInfo, setColumnInfo] = useState<ColumnInfo | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [assigneePickerVisible, setAssigneePickerVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  const getSubtaskColor = (status: Subtask['status']) => {
    if (status === 'inprogress') return '#60a5fa';
    if (status === 'done') return colors.success;
    return colors.textDim;
  };

  // ─── Fetchers ────────────────────────────────────────────────────────────────

  const fetchTask = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();
    if (data) {
      if (data.assigned_to) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.assigned_to)
          .single();
        setTask({ ...data, assignee_name: profile?.full_name || 'Unknown' });
      } else {
        setTask({ ...data, assignee_name: null });
      }
    }
    return data;
  }, [taskId]);

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

  const fetchColumnInfo = useCallback(async (task: Task) => {
    const { data } = await supabase
      .from('project_columns')
      .select('name, color')
      .eq('project_id', task.project_id)
      .eq('slug', task.status)
      .single();
    if (data) setColumnInfo(data);
  }, []);

  const fetchSubtasks = useCallback(async () => {
    const { data } = await supabase
      .from('subtasks')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });
    if (data) setSubtasks(data);
  }, [taskId]);

  const fetchNotes = useCallback(async () => {
    const { data } = await supabase
      .from('notes')
      .select('*, profiles(full_name)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });
    if (data) setNotes(data);
  }, [taskId]);

  useEffect(() => {
    const init = async () => {
      const [taskData] = await Promise.all([fetchTask(), fetchSubtasks(), fetchNotes(), fetchTeamMembers()]);
      if (taskData) await fetchColumnInfo(taskData);
      setLoading(false);
    };
    init();

    const notesChannel = supabase
      .channel(`notes-${taskId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notes', filter: `task_id=eq.${taskId}` },
        (payload) => {
          supabase
            .from('notes')
            .select('*, profiles(full_name)')
            .eq('id', (payload.new as Note).id)
            .single()
            .then(({ data }) => {
              if (data) {
                setNotes((prev) => [...prev, data]);
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
              }
            });
        }
      )
      .subscribe();

    const subtasksChannel = supabase
      .channel(`subtasks-${taskId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subtasks', filter: `task_id=eq.${taskId}` },
        fetchSubtasks
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notesChannel);
      supabase.removeChannel(subtasksChannel);
    };
  }, [taskId, fetchTask, fetchSubtasks, fetchNotes, fetchColumnInfo, fetchTeamMembers]);

  // Re-fetch column info when task status changes
  useEffect(() => {
    if (task) fetchColumnInfo(task);
  }, [task?.status]);

  // ─── Actions ──────────────────────────────────────────────────────────────────

  const handleAddSubtask = async () => {
    if (!newSubtask.trim()) return;
    setAddingSubtask(true);
    const { error } = await supabase.from('subtasks').insert({
      task_id: taskId,
      title: newSubtask.trim(),
      status: 'todo',
      created_by: user!.id,
    });
    if (error) Alert.alert('Error', error.message);
    else { setNewSubtask(''); fetchSubtasks(); }
    setAddingSubtask(false);
  };

  const handleCycleStatus = async (subtask: Subtask) => {
    const next = SUBTASK_NEXT[subtask.status];
    setSubtasks((prev) =>
      prev.map((s) => (s.id === subtask.id ? { ...s, status: next } : s))
    );
    const { error } = await supabase
      .from('subtasks')
      .update({ status: next })
      .eq('id', subtask.id);
    if (error) {
      setSubtasks((prev) =>
        prev.map((s) => (s.id === subtask.id ? { ...s, status: subtask.status } : s))
      );
    }
  };

  const handleDeleteSubtask = (subtask: Subtask) => {
    const doDelete = async () => {
      setSubtasks((prev) => prev.filter((s) => s.id !== subtask.id));
      await supabase.from('subtasks').delete().eq('id', subtask.id);
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${subtask.title}"?`)) doDelete();
    } else {
      Alert.alert('Delete Subtask', `Delete "${subtask.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleSend = async () => {
    if (!newNote.trim()) return;
    setSending(true);
    const { error } = await supabase.from('notes').insert({
      task_id: taskId,
      author_id: user!.id,
      content: newNote.trim(),
    });
    if (error) Alert.alert('Error', error.message);
    else setNewNote('');
    setSending(false);
  };

  const handleAssign = async (userId: string | null, userName?: string) => {
    await supabase.from('tasks').update({ assigned_to: userId }).eq('id', taskId);
    setTask((prev) => prev ? { ...prev, assigned_to: userId, assignee_name: userName || null } : null);
  };

  const doneCount = subtasks.filter((s) => s.status === 'done').length;

  // ─── Shared pieces ───────────────────────────────────────────────────────────

  const TaskInfoPanel = (
    <ScrollView
      style={styles.leftScroll}
      contentContainerStyle={styles.leftContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Task Card */}
      <View style={styles.taskCard}>
        <Text style={styles.taskTitle}>{task?.title}</Text>

        {columnInfo && (
          <View style={[styles.badge, { borderColor: columnInfo.color, backgroundColor: columnInfo.color + '15' }]}>
            <View style={[styles.badgeDot, { backgroundColor: columnInfo.color }]} />
            <Text style={[styles.badgeText, { color: columnInfo.color }]}>
              {columnInfo.name}
            </Text>
          </View>
        )}

        {task?.description ? (
          <Text style={styles.desc}>{task.description}</Text>
        ) : null}

        <Text style={styles.createdAt}>
          Created{' '}
          {new Date(task?.created_at || '').toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
          })}
        </Text>

        <View style={styles.assignedSection}>
          <Text style={styles.assignedLabel}>Assigned to</Text>
          {task?.assignee_name ? (
            <View style={[styles.assigneePill, { backgroundColor: getAvatarColor(task.assignee_name) + '18', borderColor: getAvatarColor(task.assignee_name) + '50' }]}>
              <View style={[styles.assigneeAvatar, { backgroundColor: getAvatarColor(task.assignee_name) }]}>
                <Text style={styles.assigneeInitial}>
                  {task.assignee_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.assigneeName, { color: getAvatarColor(task.assignee_name) }]}>{task.assignee_name}</Text>
              <TouchableOpacity
                onPress={() => { handleAssign(null); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[styles.unassignBtn, { backgroundColor: getAvatarColor(task.assignee_name) + '25' }]}
              >
                <Text style={[styles.unassignX, { color: getAvatarColor(task.assignee_name) }]}>×</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.assignPlaceholder, { borderColor: colors.border }]}
              onPress={() => setAssigneePickerVisible(true)}
            >
              <Text style={[styles.assignPlaceholderText, { color: colors.textDim }]}>+ Assign to someone</Text>
            </TouchableOpacity>
          )}
          {task?.assignee_name && (
            <TouchableOpacity onPress={() => setAssigneePickerVisible(true)}>
              <Text style={[styles.changeAssignee, { color: colors.primary }]}>Change</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Subtasks */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Subtasks</Text>
        {subtasks.length > 0 && (
          <Text style={styles.sectionCount}>{doneCount}/{subtasks.length} done</Text>
        )}
      </View>

      {subtasks.length > 0 && (
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(doneCount / subtasks.length) * 100}%` as any },
            ]}
          />
        </View>
      )}

      <View style={styles.subtaskList}>
        {subtasks.map((subtask) => {
          const statusColor = getSubtaskColor(subtask.status);
          const { icon, label } = SUBTASK_CONFIG[subtask.status];
          return (
            <View key={subtask.id} style={styles.subtaskRow}>
              <TouchableOpacity
                onPress={() => handleCycleStatus(subtask)}
                style={[styles.statusBtn, { borderColor: statusColor }]}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={[styles.statusIcon, { color: statusColor }]}>{icon}</Text>
              </TouchableOpacity>
              <View style={styles.subtaskInfo}>
                <Text
                  style={[
                    styles.subtaskTitle,
                    subtask.status === 'done' && styles.subtaskDoneText,
                  ]}
                  numberOfLines={2}
                >
                  {subtask.title}
                </Text>
                <Text style={[styles.subtaskStatusLabel, { color: statusColor }]}>{label}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleDeleteSubtask(subtask)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.deleteIcon}>✕</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <View style={styles.addSubtaskRow}>
          <TextInput
            style={styles.addSubtaskInput}
            placeholder="+ Add subtask..."
            placeholderTextColor={colors.textDim}
            value={newSubtask}
            onChangeText={setNewSubtask}
            onSubmitEditing={handleAddSubtask}
            returnKeyType="done"
          />
          {newSubtask.trim().length > 0 && (
            <TouchableOpacity
              style={[styles.addBtn, addingSubtask && styles.disabled]}
              onPress={handleAddSubtask}
              disabled={addingSubtask}
            >
              {addingSubtask ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.addBtnText}>Add</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
  );

  const NotesPanel = (
    <>
      <ScrollView
        ref={scrollRef}
        style={styles.notesScroll}
        contentContainerStyle={styles.notesContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.notesHeading}>Notes</Text>
        {notes.length === 0 ? (
          <Text style={styles.noNotes}>No notes yet. Start the conversation.</Text>
        ) : (
          notes.map((note) => (
            <View
              key={note.id}
              style={[styles.noteItem, note.author_id === user?.id && styles.ownNote]}
            >
              <View style={styles.noteHeader}>
                <Text style={styles.noteAuthor}>
                  {note.author_id === user?.id ? 'You' : note.profiles?.full_name || 'Teammate'}
                </Text>
                <Text style={styles.noteTime}>
                  {new Date(note.created_at).toLocaleTimeString('en-US', {
                    hour: '2-digit', minute: '2-digit',
                  })}{' '}· {new Date(note.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric',
                  })}
                </Text>
              </View>
              <Text style={styles.noteContent}>{note.content}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Note input */}
      <View style={[styles.inputRow, isWide && styles.inputRowRight]}>
        <TextInput
          style={styles.noteInput}
          placeholder="Add a note..."
          placeholderTextColor={colors.textDim}
          value={newNote}
          onChangeText={setNewNote}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!newNote.trim() || sending) && styles.disabled]}
          onPress={handleSend}
          disabled={!newNote.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendIcon}>→</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );

  // ─── Layout ───────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {task?.title || 'Task'}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} size="large" style={styles.loader} />
      ) : isWide ? (
        /* ── Wide: side-by-side ── */
        <View style={styles.wideLayout}>
          <View style={styles.leftPanel}>{TaskInfoPanel}</View>
          <View style={[styles.rightPanel, { borderLeftColor: colors.border }]}>
            {NotesPanel}
          </View>
        </View>
      ) : (
        /* ── Narrow: stacked ── */
        <>
          <ScrollView
            ref={scrollRef}
            style={styles.leftScroll}
            contentContainerStyle={styles.narrowContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Reuse task info & subtasks inline, then notes below */}
            <View style={styles.taskCard}>
              <Text style={styles.taskTitle}>{task?.title}</Text>
              {columnInfo && (
                <View style={[styles.badge, { borderColor: columnInfo.color, backgroundColor: columnInfo.color + '15' }]}>
                  <View style={[styles.badgeDot, { backgroundColor: columnInfo.color }]} />
                  <Text style={[styles.badgeText, { color: columnInfo.color }]}>{columnInfo.name}</Text>
                </View>
              )}
              {task?.description ? <Text style={styles.desc}>{task.description}</Text> : null}
              <Text style={styles.createdAt}>
                Created{' '}
                {new Date(task?.created_at || '').toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                })}
              </Text>
              <View style={styles.assignedSection}>
                <Text style={styles.assignedLabel}>Assigned to</Text>
                {task?.assignee_name ? (
                  <View style={[styles.assigneePill, { backgroundColor: getAvatarColor(task.assignee_name) + '18', borderColor: getAvatarColor(task.assignee_name) + '50' }]}>
                    <View style={[styles.assigneeAvatar, { backgroundColor: getAvatarColor(task.assignee_name) }]}>
                      <Text style={styles.assigneeInitial}>
                        {task.assignee_name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.assigneeName, { color: getAvatarColor(task.assignee_name) }]}>{task.assignee_name}</Text>
                    <TouchableOpacity
                      onPress={() => handleAssign(null)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={[styles.unassignBtn, { backgroundColor: getAvatarColor(task.assignee_name) + '25' }]}
                    >
                      <Text style={[styles.unassignX, { color: getAvatarColor(task.assignee_name) }]}>×</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.assignPlaceholder, { borderColor: colors.border }]}
                    onPress={() => setAssigneePickerVisible(true)}
                  >
                    <Text style={[styles.assignPlaceholderText, { color: colors.textDim }]}>+ Assign to someone</Text>
                  </TouchableOpacity>
                )}
                {task?.assignee_name && (
                  <TouchableOpacity onPress={() => setAssigneePickerVisible(true)}>
                    <Text style={[styles.changeAssignee, { color: colors.primary }]}>Change</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Subtasks</Text>
              {subtasks.length > 0 && (
                <Text style={styles.sectionCount}>{doneCount}/{subtasks.length} done</Text>
              )}
            </View>
            {subtasks.length > 0 && (
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${(doneCount / subtasks.length) * 100}%` as any }]} />
              </View>
            )}
            <View style={[styles.subtaskList, { marginBottom: spacing.lg }]}>
              {subtasks.map((subtask) => {
                const statusColor = getSubtaskColor(subtask.status);
                const { icon, label } = SUBTASK_CONFIG[subtask.status];
                return (
                  <View key={subtask.id} style={styles.subtaskRow}>
                    <TouchableOpacity
                      onPress={() => handleCycleStatus(subtask)}
                      style={[styles.statusBtn, { borderColor: statusColor }]}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={[styles.statusIcon, { color: statusColor }]}>{icon}</Text>
                    </TouchableOpacity>
                    <View style={styles.subtaskInfo}>
                      <Text style={[styles.subtaskTitle, subtask.status === 'done' && styles.subtaskDoneText]} numberOfLines={2}>
                        {subtask.title}
                      </Text>
                      <Text style={[styles.subtaskStatusLabel, { color: statusColor }]}>{label}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteSubtask(subtask)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.deleteIcon}>✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
              <View style={styles.addSubtaskRow}>
                <TextInput
                  style={styles.addSubtaskInput}
                  placeholder="+ Add subtask..."
                  placeholderTextColor={colors.textDim}
                  value={newSubtask}
                  onChangeText={setNewSubtask}
                  onSubmitEditing={handleAddSubtask}
                  returnKeyType="done"
                />
                {newSubtask.trim().length > 0 && (
                  <TouchableOpacity
                    style={[styles.addBtn, addingSubtask && styles.disabled]}
                    onPress={handleAddSubtask}
                    disabled={addingSubtask}
                  >
                    {addingSubtask ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.addBtnText}>Add</Text>}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Notes inline (narrow) */}
            <Text style={styles.notesHeading}>Notes</Text>
            {notes.length === 0 ? (
              <Text style={styles.noNotes}>No notes yet. Start the conversation.</Text>
            ) : (
              notes.map((note) => (
                <View key={note.id} style={[styles.noteItem, note.author_id === user?.id && styles.ownNote]}>
                  <View style={styles.noteHeader}>
                    <Text style={styles.noteAuthor}>
                      {note.author_id === user?.id ? 'You' : note.profiles?.full_name || 'Teammate'}
                    </Text>
                    <Text style={styles.noteTime}>
                      {new Date(note.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}{' '}
                      · {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <Text style={styles.noteContent}>{note.content}</Text>
                </View>
              ))
            )}
          </ScrollView>

          {/* Note input pinned at bottom (narrow) */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.noteInput}
              placeholder="Add a note..."
              placeholderTextColor={colors.textDim}
              value={newNote}
              onChangeText={setNewNote}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!newNote.trim() || sending) && styles.disabled]}
              onPress={handleSend}
              disabled={!newNote.trim() || sending}
            >
              {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendIcon}>→</Text>}
            </TouchableOpacity>
          </View>
        </>
      )}
      {/* Assignee Picker Modal */}
      <Modal visible={assigneePickerVisible} transparent animationType="fade">
        <Pressable style={styles.pickerOverlay} onPress={() => setAssigneePickerVisible(false)}>
          <Pressable
            onPress={() => {}}
            style={[styles.pickerPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.pickerTitle, { color: colors.text }]}>Assign to</Text>
            <TouchableOpacity
              style={styles.pickerRow}
              onPress={() => { handleAssign(null); setAssigneePickerVisible(false); }}
            >
              <Text style={[styles.pickerRowText, { color: colors.textMuted }]}>Unassigned</Text>
            </TouchableOpacity>
            {teamMembers.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={styles.pickerRow}
                onPress={() => { handleAssign(m.id, m.name); setAssigneePickerVisible(false); }}
              >
                <View style={[styles.pickerAvatar, { backgroundColor: getAvatarColor(m.name) + '30' }]}>
                  <Text style={[styles.pickerInitial, { color: getAvatarColor(m.name) }]}>
                    {m.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.pickerRowText, { color: colors.text }]}>{m.name}</Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
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
    },
    back: { ...typography.body, color: colors.primary, marginRight: spacing.md },
    headerTitle: { ...typography.h3, color: colors.text, flex: 1 },
    loader: { flex: 1 },

    // Wide layout
    wideLayout: {
      flex: 1,
      flexDirection: 'row',
    },
    leftPanel: {
      flex: 1,
    },
    rightPanel: {
      width: 380,
      borderLeftWidth: 1,
      flexDirection: 'column',
    },

    // Scroll containers
    leftScroll: { flex: 1 },
    leftContent: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
      maxWidth: 680,
      alignSelf: 'center',
      width: '100%',
    },
    narrowContent: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
      maxWidth: 720,
      alignSelf: 'center',
      width: '100%',
    },
    notesScroll: { flex: 1 },
    notesContent: {
      padding: spacing.lg,
      paddingBottom: spacing.md,
    },

    // Task card
    taskCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    taskTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      marginBottom: spacing.sm,
    },
    badgeDot: { width: 6, height: 6, borderRadius: 3, marginRight: spacing.xs },
    badgeText: { ...typography.label, fontWeight: '600' },
    desc: { ...typography.body, color: colors.textMuted, marginBottom: spacing.sm, lineHeight: 22 },
    createdAt: { ...typography.caption, color: colors.textDim },

    // Subtasks
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    sectionTitle: { ...typography.h3, color: colors.text },
    sectionCount: { ...typography.caption, color: colors.textDim },
    progressBar: {
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: colors.success, borderRadius: 2 },
    subtaskList: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    subtaskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    statusBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1.5,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    statusIcon: { fontSize: 13, fontWeight: '700', lineHeight: 16 },
    subtaskInfo: { flex: 1 },
    subtaskTitle: { ...typography.body, color: colors.text, lineHeight: 20 },
    subtaskDoneText: { color: colors.textDim, textDecorationLine: 'line-through' },
    subtaskStatusLabel: { ...typography.label, marginTop: 1, fontWeight: '500' },
    deleteIcon: { color: colors.textDim, fontSize: 12, paddingHorizontal: spacing.xs },
    addSubtaskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    addSubtaskInput: { flex: 1, ...typography.body, color: colors.text, paddingVertical: spacing.xs },
    addBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.md,
      minWidth: 48,
      alignItems: 'center',
    },
    addBtnText: { ...typography.label, color: '#fff', fontWeight: '600' },

    // Notes
    notesHeading: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
    noNotes: { ...typography.body, color: colors.textDim, textAlign: 'center', paddingVertical: spacing.xl },
    noteItem: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    ownNote: { borderColor: colors.primary + '50', backgroundColor: colors.primary + '10' },
    noteHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    noteAuthor: { ...typography.label, color: colors.primaryLight, fontWeight: '600' },
    noteTime: { ...typography.label, color: colors.textDim },
    noteContent: { ...typography.body, color: colors.text, lineHeight: 22 },

    // Note input
    inputRow: {
      flexDirection: 'row',
      padding: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.headerBg,
      gap: spacing.sm,
      alignItems: 'flex-end',
    },
    inputRowRight: {
      // Same styles, applied when in right panel on wide screens
    },
    noteInput: {
      flex: 1,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.text,
      ...typography.body,
      maxHeight: 100,
    },
    sendBtn: {
      backgroundColor: colors.primary,
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
    disabled: { opacity: 0.4 },

    // Assigned to
    assignedSection: {
      marginTop: spacing.md,
      gap: spacing.xs,
    },
    assignedLabel: {
      ...typography.label,
      color: colors.textDim,
      textTransform: 'uppercase',
      fontWeight: '600',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    assigneePill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderRadius: radius.full,
      paddingVertical: 5,
      paddingLeft: 5,
      paddingRight: spacing.sm,
      gap: spacing.xs,
    },
    assigneeAvatar: {
      width: 26,
      height: 26,
      borderRadius: 13,
      justifyContent: 'center',
      alignItems: 'center',
    },
    assigneeInitial: { fontSize: 11, fontWeight: '700', color: '#fff' },
    assigneeName: { ...typography.body, fontWeight: '600' },
    unassignBtn: {
      width: 20,
      height: 20,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 2,
    },
    unassignX: { fontSize: 15, fontWeight: '700', lineHeight: 18 },
    assignPlaceholder: {
      alignSelf: 'flex-start',
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
    },
    assignPlaceholderText: { ...typography.label, fontWeight: '500' },
    changeAssignee: {
      ...typography.label,
      fontWeight: '600',
      marginTop: 2,
    },
    assigneeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    unassigned: { ...typography.body, fontStyle: 'italic' },

    // Assignee picker modal
    pickerOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    pickerPanel: {
      borderRadius: radius.xl,
      padding: spacing.lg,
      width: '100%',
      maxWidth: 360,
      borderWidth: 1,
    },
    pickerTitle: {
      ...typography.h3,
      marginBottom: spacing.md,
    },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    pickerAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pickerInitial: { fontSize: 12, fontWeight: '700' },
    pickerRowText: { ...typography.body },
  });
}
