// Web search + image generation tools. Both use configurable providers so the
// platform stays vendor-neutral.

// ---- Web search (Serper.dev-compatible by default) -----------------------
export async function webSearch(query: string): Promise<string> {
  const key = process.env.SERPER_API_KEY
  if (!key) return 'Web search is not configured for this workspace.'

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 5 }),
    })
    if (!res.ok) return `Web search failed (${res.status}).`
    const data = await res.json()
    const organic: any[] = data?.organic ?? []
    if (!organic.length) return 'No results found.'
    return organic
      .slice(0, 5)
      .map((r, i) => `${i + 1}. ${r.title}\n${r.snippet ?? ''}\n${r.link}`)
      .join('\n\n')
  } catch (e) {
    return `Web search error: ${(e as Error).message}`
  }
}

// ---- Image generation (OpenAI-compatible images endpoint by default) -----
// Returns a public image URL, or an error string.
export async function generateImage(prompt: string): Promise<string> {
  const apiUrl = process.env.IMAGE_API_URL
  const apiKey = process.env.IMAGE_API_KEY
  if (!apiUrl || !apiKey) return 'Image generation is not configured for this workspace.'

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.IMAGE_MODEL ?? 'gpt-image-1',
        prompt,
        n: 1,
        size: '1024x1024',
      }),
    })
    if (!res.ok) return `Image generation failed (${res.status}).`
    const data = await res.json()
    const url = data?.data?.[0]?.url
    const b64 = data?.data?.[0]?.b64_json
    if (url) return url
    if (b64) return `data:image/png;base64,${b64}`
    return 'Image generation returned no image.'
  } catch (e) {
    return `Image generation error: ${(e as Error).message}`
  }
}
