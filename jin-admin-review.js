(function (root) {
  'use strict';
  const cache = new WeakMap();

  // The source table stays intact. Reviewed phases and dated notes are applied
  // to one cached view, shared by every annual snapshot.
  function prepare(raw) {
    if (!raw || typeof raw !== 'object') return raw;
    const review = root.JIN_ADMIN_REVIEW_DATA;
    if (!review) return raw;
    const prior = cache.get(raw);
    if (prior && prior.review === review) return prior.value;
    const value = JSON.parse(JSON.stringify(raw));
    const entities = new Map();
    for (const state of value.states || []) {
      entities.set(state.id, state);
      for (const prefecture of state.prefectures || []) {
        entities.set(prefecture.id, prefecture);
        for (const county of prefecture.counties || []) {
          entities.set(`${prefecture.id}/${county.id}`, county);
        }
      }
    }
    for (const patch of review.overrides || []) {
      const entity = entities.get(patch.key);
      if (!entity) throw new Error(`Unknown Jin review entity: ${patch.key}`);
      if (patch.base_name !== undefined) entity.base_name = patch.base_name;
      if (patch.phases) entity.phases = JSON.parse(JSON.stringify(patch.phases));
      if (patch.year_notes) {
        entity.year_notes = {...entity.year_notes};
        for (const [year, note] of Object.entries(patch.year_notes)) {
          const before = entity.year_notes[year];
          entity.year_notes[year] = before
            ? {summary: [before.summary, note.summary].filter(Boolean).join('；'), sources: [...(before.sources || []), ...(note.sources || [])]}
            : note;
        }
      }
    }
    value.review_policy = review.policy;
    value.reviewed_at = review.reviewed_at;
    cache.set(raw, {review, value});
    return value;
  }
  root.JIN_ADMIN_REVIEW = {prepare};
})(typeof window === 'undefined' ? globalThis : window);
