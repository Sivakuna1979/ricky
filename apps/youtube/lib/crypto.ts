import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// Server-side only. All provider API keys and OAuth tokens are encrypted
// at rest with AES-256-GCM before being written to Postgres, and are
// never sent to the browser. CREDENTIALS_ENCRYPTION_KEY must be a
// base64-encoded 32-byte key — generate one with:
//   openssl rand -base64 32

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` ' +
        'and add it to your environment before storing any provider credentials or OAuth tokens.'
    )
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY must decode to exactly 32 bytes.')
  }
  return key
}

export interface EncryptedPayload {
  ciphertext: string
  iv: string
  authTag: string
}

export function encryptSecret(plaintext: string): EncryptedPayload {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  }
}

export function decryptSecret(payload: EncryptedPayload): string {
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(payload.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ])
  return plaintext.toString('utf8')
}

export function encryptJson(value: unknown): EncryptedPayload {
  return encryptSecret(JSON.stringify(value))
}

export function decryptJson<T>(payload: EncryptedPayload): T {
  return JSON.parse(decryptSecret(payload)) as T
}
