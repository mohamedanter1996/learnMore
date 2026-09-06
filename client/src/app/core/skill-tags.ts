/**
 * Readable names for the skill tags carried by scenario rubric points.
 *
 * Shared rather than duplicated per component: the tags are the cross-scenario axis the whole
 * weakness view is built on, and two screens drifting on what `measures-first` is called would
 * make the same habit look like two different ones.
 */
export const SKILL_TAG_LABELS: Record<string, string> = {
  'asks-before-building': 'Asks before building',
  'measures-first': 'Measures before optimizing',
  'names-tradeoff': 'Names the trade-off',
  'considers-rollback': 'Plans the rollback',
  'scopes-blast-radius': 'Scopes the blast radius',
  'talks-cost': 'Talks about cost',
  'writes-it-down': 'Writes it down clearly',
  'checks-with-humans': 'Checks with the humans',
  'reads-the-evidence': 'Reads the evidence',
  'avoids-trap': 'Avoids the obvious trap'
};

export function skillTagLabel(tag: string): string {
  return SKILL_TAG_LABELS[tag] ?? tag;
}
