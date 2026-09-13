import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { formatClock, formatDateTime } from './src/format';
import { deleteRecording, loadRecordings, saveRecordings } from './src/storage';
import { SavedRecording, Stop } from './src/types';

const MAX_SECONDS = 24 * 60 * 60;
const MAX_MILLIS = MAX_SECONDS * 1000;

const recordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  directory: 'document' as const,
};

export default function App() {
  const recorder = useAudioRecorder(recordingOptions);
  const recorderState = useAudioRecorderState(recorder, 1000);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [recordings, setRecordings] = useState<SavedRecording[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);

  const isRecording = sessionStartedAt !== null && recorderState.isRecording;
  const isPaused = sessionStartedAt !== null && !recorderState.isRecording;

  useEffect(() => {
    (async () => {
      const permission = await requestRecordingPermissionsAsync();
      setHasPermission(permission.granted);
      if (permission.granted) {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          allowsBackgroundRecording: true,
          interruptionMode: 'doNotMix',
        });
      }
    })();
    loadRecordings().then(setRecordings);
  }, []);

  useEffect(() => {
    if (playerStatus.didJustFinish) {
      setPlayingId(null);
    }
  }, [playerStatus.didJustFinish]);

  // Backup watchdog in case the native forDuration cutoff doesn't fire on a given platform.
  useEffect(() => {
    if (isRecording && recorderState.durationMillis >= MAX_MILLIS) {
      handleStop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, recorderState.durationMillis]);

  async function handleGrantPermission() {
    const permission = await requestRecordingPermissionsAsync();
    setHasPermission(permission.granted);
    if (permission.granted) {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        allowsBackgroundRecording: true,
        interruptionMode: 'doNotMix',
      });
    }
  }

  async function handleStart() {
    if (!hasPermission) {
      await handleGrantPermission();
      return;
    }
    await recorder.prepareToRecordAsync();
    recorder.record({ forDuration: MAX_SECONDS });
    setStops([]);
    setSessionStartedAt(Date.now());
  }

  function handlePause() {
    recorder.pause();
  }

  function handleResume() {
    const remainingSeconds = Math.max(1, MAX_SECONDS - Math.floor(recorderState.durationMillis / 1000));
    recorder.record({ forDuration: remainingSeconds });
  }

  function handleAddStop() {
    if (!isRecording) return;
    const stopNumber = stops.length + 1;
    setStops((prev) => [...prev, { atMillis: recorderState.durationMillis, label: `Stop ${stopNumber}` }]);
  }

  async function handleStop() {
    if (sessionStartedAt === null) return;
    await recorder.stop();
    const uri = recorder.uri;
    const startedAt = sessionStartedAt;
    const durationMillis = recorderState.durationMillis;
    setSessionStartedAt(null);
    setStops([]);
    if (!uri) return;

    const entry: SavedRecording = {
      id: `${startedAt}`,
      uri,
      startedAt,
      durationMillis,
      stops,
    };
    setRecordings((prev) => {
      const next = [entry, ...prev];
      saveRecordings(next);
      return next;
    });
  }

  function handlePlayToggle(recording: SavedRecording) {
    if (playingId === recording.id) {
      player.pause();
      setPlayingId(null);
      return;
    }
    player.replace(recording.uri);
    player.play();
    setPlayingId(recording.id);
  }

  function handleDelete(recording: SavedRecording) {
    Alert.alert('Delete recording?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (playingId === recording.id) {
            player.pause();
            setPlayingId(null);
          }
          const next = await deleteRecording(recordings, recording.id);
          setRecordings(next);
          if (expandedId === recording.id) setExpandedId(null);
        },
      },
    ]);
  }

  const remainingLabel = useMemo(() => {
    const remaining = MAX_MILLIS - recorderState.durationMillis;
    return formatClock(Math.max(0, remaining));
  }, [recorderState.durationMillis]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <FlatList
        data={recordings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>24-Hour Voice Recorder</Text>

            {hasPermission === false && (
              <View style={styles.card}>
                <Text style={styles.warning}>Microphone access is required to record.</Text>
                <Pressable style={styles.primaryButton} onPress={handleGrantPermission}>
                  <Text style={styles.primaryButtonText}>Grant Microphone Access</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.timer}>{formatClock(recorderState.durationMillis)}</Text>
              <Text style={styles.timerSubtitle}>
                {isRecording || isPaused ? `${remainingLabel} remaining of 24:00:00 max` : 'Ready to record (24h max)'}
              </Text>

              {!isRecording && !isPaused && (
                <Pressable style={styles.primaryButton} onPress={handleStart}>
                  <Text style={styles.primaryButtonText}>Start Recording</Text>
                </Pressable>
              )}

              {isRecording && (
                <View>
                  <View style={styles.row}>
                    <Pressable style={styles.secondaryButton} onPress={handlePause}>
                      <Text style={styles.secondaryButtonText}>Pause</Text>
                    </Pressable>
                    <Pressable style={styles.secondaryButton} onPress={handleAddStop}>
                      <Text style={styles.secondaryButtonText}>Add Stop</Text>
                    </Pressable>
                  </View>
                  <Pressable style={styles.stopButton} onPress={handleStop}>
                    <Text style={styles.primaryButtonText}>Stop &amp; Save</Text>
                  </Pressable>
                </View>
              )}

              {isPaused && (
                <View>
                  <View style={styles.row}>
                    <Pressable style={styles.secondaryButton} onPress={handleResume}>
                      <Text style={styles.secondaryButtonText}>Resume</Text>
                    </Pressable>
                  </View>
                  <Pressable style={styles.stopButton} onPress={handleStop}>
                    <Text style={styles.primaryButtonText}>Stop &amp; Save</Text>
                  </Pressable>
                </View>
              )}

              {(isRecording || isPaused) && stops.length > 0 && (
                <View style={styles.stopsList}>
                  {stops.map((stop, index) => (
                    <Text key={index} style={styles.stopItem}>
                      {stop.label} · {formatClock(stop.atMillis)}
                    </Text>
                  ))}
                </View>
              )}
            </View>

            <Text style={styles.sectionTitle}>Past Recordings</Text>
            {recordings.length === 0 && <Text style={styles.emptyText}>No recordings yet.</Text>}
          </View>
        }
        renderItem={({ item }) => {
          const expanded = expandedId === item.id;
          return (
            <View style={styles.recordingCard}>
              <Pressable onPress={() => setExpandedId(expanded ? null : item.id)}>
                <Text style={styles.recordingDate}>{formatDateTime(item.startedAt)}</Text>
                <Text style={styles.recordingMeta}>
                  {formatClock(item.durationMillis)} · {item.stops.length} stop{item.stops.length === 1 ? '' : 's'}
                </Text>
              </Pressable>

              {expanded && item.stops.length > 0 && (
                <View style={styles.stopsList}>
                  {item.stops.map((stop, index) => (
                    <Text key={index} style={styles.stopItem}>
                      {stop.label} · {formatClock(stop.atMillis)}
                    </Text>
                  ))}
                </View>
              )}

              <View style={styles.row}>
                <Pressable style={styles.secondaryButton} onPress={() => handlePlayToggle(item)}>
                  <Text style={styles.secondaryButtonText}>
                    {playingId === item.id && playerStatus.playing ? 'Pause' : 'Play'}
                  </Text>
                </Pressable>
                <Pressable style={styles.deleteButton} onPress={() => handleDelete(item)}>
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F6FA',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  listContent: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1A1B25',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  timer: {
    fontSize: 48,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: '#1A1B25',
  },
  timerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
  },
  warning: {
    color: '#B91C1C',
    marginBottom: 12,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  stopButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#EEF2FF',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#3730A3',
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#B91C1C',
    fontWeight: '600',
  },
  stopsList: {
    width: '100%',
    marginTop: 12,
    marginBottom: 4,
    gap: 4,
  },
  stopItem: {
    fontSize: 13,
    color: '#374151',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    color: '#1A1B25',
  },
  emptyText: {
    color: '#6B7280',
    marginBottom: 12,
  },
  recordingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 10,
  },
  recordingDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1B25',
  },
  recordingMeta: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
});
