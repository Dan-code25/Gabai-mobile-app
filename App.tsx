import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Switch,
  Modal,
  Image,
  Animated,
  PanResponder,
  Alert,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as Speech from 'expo-speech';
import { HistoryRow, initDb } from './src/db/historyDb';
import { useHistory } from './src/hooks/useHistory';
import { useAssistant } from './src/assistant/useAssistant';
import { useConnectivity } from './src/assistant/connectivity';

type TabType = 'home' | 'explain' | 'history' | 'settings' | 'profile';
type ExplainSubTab = 'explain' | 'summary' | 'photo';
type LanguageType = 'EN' | 'FIL';
type HistoryListItem =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'history'; key: string; row: HistoryRow };

const PAD = 20;
const GAP = 12;
const NAV_HEIGHT = 64;
const NAV_MARGIN = 12;

const MASCOT_IMAGE = require('./assets/GabAI Logo.png');
const HISTORY_SETTING_KEY = 'gabai.history.enabled';
const ONLINE_VOICE_SETTING_KEY = 'gabai.online.voice.enabled';

const TABS: { key: TabType; label: Record<LanguageType, string>; on: any; off: any }[] = [
  { key: 'home', label: { EN: 'Home', FIL: 'Tahanan' }, on: 'home', off: 'home-outline' },
  { key: 'explain', label: { EN: 'Explain', FIL: 'Ipaliwanag' }, on: 'sparkles', off: 'sparkles-outline' },
  { key: 'history', label: { EN: 'History', FIL: 'Kasaysayan' }, on: 'time', off: 'time-outline' },
  { key: 'settings', label: { EN: 'Settings', FIL: 'Gabay' }, on: 'settings', off: 'settings-outline' },
];

const greeting = (lang: LanguageType) => {
  const h = new Date().getHours();
  if (lang === 'FIL') {
    return h < 12 ? 'Magandang Umaga' : h < 18 ? 'Magandang Hapon' : 'Magandang Gabi';
  }
  return h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening';
};

