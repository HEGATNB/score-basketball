import type { Player } from '@/shared/api/client';
import { getEspnPlayerId, getNbaPersonId } from './nbaIds';

/**
 * Build ordered player headshot candidates.
 *
 * Priority:
 *   1. manually supplied image_url
 *   2. curated ESPN PNG headshot
 *   3. NBA CDN HD fallback for large cards only when ESPN is unknown
 *
 * We intentionally do not use Basketball Reference headshots here: many of
 * them have white backgrounds and make the premium dark cards look broken.
 */export interface PlayerImageOptions {
  /** Small contexts (row avatars, 56px) → fetch the light 260×190 thumb first.
   *  Default false → big magazine cards get the crisp 1040×760 headshot. */
  thumb?: boolean;
}

export function getPlayerImageCandidates(player: Player, opts: PlayerImageOptions = {}): string[] {
  const out: string[] = [];

  if (player.image_url) out.push(player.image_url);

  // NBA CDN is only a last-resort large-card fallback; row avatars avoid it.
  const sizes = opts.thumb ? ['260x190', '1040x760'] : ['1040x760'];
  const cdn = (id: number) => sizes.map((s) => `https://cdn.nba.com/headshots/nba/latest/${s}/${id}.png`);

  // ESPN is the primary source: stable PNGs with clean card-friendly backgrounds.
  const fullName =
    player.full_name?.toLowerCase() ||
    `${player.first_name || ''} ${player.last_name || ''}`.toLowerCase().trim();

  const espnId = getEspnPlayerId(fullName);
  if (espnId) out.push(`https://a.espncdn.com/i/headshots/nba/players/full/${espnId}.png`);

  const knownId = espnId ? null : getNbaPersonId(fullName);
  if (knownId && !opts.thumb) out.push(...cdn(knownId));

  // 2. Backend-provided NBA person_id. Only useful if the local dump's
  //    common_player_info table stores real NBA IDs (which it might not).
  const nbaId = player.nba_person_id;
  if (!espnId && !opts.thumb && typeof nbaId === 'number' && nbaId > 0 && nbaId !== knownId) out.push(...cdn(nbaId));

  // 3. Long player.id values look like NBA person_ids — try them as well.
  //    (A miss just 404s and we fall through to the clean initials avatar.)
  const fallbackId = player.id;
  if (!espnId && !opts.thumb && fallbackId && fallbackId > 1000000 && fallbackId !== nbaId && fallbackId !== knownId) {
    out.push(...cdn(fallbackId));
  }

  return Array.from(new Set(out));

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
