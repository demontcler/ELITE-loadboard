/**
 * Company-timezone-aware date range helpers for reports/dashboard.
 */
export type DatePreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "quarter"
  | "year"
  | "custom";

export type DateRange = {
  start: Date;
  end: Date;
  label: string;
  preset: DatePreset;
};

function partsInTz(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** Approximate local midnight → UTC Date for a calendar day in timezone. */
export function zonedDayStart(year: number, month: number, day: number, timeZone: string): Date {
  // Binary-search UTC instant whose local date matches
  let guess = Date.UTC(year, month - 1, day, 12, 0, 0);
  for (let i = 0; i < 6; i++) {
    const p = partsInTz(new Date(guess), timeZone);
    const localAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const target = Date.UTC(year, month - 1, day, 0, 0, 0);
    guess += target - localAsUtc;
  }
  return new Date(guess);
}

export function zonedDayEnd(year: number, month: number, day: number, timeZone: string): Date {
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const startNext = zonedDayStart(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    timeZone
  );
  return new Date(startNext.getTime() - 1);
}

function todayParts(timeZone: string) {
  return partsInTz(new Date(), timeZone);
}

export function resolveDateRange(params: {
  preset?: string | null;
  start?: string | null;
  end?: string | null;
  timeZone?: string;
}): DateRange {
  const timeZone = params.timeZone || "America/Chicago";
  const preset = (params.preset || "this_month") as DatePreset;
  const t = todayParts(timeZone);

  if (preset === "custom" && params.start && params.end) {
    const [sy, sm, sd] = params.start.split("-").map(Number);
    const [ey, em, ed] = params.end.split("-").map(Number);
    return {
      start: zonedDayStart(sy!, sm!, sd!, timeZone),
      end: zonedDayEnd(ey!, em!, ed!, timeZone),
      label: `${params.start} → ${params.end}`,
      preset: "custom",
    };
  }

  if (preset === "today") {
    return {
      start: zonedDayStart(t.year, t.month, t.day, timeZone),
      end: zonedDayEnd(t.year, t.month, t.day, timeZone),
      label: "Today",
      preset: "today",
    };
  }

  if (preset === "yesterday") {
    const d = new Date(Date.UTC(t.year, t.month - 1, t.day - 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    return {
      start: zonedDayStart(y, m, day, timeZone),
      end: zonedDayEnd(y, m, day, timeZone),
      label: "Yesterday",
      preset: "yesterday",
    };
  }

  if (preset === "this_week") {
    // Sunday start
    const dow = new Date(Date.UTC(t.year, t.month - 1, t.day)).getUTCDay();
    const startDay = new Date(Date.UTC(t.year, t.month - 1, t.day - dow));
    return {
      start: zonedDayStart(startDay.getUTCFullYear(), startDay.getUTCMonth() + 1, startDay.getUTCDate(), timeZone),
      end: zonedDayEnd(t.year, t.month, t.day, timeZone),
      label: "This Week",
      preset: "this_week",
    };
  }

  if (preset === "last_week") {
    const dow = new Date(Date.UTC(t.year, t.month - 1, t.day)).getUTCDay();
    const thisWeekStart = new Date(Date.UTC(t.year, t.month - 1, t.day - dow));
    const lastStart = new Date(thisWeekStart.getTime() - 7 * 86400000);
    const lastEnd = new Date(thisWeekStart.getTime() - 86400000);
    return {
      start: zonedDayStart(lastStart.getUTCFullYear(), lastStart.getUTCMonth() + 1, lastStart.getUTCDate(), timeZone),
      end: zonedDayEnd(lastEnd.getUTCFullYear(), lastEnd.getUTCMonth() + 1, lastEnd.getUTCDate(), timeZone),
      label: "Last Week",
      preset: "last_week",
    };
  }

  if (preset === "last_month") {
    const d = new Date(Date.UTC(t.year, t.month - 2, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return {
      start: zonedDayStart(y, m, 1, timeZone),
      end: zonedDayEnd(y, m, lastDay, timeZone),
      label: "Last Month",
      preset: "last_month",
    };
  }

  if (preset === "quarter") {
    const qStartMonth = Math.floor((t.month - 1) / 3) * 3 + 1;
    return {
      start: zonedDayStart(t.year, qStartMonth, 1, timeZone),
      end: zonedDayEnd(t.year, t.month, t.day, timeZone),
      label: "This Quarter",
      preset: "quarter",
    };
  }

  if (preset === "year") {
    return {
      start: zonedDayStart(t.year, 1, 1, timeZone),
      end: zonedDayEnd(t.year, t.month, t.day, timeZone),
      label: "This Year",
      preset: "year",
    };
  }

  // default this_month
  return {
    start: zonedDayStart(t.year, t.month, 1, timeZone),
    end: zonedDayEnd(t.year, t.month, t.day, timeZone),
    label: "This Month",
    preset: "this_month",
  };
}

export const DATE_PRESET_OPTIONS: Array<{ value: DatePreset; label: string }> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
  { value: "custom", label: "Custom Range" },
];
