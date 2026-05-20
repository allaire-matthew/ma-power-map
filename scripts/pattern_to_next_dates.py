#!/usr/bin/env python3
"""Compute next meeting date(s) from a recurring-pattern string.

Used when a school committee doesn't publish specific future dates but
has a documented recurring schedule like '2nd/4th Tuesday monthly 7pm'.
The output feeds into next-school-committee-meetings.json so every district
can show a date, not just a status.
"""
from __future__ import annotations
import datetime
import re
from typing import Optional

DAYS = {
    "mon": 0, "monday": 0,
    "tue": 1, "tues": 1, "tuesday": 1,
    "wed": 2, "wednesday": 2,
    "thu": 3, "thur": 3, "thurs": 3, "thursday": 3,
    "fri": 4, "friday": 4,
    "sat": 5, "saturday": 5,
    "sun": 6, "sunday": 6,
}

ORD_MAP = {
    "1st": 1, "first": 1, "one": 1,
    "2nd": 2, "second": 2, "two": 2,
    "3rd": 3, "third": 3, "three": 3,
    "4th": 4, "fourth": 4, "four": 4,
    "5th": 5, "fifth": 5,
    "last": -1, "final": -1,
}

# Months where school committees typically don't meet (summer)
DARK_MONTHS = {7, 8}


def parse_pattern(pattern: str) -> dict:
    """Parse a free-text pattern into structured rules."""
    if not pattern:
        return {}
    p = pattern.lower()
    # Days of week mentioned
    days = set()
    for word in re.findall(r"\b[a-z]+\b", p):
        if word in DAYS:
            days.add(DAYS[word])
    # Ordinals
    ords = []
    for word in re.findall(r"\b[a-z0-9]+\b", p):
        if word in ORD_MAP:
            ords.append(ORD_MAP[word])
    # Special phrases
    every_other = "every other" in p or "biweekly" in p
    every_week = re.search(r"\bevery\b(?!\s+other)", p) is not None
    twice_monthly = "twice monthly" in p or "twice a month" in p or "twice per month" in p
    return {
        "days": sorted(days),
        "ordinals": sorted(set(ords)),
        "every_other": every_other,
        "every_week": every_week,
        "twice_monthly": twice_monthly,
    }


def nth_weekday_of_month(year: int, month: int, weekday: int, n: int) -> Optional[datetime.date]:
    """Return the nth occurrence of weekday in (year, month). n=-1 → last."""
    first = datetime.date(year, month, 1)
    if n == -1:
        # Walk backwards from end of month
        if month == 12:
            next_first = datetime.date(year + 1, 1, 1)
        else:
            next_first = datetime.date(year, month + 1, 1)
        last_day = next_first - datetime.timedelta(days=1)
        d = last_day
        while d.weekday() != weekday:
            d -= datetime.timedelta(days=1)
        return d if d.month == month else None
    # nth occurrence
    d = first
    while d.weekday() != weekday:
        d += datetime.timedelta(days=1)
    d += datetime.timedelta(days=7 * (n - 1))
    return d if d.month == month else None


def next_dates(pattern: str, start: datetime.date, count: int = 3) -> list[datetime.date]:
    rules = parse_pattern(pattern)
    if not rules.get("days"):
        return []
    days = rules["days"]
    ords = rules["ordinals"] or ([1, 3] if rules.get("twice_monthly") else [])
    results: list[datetime.date] = []

    if ords:
        # Iterate months forward
        year, month = start.year, start.month
        while len(results) < count and (year, month) < (start.year + 1, start.month):
            if month not in DARK_MONTHS:
                for n in ords:
                    for day in days:
                        d = nth_weekday_of_month(year, month, day, n)
                        if d and d >= start and d not in results:
                            results.append(d)
            month += 1
            if month > 12:
                month = 1
                year += 1
    elif rules.get("every_other"):
        # Bi-weekly cadence — pick first day match, then add 14d
        for day in days:
            d = start
            while d.weekday() != day:
                d += datetime.timedelta(days=1)
            while len(results) < count:
                if d.month not in DARK_MONTHS:
                    results.append(d)
                d += datetime.timedelta(days=14)
    elif rules.get("every_week"):
        for day in days:
            d = start
            while d.weekday() != day:
                d += datetime.timedelta(days=1)
            while len(results) < count:
                if d.month not in DARK_MONTHS:
                    results.append(d)
                d += datetime.timedelta(days=7)
    else:
        # Pattern mentions day(s) but no cadence — guess 1st occurrence per month
        year, month = start.year, start.month
        while len(results) < count and (year, month) < (start.year + 1, start.month):
            if month not in DARK_MONTHS:
                for day in days:
                    d = nth_weekday_of_month(year, month, day, 1)
                    if d and d >= start and d not in results:
                        results.append(d)
            month += 1
            if month > 12:
                month = 1
                year += 1
    results.sort()
    return results[:count]


# Quick self-test
if __name__ == "__main__":
    today = datetime.date(2026, 5, 20)
    cases = [
        "2nd/4th Tuesday monthly at 7pm",
        "1st Wednesday monthly",
        "every other Thursday 6:30pm",
        "Tuesdays 6:30pm",
        "third Wednesday 6pm",
        "last Monday of the month",
        "twice monthly",
    ]
    for p in cases:
        ds = next_dates(p, today, 3)
        print(f"{p!r} → {[d.isoformat() for d in ds]}")
