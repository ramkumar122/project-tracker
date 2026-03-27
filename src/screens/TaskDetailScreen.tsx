import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, typography, columnConfig } from '../constants/theme';
import { RootStackParamList } from '../types/navigation';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'TaskDetail'>;
  route: RouteProp<RootStackParamList, 'TaskDetail'>;
};

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
}

interface Note {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  profiles: { full_name: string | null } | null;
}

export default function TaskDetailScreen({ navigation, route }: Props) {
  const { taskId } = route.params;
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const fetchTask = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();
    if (data) setTask(data);
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
    Promise.all([fetchTask(), fetchNotes()]).then(() => setLoading(false));

    const channel = supabase
      .channel(`notes-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notes',
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          supabase
            .from('notes')
            .select('*, profiles(full_name)')
            .eq('id', (payload.new as Note).id)
            .single()
            .then(({ data }) => {
              if (data) {
                setNotes((prev) => [...prev, data]);
                setTimeout(
                  () => scrollRef.current?.scrollToEnd({ animated: true }),
                  100
                );
              }
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId, fetchTask, fetchNotes]);

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

  const colCfg = task
    ? columnConfig[task.status as keyof typeof columnConfig]
    : null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
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
        <ActivityIndicator
          color={colors.primary}
          size="large"
          style={styles.loader}
        />
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.taskCard}>
              <Text style={styles.taskTitle}>{task?.title}</Text>

              {colCfg && (
                <View style={[styles.badge, { borderColor: colCfg.color }]}>
                  <View style={[styles.badgeDot, { backgroundColor: colCfg.color }]} />
                  <Text style={[styles.badgeText, { color: colCfg.color }]}>
                    {colCfg.label}
                  </Text>
                </View>
              )}

              {task?.description ? (
                <Text style={styles.desc}>{task.description}</Text>
              ) : null}

              <Text style={styles.createdAt}>
                Created{' '}
                {new Date(task?.created_at || '').toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </View>

            <Text style={styles.notesHeading}>Notes</Text>

            {notes.length === 0 ? (
              <Text style={styles.noNotes}>
                No notes yet. Start the conversation.
              </Text>
            ) : (
              notes.map((note) => (
                <View
                  key={note.id}
                  style={[
                    styles.noteItem,
                    note.author_id === user?.id && styles.ownNote,
                  ]}
                >
                  <View style={styles.noteHeader}>
                    <Text style={styles.noteAuthor}>
                      {note.author_id === user?.id
                        ? 'You'
                        : note.profiles?.full_name || 'Teammate'}
                    </Text>
                    <Text style={styles.noteTime}>
                      {new Date(note.created_at).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      ·{' '}
                      {new Date(note.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                  <Text style={styles.noteContent}>{note.content}</Text>
                </View>
              ))
            )}
          </ScrollView>

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
              style={[
                styles.sendBtn,
                (!newNote.trim() || sending) && styles.disabled,
              ]}
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
      )}
    </KeyboardAvoidingView>
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
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
  },
  loader: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
  },
  taskCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  taskTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
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
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  badgeText: {
    ...typography.label,
    fontWeight: '500',
  },
  desc: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    lineHeight: 22,
  },
  createdAt: {
    ...typography.caption,
    color: colors.textDim,
  },
  notesHeading: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  noNotes: {
    ...typography.body,
    color: colors.textDim,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  noteItem: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ownNote: {
    borderColor: colors.primary + '50',
    backgroundColor: colors.primary + '12',
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  noteAuthor: {
    ...typography.label,
    color: colors.primaryLight,
    fontWeight: '600',
  },
  noteTime: {
    ...typography.label,
    color: colors.textDim,
  },
  noteContent: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  inputRow: {
    flexDirection: 'row',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  noteInput: {
    flex: 1,
    backgroundColor: colors.surface,
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
  sendIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.4,
  },
});
