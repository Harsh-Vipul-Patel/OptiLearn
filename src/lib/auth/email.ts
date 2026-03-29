const MAX_EMAIL_LENGTH = 254
const MAX_LOCAL_PART_LENGTH = 64
const MAX_DOMAIN_LABEL_LENGTH = 63

const LOCAL_PART_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/
const DOMAIN_LABEL_PATTERN = /^[A-Za-z0-9-]+$/

export type EmailValidationResult = {
  isValid: boolean
  normalizedEmail: string
  error: string | null
}

function invalid(normalizedEmail: string, error: string = 'Enter a valid email address.'): EmailValidationResult {
  return { isValid: false, normalizedEmail, error }
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function validateEmail(value: unknown): EmailValidationResult {
  if (typeof value !== 'string') {
    return invalid('')
  }

  const normalizedEmail = normalizeEmail(value)

  if (!normalizedEmail) {
    return invalid(normalizedEmail, 'Email is required.')
  }

  if (normalizedEmail.length > MAX_EMAIL_LENGTH) {
    return invalid(normalizedEmail, 'Email is too long.')
  }

  if (/\s/.test(normalizedEmail)) {
    return invalid(normalizedEmail)
  }

  const atIndex = normalizedEmail.indexOf('@')
  if (atIndex <= 0 || atIndex !== normalizedEmail.lastIndexOf('@') || atIndex === normalizedEmail.length - 1) {
    return invalid(normalizedEmail)
  }

  const localPart = normalizedEmail.slice(0, atIndex)
  const domainPart = normalizedEmail.slice(atIndex + 1)

  if (localPart.length > MAX_LOCAL_PART_LENGTH) {
    return invalid(normalizedEmail)
  }

  if (!LOCAL_PART_PATTERN.test(localPart)) {
    return invalid(normalizedEmail)
  }

  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    return invalid(normalizedEmail)
  }

  if (domainPart.startsWith('.') || domainPart.endsWith('.') || domainPart.includes('..')) {
    return invalid(normalizedEmail)
  }

  const domainLabels = domainPart.split('.')
  if (domainLabels.length < 2) {
    return invalid(normalizedEmail)
  }

  const hasInvalidLabel = domainLabels.some((label) => {
    return (
      !label ||
      label.length > MAX_DOMAIN_LABEL_LENGTH ||
      label.startsWith('-') ||
      label.endsWith('-') ||
      !DOMAIN_LABEL_PATTERN.test(label)
    )
  })

  if (hasInvalidLabel) {
    return invalid(normalizedEmail)
  }

  const tld = domainLabels[domainLabels.length - 1]
  if (!/^[A-Za-z]{2,63}$/.test(tld)) {
    return invalid(normalizedEmail)
  }

  return { isValid: true, normalizedEmail, error: null }
}

export function normalizeOptionalEmail(value: unknown): string | undefined {
  const result = validateEmail(value)
  return result.isValid ? result.normalizedEmail : undefined
}

export function getEmailLocalPart(value: unknown): string {
  const normalizedEmail = normalizeOptionalEmail(value)
  if (!normalizedEmail) return ''
  return normalizedEmail.split('@')[0]
}

export function getFallbackUserEmail(userId: string, email: unknown): string {
  const normalizedEmail = normalizeOptionalEmail(email)
  if (normalizedEmail) return normalizedEmail
  return `${userId}@local.invalid`
}
