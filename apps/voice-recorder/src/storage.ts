import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import { SavedRecording } from './types';

const STORAGE_KEY = 'voice-recorder/recordings';

export async function loadRecordings(): Promise<SavedRecording[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SavedRecording[];
    return parsed.sort((a, b) => b.startedAt - a.startedAt);
  } catch {
    return [];
  }
}

export async function saveRecordings(recordings: SavedRecording[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(recordings));
}

export async function deleteRecording(recordings: SavedRecording[], id: string): Promise<SavedRecording[]> {
  const target = recordings.find((r) => r.id === id);
  if (target) {
    const file = new File(target.uri);
    if (file.exists) {
      file.delete();
    }
  }
  const next = recordings.filter((r) => r.id !== id);
  await saveRecordings(next);
  return next;
}
