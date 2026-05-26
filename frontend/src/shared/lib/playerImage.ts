import type { Player } from '@/shared/api/client';
import { getNbaPersonId } from './nbaIds';

/**
 * Build a list of candidate headshot URLs for a player, ordered from
 * highest to lowest quality. The component tries them sequentially via
 * onError, falling back to a coloured initials avatar.
 *
 * Sources, in priority order:
 *   1. Manually-set image_url (if any)
 *   2. NBA CDN with real person_id from our hardcoded star map (HD 1040×760)
 *   3. NBA CDN with backend-provided nba_person_id (may not be a real NBA id
 *      if the local common_player_info dump uses synthetic ids)
 *   4. cdn.ssref.net (basketball-reference CDN) — better quality than legacy
 *   5. Legacy basketball-reference.com path (low-quality jpg, last resort)
 */
export function getPlayerImageCandidates(player: Player): string[] {
  const out: string[] = [];

  if (player.image_url) out.push(player.image_url);

  // 1. Try our curated NBA person_id map — this is the most reliable source
  //    for active stars.
  const fullName =
    player.full_name?.toLowerCase() ||
    `${player.first_name || ''} ${player.last_name || ''}`.toLowerCase().trim();
  const knownId = getNbaPersonId(fullName);
  if (knownId) {
    out.push(`https://cdn.nba.com/headshots/nba/latest/1040x760/${knownId}.png`);
    out.push(`https://cdn.nba.com/headshots/nba/latest/260x190/${knownId}.png`);
  }

  // 2. Backend-provided NBA person_id. Only useful if the local dump's
  //    common_player_info table stores real NBA IDs (which it might not).
  const nbaId = player.nba_person_id;
  if (typeof nbaId === 'number' && nbaId > 0 && nbaId !== knownId) {
    out.push(`https://cdn.nba.com/headshots/nba/latest/1040x760/${nbaId}.png`);
    out.push(`https://cdn.nba.com/headshots/nba/latest/260x190/${nbaId}.png`);
  }

  // 3. Long player.id values look like NBA person_ids — try them as well.
  const fallbackId = player.id;
  if (fallbackId && fallbackId > 1000000 && fallbackId !== nbaId && fallbackId !== knownId) {
    out.push(`https://cdn.nba.com/headshots/nba/latest/1040x760/${fallbackId}.png`);
    out.push(`https://cdn.nba.com/headshots/nba/latest/260x190/${fallbackId}.png`);
  }

  // 4. basketball-reference style URLs — derived from name slices.
  const firstName = player.first_name?.toLowerCase().replace(/[^a-z]/g, '') || '';
  const lastName = player.last_name?.toLowerCase().replace(/[^a-z]/g, '') || '';
  if (lastName && firstName) {
    const lastNamePart = lastName.slice(0, 5);
    const firstNamePart = firstName.slice(0, 2);
    out.push(
      `https://www.basketball-reference.com/req/202503171/images/headshots/${lastNamePart}${firstNamePart}01.jpg`,
    );
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
