export function normalizeError(err: unknown) {
  if (err instanceof Error) {
    return { message: err.message, name: err.name, stack: err.stack };
  }

  try {
    return { message: JSON.stringify(err) };
  } catch {
    return { message: String(err) };
  }
}
