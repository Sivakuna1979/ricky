// @ts-nocheck
// Shared text-to-speech helper for the till's "order ready" call-outs —
// picks a clear female voice where the browser offers one (falls back to
// whatever's available) and speaks slowly enough to be understood over
// counter noise, like a professional announcement rather than a rushed
// robotic default voice.
function getVoicesAsync() {
  return new Promise(resolve => {
    const synth = window.speechSynthesis
    const existing = synth.getVoices()
    if (existing.length) { resolve(existing); return }
    const handler = () => {
      synth.removeEventListener('voiceschanged', handler)
      resolve(synth.getVoices())
    }
    synth.addEventListener('voiceschanged', handler)
    setTimeout(() => resolve(synth.getVoices()), 500)
  })
}

function pickFemaleVoice(voices) {
  if (!voices?.length) return null
  const byName = names => voices.find(v => names.some(n => v.name.toLowerCase().includes(n.toLowerCase())))
  return (
    byName(['female']) ||
    byName(['Serena', 'Samantha', 'Kate', 'Moira', 'Tessa', 'Zira', 'Karen', 'Fiona', 'Google UK English Female']) ||
    voices.find(v => v.lang?.startsWith('en')) ||
    voices[0]
  )
}

export async function speakAnnouncement(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const voices = await getVoicesAsync()
  const utter = new SpeechSynthesisUtterance(text)
  utter.rate = 0.8
  utter.pitch = 1.05
  const voice = pickFemaleVoice(voices)
  if (voice) utter.voice = voice
  window.speechSynthesis.speak(utter)
}
