// The installable, saved-on-the-device game: manifest, icons and service worker are complete and actually shipped.
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const PUB = join(import.meta.dir, "../public");
const BUILD = readFileSync(join(import.meta.dir, "../../../pages/build.mjs"), "utf8");
const manifest = JSON.parse(readFileSync(join(PUB, "manifest.webmanifest"), "utf8"));
const sw = readFileSync(join(PUB, "zsw.js"), "utf8");
const filesInSw: string[] = JSON.parse(sw.match(/const FILES = (\[[\s\S]*?\]);/)![1]!);

describe("installable app (PWA)", () => {
  test("manifest is installable: name, standalone, start url, 192 and 512 icons, one maskable", () => {
    expect(manifest.name).toBe("Corporate Luck by Chance"); expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/z.html"); expect(manifest.scope).toBe("/"); expect(manifest.id).toBe("/z.html");
    expect(manifest.short_name).toBe(manifest.name); expect(manifest.orientation).toBe("any"); // a phone on its side works too, so the app is not locked to upright
    expect(manifest.theme_color).toMatch(/^#[0-9A-Fa-f]{6}$/); expect(manifest.background_color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    for (const p of ["192x192", "512x512"]) expect(manifest.icons.some((i: any) => i.sizes === p && i.purpose === "maskable")).toBe(true);
    const sizes = manifest.icons.map((i: any) => i.sizes);
    expect(sizes).toContain("192x192"); expect(sizes).toContain("512x512");
    expect(manifest.icons.some((i: any) => i.purpose === "maskable")).toBe(true);
    for (const i of manifest.icons) { const f = join(PUB, i.src.slice(1)); expect(existsSync(f)).toBe(true); expect(statSync(f).size).toBeGreaterThan(500); }
  });
  test("every file the service worker saves exists and is shipped by the Pages build", () => {
    for (const f of filesInSw) {
      expect(existsSync(join(PUB, f.slice(1)))).toBe(true);
      const top = f.slice(1).split("/")[0]!;
      expect(BUILD.includes(`"${top}"`)).toBe(true); // a whitelisted file, or the fonts/img folder
    }
    for (const f of ["zsw.js", "pwa.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"]) expect(BUILD.includes(`"${f}"`)).toBe(true);
  });
  test("the game pages (every file the phone screen loads) are all in the saved set", () => {
    const html = readFileSync(join(PUB, "z.html"), "utf8");
    const used = [...html.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]!).filter((u) => u !== "/rum.js");
    for (const u of used) expect(filesInSw).toContain(u);
    expect(filesInSw).toContain("/z.html");
  });
  test("service worker never touches the API or other sites, and the pages link manifest and installer", () => {
    expect(sw).toContain('url.pathname.startsWith("/api/")'); expect(sw).toContain("url.origin !== location.origin");
    for (const p of ["z.html", "zc.html", "big.html", "index.html", "demo.html"]) {
      const h = readFileSync(join(PUB, p), "utf8");
      expect(h).toContain('rel="manifest"'); expect(h).toContain("/pwa.js"); expect(h).toContain("apple-touch-icon");
    }
    expect(readFileSync(join(PUB, "pwa.js"), "utf8")).toContain('register("/zsw.js")');
  });
  test("the page can be added to the home screen on a phone: full-screen viewport (notch), apple touch icon 180 px, theme colour, standalone hints", () => {
    for (const p of ["z.html", "demo.html"]) {
      const h = readFileSync(join(PUB, p), "utf8");
      expect(h).toContain("viewport-fit=cover"); expect(h).toContain('name="theme-color"'); expect(h).toContain('name="apple-mobile-web-app-capable"'); expect(h).toContain('name="mobile-web-app-capable"'); expect(h).toContain('rel="apple-touch-icon" href="/apple-touch-icon.png"');
    }
    const png = (f: string) => { const b = readFileSync(join(PUB, f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
    expect(png("apple-touch-icon.png")).toEqual([180, 180]); expect(png("icon-192.png")).toEqual([192, 192]); expect(png("icon-512.png")).toEqual([512, 512]); expect(png("icon-maskable-192.png")).toEqual([192, 192]); expect(png("icon-maskable-512.png")).toEqual([512, 512]);
  });
  test("offline: the saved set holds the game pages, the demo and an offline page; a page that is not saved shows the offline page when there is no connection; old saved sets are removed", () => {
    for (const f of ["/offline.html", "/demo.html", "/demo.js", "/luck-dice.js", "/luck-dice.css", "/icon-maskable-192.png"]) expect(filesInSw).toContain(f);
    expect(sw).toContain('match("/offline.html")'); expect(sw).toContain('req.mode === "navigate"');
    const cache = /const CACHE = "([^"]+)"/.exec(sw)![1]!; expect(sw).toContain(`k.startsWith("${cache.replace(/-v\d+$/, "-")}")`); // the clean-up looks for the same name the cache has
    const off = readFileSync(join(PUB, "offline.html"), "utf8");
    expect(off).toContain("You are offline"); expect(off).not.toContain("<script"); // a plain page: nothing to run, nothing to fetch beyond the saved styles
    for (const u of [...off.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]!)) expect(filesInSw).toContain(u);
  });
  test("an installed app opens the last game: the phone page remembers its engagement", () => {
    expect(readFileSync(join(PUB, "luck.js"), "utf8")).toContain("luck:last");
  });
  test("it works silently: no banner, no button, no text of ours on any page; news only through the browser's own notification permission", () => {
    const js = readFileSync(join(PUB, "pwa.js"), "utf8");
    expect(js).not.toMatch(/innerHTML|Install app|Saving the game|saved on this device|Remind me/i); // nothing is drawn, except one small "Notify me" button
    expect((js.match(/createElement/g) ?? []).length).toBe(1); expect(js).toContain("Notify me"); expect(js).not.toContain("pointerdown"); // the permission question comes only from a tap on that button
    expect(js).toContain("preventDefault"); expect(js).toContain("Notification.permission"); expect(js).toContain("/api/notices"); expect(js).toContain("periodicSync");
    expect(sw).toContain("periodicsync"); expect(sw).toContain("notificationclick"); expect(sw).toContain('Notification.permission !== "granted"');
    expect(js + sw).not.toMatch(/pushManager|subscribe\(/); // no push subscription: we never receive an address of the visitor
  });
});
