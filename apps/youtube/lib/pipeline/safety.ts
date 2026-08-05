import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScriptAIProvider } from '@/lib/providers/types'

const PROHIBITED_KEYWORDS: Record<string, string[]> = {
  violence: ['graphic violence', 'gore', 'torture', 'mutilation'],
  hateful: ['racial slur', 'ethnic cleansing', 'hate speech'],
  sexual: ['nudity', 'explicit sexual', 'pornographic'],
  dangerous_acts: ['how to make a bomb', 'suicide method', 'self-harm instructions', 'lethal dose'],
  fraud: ['guaranteed profit', 'get rich quick scheme', 'miracle cure', 'ponzi'],
  misleading: ['doctors hate this one trick', 'shocking secret they don\'t want you to know'],
}

export interface PolicyCheckResult {
  checkType: string
  passed: boolean
  severity: 'info' | 'warning' | 'blocking'
  details: Record<string, unknown>
}

export function scanProhibitedKeywords(text: string): PolicyCheckResult {
  const lower = text.toLowerCase()
  const hits: Record<string, string[]> = {}
  for (const [category, keywords] of Object.entries(PROHIBITED_KEYWORDS)) {
    const matched = keywords.filter((k) => lower.includes(k))
    if (matched.length) hits[category] = matched
  }
  const passed = Object.keys(hits).length === 0
  return {
    checkType: 'prohibited_content_keywords',
    passed,
    severity: passed ? 'info' : 'blocking',
    details: { hits },
  }
}

export async function reviewAdvertiserFriendliness(ai: ScriptAIProvider, scriptText: string): Promise<PolicyCheckResult> {
  const prompt = `Assess this YouTube video script against YouTube's advertiser-friendly content guidelines and
Community Guidelines. Check for: violence, hate speech, sexual content, dangerous acts/challenges, harassment,
misinformation, spam/scams, and content that would get a video demonetised or removed.
Return ONLY JSON: {"passed": true|false, "concerns": ["..."], "severity": "info|warning|blocking"}

Script: ${scriptText}`

  const raw = await ai.complete(
    [{ role: 'system', content: 'You are a YouTube policy compliance reviewer. Output only valid JSON.' }, { role: 'user', content: prompt }],
    { temperature: 0.1, maxTokens: 600, json: true }
  )
  const parsed = JSON.parse(raw.trim().replace(/^```(json)?/i, '').replace(/```$/, '')) as {
    passed: boolean
    concerns: string[]
    severity: 'info' | 'warning' | 'blocking'
  }
  return {
    checkType: 'advertiser_friendly_guidelines',
    passed: parsed.passed,
    severity: parsed.severity,
    details: { concerns: parsed.concerns },
  }
}

export async function checkTitleNotMisleading(
  ai: ScriptAIProvider,
  title: string,
  scriptText: string
): Promise<PolicyCheckResult> {
  const prompt = `Does this YouTube title accurately represent the content of the script below, with no
clickbait exaggeration, false promise, or bait-and-switch? Return ONLY JSON:
{"accurate": true|false, "reason": "..."}

Title: ${title}
Script: ${scriptText.slice(0, 4000)}`

  const raw = await ai.complete(
    [{ role: 'system', content: 'You are a strict truth-in-titling reviewer. Output only valid JSON.' }, { role: 'user', content: prompt }],
    { temperature: 0.1, maxTokens: 300, json: true }
  )
  const parsed = JSON.parse(raw.trim().replace(/^```(json)?/i, '').replace(/```$/, '')) as { accurate: boolean; reason: string }
  return {
    checkType: 'title_not_misleading',
    passed: parsed.accurate,
    severity: parsed.accurate ? 'info' : 'blocking',
    details: { reason: parsed.reason },
  }
}

const REAL_PERSON_PATTERN = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2})\b/g

