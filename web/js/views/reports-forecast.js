// Reports sections for lifespan forecast (gap 3) and insurance value (gap 4). Owned by G3; F0 ships empty stubs.
// Both are synchronous and take data = { assets, expenses, projects, rooms, tasks } (arrays from HB.list).
// Return a DOM node, or null when there is nothing to show. reports.js adds a "Lifespan" tab only when
// lifespanSection() returns a node, and appends insuranceSection() to the Inventory tab when it returns a node.
export function lifespanSection(data) { return null; }
export function insuranceSection(data) { return null; }
