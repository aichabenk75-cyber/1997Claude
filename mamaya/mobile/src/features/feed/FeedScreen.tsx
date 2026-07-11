/**
 * Fil d'actualité 💛 — en-tête de marque, deux modes (Pour toi / Récent),
 * cartes avec photos, like optimiste, bouton flottant pour publier.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, GRADIENTS, RADIUS, SHADOW } from '../../lib/theme';
import { Avatar } from '../../ui/components';
import { FeedItem, FeedMode, feedApi, mediaUrl } from './api';

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
      const apply = (l: boolean) => {
        setLiked((prev) => {
          const next = new Set(prev);
          l ? next.add(post.id) : next.delete(post.id);
          return next;
        });
        setItems((prev) =>
          prev.map((p) =>
            p.id === post.id ? { ...p, likeCount: p.likeCount + (l ? 1 : -1) } : p,
          ),
        );
      };
      apply(!wasLiked);
      try {
        await (wasLiked ? feedApi.unlike(post.id) : feedApi.like(post.id));
      } catch {
        apply(wasLiked); // rollback
      }
    },
    [liked],
  );

  return (
    <View style={styles.container}>
      {/* En-tête de marque */}
      <View style={styles.header}>
        <Text style={styles.brand}>
          Mamaya <Text style={styles.brandHeart}>💛</Text>
        </Text>
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
      </View>

      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadFirstPage(mode)} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        contentContainerStyle={[
          { paddingBottom: 96 },
          items.length === 0 && styles.emptyContainer,
        ]}
        ListEmptyComponent={
          refreshing ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🌷</Text>
              <Text style={styles.emptyTitle}>C'est calme par ici</Text>
              <Text style={styles.emptyText}>
                Sois la première à partager quelque chose avec les mamans !
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <PostCard item={item} liked={liked.has(item.id)} onLike={() => toggleLike(item)} />
        )}
      />

      {/* Bouton flottant : nouveau post */}
      <Pressable style={styles.fabWrap} onPress={onCompose}>
        <LinearGradient
          colors={GRADIENTS.fab}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fab}
        >
          <Ionicons name="add" size={30} color="#fff" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function PostCard({
  item,
  liked,
  onLike,
}: {
  item: FeedItem;
  liked: boolean;
  onLike: () => void;
}) {
  const { width } = useWindowDimensions();
  const photoWidth = width - 24 - 32; // marges carte + padding

  return (
    <View style={[styles.card, SHADOW.card]}>
      <View style={styles.cardHeader}>
        <Avatar name={item.author.displayName} seed={item.author.id} size={42} />
        <View style={styles.headerText}>
          <Text style={styles.authorName}>{item.author.displayName}</Text>
          <Text style={styles.timestamp}>{formatRelative(item.createdAt)}</Text>
        </View>
      </View>

      {item.body ? <Text style={styles.body}>{item.body}</Text> : null}

      {/* Photos : 1 → pleine largeur ; 2+ → grille de vignettes */}
      {item.mediaKeys.length === 1 && (
        <Image
          source={{ uri: mediaUrl(item.mediaKeys[0]) }}
          style={[styles.photoSingle, { width: photoWidth, height: photoWidth * 0.75 }]}
          resizeMode="cover"
        />
      )}
      {item.mediaKeys.length > 1 && (
        <View style={styles.photoGrid}>
          {item.mediaKeys.map((key) => (
            <Image
              key={key}
              source={{ uri: mediaUrl(key) }}
              style={[
                styles.photoThumb,
                { width: (photoWidth - 8) / 2, height: (photoWidth - 8) / 2 },
              ]}
              resizeMode="cover"
            />
          ))}
        </View>
      )}

      <View style={styles.actionsRow}>
        <Pressable style={styles.action} onPress={onLike} hitSlop={8}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={22}
            color={liked ? COLORS.rose : COLORS.gray}
          />
          <Text style={[styles.actionText, liked && styles.actionActive]}>{item.likeCount}</Text>
        </Pressable>
        <View style={styles.action}>
          <Ionicons name="chatbubble-outline" size={20} color={COLORS.gray} />
          <Text style={styles.actionText}>{item.commentCount}</Text>
        </View>
      </View>
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
  header: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  brand: { fontSize: 24, fontWeight: '900', color: COLORS.rose, marginBottom: 10 },
  brandHeart: { fontSize: 20 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeChip: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.field,
  },
  modeChipActive: { backgroundColor: COLORS.rose },
  modeText: { color: COLORS.gray, fontSize: 14, fontWeight: '600' },
  modeTextActive: { color: '#fff', fontSize: 14, fontWeight: '800' },
  card: {
    backgroundColor: COLORS.bg,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: RADIUS.lg,
    padding: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  headerText: { marginLeft: 10 },
  authorName: { fontWeight: '800', fontSize: 15, color: COLORS.ink },
  timestamp: { fontSize: 12, color: COLORS.grayLight, marginTop: 1 },
  body: { fontSize: 15, lineHeight: 22, color: COLORS.ink },
  photoSingle: { borderRadius: RADIUS.md, marginTop: 10, backgroundColor: COLORS.field },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  photoThumb: { borderRadius: RADIUS.md, backgroundColor: COLORS.field },
  actionsRow: { flexDirection: 'row', gap: 22, marginTop: 12 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 14, color: COLORS.gray, fontWeight: '600' },
  actionActive: { color: COLORS.rose, fontWeight: '800' },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 44, marginBottom: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.ink, marginBottom: 8 },
  emptyText: { fontSize: 14, color: COLORS.gray, textAlign: 'center', lineHeight: 20 },
  fabWrap: { position: 'absolute', right: 20, bottom: 24, borderRadius: 28, ...SHADOW.fab },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
