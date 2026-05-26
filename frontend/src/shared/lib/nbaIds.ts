/**
 * Known NBA person_ids for active stars. Used to build cdn.nba.com headshot
 * URLs at HD resolution. Keyed by lowercase full name.
 *
 * Our DB's `common_player_info.person_id` is an auto-increment that doesn't
 * match the real NBA IDs, so this hand-maintained map is the most reliable
 * source for headshots. To add a new player, look up their ID at:
 *   https://www.nba.com/stats/players (Inspect headshot URL)
 */
export const NBA_PERSON_IDS: Record<string, number> = {
  // East — All-NBA / star tier
  'jayson tatum': 1628369,
  'jaylen brown': 1627759,
  'jrue holiday': 201950,
  'kristaps porzingis': 204001,
  'donovan mitchell': 1628378,
  'darius garland': 1629636,
  'evan mobley': 1630596,
  'jarrett allen': 1628386,
  'tyrese haliburton': 1630169,
  'pascal siakam': 1627783,
  'myles turner': 1626167,
  'jalen brunson': 1628973,
  'og anunoby': 1628384,
  'mikal bridges': 1628969,
  'julius randle': 203944,
  'joel embiid': 203954,
  'tyrese maxey': 1630178,
  'paul george': 202331,
  'jimmy butler': 202710,
  'bam adebayo': 1628389,
  'damian lillard': 203081,
  'giannis antetokounmpo': 203507,
  'lebron james': 2544,
  'anthony davis': 203076,
  'kyrie irving': 202681,

  // West — All-NBA / star tier
  'luka doncic': 1629029,
  'luka dončić': 1629029,
  'shai gilgeous-alexander': 1628983,
  'nikola jokic': 203999,
  'nikola jokić': 203999,
  'jamal murray': 1627750,
  'aaron gordon': 203932,
  'anthony edwards': 1630162,
  'karl-anthony towns': 1626157,
  'rudy gobert': 203497,
  'stephen curry': 201939,
  'klay thompson': 202691,
  'draymond green': 203110,
  'kevin durant': 201142,
  'devin booker': 1626164,
  'bradley beal': 203078,
  'kawhi leonard': 202695,
  'james harden': 201935,
  'paul george philly': 202331,
  'chet holmgren': 1631096,
  'josh giddey': 1630581,
  'victor wembanyama': 1641705,
  'zion williamson': 1629627,
  'brandon ingram': 1627742,
  'cj mccollum': 203468,
  'ja morant': 1629630,
  'desmond bane': 1630217,
  'jaren jackson jr.': 1628991,

  // Notable extras
  'russell westbrook': 201566,
  'demar derozan': 201942,
  'zach lavine': 203897,
  'trae young': 1629027,
  'dejounte murray': 1627749,
  'lauri markkanen': 1628374,
};

export function getNbaPersonId(fullName: string | undefined | null): number | null {
  if (!fullName) return null;
  const k = fullName.toLowerCase().trim();
  return NBA_PERSON_IDS[k] ?? null;
}