function MainApp() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [databaseReady, setDatabaseReady] = useState(false);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [tab, setTab] = useState<TabType>('settings');
  const [explainSubTab, setExplainSubTab] = useState<ExplainSubTab>('explain');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState('1x');
  const [language, setLanguage] = useState<LanguageType>('EN');
  const [onlineVoiceEnabled, setOnlineVoiceEnabled] = useState(false);
  const connectivity = useConnectivity(onlineVoiceEnabled);
  const assistant = useAssistant(language === 'FIL' ? 'fil' : 'en', connectivity.mode);
  const bubblePosition = useRef(new Animated.ValueXY()).current;
  const waveformProgress = useRef(new Animated.Value(0)).current;
  const [historySearch, setHistorySearch] = useState('');
  const [selectedHistory, setSelectedHistory] = useState<HistoryRow | null>(null);
  const {
    items: historyItems,
    loading: historyLoading,
    error: historyError,
    refresh: refreshHistory,
    loadMore: loadMoreHistory,
    search: searchHistory,
    remove: removeHistory,
    clearAll: clearHistoryItems,
  } = useHistory();

  // Settings states
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [historyToggle, setHistoryToggle] = useState(true);
  const [notificationsToggle, setNotificationsToggle] = useState(true);

  // Floating Assistant Modal state
  const [floatingVisible, setFloatingVisible] = useState(false);
  const [floatingAction, setFloatingAction] = useState('Explain');

  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;

    initDb()
      .then(() => {
        if (mounted) setDatabaseReady(true);
      })
      .catch((error: unknown) => {
        console.error('Failed to initialize GabAI history database', error);
        if (mounted) {
          setDatabaseError(
            language === 'FIL'
              ? 'Hindi mabuksan ang kasaysayan sa device.'
              : 'History could not be opened on this device.',
          );
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(HISTORY_SETTING_KEY)
      .then((value) => {
        if (value !== null) setHistoryToggle(value === 'true');
      })
      .catch((error: unknown) => console.error('Failed to load history setting', error));
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(ONLINE_VOICE_SETTING_KEY)
      .then((value) => {
        if (value !== null) setOnlineVoiceEnabled(value === 'true');
      })
      .catch((error: unknown) => console.error('Failed to load online voice setting', error));
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  useEffect(() => {
    if (!assistant.isSpeaking) {
      waveformProgress.stopAnimation();
      waveformProgress.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(waveformProgress, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(waveformProgress, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [assistant.isSpeaking, waveformProgress]);

  const bubblePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event(
        [null, { dx: bubblePosition.x, dy: bubblePosition.y }],
        { useNativeDriver: false },
      ),
      onPanResponderRelease: (_event, gestureState) => {
        if (Math.abs(gestureState.dx) < 8 && Math.abs(gestureState.dy) < 8) {
          setFloatingVisible(true);
          return;
        }

        const snapLeft = gestureState.dx < -(width / 2 - PAD - 30);
        const targetX = snapLeft ? -(width - (PAD * 2) - 60) : 0;
        const targetY = Math.max(-height / 2, Math.min(height / 2, gestureState.dy));
        Animated.spring(bubblePosition, {
          toValue: { x: targetX, y: targetY },
          useNativeDriver: false,
          bounciness: 8,
        }).start();
      },
    }),
  ).current;

  useEffect(() => {
    if (tab === 'history' && databaseReady) void refreshHistory();
  }, [databaseReady, refreshHistory, tab]);

  const showToast = (msg: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(msg);
    timer.current = setTimeout(() => setToast(null), 2500);
  };

  const toggle = () => {
    const next = !active;
    setActive(next);
    showToast(
      language === 'FIL'
        ? (next ? 'Aktibo na ang Katulong!' : 'Naka-off ang Katulong.')
        : (next ? 'Assistant activated!' : 'Assistant turned off.')
    );
  };

  const toggleLanguage = () => {
    const nextLang = language === 'EN' ? 'FIL' : 'EN';
    setLanguage(nextLang);
    showToast(nextLang === 'FIL' ? 'Wikang Filipino ang ginagamit' : 'Language switched to English');
  };

  const setHistorySaving = (enabled: boolean) => {
    setHistoryToggle(enabled);
    AsyncStorage.setItem(HISTORY_SETTING_KEY, String(enabled))
      .catch((error: unknown) => console.error('Failed to save history setting', error));
    showToast(
      enabled
        ? (language === 'FIL' ? 'Naka-on ang pag-save ng history' : 'History saving enabled')
        : (language === 'FIL' ? 'Naka-off ang pag-save ng history' : 'History saving disabled'),
    );
  };

  const setOnlineVoice = (enabled: boolean) => {
    setOnlineVoiceEnabled(enabled);
    AsyncStorage.setItem(ONLINE_VOICE_SETTING_KEY, String(enabled))
      .catch((error: unknown) => console.error('Failed to save online voice setting', error));
    showToast(
      enabled
        ? (language === 'FIL' ? 'Naka-on ang online na boses' : 'Online voice enabled')
        : (language === 'FIL' ? 'Naka-off ang online na boses' : 'Online voice disabled'),
    );
  };

  const compact = width < 380;
  const cardWidth = (width - PAD * 2 - GAP) / 2;
  const navBottom = insets.bottom + NAV_MARGIN;

  const getHistoryGroupLabel = (createdAt: number) => {
    const date = new Date(createdAt);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isSameDate = (left: Date, right: Date) =>
      left.getFullYear() === right.getFullYear()
      && left.getMonth() === right.getMonth()
      && left.getDate() === right.getDate();

    if (isSameDate(date, today)) return language === 'FIL' ? 'Ngayon' : 'Today';
    if (isSameDate(date, yesterday)) return language === 'FIL' ? 'Kahapon' : 'Yesterday';
    return date.toLocaleDateString(language === 'FIL' ? 'fil-PH' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const historyTypeLabel = (type: HistoryRow['type']) => {
    if (type === 'read') return language === 'FIL' ? 'Basahin' : 'Read';
    if (type === 'explain') return language === 'FIL' ? 'Ipaliwanag' : 'Explain';
    return language === 'FIL' ? 'Buod' : 'Summary';
  };

  const historyTypeIcon = (type: HistoryRow['type'], size = 24, color = '#fff') => {
    if (type === 'summarize') {
      return <MaterialCommunityIcons name="format-list-bulleted" size={size} color={color} />;
    }
    if (type === 'explain') {
      return <Ionicons name="sparkles" size={size} color={color} />;
    }
    return <Ionicons name="volume-high" size={size} color={color} />;
  };

  const historyListItems: HistoryListItem[] = [];
  let previousGroup = '';
  historyItems.forEach((row) => {
    const group = getHistoryGroupLabel(row.created_at);
    if (group !== previousGroup) {
      historyListItems.push({ kind: 'header', key: `header-${group}`, label: group });
      previousGroup = group;
    }
    historyListItems.push({ kind: 'history', key: `history-${row.id}`, row });
  });

  if (!databaseReady) {
    return (
      <View style={[s.root, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center', padding: PAD }]}>
        <Text style={s.state}>
          {databaseError ?? (language === 'FIL' ? 'Inihahanda ang kasaysayan...' : 'Preparing history...')}
        </Text>
      </View>
    );
  }

  const actions = [
    { label: language === 'FIL' ? 'Ipaliwanag' : 'Explain', bg: '#eef2ff', border: '#e0e7ff', icon: '#4f46e5', node: <Ionicons name="sparkles" size={20} color="#fff" /> },
    { label: language === 'FIL' ? 'Buod' : 'Summary', bg: '#fff1f2', border: '#ffe4e6', icon: '#e11d48', node: <MaterialCommunityIcons name="format-list-bulleted" size={20} color="#fff" /> },
    { label: language === 'FIL' ? 'Larawan' : 'Photo', bg: '#fffbeb', border: '#fef3c7', icon: '#d97706', node: <Feather name="image" size={20} color="#fff" /> },
    { label: language === 'FIL' ? 'Makinig' : 'Listen', bg: '#fefce8', border: '#fef9c3', icon: '#f59e0b', dot: true, node: <Ionicons name="volume-high" size={20} color="#fff" /> },
  ];

  const chips = [
    { label: language === 'FIL' ? 'Handa' : 'Ready', node: <Ionicons name="sparkles" size={18} color="#6366f1" /> },
    { label: language === 'FIL' ? 'Offline' : 'Offline', node: <Ionicons name="shield-outline" size={18} color="#059669" /> },
    { label: language === 'FIL' ? 'Boses' : 'Voice', node: <Ionicons name="volume-high-outline" size={18} color="#d97706" /> },
  ];

  const getHeaderTitle = () => {
    if (explainSubTab === 'summary') return language === 'FIL' ? 'Buod' : 'Summarize';
    if (explainSubTab === 'photo') return language === 'FIL' ? 'Larawan' : 'Photo';
    return language === 'FIL' ? 'Ipaliwanag' : 'Explain';
  };

  const getMainBtnLabel = () => {
    if (explainSubTab === 'summary') return language === 'FIL' ? 'Buod' : 'Summarize';
    if (explainSubTab === 'photo') return language === 'FIL' ? 'Larawan' : 'Photo';
    return language === 'FIL' ? 'Ipaliwanag' : 'Explain';
  };

  const getSubLabelText = () => {
    if (explainSubTab === 'summary') return language === 'FIL' ? 'Pangunahing buod' : 'Key summary';
    if (explainSubTab === 'photo') return language === 'FIL' ? 'Pagsusuri sa larawan' : 'Photo analysis';
    return language === 'FIL' ? 'Simpleng paliwanag' : 'Simple explanation';
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {toast && (
        <View pointerEvents="none" style={[s.toast, { top: insets.top + 8 }]}>
          <Ionicons name="information-circle" size={20} color="#fff" />
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}

      {/* Header */}
      {tab !== 'profile' && (
        <View style={s.header}>
          <View style={s.headerLeft}>
            <LinearGradient
              colors={['#f59e0b', '#fb923c']}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={s.avatarRing}
            >
              <View style={s.avatarInner}>
                <Image source={MASCOT_IMAGE} style={s.avatarImage} />
              </View>
            </LinearGradient>
            <View style={{ marginLeft: 12, flexShrink: 1 }}>
              <Text style={s.greeting} numberOfLines={1}>{greeting(language)}</Text>
              <Text style={s.guest}>GabAI</Text>
            </View>
          </View>

          <View style={s.row}>
            <View style={[s.pill, { marginRight: 8 }]}>
              <Ionicons name="shield-checkmark-outline" size={13} color="#059669" />
              {!compact && <Text style={s.pillText}>{language === 'FIL' ? 'Offline' : 'Offline'}</Text>}
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={toggleLanguage}
              style={s.pill}
            >
              <Text style={language === 'EN' ? s.lang : s.langOff}>EN</Text>
              <Text style={s.langSep}>|</Text>
              <Text style={language === 'FIL' ? s.lang : s.langOff}>FIL</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Content based on active tab */}
      {tab === 'home' && (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          contentContainerStyle={{
            paddingHorizontal: PAD,
            paddingTop: 8,
            paddingBottom: navBottom + NAV_HEIGHT + 24,
          }}
        >
          <LinearGradient colors={['#eef2ff', '#ffffff']} style={s.assistantCard}>
            <Text style={s.cardLabel}>{language === 'FIL' ? 'KATULONG' : 'ASSISTANT'}</Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={toggle}
              accessibilityRole="switch"
              accessibilityLabel="Assistant"
              accessibilityState={{ checked: active }}
              style={[s.power, { backgroundColor: active ? '#059669' : '#4f46e5' }]}
            >
              <Ionicons name="power" size={42} color="#fff" />
            </TouchableOpacity>
            <Text style={s.state}>
              {active ? (language === 'FIL' ? 'Aktibo' : 'Active') : (language === 'FIL' ? 'Naka-off' : 'Off')}
            </Text>
          </LinearGradient>

          <View style={s.chipRow}>
            {chips.map((c) => (
              <View key={c.label} style={s.chip}>
                {c.node}
                <Text style={s.chipText}>{c.label}</Text>
                <Ionicons name="checkmark" size={14} color="#059669" style={{ marginTop: 4 }} />
              </View>
            ))}
          </View>

          <Text style={s.section}>{language === 'FIL' ? 'Mabilis na Aksyon' : 'Quick Actions'}</Text>

          <View style={s.grid}>
            {actions.map((a, idx) => (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.8}
                onPress={() => {
                  if (idx === 0) {
                    setTab('explain');
                    setExplainSubTab('explain');
                  } else if (idx === 1) {
                    setTab('explain');
                    setExplainSubTab('summary');
                  } else if (idx === 2) {
                    setTab('explain');
                    setExplainSubTab('photo');
                  } else {
                    showToast(language === 'FIL' ? `Binubuksan ang ${a.label}` : `Opening ${a.label} feature`);
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                style={[s.action, { width: cardWidth, backgroundColor: a.bg, borderColor: a.border }]}
              >
                <View style={[s.actionIcon, { backgroundColor: a.icon }]}>{a.node}</View>
                <View style={s.actionFooter}>
                  <Text style={s.actionText}>{a.label}</Text>
                  {a.dot ? <View style={s.dot} /> : <Ionicons name="chevron-forward" size={16} color="#475569" />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {tab === 'explain' && (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          contentContainerStyle={{
            paddingHorizontal: PAD,
            paddingTop: 8,
            paddingBottom: navBottom + NAV_HEIGHT + 24,
          }}
        >
          <View style={s.explainHeaderRow}>
            <View>
              <Text style={s.cardLabel}>{language === 'FIL' ? 'UNAWAIN' : 'UNDERSTAND'}</Text>
              <Text style={s.explainTitle}>{getHeaderTitle()}</Text>
            </View>
            <View style={s.pill}>
              <Ionicons name="shield-checkmark-outline" size={13} color="#059669" />
              <Text style={s.pillText}>Offline</Text>
            </View>
          </View>

          <View style={s.segmentContainer}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setExplainSubTab('explain');
                showToast(language === 'FIL' ? 'Napili ang Paliwanag' : 'Explain mode selected');
              }}
              style={[s.segmentBtn, explainSubTab === 'explain' && s.segmentBtnActive]}
            >
              <Ionicons name="sparkles" size={16} color={explainSubTab === 'explain' ? '#000' : '#475569'} />
              <Text style={[s.segmentText, explainSubTab === 'explain' && s.segmentTextActive]}>
                {language === 'FIL' ? 'Paliwanag' : 'Explain'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setExplainSubTab('summary');
                showToast(language === 'FIL' ? 'Napili ang Buod' : 'Summary mode selected');
              }}
              style={[s.segmentBtn, explainSubTab === 'summary' && s.segmentBtnActive]}
            >
              <MaterialCommunityIcons name="format-list-bulleted" size={16} color={explainSubTab === 'summary' ? '#000' : '#475569'} />
              <Text style={[s.segmentText, explainSubTab === 'summary' && s.segmentTextActive]}>
                {language === 'FIL' ? 'Buod' : 'Summary'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setExplainSubTab('photo');
                showToast(language === 'FIL' ? 'Napili ang Larawan' : 'Photo mode selected');
              }}
              style={[s.segmentBtn, explainSubTab === 'photo' && s.segmentBtnActive]}
            >
              <Feather name="image" size={16} color={explainSubTab === 'photo' ? '#000' : '#475569'} />
              <Text style={[s.segmentText, explainSubTab === 'photo' && s.segmentTextActive]}>
                {language === 'FIL' ? 'Larawan' : 'Photo'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={s.inputCard}>
            <Text style={s.inputText}>
              {language === 'FIL'
                ? 'PAABISO: Ang iyong bayarin sa tubig ay dapat bayaran bago mag-Abril 30.'
                : 'NOTICE: Your water bill must be paid before April 30.'}
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => showToast(language === 'FIL' ? 'Binubuksan ang nakakabit na larawan...' : 'Opening attached photo...')}
              style={s.imageBtn}
            >
              <Feather name="image" size={16} color="#0f172a" />
              <Text style={s.imageBtnText}>{language === 'FIL' ? 'Larawan' : 'Photo'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => showToast(language === 'FIL' ? `Pinoproseso ang ${explainSubTab}...` : `Processing ${explainSubTab}...`)}
            style={s.mainExplainBtnContainer}
          >
            <LinearGradient
              colors={['#7c3aed', '#6366f1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.mainExplainBtn}
            >
              <Ionicons name="sparkles" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={s.mainExplainBtnText}>{getMainBtnLabel()}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={s.resultCard}>
            <View style={s.resultHeaderRow}>
              <View style={s.resultIconBox}>
                <Ionicons name="sparkles" size={16} color="#fff" />
              </View>
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={s.resultSubLabel}>{getSubLabelText()}</Text>
                <Text style={s.resultMainTitle}>
                  {language === 'FIL' ? 'Magbayad bago mag-Abril 30' : 'Pay before April 30'}
                </Text>
              </View>
            </View>

            <Text style={s.resultBody}>
              {language === 'FIL'
                ? 'Ang iyong bayarin sa tubig ay dapat bayaran '
                : 'Your water bill must be paid '}
              <Text style={{ fontWeight: '700', textDecorationLine: 'underline' }}>
                {language === 'FIL' ? 'bago mag-Abril 30' : 'before April 30'}
              </Text>
              {language === 'FIL' ? ' upang maiwasan ang dagdag na bayarin.' : ' to avoid an extra charge.'}
            </Text>

            <View style={s.importantBox}>
              <Ionicons name="checkmark" size={16} color="#0f172a" style={{ marginRight: 8, marginTop: 2 }} />
              <Text style={s.importantText}>
                <Text style={{ fontWeight: '700' }}>
                  {language === 'FIL' ? 'Mahalaga:' : 'Important:'}
                </Text>{' '}
                {language === 'FIL' ? 'Abril 30 ang takdang petsa.' : 'April 30 is the deadline.'}
              </Text>
            </View>

            <View style={s.audioBar}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  const nextPlay = !isPlaying;
                  setIsPlaying(nextPlay);
                  showToast(
                    language === 'FIL'
                      ? (nextPlay ? 'Nagpe-play ng pagsusuri ng audio...' : 'Naka-pause ang audio.')
                      : (nextPlay ? 'Playing audio analysis...' : 'Audio paused.')
                  );
                }}
                style={s.audioPlayBtn}
              >
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color="#fff" />
              </TouchableOpacity>

              <View style={s.waveformContainer}>
                {[12, 22, 16, 28, 14, 24, 18, 26, 12, 20, 15, 25].map((h, idx) => (
                  <View
                    key={idx}
                    style={[
                      s.waveformBar,
                      { height: h, backgroundColor: isPlaying && idx < 6 ? '#6366f1' : '#a5b4fc' },
                    ]}
                  />
                ))}
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  const speeds = ['1x', '1.5x', '2x'];
                  const nextSpeed = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
                  setPlaybackSpeed(nextSpeed);
                  showToast(language === 'FIL' ? `Bilis ng pag-playback: ${nextSpeed}` : `Playback speed: ${nextSpeed}`);
                }}
                style={s.speedBtn}
              >
                <Text style={s.speedBtnText}>{playbackSpeed}</Text>
              </TouchableOpacity>
            </View>

            <View style={s.actionBtnRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => showToast(language === 'FIL' ? 'Nakopya sa clipboard!' : 'Copied to clipboard!')}
                style={s.subActionBtn}
              >
                <Feather name="copy" size={16} color="#0f172a" style={{ marginRight: 6 }} />
                <Text style={s.subActionText}>{language === 'FIL' ? 'Kopyahin' : 'Copy'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => showToast(language === 'FIL' ? 'Binubuksan ang dialog ng pagbabahagi...' : 'Opening share dialog...')}
                style={s.subActionBtn}
              >
                <Feather name="share-2" size={16} color="#0f172a" style={{ marginRight: 6 }} />
                <Text style={s.subActionText}>{language === 'FIL' ? 'Ibahagi' : 'Share'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => showToast(language === 'FIL' ? 'Binubuksan ang detalyadong paliwanag...' : 'Opening detailed breakdown...')}
                style={[s.subActionBtn, { flex: 1.2 }]}
              >
                <Text style={[s.subActionText, { marginRight: 4 }]}>
                  {language === 'FIL' ? 'Detalye' : 'Details'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#0f172a" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.securityFooter}>
            <Ionicons name="shield-outline" size={16} color="#64748b" style={{ marginRight: 8 }} />
            <Text style={s.securityText}>
              {language === 'FIL'
                ? 'Pinoproseso sa device na ito. Hindi binabasa ang mga password/OTP.'
                : 'Processed on this device. Password/OTPs are never read.'}
            </Text>
          </View>
        </ScrollView>
      )}

      {tab === 'history' && selectedHistory && (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: PAD,
            paddingTop: 8,
            paddingBottom: navBottom + NAV_HEIGHT + 24,
          }}
        >
          <View style={s.historyDetailHeader}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                Speech.stop();
                setSelectedHistory(null);
              }}
              style={s.backBtn}
              accessibilityLabel={language === 'FIL' ? 'Bumalik sa history' : 'Back to history'}
            >
              <Ionicons name="arrow-back" size={22} color="#0f172a" />
            </TouchableOpacity>
            <Text style={s.historyDetailTitle}>{language === 'FIL' ? 'Detalye' : 'History detail'}</Text>
            <View style={s.detailHeaderSpacer} />
          </View>

          <View style={s.historyDetailType}>
            <View style={[s.historyDetailIcon, {
              backgroundColor: selectedHistory.type === 'summarize'
                ? '#be185d'
                : selectedHistory.type === 'explain' ? '#3b82f6' : '#c2410c',
            }]}>
              {historyTypeIcon(selectedHistory.type)}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.historyDetailTypeLabel}>{historyTypeLabel(selectedHistory.type)}</Text>
              <Text style={s.historyDetailDate}>
                {new Date(selectedHistory.created_at).toLocaleString(language === 'FIL' ? 'fil-PH' : 'en-US', {
                  dateStyle: 'long',
                  timeStyle: 'short',
                })}
              </Text>
            </View>
          </View>

          <View style={s.historyDetailSection}>
            <Text style={s.historyDetailSectionLabel}>{language === 'FIL' ? 'Orihinal na teksto' : 'Original text'}</Text>
            <Text style={s.historyDetailBody}>{selectedHistory.source_text}</Text>
          </View>

          <View style={s.historyDetailSection}>
            <Text style={s.historyDetailSectionLabel}>{language === 'FIL' ? 'Resulta' : 'Result'}</Text>
            <Text style={s.historyDetailBody}>{selectedHistory.result_text}</Text>
          </View>

          <View style={s.historyDetailActions}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                Speech.stop();
                Speech.speak(selectedHistory.result_text, {
                  language: selectedHistory.language === 'fil' ? 'fil-PH' : 'en-US',
                });
              }}
              style={[s.historyDetailAction, { backgroundColor: '#ea580c' }]}
              accessibilityLabel={language === 'FIL' ? 'Pakinggan ang resulta' : 'Listen to result'}
            >
              <Ionicons name="volume-high" size={20} color="#fff" />
              <Text style={s.historyDetailActionText}>{language === 'FIL' ? 'Pakinggan' : 'Listen'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                void Clipboard.setStringAsync(`${selectedHistory.source_text}\n\n${selectedHistory.result_text}`)
                  .then(() => showToast(language === 'FIL' ? 'Nakopya na.' : 'Copied.'));
              }}
              style={[s.historyDetailAction, { backgroundColor: '#2563eb' }]}
              accessibilityLabel={language === 'FIL' ? 'Kopyahin ang history' : 'Copy history'}
            >
              <Feather name="copy" size={20} color="#fff" />
              <Text style={s.historyDetailActionText}>{language === 'FIL' ? 'Kopyahin' : 'Copy'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                Alert.alert(
                  language === 'FIL' ? 'Burahin ang history?' : 'Delete this history?',
                  language === 'FIL' ? 'Hindi na maibabalik ang record na ito.' : 'This record cannot be restored.',
                  [
                    { text: language === 'FIL' ? 'Kanselahin' : 'Cancel', style: 'cancel' },
                    {
                      text: language === 'FIL' ? 'Burahin' : 'Delete',
                      style: 'destructive',
                      onPress: () => {
                        Speech.stop();
                        void removeHistory(selectedHistory.id).then(() => {
                          setSelectedHistory(null);
                          showToast(language === 'FIL' ? 'Tinanggal ang history.' : 'History deleted.');
                        });
                      },
                    },
                  ],
                );
              }}
              style={[s.historyDetailAction, { backgroundColor: '#be185d' }]}
              accessibilityLabel={language === 'FIL' ? 'Burahin ang history' : 'Delete history'}
            >
              <Feather name="trash-2" size={20} color="#fff" />
              <Text style={s.historyDetailActionText}>{language === 'FIL' ? 'Burahin' : 'Delete'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
      {tab === 'history' && !selectedHistory && (
        <FlatList<HistoryListItem>
          style={{ flex: 1 }}
          data={historyListItems}
          keyExtractor={(item) => item.key}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: PAD,
            paddingTop: 8,
            paddingBottom: navBottom + NAV_HEIGHT + 24,
            flexGrow: historyListItems.length === 0 ? 1 : undefined,
          }}
          refreshControl={
            <RefreshControl
              refreshing={historyLoading && historyItems.length > 0}
              onRefresh={() => void refreshHistory()}
              tintColor="#6366f1"
              colors={['#6366f1']}
            />
          }
          onEndReached={() => void loadMoreHistory()}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={(
            <View>
              <View style={s.historyHeaderRow}>
                <View>
                  <Text style={s.cardLabel}>{language === 'FIL' ? 'SA DEVICE LAMANG' : 'ON DEVICE ONLY'}</Text>
                  <Text style={s.explainTitle}>{language === 'FIL' ? 'Kasaysayan' : 'History'}</Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    if (historyItems.length === 0) return;
                    Alert.alert(
                      language === 'FIL' ? 'Burahin lahat?' : 'Clear all history?',
                      language === 'FIL' ? 'Hindi na maibabalik ang mga ito.' : 'This cannot be undone.',
                      [
                        { text: language === 'FIL' ? 'Kanselahin' : 'Cancel', style: 'cancel' },
                        {
                          text: language === 'FIL' ? 'Burahin lahat' : 'Clear all',
                          style: 'destructive',
                          onPress: () => {
                            void clearHistoryItems().then(() => {
                              showToast(language === 'FIL' ? 'Na-clear ang lahat ng kasaysayan.' : 'All history cleared.');
                            });
                          },
                        },
                      ],
                    );
                  }}
                  style={s.clearAllBtn}
                >
                  <Text style={s.clearAllText}>{language === 'FIL' ? 'Burahin lahat' : 'Clear all'}</Text>
                </TouchableOpacity>
              </View>

              <View style={s.historySearchBox}>
                <Ionicons name="search" size={20} color="#64748b" />
                <TextInput
                  value={historySearch}
                  onChangeText={(value) => {
                    setHistorySearch(value);
                    searchHistory(value);
                  }}
                  placeholder={language === 'FIL' ? 'Maghanap sa history' : 'Search history'}
                  placeholderTextColor="#64748b"
                  style={s.historySearchInput}
                  accessibilityLabel={language === 'FIL' ? 'Maghanap sa history' : 'Search history'}
                  returnKeyType="search"
                />
                {historySearch.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setHistorySearch('');
                      searchHistory('');
                    }}
                    style={s.searchClearBtn}
                    accessibilityLabel={language === 'FIL' ? 'Burahin ang paghahanap' : 'Clear search'}
                  >
                    <Ionicons name="close-circle" size={20} color="#64748b" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={s.deviceOnlyPill}>
                <Ionicons name="lock-closed-outline" size={14} color="#0f172a" style={{ marginRight: 6 }} />
                <Text style={s.deviceOnlyText}>
                  {language === 'FIL' ? 'Nakatago lamang sa device na ito' : 'Stored only on this device'}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            historyLoading ? (
              <View style={s.emptyHistoryContainer}>
                <ActivityIndicator size="large" color="#6366f1" />
              </View>
            ) : (
              <View style={s.emptyHistoryContainer}>
                <Ionicons name="time-outline" size={40} color="#94a3b8" />
                <Text style={s.emptyHistoryText}>
                  {language === 'FIL' ? 'Wala pang history.' : 'No history yet.'}
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return <Text style={s.historyGroupTitle}>{item.label}</Text>;
            }

            const row = item.row;
            const iconBackground = row.type === 'summarize' ? '#be185d' : row.type === 'explain' ? '#3b82f6' : '#c2410c';
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setSelectedHistory(row)}
                style={s.historyCard}
              >
                <View style={[s.historyIconBox, { backgroundColor: iconBackground }]}>
                  {historyTypeIcon(row.type, 20)}
                </View>
                <View style={s.historyContent}>
                  <View style={s.historyTypeRow}>
                    <Text style={s.historyTypeLabel}>{historyTypeLabel(row.type)}</Text>
                    <Text style={s.historyTime}>
                      {new Date(row.created_at).toLocaleTimeString(language === 'FIL' ? 'fil-PH' : 'en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <Text style={s.historyItemTitle} numberOfLines={2}>{row.source_text}</Text>
                  <Text style={s.historyItemSubtitle} numberOfLines={2}>{row.result_text}</Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    void removeHistory(row.id).then(() => {
                      showToast(language === 'FIL' ? 'Tinanggal ang history.' : 'History deleted.');
                    });
                  }}
                  style={s.trashBtn}
                  accessibilityLabel={language === 'FIL' ? 'Burahin ang history' : 'Delete history'}
                >
                  <Feather name="trash-2" size={16} color="#be185d" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            historyLoading && historyItems.length > 0
              ? <ActivityIndicator size="small" color="#6366f1" style={s.historyLoadingFooter} />
              : historyError
                ? <Text style={s.historyErrorText}>{language === 'FIL' ? 'Hindi ma-load ang history.' : 'Could not load history.'}</Text>
                : null
          }
        />
      )}

      {tab === 'settings' && (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          contentContainerStyle={{
            paddingHorizontal: PAD,
            paddingTop: 8,
            paddingBottom: navBottom + NAV_HEIGHT + 24,
          }}
        >
          <View style={s.settingsHeaderRow}>
            <View>
              <Text style={s.cardLabel}>GABAI</Text>
              <Text style={s.explainTitle}>{language === 'FIL' ? 'Gabay' : 'Settings'}</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setTab('profile');
                showToast(language === 'FIL' ? 'Binubuksan ang profile...' : 'Opening profile...');
              }}
              style={s.profileIconBtn}
            >
              <Feather name="user" size={20} color="#0f172a" />
            </TouchableOpacity>
          </View>

          <View style={s.settingsGrid}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => showToast(language === 'FIL' ? 'Binubuksan ang mga setting ng wika' : 'Opening language settings')}
              style={[s.settingCard, { backgroundColor: '#eef2ff', borderColor: '#e0e7ff', width: cardWidth }]}
            >
              <View style={s.settingCardTopRow}>
                <View style={[s.settingIconBox, { backgroundColor: '#3b82f6' }]}>
                  <Ionicons name="globe-outline" size={20} color="#fff" />
                </View>
                <View style={s.miniBadge}>
                  <Text style={s.miniBadgeText}>{language}</Text>
                </View>
              </View>
              <Text style={s.settingCardTitle}>{language === 'FIL' ? 'Wika' : 'Language'}</Text>
              <Text style={s.settingCardSubtitle}>{language === 'FIL' ? 'Filipino' : 'English'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => showToast(language === 'FIL' ? 'Binubuksan ang laki ng teksto' : 'Opening text size options')}
              style={[s.settingCard, { backgroundColor: '#ede9fe', borderColor: '#ddd6fe', width: cardWidth }]}
            >
              <View style={s.settingCardTopRow}>
                <View style={[s.settingIconBox, { backgroundColor: '#8b5cf6' }]}>
                  <Ionicons name="text-outline" size={20} color="#fff" />
                </View>
                <Text style={s.largeAaText}>Aa</Text>
              </View>
              <Text style={s.settingCardTitle}>{language === 'FIL' ? 'Laki ng Teksto' : 'Text Size'}</Text>
              <Text style={s.settingCardSubtitle}>{language === 'FIL' ? 'Malaki' : 'Large'}</Text>
            </TouchableOpacity>

            <View style={[s.settingCard, { backgroundColor: '#fef3c7', borderColor: '#fde68a', width: cardWidth }]}>
              <View style={s.settingCardTopRow}>
                <View style={[s.settingIconBox, { backgroundColor: '#f59e0b' }]}>
                  <Ionicons name="eye-outline" size={20} color="#fff" />
                </View>
                <Switch
                  value={highContrast}
                  onValueChange={(val) => {
                    setHighContrast(val);
                    showToast(val ? 'High Contrast enabled' : 'High Contrast disabled');
                  }}
                  trackColor={{ false: '#cbd5e1', true: '#f59e0b' }}
                  thumbColor={'#fff'}
                />
              </View>
              <Text style={[s.settingCardTitle, { marginTop: 16 }]}>High Contrast</Text>
            </View>

            <View style={[s.settingCard, { backgroundColor: '#ffe4e6', borderColor: '#fecdd3', width: cardWidth }]}>
              <View style={s.settingCardTopRow}>
                <View style={[s.settingIconBox, { backgroundColor: '#e11d48' }]}>
                  <Ionicons name="sparkles" size={20} color="#fff" />
                </View>
                <Switch
                  value={reducedMotion}
                  onValueChange={(val) => {
                    setReducedMotion(val);
                    showToast(val ? 'Reduced Motion enabled' : 'Reduced Motion disabled');
                  }}
                  trackColor={{ false: '#cbd5e1', true: '#e11d48' }}
                  thumbColor={'#fff'}
                />
              </View>
              <Text style={[s.settingCardTitle, { marginTop: 16 }]}>Reduced Motion</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => showToast('Opening Voice & Speed settings')}
              style={[s.settingCard, { backgroundColor: '#ffedd5', borderColor: '#fed7aa', width: cardWidth }]}
            >
              <View style={s.settingCardTopRow}>
                <View style={[s.settingIconBox, { backgroundColor: '#ea580c' }]}>
                  <Ionicons name="volume-high" size={20} color="#fff" />
                </View>
                <Feather name="chevron-right" size={20} color="#9a3412" />
              </View>
              <Text style={s.settingCardTitle}>Voice & Speed</Text>
              <Text style={s.settingCardSubtitle}>English · 1x · Offline</Text>
            </TouchableOpacity>

            <View style={[s.settingCard, { backgroundColor: '#dcfce7', borderColor: '#bbf7d0', width: cardWidth }]}>
              <View style={s.settingCardTopRow}>
                <View style={[s.settingIconBox, { backgroundColor: '#16a34a' }]}>
                  <Ionicons name="cloud-outline" size={20} color="#fff" />
                </View>
                <Switch
                  value={onlineVoiceEnabled}
                  onValueChange={setOnlineVoice}
                  trackColor={{ false: '#cbd5e1', true: '#16a34a' }}
                  thumbColor="#fff"
                />
              </View>
              <Text style={[s.settingCardTitle, { marginTop: 16 }]}>
                {language === 'FIL' ? 'Online na boses (Agora)' : 'Online voice (Agora)'}
              </Text>
              <Text style={s.settingCardSubtitle}>
                {language === 'FIL' ? 'Opsyonal' : 'Optional'}
              </Text>
            </View>

            <View style={[s.settingCard, { backgroundColor: '#e0f2fe', borderColor: '#bae6fd', width: cardWidth }]}>
              <View style={s.settingCardTopRow}>
                <View style={[s.settingIconBox, { backgroundColor: '#0284c7' }]}>
                  <Ionicons name="time-outline" size={20} color="#fff" />
                </View>
                <Switch
                  value={historyToggle}
                  onValueChange={setHistorySaving}
                  trackColor={{ false: '#cbd5e1', true: '#0284c7' }}
                  thumbColor={'#fff'}
                />
              </View>
              <Text style={[s.settingCardTitle, { marginTop: 16 }]}>
                {language === 'FIL' ? 'I-save ang history' : 'Save history'}
              </Text>
              <Text style={s.settingCardSubtitle}>
                {language === 'FIL' ? 'Sa device lamang' : 'On device only'}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => showToast('Opening privacy settings')}
              style={[s.settingCard, { backgroundColor: '#ede9fe', borderColor: '#ddd6fe', width: cardWidth }]}
            >
              <View style={s.settingCardTopRow}>
                <View style={[s.settingIconBox, { backgroundColor: '#7c3aed' }]}>
                  <Ionicons name="lock-closed-outline" size={20} color="#fff" />
                </View>
                <Feather name="chevron-right" size={20} color="#5b21b6" />
              </View>
              <Text style={s.settingCardTitle}>Privacy</Text>
              <Text style={s.settingCardSubtitle}>Offline only</Text>
            </TouchableOpacity>

            <View style={[s.settingCard, { backgroundColor: '#fce7f3', borderColor: '#fbcfe8', width: cardWidth }]}>
              <View style={s.settingCardTopRow}>
                <View style={[s.settingIconBox, { backgroundColor: '#db2777' }]}>
                  <Ionicons name="notifications-outline" size={20} color="#fff" />
                </View>
                <Switch
                  value={notificationsToggle}
                  onValueChange={(val) => {
                    setNotificationsToggle(val);
                    showToast(val ? 'Notifications enabled' : 'Notifications disabled');
                  }}
                  trackColor={{ false: '#cbd5e1', true: '#db2777' }}
                  thumbColor={'#fff'}
                />
              </View>
              <Text style={[s.settingCardTitle, { marginTop: 16 }]}>Notifications</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                setFloatingVisible(true);
                showToast('Floating Assistant opened');
              }}
              style={[s.settingCard, { backgroundColor: '#ffedd5', borderColor: '#fed7aa', width: cardWidth }]}
            >
              <View style={s.settingCardTopRow}>
                <View style={[s.settingIconBox, { backgroundColor: '#ea580c' }]}>
                  <Feather name="smartphone" size={20} color="#fff" />
                </View>
                <Feather name="chevron-right" size={20} color="#9a3412" />
              </View>
              <Text style={s.settingCardTitle}>Floating Assistant</Text>
              <Text style={s.settingCardSubtitle}>View preview</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => showToast('Opening Accessibility Setup')}
              style={[s.settingCard, { backgroundColor: '#fef3c7', borderColor: '#fde68a', width: cardWidth }]}
            >
              <View style={s.settingCardTopRow}>
                <View style={[s.settingIconBox, { backgroundColor: '#f59e0b' }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
                </View>
                <Feather name="chevron-right" size={20} color="#b45309" />
              </View>
              <Text style={s.settingCardTitle}>Accessibility Setup</Text>
              <Text style={s.settingCardSubtitle}>Enabled</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => showToast('Opening How to Use guide')}
              style={[s.settingCard, { backgroundColor: '#e0f2fe', borderColor: '#bae6fd', width: cardWidth }]}
            >
              <View style={s.settingCardTopRow}>
                <View style={[s.settingIconBox, { backgroundColor: '#0284c7' }]}>
                  <Ionicons name="help-circle-outline" size={20} color="#fff" />
                </View>
                <Feather name="chevron-right" size={20} color="#0369a1" />
              </View>
              <Text style={s.settingCardTitle}>How to Use</Text>
              <Text style={s.settingCardSubtitle}>GabAI guide</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {tab === 'profile' && (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          contentContainerStyle={{
            paddingHorizontal: PAD,
            paddingTop: 8,
            paddingBottom: navBottom + NAV_HEIGHT + 24,
          }}
        >
          <View style={s.profileTopBar}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setTab('settings');
                showToast(language === 'FIL' ? 'Bumalik sa Gabay' : 'Returned to Settings');
              }}
              style={s.backBtn}
            >
              <Ionicons name="chevron-back" size={20} color="#0f172a" />
            </TouchableOpacity>
            <Text style={s.profileTitle}>Profile</Text>
            <View style={s.pill}>
              <Ionicons name="shield-checkmark-outline" size={13} color="#059669" />
              <Text style={s.pillText}>Offline</Text>
            </View>
          </View>

          <View style={s.profileCardMain}>
            <View style={s.profileAvatarBox}>
              <Image source={MASCOT_IMAGE} style={s.profileAvatarImage} />
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={s.profileName}>GabAI</Text>
              <View style={s.privateBadge}>
                <Ionicons name="lock-closed-outline" size={12} color="#0f172a" style={{ marginRight: 4 }} />
                <Text style={s.privateBadgeText}>Private</Text>
              </View>
            </View>
          </View>

          <View style={s.settingsGrid}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => showToast('Opening language settings')}
              style={[s.settingCard, { backgroundColor: '#eef2ff', borderColor: '#e0e7ff', width: cardWidth }]}
            >
              <View style={s.settingCardTopRow}>
                <View style={[s.settingIconBox, { backgroundColor: '#3b82f6' }]}>
                  <Ionicons name="globe-outline" size={20} color="#fff" />
                </View>
                <Feather name="chevron-right" size={20} color="#1e40af" />
              </View>
              <Text style={s.settingCardTitle}>{language === 'FIL' ? 'Wika' : 'Language'}</Text>
              <Text style={s.settingCardSubtitle}>{language === 'FIL' ? 'Filipino' : 'English'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => showToast('Opening voice settings')}
              style={[s.settingCard, { backgroundColor: '#ede9fe', borderColor: '#ddd6fe', width: cardWidth }]}
            >
              <View style={s.settingCardTopRow}>
                <View style={[s.settingIconBox, { backgroundColor: '#7c3aed' }]}>
                  <Ionicons name="volume-high" size={20} color="#fff" />
                </View>
                <Feather name="chevron-right" size={20} color="#5b21b6" />
              </View>
              <Text style={s.settingCardTitle}>{language === 'FIL' ? 'Boses' : 'Voice'}</Text>
              <Text style={s.settingCardSubtitle}>{language === 'FIL' ? 'Filipino · Offline' : 'English · Offline'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => showToast('Opening text size options')}
              style={[s.settingCard, { backgroundColor: '#fef3c7', borderColor: '#fde68a', width: cardWidth }]}
            >
              <View style={s.settingCardTopRow}>
                <View style={[s.settingIconBox, { backgroundColor: '#f59e0b' }]}>
                  <Ionicons name="text-outline" size={20} color="#fff" />
                </View>
                <Feather name="chevron-right" size={20} color="#b45309" />
              </View>
              <Text style={s.settingCardTitle}>{language === 'FIL' ? 'Teksto' : 'Text'}</Text>
              <Text style={s.settingCardSubtitle}>{language === 'FIL' ? 'Malaki' : 'Large'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => showToast('Opening account settings')}
              style={[s.settingCard, { backgroundColor: '#fce7f3', borderColor: '#fbcfe8', width: cardWidth }]}
            >
              <View style={s.settingCardTopRow}>
                <View style={[s.settingIconBox, { backgroundColor: '#db2777' }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
                </View>
                <Feather name="chevron-right" size={20} color="#9d174d" />
              </View>
              <Text style={s.settingCardTitle}>{language === 'FIL' ? 'Account' : 'Account'}</Text>
              <Text style={s.settingCardSubtitle}>GabAI mode</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => showToast('Logged out from GabAI mode')}
            style={s.logoutBtn}
          >
            <Text style={s.logoutBtnText}>Logout — GabAI</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Floating Assistant Modal */}
      <Modal
        visible={floatingVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFloatingVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.floatingOuterBox}>
            <View style={s.floatingHeaderRow}>
              <View style={[s.pill, assistant.mode === 'online' ? s.onlinePill : s.offlinePill]}>
                <Ionicons
                  name={assistant.mode === 'online' ? 'cloud-outline' : 'shield-checkmark-outline'}
                  size={13}
                  color={assistant.mode === 'online' ? '#15803d' : '#64748b'}
                />
                <Text style={[s.pillText, { color: assistant.mode === 'online' ? '#166534' : '#475569' }]}>
                  {assistant.mode === 'online' ? 'Online' : 'Offline'}
                </Text>
              </View>
              <Text style={s.floatingTitle}>GabAI</Text>
              <View style={s.floatingHeaderRight}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={toggleLanguage}
                  style={s.pill}
                  accessibilityLabel={language === 'FIL' ? 'Lumipat sa English' : 'Switch to Filipino'}
                >
                  <Text style={language === 'EN' ? s.lang : s.langOff}>EN</Text>
                  <Text style={s.langSep}>|</Text>
                  <Text style={language === 'FIL' ? s.lang : s.langOff}>FIL</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.floatingActionRow}>
              {[
                { key: 'read', label: language === 'FIL' ? 'Basahin' : 'Read', icon: <Ionicons name="scan-outline" size={18} color="#fff" />, bg: '#3b82f6' },
                { key: 'explain', label: language === 'FIL' ? 'Ipaliwanag' : 'Explain', icon: <Ionicons name="sparkles" size={18} color="#fff" />, bg: '#7c3aed' },
                { key: 'summarize', label: language === 'FIL' ? 'Buod' : 'Summary', icon: <MaterialCommunityIcons name="format-list-bulleted" size={18} color="#fff" />, bg: '#be185d' },
                { key: 'speak', label: language === 'FIL' ? 'Pakinggan' : 'Listen', icon: <Ionicons name="volume-high" size={18} color="#fff" />, bg: '#ea580c' },
              ].map((act, idx) => {
                const isSelected = floatingAction === act.label;
                return (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.8}
                    onPress={() => {
                      setFloatingAction(act.label);
                      if (act.key === 'read') {
                        void assistant.read();
                      } else if (act.key === 'explain') {
                        void assistant.explain();
                      } else if (act.key === 'summarize') {
                        void assistant.summarize();
                      } else {
                        void assistant.speak();
                      }
                    }}
                    style={s.floatingActionItem}
                  >
                    <View style={[s.floatingActionIconBox, { backgroundColor: act.bg }]}>
                      {act.icon}
                    </View>
                    <Text style={[s.floatingActionText, isSelected && { fontWeight: '800', color: '#0f172a' }]}>
                      {act.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={s.floatingInfoCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons
                  name={assistant.status === 'error' ? 'alert-circle' : assistant.status === 'loading' ? 'hourglass' : 'checkmark'}
                  size={16}
                  color={assistant.status === 'error' ? '#b91c1c' : '#0f172a'}
                  style={{ marginRight: 6 }}
                />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a' }}>
                  {assistant.status === 'loading'
                    ? (language === 'FIL' ? 'Binabasa ang screen...' : 'Reading the screen...')
                    : assistant.status === 'result'
                      ? (language === 'FIL' ? 'Narito ang resulta' : 'Here is the result')
                      : assistant.status === 'error'
                        ? (language === 'FIL' ? 'May problema' : 'Something went wrong')
                        : (language === 'FIL' ? 'Handang tumulong' : 'Ready to help')}
                </Text>
              </View>
              <ScrollView style={{ maxHeight: 130 }} nestedScrollEnabled>
                <Text style={{ fontSize: 13, color: assistant.status === 'error' ? '#b91c1c' : '#475569', marginBottom: 16 }}>
                  {assistant.status === 'loading'
                    ? (language === 'FIL' ? 'Sandali lang...' : 'Please wait...')
                    : assistant.resultText || (language === 'FIL' ? 'Pumili ng aksyon sa itaas.' : 'Choose an action above.')}
                </Text>
              </ScrollView>
              {!!assistant.voiceNote && (
                <Text style={s.voiceFallbackNote}>{assistant.voiceNote}</Text>
              )}

              <View style={s.audioBar}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    if (assistant.isSpeaking) {
                      void assistant.close();
                    } else {
                      void assistant.speak();
                    }
                  }}
                  style={s.audioPlayBtn}
                >
                  <Ionicons name={assistant.isSpeaking ? 'pause' : 'play'} size={16} color="#fff" />
                </TouchableOpacity>

                <View style={s.waveformContainer}>
                  {[10, 20, 14, 26, 12, 22, 16, 24, 10, 18].map((h, idx) => (
                    <View
                      key={idx}
                      style={[
                        s.waveformBar,
                        {
                          height: h,
                          backgroundColor: assistant.isSpeaking && idx < 5 ? '#6366f1' : '#a5b4fc',
                          transform: [{ scaleY: assistant.isSpeaking ? 0.85 + (idx % 3) * 0.1 : 1 }],
                        },
                      ]}
                    />
                  ))}
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    const speeds = [1, 1.25, 0.75] as const;
                    const next = speeds[(speeds.indexOf(assistant.speed) + 1) % speeds.length];
                    assistant.setSpeed(next);
                  }}
                  style={s.speedBtn}
                >
                  <Text style={s.speedBtnText}>{assistant.speed}x</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              void assistant.close();
              setFloatingVisible(false);
            }}
            style={[s.floatingBubbleBtn, s.floatingBubbleClose]}
            accessibilityLabel={language === 'FIL' ? 'Isara' : 'Close'}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Floating mascot badge */}
      {!floatingVisible && (
        <Animated.View
          {...bubblePanResponder.panHandlers}
          style={[
            s.mascot,
            { bottom: navBottom + NAV_HEIGHT + 12 },
            { transform: bubblePosition.getTranslateTransform() },
          ]}
        >
          <Image source={MASCOT_IMAGE} style={s.mascotImage} />
          <View style={s.mascotCheck}>
            <Ionicons name="checkmark" size={9} color="#fff" />
          </View>
        </Animated.View>
      )}

      {/* Bottom nav */}
      <View style={[s.nav, { bottom: navBottom }]}>
        {TABS.map((t) => {
          const on = tab === t.key || (tab === 'profile' && t.key === 'settings');
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => {
                if (t.key === 'settings') {
                  setTab('settings');
                } else {
                  setTab(t.key);
                }
              }}
              accessibilityRole="tab"
              accessibilityLabel={t.label[language]}
              accessibilityState={{ selected: on }}
              style={[s.tab, on && s.tabOn, { paddingHorizontal: on ? 14 : 12 }]}
            >
              <Ionicons name={on ? t.on : t.off} size={22} color={on ? '#6366f1' : '#64748b'} />
              {on && <Text style={s.tabText}>{t.label[language]}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  row: { flexDirection: 'row', alignItems: 'center' },

  toast: {
    position: 'absolute', left: PAD, right: PAD, zIndex: 50, elevation: 12,
    backgroundColor: '#0f172a', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  toastText: { color: '#fff', fontWeight: '500', marginLeft: 8, flexShrink: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: PAD, paddingTop: 8, paddingBottom: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  avatarRing: { width: 48, height: 48, borderRadius: 16, padding: 2 },
  avatarInner: { flex: 1, borderRadius: 14, backgroundColor: '#ffedd5', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  greeting: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  guest: { fontSize: 12, fontWeight: '500', color: '#64748b' },
  pill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#e2e8f0',
  },
  onlinePill: { backgroundColor: '#dcfce7', borderColor: '#86efac' },
  offlinePill: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
  pillText: { fontSize: 12, fontWeight: '600', color: '#334155', marginLeft: 4 },
  lang: { fontSize: 12, fontWeight: '700', color: '#1e293b' },
  langSep: { fontSize: 12, color: '#94a3b8', marginHorizontal: 4 },
  langOff: { fontSize: 12, fontWeight: '500', color: '#64748b' },

  assistantCard: {
    borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: '#e0e7ff', overflow: 'hidden',
  },
  cardLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: 'rgba(49,46,129,0.6)', marginBottom: 4 },
  power: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', elevation: 8 },
  state: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginTop: 16 },

  chipRow: { flexDirection: 'row', marginBottom: 24, gap: 8 },
  chip: {
    flex: 1, backgroundColor: '#fff', paddingVertical: 12, borderRadius: 16,
    borderWidth: 1, borderColor: '#f1f5f9', alignItems: 'center', elevation: 1,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: '#1e293b', marginTop: 6 },

  section: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  action: { padding: 16, borderRadius: 24, borderWidth: 1, justifyContent: 'space-between', minHeight: 130 },
  actionIcon: { width: 40, height: 40, borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  actionFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  actionText: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4f46e5' },

  mascot: {
    position: 'absolute', right: PAD, width: 60, height: 60, backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: '#f1f5f9', elevation: 6, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  mascotImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  mascotCheck: {
    position: 'absolute', top: 2, right: 2, width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#059669', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  mascotCheckSmall: {
    position: 'absolute', top: 0, right: 0, width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#059669', borderWidth: 1.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },

  nav: {
    position: 'absolute', left: PAD, right: PAD, height: NAV_HEIGHT, paddingHorizontal: 8,
    backgroundColor: '#fff', borderRadius: 999, borderWidth: 1, borderColor: '#e2e8f0', elevation: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  tab: { minWidth: 48, height: 48, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: '#e0e7ff' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#4f46e5', marginLeft: 6 },

  explainHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  explainTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  segmentContainer: {
    flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 20, padding: 4, marginBottom: 16,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  segmentBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 16,
  },
  segmentBtnActive: {
    backgroundColor: '#ffffff', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
  },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#475569', marginLeft: 4 },
  segmentTextActive: { color: '#0f172a', fontWeight: '700' },

  inputCard: {
    backgroundColor: '#f1f5f9', borderRadius: 24, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  inputText: { fontSize: 15, color: '#1e293b', fontWeight: '500', lineHeight: 22, marginBottom: 24 },
  imageBtn: {
    alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1',
  },
  imageBtnText: { fontSize: 13, fontWeight: '700', color: '#0f172a', marginLeft: 6 },

  mainExplainBtnContainer: { marginBottom: 20, borderRadius: 20, overflow: 'hidden', elevation: 4 },
  mainExplainBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 20,
  },
  mainExplainBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  resultCard: {
    backgroundColor: '#ffffff', borderRadius: 24, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: '#e2e8f0', elevation: 2,
  },
  resultHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  resultIconBox: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center',
  },
  resultSubLabel: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  resultMainTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  resultBody: { fontSize: 15, color: '#334155', lineHeight: 22, marginBottom: 14 },

  importantBox: {
    flexDirection: 'row', backgroundColor: '#fef3c7', borderRadius: 16, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: '#fde68a', alignItems: 'flex-start',
  },
  importantText: { fontSize: 14, color: '#92400e', flex: 1, lineHeight: 20 },

  audioBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#eef2ff', borderRadius: 16, padding: 10, marginBottom: 16,
    borderWidth: 1, borderColor: '#e0e7ff',
  },
  audioPlayBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center',
  },
  waveformContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingHorizontal: 12 },
  waveformBar: { width: 3, borderRadius: 1.5 },
  speedBtn: {
    backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1, borderColor: '#c7d2fe',
  },
  speedBtnText: { fontSize: 12, fontWeight: '700', color: '#4f46e5' },

  actionBtnRow: { flexDirection: 'row', gap: 8 },
  subActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9',
    paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0',
  },
  subActionText: { fontSize: 13, fontWeight: '700', color: '#0f172a' },

  securityFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8,
  },
  securityText: { fontSize: 12, color: '#64748b', fontWeight: '500' },

  historyHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  clearAllBtn: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
  clearAllText: { fontSize: 16, fontWeight: '700', color: '#6b21a8' },
  historySearchBox: {
    minHeight: 52, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 16, paddingHorizontal: 14, marginBottom: 12,
  },
  historySearchInput: { flex: 1, minHeight: 48, fontSize: 16, color: '#0f172a', marginLeft: 10 },
  searchClearBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  deviceOnlyPill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#fff',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16,
  },
  deviceOnlyText: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  historyGroupTitle: {
    fontSize: 18, fontWeight: '800', color: '#334155', marginTop: 8, marginBottom: 8,
  },
  historyCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 20, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#e2e8f0', elevation: 1,
  },
  historyIconBox: {
    width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  historyContent: { flex: 1, marginRight: 8 },
  historyTypeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  historyTypeLabel: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  historyTime: { fontSize: 16, fontWeight: '600', color: '#64748b', marginLeft: 8 },
  historyItemTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  historyItemSubtitle: { fontSize: 16, color: '#475569' },
  trashBtn: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: '#fff1f2', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#ffe4e6',
  },
  emptyHistoryContainer: { paddingVertical: 40, alignItems: 'center' },
  emptyHistoryText: { fontSize: 16, color: '#64748b', fontWeight: '500', marginTop: 10 },
  historyLoadingFooter: { paddingVertical: 16 },
  historyErrorText: { fontSize: 16, color: '#b91c1c', textAlign: 'center', paddingVertical: 16 },
  historyDetailHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
  },
  historyDetailTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  detailHeaderSpacer: { width: 48, height: 48 },
  historyDetailType: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 20,
    padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16,
  },
  historyDetailIcon: {
    width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  historyDetailTypeLabel: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  historyDetailDate: { fontSize: 16, color: '#64748b', marginTop: 4 },
  historyDetailSection: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20, borderWidth: 1,
    borderColor: '#e2e8f0', marginBottom: 16,
  },
  historyDetailSectionLabel: {
    fontSize: 16, fontWeight: '800', color: '#475569', marginBottom: 10,
  },
  historyDetailBody: { fontSize: 20, lineHeight: 30, color: '#0f172a' },
  historyDetailActions: { gap: 10, marginTop: 4 },
  historyDetailAction: {
    minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', paddingHorizontal: 16,
  },
  historyDetailActionText: { color: '#fff', fontSize: 18, fontWeight: '800', marginLeft: 8 },

  settingsHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  profileIconBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#e2e8f0', elevation: 1,
  },
  settingsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: GAP,
  },
  settingCard: {
    padding: 16, borderRadius: 24, borderWidth: 1, minHeight: 130, justifyContent: 'space-between',
  },
  settingCardTopRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  settingIconBox: {
    width: 40, height: 40, borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 2,
  },
  miniBadge: {
    backgroundColor: '#3b82f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  miniBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  largeAaText: { fontSize: 20, fontWeight: '800', color: '#5b21b6' },
  settingCardTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginTop: 12 },
  settingCardSubtitle: { fontSize: 12, fontWeight: '500', color: '#64748b', marginTop: 2 },

  profileTopBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#e2e8f0', elevation: 1,
  },
  profileTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  profileCardMain: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffedd5', borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: '#fed7aa', marginBottom: 20,
  },
  profileAvatarBox: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: '#fff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    elevation: 2,
  },
  profileAvatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  profileName: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  privateBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#fff',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: '#cbd5e1',
  },
  privateBadgeText: { fontSize: 12, fontWeight: '600', color: '#0f172a' },
  logoutBtn: {
    backgroundColor: '#fff', marginTop: 24, paddingVertical: 16, borderRadius: 20,
    borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', elevation: 1,
  },
  logoutBtnText: { fontSize: 15, fontWeight: '700', color: '#0f172a' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20,
  },
  floatingOuterBox: {
    width: '100%', maxWidth: 360, backgroundColor: '#ffffff', borderRadius: 28, padding: 20,
    borderWidth: 1, borderColor: '#e2e8f0', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 12,
  },
  floatingHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  floatingHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  floatingTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  floatingActionRow: {
    flexGrow: 1, width: '100%', justifyContent: 'center',
    gap: 12, paddingVertical: 4, marginBottom: 16,
  },
  floatingActionItem: {
    alignItems: 'center', width: 56,
  },
  floatingActionIconBox: {
    width: 44, height: 44, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 6, elevation: 2,
  },
  floatingActionText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  floatingInfoCard: {
    backgroundColor: '#f1f5f9', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#e2e8f0',
  },
  voiceFallbackNote: { fontSize: 12, color: '#64748b', marginBottom: 10 },
  floatingBubbleBtn: {
    position: 'absolute', bottom: 44, right: 28, width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#ea580c', alignItems: 'center', justifyContent: 'center', elevation: 10,
    borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6, overflow: 'hidden',
  },
  floatingBubbleClose: { backgroundColor: '#ea580c' },
  floatingBubbleImage: { width: '100%', height: '100%', resizeMode: 'cover' },
});