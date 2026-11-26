// Phones send a device id when they join (one ticket, one device). Older tests do not care which device: they all join from the same one unless they say otherwise.
export const DEVICE = "a".repeat(32);
/** One phone, one ticket: tests that do not say which device joins get a device of their own for each invite ID (the same ID twice is the same device). */
export const deviceOf = (who: unknown): string => (Array.from(String(who ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-14)).map((c) => c.charCodeAt(0).toString(16)).join("") + "0".repeat(32)).slice(0, 32); // the ID (or an old mobile number) decides the device, so two different IDs are two different phones
export const withDevice = (method: string, path: string, body: unknown) => {
  const b = method === "POST" && /\/join$/.test(path) && body && typeof body === "object" && !("device" in (body as object)) ? { device: deviceOf((body as any).id ?? (body as any).phone) || DEVICE, ...(body as object) } : body;
  return b === undefined ? undefined : typeof b === "string" ? b : JSON.stringify(b);
};
