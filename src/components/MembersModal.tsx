import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, typography } from '../constants/theme';

interface Member {
  user_id: string;
  invited_by: string;
  profiles: { full_name: string | null; email: string | null } | null;
}

interface MembersModalProps {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  projectOwnerId: string;
}

export default function MembersModal({
  visible,
  onClose,
  projectId,
  projectOwnerId,
}: MembersModalProps) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const isOwner = user?.id === projectOwnerId;

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase
      .from('project_members')
      .select('user_id, invited_by, profiles(full_name, email)')
      .eq('project_id', projectId);
    setMembers(data || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (visible) fetchMembers();
  }, [visible, fetchMembers]);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setInviting(true);

    // Look up user by email in profiles
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (error || !profile) {
      Alert.alert('Not found', 'No account found with that email address.');
      setInviting(false);
      return;
    }

    if (profile.id === user?.id) {
      Alert.alert('Error', "You can't invite yourself.");
      setInviting(false);
      return;
    }

    const alreadyMember = members.some((m) => m.user_id === profile.id);
    if (alreadyMember) {
      Alert.alert('Already a member', 'This person already has access.');
      setInviting(false);
      return;
    }

    const { error: insertError } = await supabase.from('project_members').insert({
      project_id: projectId,
      user_id: profile.id,
      invited_by: user!.id,
    });

    if (insertError) {
      Alert.alert('Error', insertError.message);
    } else {
      setEmail('');
      fetchMembers();
    }
    setInviting(false);
  };

  const handleRemove = (memberId: string, memberName: string) => {
    Alert.alert('Remove member', `Remove ${memberName || 'this person'} from the project?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await supabase
            .from('project_members')
            .delete()
            .eq('project_id', projectId)
            .eq('user_id', memberId);
          fetchMembers();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.modal}>
          <Text style={styles.title}>Project Members</Text>

          {/* Owner row */}
          <View style={styles.memberRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>O</Text>
            </View>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>You (Owner)</Text>
            </View>
            <View style={styles.ownerBadge}>
              <Text style={styles.ownerBadgeText}>Owner</Text>
            </View>
          </View>

          {/* Member list */}
          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : members.length === 0 ? (
            <Text style={styles.emptyText}>No teammates added yet.</Text>
          ) : (
            <FlatList
              data={members}
              keyExtractor={(item) => item.user_id}
              style={styles.list}
              renderItem={({ item }) => {
                const name = item.profiles?.full_name || item.profiles?.email || 'Unknown';
                const initial = name.charAt(0).toUpperCase();
                const canRemove = isOwner || item.user_id === user?.id;
                return (
                  <View style={styles.memberRow}>
                    <View style={[styles.avatar, styles.memberAvatar]}>
                      <Text style={styles.avatarText}>{initial}</Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {name}
                      </Text>
                      {item.profiles?.email && (
                        <Text style={styles.memberEmail} numberOfLines={1}>
                          {item.profiles.email}
                        </Text>
                      )}
                    </View>
                    {canRemove && (
                      <TouchableOpacity
                        onPress={() => handleRemove(item.user_id, name)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.removeText}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
            />
          )}

          {/* Invite input (owner only) */}
          {isOwner && (
            <View style={styles.inviteSection}>
              <Text style={styles.inviteLabel}>Invite by email</Text>
              <View style={styles.inviteRow}>
                <TextInput
                  style={styles.input}
                  placeholder="teammate@email.com"
                  placeholderTextColor={colors.textDim}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.inviteBtn, inviting && styles.disabled]}
                  onPress={handleInvite}
                  disabled={inviting}
                >
                  {inviting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.inviteBtnText}>Invite</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    maxHeight: '80%',
  },
  title: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  loader: {
    marginVertical: spacing.lg,
  },
  list: {
    maxHeight: 200,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textDim,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '40',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  memberAvatar: {
    backgroundColor: colors.card,
  },
  avatarText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  memberEmail: {
    ...typography.caption,
    color: colors.textMuted,
  },
  ownerBadge: {
    backgroundColor: colors.primary + '25',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  ownerBadgeText: {
    ...typography.label,
    color: colors.primaryLight,
  },
  removeText: {
    ...typography.caption,
    color: colors.error,
  },
  inviteSection: {
    marginTop: spacing.md,
  },
  inviteLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  inviteRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    color: colors.text,
    ...typography.body,
  },
  inviteBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    justifyContent: 'center',
    minWidth: 70,
    alignItems: 'center',
  },
  inviteBtnText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
  doneBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  doneBtnText: {
    ...typography.body,
    color: colors.textMuted,
  },
});
