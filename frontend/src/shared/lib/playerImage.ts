import type { Player } from '@/shared/api/client';

/**
 * Build a list of candidate image URLs for a player, ordered from most-likely to
 * least-likely. The component should try them sequentially via onError.
 *
 * Why a list:
 *  - basketball-reference URLs are derived from a player code that we can't
 *    reliably reconstruct from name (we only know first/last name slices).
 *  - NBA CDN headshots use the NBA `person_id`. If our row carries an id that
 *    looks like an NBA person_id (numeric, 7+ digits), we use it. Otherwise we
 *    skip that source.
 *  - ESPN CDN works with their own slug, but we don't have it.
 *
 * The component falls back to a custom initials avatar if all candidates fail.
 */
export function getPlayerImageCandidates(player: Player): string[] {
  const out: string[] = [];

  if (player.image_url) out.push(player.image_url);

  // NBA CDN — only meaningful if `id` looks like a real NBA person_id.
  // Our internal `players.id` is a small auto-increment, so this URL will 404.
  // We still try it: if there is ANY id ≥ 7 digits we treat it as person_id.
  const id = player.id;
  if (id && id > 1000000) {
    out.push(`https://cdn.nba.com/headshots/nba/latest/260x190/${id}.png`);
    out.push(`https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`);
  }

  // basketball-reference — derived from name slices. Often correct, often not.
  const firstName = player.first_name?.toLowerCase().replace(/[^a-z]/g, '') || '';
  const lastName = player.last_name?.toLowerCase().replace(/[^a-z]/g, '') || '';
  if (lastName && firstName) {
    const lastNamePart = lastName.slice(0, 5);
    const firstNamePart = firstName.slice(0, 2);
    out.push(
      `https://www.basketball-reference.com/req/202503171/images/players/${lastNamePart}${firstNamePart}01.jpg`,
    );
  }

  return out;
}

export function getPlayerInitials(player: Player): string {
  const fn = (player.first_name || '').trim();
  const ln = (player.last_name || '').trim();
  if (fn && ln) return (fn[0] + ln[0]).toUpperCase();
  if (player.full_name) {
    const parts = player.full_name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  }
  return 'NBA';
}