export async function checkImpersonationRisk(scriptText: string, thumbnailPrompt: string): Promise<PolicyCheckResult> {
  // Heuristic: flag any capitalised multi-word name mentioned alongside
  // language implying the video shows them speaking/acting, since our
  // generated visuals must never depict a real, identifiable person as if
  // they said or did something they didn't.
  const combined = `${scriptText} ${thumbnailPrompt}`
  const names = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = REAL_PERSON_PATTERN.exec(combined))) names.add(match[1])

  const riskyPhrases = ['says', 'said', 'claims', 'announces', 'reacts', 'interview with']
  const flagged = [...names].filter((name) => {
    const idx = combined.indexOf(name)
    const window = combined.slice(Math.max(0, idx - 40), idx + 60).toLowerCase()
    return riskyPhrases.some((p) => window.includes(p))
  })

  return {
    checkType: 'impersonation_risk',
    passed: flagged.length === 0,
    severity: flagged.length ? 'blocking' : 'info',
    details: { flaggedNames: flagged, note: 'Heuristic name scan — human review recommended for any hit.' },
  }
}

export function assessSyntheticMediaDisclosure(scriptText: string): PolicyCheckResult {
  // Our pipeline never generates photorealistic depictions of real people
  // or fabricated real-world footage — visuals are stock footage (real,
  // licensed) or clearly-stylised/generated graphics, and the voice is a
  // disclosed synthetic narrator. Disclosure under YouTube's "altered or
  // synthetic content" policy is required when a video contains realistic
  // media that could be mistaken for an actual recording of a real event
  // or person; flag for manual review if the script narrates a specific
  // real, recent news event in first person or claims to show real footage.
  const lower = scriptText.toLowerCase()
  const suspectPhrases = ['exclusive footage', 'real footage of', 'in this leaked video', 'watch as [real person]']
  const flagged = suspectPhrases.some((p) => lower.includes(p))
  return {
    checkType: 'synthetic_media_disclosure',
    passed: true,
    severity: flagged ? 'warning' : 'info',
    details: {
      aiVoiceDisclosed: true,
      requiresRealisticContentDisclosure: flagged,
      note: flagged
        ? 'Script implies real footage — verify and enable "Altered or synthetic content" disclosure before upload.'
        : 'Standard AI-narration disclosure applied via description + made_for_kids/synthetic flags.',
    },
  }
}

export interface AssetLicenseCheckInput {
  assetType: string
  licenseType: string | null
  licenseUrl: string | null
}

export function checkAssetLicenses(assets: AssetLicenseCheckInput[]): PolicyCheckResult {
  const unlicensed = assets.filter((a) => !a.licenseType)
  return {
    checkType: 'media_license_records',
    passed: unlicensed.length === 0,
    severity: unlicensed.length ? 'blocking' : 'info',
    details: { unlicensedCount: unlicensed.length, totalAssets: assets.length },
  }
}

export function checkMusicLicensed(assets: AssetLicenseCheckInput[]): PolicyCheckResult {
  const music = assets.filter((a) => a.assetType === 'music')
  const passed = music.length > 0 && music.every((a) => !!a.licenseType)
  return {
    checkType: 'music_licensed',
    passed,
    severity: passed ? 'info' : 'blocking',
    details: { musicAssetCount: music.length },
  }
}

export async function persistChecks(
  supabase: SupabaseClient,
  videoId: string,
  policyResults: PolicyCheckResult[],
  copyrightResults: PolicyCheckResult[]
) {
  if (policyResults.length) {
    const { error } = await supabase.from('yt_policy_checks').insert(
      policyResults.map((r) => ({
        video_id: videoId,
        check_type: r.checkType,
        passed: r.passed,
        severity: r.severity,
        details: r.details,
      }))
    )
    if (error) throw error
  }
  if (copyrightResults.length) {
    const { error } = await supabase.from('yt_copyright_checks').insert(
      copyrightResults.map((r) => ({
        video_id: videoId,
        check_type: r.checkType,
        passed: r.passed,
        details: { ...r.details, severity: r.severity },
      }))
    )
    if (error) throw error
  }
}

export function allBlockingChecksPassed(results: PolicyCheckResult[]): boolean {
  return results.every((r) => r.severity !== 'blocking' || r.passed)
}
