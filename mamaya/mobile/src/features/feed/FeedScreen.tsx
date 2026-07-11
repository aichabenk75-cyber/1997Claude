/**
 * Fil d'actualité 💛 — deux modes (Pour toi / Récent), pagination par curseur,
 * like optimiste avec rollback, composer accessible par le bouton flottant.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { COLORS } from '../../lib/theme';
import { FeedItem, FeedMode, feedApi } from './api';

export function FeedScreen({ onCompose }: { onCompose: () => void }) {
  const [mode, setMode] = useState<FeedMode>('algo');
  const [items, setItems] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  // Évite d'appliquer la réponse d'un chargement lancé pour l'ancien mode.
  const loadSeq = useRef(0);

  const loadFirstPage = useCallback(async (m: FeedMode) => {
    const seq = ++loadSeq.current;
    setRefreshing(true);
    try {
      const { data, nextCursor: cursor } = await feedApi.getFeed(m);
      if (seq !== loadSeq.current) return;
      setItems(data);
      setNextCursor(cursor);
    } finally {
      if (seq === loadSeq.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFirstPage(mode);
  }, [mode, loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { data, nextCursor: cursor } = await feedApi.getFeed(mode, nextCursor);
      setItems((prev) => [...prev, ...data]);
      setNextCursor(cursor);
    } finally {
      setLoadingMore(false);
    }
  }, [mode, nextCursor, loadingMore]);

  /** Like optimiste : UI d'abord, rollback si le serveur refuse. */
  const toggleLike = useCallback(
    async (post: FeedItem) => {
      const wasLiked = liked.has(post.id);
      setLiked((prev) => {
        const next = new Set(prev);
        wasLiked ? next.delete(post.id) : next.add(post.id);
        return next;
      });
      setItems((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, likeCount: p.likeCount + (wasLiked ? -1 : 1) } : p,
        ),
      );
      try {
        await (wasLiked ? feedApi.unlike(post.id) : feedApi.like(post.id));
      } catch {
        setLiked((prev) => {
          const next = new Set(prev);
          wasLiked ? next.add(post.id) : next.delete(post.id);
          return next;
        });
        setItems((prev) =>
          prev.map((p) =>
            p.id === post.id ? { ...p, likeCount: p.likeCount + (wasLiked ? 1 : -1) } : p,
          ),
        );
      }
    },
    [liked],
  );

  return (
    <View style={styles.container}>
      {/* Bascule Pour toi / Récent */}
      <View style={styles.modeRow}>
        {(
          [
            { value: 'algo', label: 'Pour toi ✨' },
            { value: 'chrono', label: 'Récent 🕐' },
          ] as const
        ).map((m) => (
          <Pressable
            key={m.value}
            onPress={() => setMode(m.value)}
            style={[styles.modeChip, mode === m.value && styles.modeChipActive]}
          >
            <Text style={mode === m.value ? styles.modeTextActive : styles.modeText}>
              {m.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadFirstPage(mode)} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        contentContainerStyle={items.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          refreshing ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>C'est calme par ici 💛</Text>
              <Text style={styles.emptyText}>
                Sois la première à partager quelque chose avec les mamans !
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>
                  {item.author.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.headerText}>
                <Text style={styles.authorName}>{item.author.displayName}</Text>
                <Text style={styles.timestamp}>{formatRelative(item.createdAt)}</Text>
              </View>
            </View>
            {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
            <View style={styles.actionsRow}>
              <Pressable style={styles.action} onPress={() => toggleLike(item)}>
                <Text style={[styles.actionText, liked.has(item.id) && styles.actionActive]}>
                  {liked.has(item.id) ? '💛' : '🤍'} {item.likeCount}
                </Text>
              </Pressable>
              <Text style={styles.actionText}>💬 {item.commentCount}</Text>
            </View>
          </View>
        )}
      />

      {/* Bouton flottant : nouveau post */}
      <Pressable style={styles.fab} onPress={onCompose}>
        <Text style={styles.fabText}>＋</Text>
      </Pressable>
    </View>
  );
}

function formatRelative(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgSoft },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  modeChip: {
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.bgSoft,
  },
  modeChipActive: { backgroundColor: COLORS.rose },
  modeText: { color: COLORS.gray, fontSize: 14, fontWeight: '600' },
  modeTextActive: { color: '#fff', fontSize: 14, fontWeight: '700' },
  card: {
    backgroundColor: COLORS.bg,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.roseBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: COLORS.rose, fontWeight: '800', fontSize: 17 },
  headerText: { marginLeft: 10 },
  authorName: { fontWeight: '700', fontSize: 15, color: COLORS.ink },
  timestamp: { fontSize: 12, color: COLORS.grayLight, marginTop: 1 },
  body: { fontSize: 15, lineHeight: 22, color: COLORS.ink },
  actionsRow: { flexDirection: 'row', gap: 20, marginTop: 12 },
  action: { flexDirection: 'row', alignItems: 'center' },
  actionText: { fontSize: 14, color: COLORS.gray },
  actionActive: { color: COLORS.rose, fontWeight: '700' },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink, marginBottom: 8 },
  emptyText: { fontSize: 14, color: COLORS.gray, textAlign: 'center', lineHeight: 20 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.rose,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32 },
});
