export function initials(u: { firstName: string | null; lastName: string | null }) {
  return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || 'U';
}