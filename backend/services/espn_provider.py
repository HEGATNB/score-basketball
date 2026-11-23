"""HTTPS transport shared by live reads and the scheduled NBA import."""

from typing import Any
from urllib.parse import quote

import requests
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba"
SCOREBOARD = f"{BASE}/scoreboard"
SUMMARY = f"{BASE}/summary"
NEWS = f"{BASE}/news"


class FeedUnavailable(Exception):
    pass


class ESPNProvider:
    def __init__(self, retries: int = 0):
        self.retries = retries

    def fetch(self, url: str, params=None) -> dict[str, Any]:
        try:
            with requests.Session() as session:
                session.mount("https://", HTTPAdapter(max_retries=Retry(
                    total=self.retries, allowed_methods={"GET"}, status_forcelist=(500, 502, 503, 504),
                    backoff_factor=0.4, respect_retry_after_header=False,
                )))
                response = session.get(
                    url, params=params, timeout=(3, 6), allow_redirects=False,
                    headers={"User-Agent": "SCORE/1.0"},
                )
                if response.status_code != 200:
                    raise FeedUnavailable(f"ESPN returned HTTP {response.status_code}")
                data = response.json()
        except (requests.RequestException, ValueError) as exc:
            raise FeedUnavailable("Could not obtain ESPN data") from exc
        if not isinstance(data, dict):
            raise FeedUnavailable("Expected an ESPN JSON object")
        key = {SCOREBOARD: "events", NEWS: "articles"}.get(url)
        if key and (
            not isinstance(data.get(key), list) or not all(isinstance(item, dict) for item in data[key])
        ):
            raise FeedUnavailable(f"Invalid ESPN {key} list")
        return data

    def scoreboard(self, date: str, limit: int = 100) -> list[dict]:
        return self.fetch(SCOREBOARD, {"dates": date, "limit": limit})["events"]

    def summary(self, event_id: str) -> dict:
        return self.fetch(SUMMARY, {"event": event_id})

    @staticmethod
    def article_url(article_id: str) -> str:
        return f"https://content.core.api.espn.com/v1/sports/news/{quote(article_id, safe='')}"
