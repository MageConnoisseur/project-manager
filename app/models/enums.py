from enum import Enum


class RecurrenceUnit(str, Enum):
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
