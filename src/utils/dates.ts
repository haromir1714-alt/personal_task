import { format, isValid, parseISO } from "date-fns";
export const localDay = (date = new Date()) => format(date, "yyyy-MM-dd");
export function validDay(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    isValid(parseISO(value)) &&
    localDay(parseISO(value)) === value
  );
}
export function validTime(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(
      value,
    )
  )
    return false;
  return validDay(value.slice(0, 10)) && isValid(parseISO(value));
}
