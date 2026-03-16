/** Extract default values from a Leva-style param schema.
 *
 * Handles both object-shaped params (e.g. `{ value: 42, min: 0, max: 100 }`)
 * and raw primitives (e.g. `0.5`). Returns a flat key→value record.
 */
export function extractParamValues(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const [key, def] of Object.entries(params)) {
    values[key] =
      def && typeof def === 'object' && 'value' in def
        ? (def as { value: unknown }).value
        : def
  }
  return values
}
