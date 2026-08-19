export function zonedDateTime(now, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric",
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    hourCycle: "h23" }).formatToParts(now);
  const read = (type) => parts.find((part) => part.type === type)?.value || "";
  return { date: `${read("year")}-${read("month")}-${read("day")}`,
    time: `${read("hour")}:${read("minute")}` };
}

export function zonedLocalToUtc(date, time, timeZone) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedDateTime(new Date(candidate), timeZone);
    const [actualYear, actualMonth, actualDay] = actual.date.split("-").map(Number);
    const [actualHour, actualMinute] = actual.time.split(":").map(Number);
    const represented = Date.UTC(actualYear, actualMonth - 1, actualDay, actualHour, actualMinute);
    candidate += target - represented;
  }
  return new Date(candidate);
}
