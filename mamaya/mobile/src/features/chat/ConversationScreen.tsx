/**
 * Une conversation : historique (déchiffré côté serveur pour ses membres),
 * envoi de messages, rafraîchissement par polling léger toutes les 4 s.
 * (Le temps réel Socket.IO pourra remplacer le polling plus tard.)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../../lib/auth-context';
import { COLORS } from '../../lib/theme';
import { chatApi, Message } from './api';

const POLL_MS = 4_000;

export function ConversationScreen({ conversationId }: { conversationId: string }) {
  const { userId } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]); // du plus récent au plus ancien
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const pollBusy = useRef(false);

  const refresh = useCallback(async () => {
    if (pollBusy.current) return;
    pollBusy.current = true;
    try {
      const { data } = await chatApi.getMessages(conversationId);
      setMessages(data);
      await chatApi.markRead(conversationId);
    } catch {
      // silencieux : le prochain tick de polling retentera
    } finally {
      pollBusy.current = false;
    }
  }, [conversationId]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const sent = await chatApi.sendMessage(conversationId, body);
      setDraft('');
      setMessages((prev) => [sent, ...prev]);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        style={styles.list}
        data={messages}
        keyExtractor={(m) => m.id}
        inverted
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const mine = item.senderId === userId;
          return (
            <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                <Text style={mine ? styles.bubbleTextMine : styles.bubbleText}>{item.body}</Text>
                <Text style={[styles.time, mine && styles.timeMine]}>
                  {formatTime(item.createdAt)}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Dis bonjour, c'est toi qui ouvres le bal 💛</Text>
          </View>
        }
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Ton message…"
          placeholderTextColor={COLORS.grayLight}
          multiline
          maxLength={4000}
        />
        <Pressable
          style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!draft.trim() || sending}
        >
          <Text style={styles.sendBtnText}>➤</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.bgSoft },
  list: { flex: 1 },
  listContent: { padding: 12 },
  bubbleRow: { flexDirection: 'row', marginVertical: 3 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bubbleMine: { backgroundColor: COLORS.rose, borderBottomRightRadius: 4 },
  bubbleOther: {
    backgroundColor: COLORS.bg,
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  bubbleText: { fontSize: 15, color: COLORS.ink, lineHeight: 21 },
  bubbleTextMine: { fontSize: 15, color: '#fff', lineHeight: 21 },
  time: { fontSize: 10, color: COLORS.grayLight, marginTop: 3, alignSelf: 'flex-end' },
  timeMine: { color: 'rgba(255,255,255,0.75)' },
  // Liste inversée → le composant "vide" apparaît retourné, on le remet à l'endroit.
  empty: { padding: 32, alignItems: 'center', transform: [{ scaleY: -1 }] },
  emptyText: { fontSize: 14, color: COLORS.gray, textAlign: 'center' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    gap: 8,
    backgroundColor: COLORS.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    maxHeight: 120,
    color: COLORS.ink,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.rose,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontSize: 16 },
});
