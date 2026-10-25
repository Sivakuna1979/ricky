# Voice Recorder

A simple Expo app that records audio for up to 24 hours in a single session, with
manual "stop" markers you can drop while recording (e.g. between workout sets)
and a list of past recordings you can play back or delete.

## Run it on your phone

1. Install the **Expo Go** app from the App Store / Play Store.
2. From this directory:
   ```bash
   npm install
   npx expo start
   ```
3. Scan the QR code shown in the terminal with your phone's camera (iOS) or the
   Expo Go app (Android).
4. Grant microphone access when prompted.

## How it works

- **Start Recording** begins a session capped at 24 hours (`recorder.record({ forDuration: 24 * 60 * 60 })`),
  with a JS-side watchdog that also force-stops at the 24h mark as a backup.
- **Pause / Resume** let you pause the recording without ending the session.
- **Add Stop** drops a timestamped marker into the current session (e.g. "Stop 1"
  at 00:15:32) — use it to mark the start/end of workout segments while the
  recording keeps going.
- **Stop & Save** finalizes the recording and saves it, along with its markers,
  to the device (recording file in the app's document directory, metadata in
  `AsyncStorage`).
- **Past Recordings** lists saved sessions; tap one to see its stop markers,
  play/pause it, or delete it.

## Notes / limits

- Built with `expo-audio` (Expo SDK 57). Background recording is enabled via
  the `expo-audio` config plugin (`enableBackgroundRecording`) and
  `UIBackgroundModes: ["audio"]` on iOS, so recording can continue while the
  screen is locked — actual OS behavior for a full 24h background session can
  still vary by device/OS power management, so test on your own phone before
  relying on it for a full day.
- This was built and typechecked/bundled in a sandboxed environment without a
  physical phone attached, so it has **not** been hand-tested on-device yet —
  try it via Expo Go and report anything that looks off.
