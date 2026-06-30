export function readJsonStorage(storage, key, fallback, validate = () => true) {
  const rawValue = storage.getItem(key);
  if (rawValue === null) return fallback;

  try {
    const parsedValue = JSON.parse(rawValue);
    if (!validate(parsedValue)) throw new TypeError(`Invalid stored value for ${key}`);
    return parsedValue;
  } catch (error) {
    console.warn(`[storage] Removed invalid value for "${key}".`, error);
    storage.removeItem(key);
    return fallback;
  }
}

export function readLocalJson(key, fallback, validate) {
  return readJsonStorage(localStorage, key, fallback, validate);
}
