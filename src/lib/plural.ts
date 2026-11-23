// "1 file", "13 files": the noun that agrees with the count.
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

// Only the noun, for texts such as "8 of 1 file".
export function noun(count: number, one: string, many = `${one}s`): string {
  return count === 1 ? one : many;
}
