"""Voice (speech recognition + text-to-speech).  *** NOT IMPLEMENTED ***

Planned: English and Tamil.
  * Speech-to-text: an offline model such as Whisper (supports Tamil).
  * Text-to-speech: a TTS engine with an English and a Tamil voice.
  * Recognised text goes to the SAME task planner and safety checks as typed
    instructions. A spoken "STOP" will be an extra (not the only) way to stop.
Today the simulated speaker only logs what the robot would say.
"""

SUPPORTED_LANGUAGES = {"en": "English", "ta": "Tamil"}
SPEECH_RECOGNITION_AVAILABLE = False
TEXT_TO_SPEECH_AVAILABLE = False
