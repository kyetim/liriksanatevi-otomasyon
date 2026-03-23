import { safeStorage } from 'electron'

// Şifrelenmiş değerler "enc:" öneki ile saklanır
const PREFIX = 'enc:'

// Hassas ayar anahtarları — bu anahtarlar DB'ye kaydedilmeden önce şifrelenir
export const SENSITIVE_KEYS = new Set(['netgsm_usercode', 'netgsm_password'])

/**
 * Bir değeri OS keychain üzerinden şifreler.
 * safeStorage kullanılamıyorsa değeri düz metin olarak döner (yedek davranış).
 */
export function encryptCredential(plainText: string): string {
  if (!plainText) return plainText
  if (!safeStorage.isEncryptionAvailable()) return plainText
  try {
    const encrypted = safeStorage.encryptString(plainText)
    return PREFIX + encrypted.toString('base64')
  } catch {
    return plainText
  }
}

/**
 * "enc:" önekiyle saklanan değeri çözer.
 * Önek yoksa değeri olduğu gibi döner (düz metin legacy değeri).
 */
export function decryptCredential(stored: string): string {
  if (!stored || !stored.startsWith(PREFIX)) return stored
  if (!safeStorage.isEncryptionAvailable()) return ''
  try {
    const buffer = Buffer.from(stored.slice(PREFIX.length), 'base64')
    return safeStorage.decryptString(buffer)
  } catch {
    return ''
  }
}
