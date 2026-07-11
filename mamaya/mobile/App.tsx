/**
 * Racine de l'app Mamaya : session (AuthProvider) puis navigation.
 * Non connectée → connexion/inscription. Connectée → 4 onglets :
 * Fil, Messages, Autour de moi, Profil.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/lib/auth-context';
import { COLORS } from './src/lib/theme';
import { LoginScreen } from './src/features/auth/LoginScreen';
import { RegisterScreen } from './src/features/auth/RegisterScreen';
import { FeedScreen } from './src/features/feed/FeedScreen';
import { ComposeScreen } from './src/features/feed/ComposeScreen';
import { ConversationsScreen } from './src/features/chat/ConversationsScreen';
import { ConversationScreen } from './src/features/chat/ConversationScreen';
import { NearbyMapScreen } from './src/features/nearby/NearbyMapScreen';
import { ProfileScreen } from './src/features/profile/ProfileScreen';

type RootStackParamList = {
  Tabs: undefined;
  Compose: undefined;
  Conversation: { conversationId: string; title: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Root />
    </AuthProvider>
  );
}

function Root() {
  const { ready, userId } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: COLORS.roseBg }}>
        <ActivityIndicator size="large" color={COLORS.rose} />
      </View>
    );
  }

  if (!userId) return <AuthFlow />;

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="Compose"
          component={ComposeRoute}
          options={{ presentation: 'modal', title: 'Nouveau post' }}
        />
        <Stack.Screen
          name="Conversation"
          component={ConversationRoute}
          options={({ route }) => ({ title: route.params.title })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/** Connexion ↔ inscription : simple bascule locale, pas besoin de navigateur. */
function AuthFlow() {
  const [showRegister, setShowRegister] = useState(false);
  return showRegister ? (
    <RegisterScreen onShowLogin={() => setShowRegister(false)} />
  ) : (
    <LoginScreen onShowRegister={() => setShowRegister(true)} />
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: COLORS.rose,
        tabBarInactiveTintColor: COLORS.gray,
      }}
    >
      <Tab.Screen
        name="Fil"
        component={FeedRoute}
        options={{ title: 'Fil', tabBarIcon: tabEmoji('🏡') }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesRoute}
        options={{ tabBarIcon: tabEmoji('💬') }}
      />
      <Tab.Screen
        name="Autour de moi"
        component={NearbyMapScreen}
        options={{ tabBarIcon: tabEmoji('🗺️') }}
      />
      <Tab.Screen
        name="Profil"
        component={ProfileScreen}
        options={{ headerShown: false, tabBarIcon: tabEmoji('🌸') }}
      />
    </Tab.Navigator>
  );
}

function tabEmoji(emoji: string) {
  return () => <Text style={{ fontSize: 18 }}>{emoji}</Text>;
}

// ---- Ponts navigation → écrans (les écrans ignorent react-navigation) ------

function FeedRoute({ navigation }: { navigation: any }) {
  return <FeedScreen onCompose={() => navigation.navigate('Compose')} />;
}

function MessagesRoute({ navigation }: { navigation: any }) {
  return (
    <ConversationsScreen
      onOpenConversation={(conversationId, title) =>
        navigation.navigate('Conversation', { conversationId, title })
      }
    />
  );
}

function ComposeRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'Compose'>) {
  return <ComposeScreen onDone={() => navigation.goBack()} />;
}

function ConversationRoute({
  route,
}: NativeStackScreenProps<RootStackParamList, 'Conversation'>) {
  return <ConversationScreen conversationId={route.params.conversationId} />;
}
