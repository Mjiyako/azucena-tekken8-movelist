const AUTHORS = new Set(['RyzingSol', 'TheFURY']);
const videoId = url => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !['www.youtube.com', 'youtube.com'].includes(parsed.hostname) || parsed.pathname !== '/watch') return null;
    const id = parsed.searchParams.get('v');
    return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : null;
  } catch { return null; }
};

export function applyCreatorOverrides(combos, overrides, roster) {
  if (overrides.schemaVersion !== 1 || overrides.season !== 3 || !overrides.characters || Array.isArray(overrides.characters)) throw new Error('Invalid creator override document.');
  const allowed = new Set(roster.map(character => character.id));
  let result = [...combos];
  for (const [character, review] of Object.entries(overrides.characters)) {
    const video = videoId(review.videoUrl);
    if (!allowed.has(character) || !AUTHORS.has(review.author) || !video || review.complete !== true
      || !Number.isFinite(Date.parse(review.publishedAt)) || !Number.isFinite(Date.parse(review.verifiedAt))
      || typeof review.verificationNotes !== 'string' || !review.verificationNotes.trim()
      || !Array.isArray(review.combos) || !review.combos.length) throw new Error(`Incomplete creator review for ${character}; existing combos must be kept.`);
    const ids = new Set();
    const replacement = review.combos.map(combo => {
      if (!combo.id?.startsWith(`creator-${character}-`) || ids.has(combo.id)
        || combo.character !== character || !combo.notation?.trim()
        || !Number.isInteger(combo.damage) || combo.damage <= 0
        || (combo.hits !== null && (!Number.isInteger(combo.hits) || combo.hits <= 0))
        || !Array.isArray(combo.conditions) || !combo.conditions.every(item => typeof item === 'string')
        || videoId(combo.sourceUrl) !== video || !Number.isFinite(combo.videoTimestampSeconds) || combo.videoTimestampSeconds < 0
        || typeof combo.damageBasis !== 'string' || !combo.damageBasis.trim()) {
        throw new Error(`Invalid video combo ${combo.id || '(missing ID)'} for ${character}.`);
      }
      ids.add(combo.id);
      return { ...combo, author: review.author, season: 3,
        seasonLabel: combo.patch || 'Season 3 video · patch unspecified',
        seasonEvidence: review.verificationNotes,
        verifiedAt: review.verifiedAt, sourceVideoPublishedAt: review.publishedAt };
    });
    // A complete reviewed video replaces every previous combo for this character.
    result = result.filter(combo => combo.character !== character).concat(replacement);
  }
  const ids = result.map(combo => combo.id);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate combo IDs after creator replacement.');
  return result.sort((a, b) => a.character.localeCompare(b.character) || b.damage - a.damage || a.id.localeCompare(b.id));
}
