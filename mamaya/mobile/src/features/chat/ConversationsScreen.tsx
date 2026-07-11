/**
 * Messages 💬 — mes conversations + annuaire des groupes publics à rejoindre
 * (« Mamans de Paris »…). Rejoindre un groupe l'ajoute à mes conversations.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { COLORS } from '../../lib/theme';
import { chatApi, ConversationSummary, PublicGroup } from './api';

export function ConversationsScreen({
  onOpenConversation,
}: {
  onOpenConversation: (id: string, title: string) => void;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [groups, setGroups] = useState<PublicGroup[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [convs, discover] = await Promise.all([
        chatApi.myConversations(),
        chatApi.discoverGroups(),
      ]);
      setConversations(convs);
      // On ne repropose pas les groupes déjà rejoints
      const mine = new Set(convs.map((c) => c.id));
      setGroups(discover.filter((g) => !mine.has(g.id)));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleJoin = useCallback(
    async (group: PublicGroup) => {
      setJoining(group.id);
      try {
        await chatApi.joinGroup(group.id);
        await load();
        onOpenConversation(group.id, group.title);
      } finally {
        setJoining(null);
      }
    },
    [load, onOpenConversation],
  );

  return (
    <FlatList
      style={styles.container}
      data={conversations}
      keyExtractor={(c) => c.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          onPress={() => onOpenConversation(item.id, titleOf(item))}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>{item.type === 'dm' ? '💬' : '👥'}</Text>
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{titleOf(item)}</Text>
            <Text style={styles.rowSubtitle}>
              {item.type === 'dm' ? 'Message privé' : 'Groupe'}
            </Text>
          </View>
        </Pressable>
      )}
      ListEmptyComponent={
        refreshing ? null : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Pas encore de conversation. Rejoins un groupe ci-dessous pour commencer 💛
            </Text>
          </View>
        )
      }
      ListFooterComponent={
        groups.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Groupes à découvrir ✨</Text>
            {groups.map((g) => (
              <View key={g.id} style={styles.groupRow}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{g.title}</Text>
                  <Text style={styles.rowSubtitle}>
                    {g.memberCount} maman{Number(g.memberCount) > 1 ? 's' : ''}
                    {g.description ? ` · ${g.description}` : ''}
                  </Text>
                </View>
                <Pressable
                  style={styles.joinBtn}
                  onPress={() => handleJoin(g)}
                  disabled={joining === g.id}
                >
                  <Text style={styles.joinBtnText}>
                    {joining === g.id ? '…' : 'Rejoindre'}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null
      }
    />
  );
}

function titleOf(c: ConversationSummary): string {
  return c.title ?? 'Message privé 💬';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgSoft },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginHorizontal: 12,
    marginTop: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.roseSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 20 },
  rowText: { marginLeft: 12, flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
  rowSubtitle: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 14, color: COLORS.gray, textAlign: 'center', lineHeight: 21 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 12,
    marginTop: 10,
  },
  joinBtn: {
    backgroundColor: COLORS.rose,
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
