// Stand-in for S2's router.js, used only by the S3 harness.
export const views = new Map();
export function registerView(v) { views.set(v.id, v); }
