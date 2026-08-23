export type Stop = {
  atMillis: number;
  label: string;
};

export type SavedRecording = {
  id: string;
  uri: string;
  startedAt: number;
  durationMillis: number;
  stops: Stop[];
};
