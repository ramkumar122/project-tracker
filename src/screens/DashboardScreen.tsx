import React, { useState, useEffect, useCallback } from 'react';
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
import { colors, spacing, radius, typography } from '../constants/theme';
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
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

export default function DashboardScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const numColumns = width > 900 ? 3 : width > 560 ? 2 : 1;

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

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
    const { error } = await supabase.from('projects').insert({
      name: name.trim(),
      description: description.trim() || null,
      owner_id: user!.id,
    });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setName('');
      setDescription('');
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

  const renderProject = ({ item }: { item: Project }) => (
    <TouchableOpacity
      style={[styles.card, numColumns > 1 && styles.cardMultiCol]}
      onPress={() =>
        navigation.navigate('Kanban', {
          projectId: item.id,
          projectName: item.name,
        })
      }
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <View style={styles.iconBox}>
          <Text style={styles.iconText}>{item.name.charAt(0).toUpperCase()}</Text>
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
      <Text style={styles.cardDate}>
        {new Date(item.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good {getTimeOfDay()}</Text>
          <Text style={styles.email} numberOfLines={1}>
            {user?.email}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Projects</Text>
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.newBtnText}>+ New Project</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator
            color={colors.primary}
            size="large"
            style={styles.loader}
          />
        ) : projects.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No projects yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first project to get started
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => setModalVisible(true)}
            >
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

const styles = StyleSheet.create({
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
  logoutBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardMultiCol: {
    margin: spacing.xs,
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
    backgroundColor: colors.primary + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    ...typography.h3,
    color: colors.primary,
  },
  deleteX: {
    fontSize: 22,
    color: colors.textDim,
    lineHeight: 22,
  },
  sharedBadge: {
    backgroundColor: colors.primary + '25',
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
