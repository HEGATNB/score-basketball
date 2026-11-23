"""NBA team identities shared by the archive and ESPN feeds."""

TEAMS = (
    (1610612737, 1, "ATL", "Atlanta Hawks", "Atlanta", "Eastern"),
    (1610612738, 2, "BOS", "Boston Celtics", "Boston", "Eastern"),
    (1610612751, 17, "BKN", "Brooklyn Nets", "Brooklyn", "Eastern"),
    (1610612766, 30, "CHA", "Charlotte Hornets", "Charlotte", "Eastern"),
    (1610612741, 4, "CHI", "Chicago Bulls", "Chicago", "Eastern"),
    (1610612739, 5, "CLE", "Cleveland Cavaliers", "Cleveland", "Eastern"),
    (1610612742, 6, "DAL", "Dallas Mavericks", "Dallas", "Western"),
    (1610612743, 7, "DEN", "Denver Nuggets", "Denver", "Western"),
    (1610612765, 8, "DET", "Detroit Pistons", "Detroit", "Eastern"),
    (1610612744, 9, "GSW", "Golden State Warriors", "San Francisco", "Western"),
    (1610612745, 10, "HOU", "Houston Rockets", "Houston", "Western"),
    (1610612754, 11, "IND", "Indiana Pacers", "Indianapolis", "Eastern"),
    (1610612746, 12, "LAC", "LA Clippers", "Los Angeles", "Western"),
    (1610612747, 13, "LAL", "Los Angeles Lakers", "Los Angeles", "Western"),
    (1610612763, 29, "MEM", "Memphis Grizzlies", "Memphis", "Western"),
    (1610612748, 14, "MIA", "Miami Heat", "Miami", "Eastern"),
    (1610612749, 15, "MIL", "Milwaukee Bucks", "Milwaukee", "Eastern"),
    (1610612750, 16, "MIN", "Minnesota Timberwolves", "Minneapolis", "Western"),
    (1610612740, 3, "NOP", "New Orleans Pelicans", "New Orleans", "Western"),
    (1610612752, 18, "NYK", "New York Knicks", "New York", "Eastern"),
    (1610612760, 25, "OKC", "Oklahoma City Thunder", "Oklahoma City", "Western"),
    (1610612753, 19, "ORL", "Orlando Magic", "Orlando", "Eastern"),
    (1610612755, 20, "PHI", "Philadelphia 76ers", "Philadelphia", "Eastern"),
    (1610612756, 21, "PHX", "Phoenix Suns", "Phoenix", "Western"),
    (1610612757, 22, "POR", "Portland Trail Blazers", "Portland", "Western"),
    (1610612758, 23, "SAC", "Sacramento Kings", "Sacramento", "Western"),
    (1610612759, 24, "SAS", "San Antonio Spurs", "San Antonio", "Western"),
    (1610612761, 28, "TOR", "Toronto Raptors", "Toronto", "Eastern"),
    (1610612762, 26, "UTA", "Utah Jazz", "Salt Lake City", "Western"),
    (1610612764, 27, "WAS", "Washington Wizards", "Washington", "Eastern"),
)

BY_NBA_ID = {team[0]: team for team in TEAMS}
BY_ESPN_ID = {str(team[1]): team for team in TEAMS}
BY_ABBREV = {team[2]: team for team in TEAMS}
DIVISION_BY_ABBREV = {
    abbrev: division
    for division, teams in (
        ("Atlantic", "BOS BKN NYK PHI TOR"),
        ("Central", "CHI CLE DET IND MIL"),
        ("Southeast", "ATL CHA MIA ORL WAS"),
        ("Northwest", "DEN MIN OKC POR UTA"),
        ("Pacific", "GSW LAC LAL PHX SAC"),
        ("Southwest", "DAL HOU MEM NOP SAS"),
    )
    for abbrev in teams.split()
}
ALIASES = {"BRK": "BKN", "GS": "GSW", "NO": "NOP", "NY": "NYK", "PHO": "PHX",
           "SA": "SAS", "UTAH": "UTA", "WSH": "WAS"}


def normalize_abbrev(value: str) -> str:
    abbrev = value.upper()
    return ALIASES.get(abbrev, abbrev)
