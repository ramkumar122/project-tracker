import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
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
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { spacing, radius, typography } from '../constants/theme';
import { getDueDateInfo } from '../utils/dueDate';
import { RootStackParamList } from '../types/navigation';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'Dashboard'>;
};

interface Project {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  due_date?: string | null;
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

// Project accent colors — cycle through for visual variety
const PROJECT_ACCENTS = ['#f43f5e', '#f59e0b', '#8b5cf6', '#10b981', '#6366f1', '#06b6d4'];

export default function DashboardScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { width } = useWindowDimensions();
  const numColumns = width > 900 ? 3 : width > 560 ? 2 : 1;

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [creating, setCreating] = useState(false);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  const fetchProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) Alert.alert('Error', error.message);
    else setProjects(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);

    const parsedDue = dueDate.trim() ? new Date(dueDate.trim()) : null;
    const dueDateValue =
      parsedDue && !isNaN(parsedDue.getTime()) ? dueDate.trim() : null;

    const { error } = await supabase.from('projects').insert({
      name: name.trim(),
      description: description.trim() || null,
      owner_id: user!.id,
      due_date: dueDateValue,
    });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setName('');
      setDescription('');
      setDueDate('');
      setModalVisible(false);
      fetchProjects();
    }
    setCreating(false);
  };

  const handleDelete = (projectId: string) => {
    Alert.alert('Delete Project', 'This will also delete all tasks and notes. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('projects').delete().eq('id', projectId);
          setProjects((prev) => prev.filter((p) => p.id !== projectId));
        },
      },
    ]);
  };

  const renderProject = ({ item, index }: { item: Project; index: number }) => {
    const accent = PROJECT_ACCENTS[index % PROJECT_ACCENTS.length];
    const dueInfo = getDueDateInfo(item.due_date, colors);

    return (
      <TouchableOpacity
        style={[styles.card, numColumns > 1 && styles.cardMultiCol]}
        onPress={() =>
          navigation.navigate('Kanban', { projectId: item.id, projectName: item.name })
        }
        activeOpacity={0.8}
      >
        {/* Colored top accent bar */}
        <View style={[styles.cardAccent, { backgroundColor: accent }]} />

        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: accent + '22' }]}>
              <Text style={[styles.iconText, { color: accent }]}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            {item.owner_id === user?.id ? (
              <TouchableOpacity
                onPress={() => handleDelete(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.deleteX}>×</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.sharedBadge}>
                <Text style={styles.sharedBadgeText}>Shared</Text>
              </View>
            )}
          </View>

          <Text style={styles.cardName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.description ? (
            <Text style={styles.cardDesc} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}

          <View style={styles.cardFooter}>
            {dueInfo ? (
              <Text style={[styles.dueDateText, { color: dueInfo.color }]}>
                {dueInfo.status === 'overdue' ? '⚠ ' : '📅 '}{dueInfo.label}
              </Text>
            ) : (
              <Text style={styles.cardDate}>
                {new Date(item.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good {getTimeOfDay()} 👋</Text>
          <Text style={styles.email} numberOfLines={1}>
            {user?.email}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={toggleTheme}>
            <Text style={styles.iconBtnText}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Projects</Text>
          <TouchableOpacity style={styles.newBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.newBtnText}>+ New Project</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} size="large" style={styles.loader} />
        ) : projects.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No projects yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first project to get started
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setModalVisible(true)}>
              <Text style={styles.emptyBtnText}>Create Project</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={projects}
            renderItem={renderProject}
            keyExtractor={(item) => item.id}
            numColumns={numColumns}
            key={numColumns}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <Modal visible={modalVisible} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)}>
          <Pressable onPress={() => {}} style={styles.modal}>
            <Text style={styles.modalTitle}>New Project</Text>
            <TextInput
              style={styles.input}
              placeholder="Project name *"
              placeholderTextColor={colors.textDim}
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description (optional)"
              placeholderTextColor={colors.textDim}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
            <TextInput
              style={styles.input}
              placeholder="Due date (YYYY-MM-DD, optional)"
              placeholderTextColor={colors.textDim}
              value={dueDate}
              onChangeText={setDueDate}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, creating && styles.disabled]}
                onPress={handleCreate}
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
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      paddingTop: Platform.OS === 'ios' ? 50 : Platform.OS === 'android' ? 32 : spacing.md,
      backgroundColor: colors.headerBg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    greeting: {
      ...typography.h2,
      color: colors.text,
    },
    email: {
      ...typography.caption,
      color: colors.textMuted,
      maxWidth: 220,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconBtnText: {
      fontSize: 16,
    },
    logoutBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    logoutText: {
      ...typography.body,
      color: colors.textMuted,
    },
    body: {
      flex: 1,
      padding: spacing.lg,
    },
    sectionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      ...typography.h2,
      color: colors.text,
    },
    newBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 3,
    },
    newBtnText: {
      ...typography.body,
      color: '#fff',
      fontWeight: '600',
    },
    loader: {
      marginTop: spacing.xxl,
    },
    list: {
      paddingBottom: spacing.xl,
      gap: spacing.md,
    },
    card: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    cardMultiCol: {
      margin: spacing.xs,
    },
    cardAccent: {
      height: 4,
    },
    cardBody: {
      padding: spacing.lg,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.md,
    },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconText: {
      ...typography.h3,
    },
    deleteX: {
      fontSize: 22,
      color: colors.textDim,
      lineHeight: 22,
    },
    sharedBadge: {
      backgroundColor: colors.primary + '20',
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.full,
    },
    sharedBadgeText: {
      ...typography.label,
      color: colors.primaryLight,
    },
    cardName: {
      ...typography.h3,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    cardDesc: {
      ...typography.caption,
      color: colors.textMuted,
      marginBottom: spacing.sm,
      lineHeight: 18,
    },
    cardFooter: {
      marginTop: spacing.xs,
    },
    dueDateText: {
      ...typography.label,
      fontWeight: '500',
    },
    cardDate: {
      ...typography.label,
      color: colors.textDim,
    },
    empty: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyTitle: {
      ...typography.h3,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    emptySubtitle: {
      ...typography.body,
      color: colors.textMuted,
      marginBottom: spacing.lg,
      textAlign: 'center',
    },
    emptyBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
    },
    emptyBtnText: {
      ...typography.body,
      color: '#fff',
      fontWeight: '600',
    },
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
    modalTitle: {
      ...typography.h3,
      color: colors.text,
      marginBottom: spacing.md,
    },
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
}
