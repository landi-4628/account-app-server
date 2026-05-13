/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeEntityId(value) {
  if (value === undefined || value === null) {
    return null
  }

  const trimmed = String(value).trim()
  return trimmed === '' ? null : trimmed
}
