import type { JsonValue } from "./types.js";

export function serializeJson(value: JsonValue | undefined): string {
  return JSON.stringify(value ?? {});
}

export function parseJson<TValue extends JsonValue>(value: string | null): TValue {
  if (!value) {
    return {} as TValue;
  }

  return JSON.parse(value) as TValue;
}
