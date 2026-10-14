// The drawn dice (luck-dice.js + luck-dice.css) and the try-it page (demo.js): the dots of every face, the cube, the turn that shows a number, the words about the score, the roll and the landing,
// the screen-reader announcement, the colours (contrast worked out from the real CSS), and a whole demo played in a simulated phone. Presentation only: the numbers still come from the engine.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import { setDefaultTimeout } from "bun:test";
setDefaultTimeout(60_000);

const pub = (f: string) => readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
const tick = (ms = 15) => new Promise((r) => setTimeout(r, ms));
const MEDIA = (reduce: boolean) => (q: string) => ({ matches: reduce && /reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });

function load(reduce = true) {
  const w: any = new Window({ url: "https://corporate-luck-by-chance.pages.dev/demo.html", width: 390, height: 780 });
  w.crypto = globalThis.crypto; w.matchMedia = MEDIA(reduce);
  w.document.body.innerHTML = '<main id="app"></main>';
  new Function("window", "document", "setTimeout", pub("luck-dice.js"))(w, w.document, (fn: any, ms?: number) => setTimeout(fn, ms));
  return { w, d: w.document, LD: w.LuckDice };
}
const { LD: L0 } = load();

describe("the faces: dots like a real dice", () => {
  test("every face 1 to 6 has exactly that many dots, on the 3 x 3 grid, symmetric like a real dice", () => {
    for (let n = 1; n <= 6; n++) {
      const cells: number[] = L0.pipsOf(n);
      expect(cells.length).toBe(n);
      expect(new Set(cells).size).toBe(n);
      for (const c of cells) { expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThanOrEqual(8); expect(cells).toContain(8 - c); } // turned half way round, the face looks the same
    }
    expect(L0.pipsOf(1)).toEqual([4]); expect(L0.pipsOf(6)).toEqual([0, 2, 3, 5, 6, 8]); expect(L0.pipsOf(5)).toContain(4);
  });
  test("the drawn face has one dot element per dot, a number, and is the same in the target and in the chips", () => {
    const { d, LD } = load();
    for (let n = 1; n <= 6; n++) {
      d.body.innerHTML = LD.faceHtml(n) + LD.miniHtml(n, "Test " + n);
      expect(d.querySelectorAll(".ld-face .ld-pip").length).toBe(n); expect(d.querySelectorAll(".ld-mini .ld-pip").length).toBe(n);
      expect(d.querySelector(".ld-mini")!.getAttribute("aria-label")).toBe("Test " + n); expect(d.querySelector(".ld-mini")!.getAttribute("data-n")).toBe(String(n));
      const cls = [...d.querySelectorAll(".ld-face .ld-pip")].map((p: any) => /p(\d)/.exec(p.className)![1]); expect(cls.map(Number).sort()).toEqual([...LD.pipsOf(n)].sort());
    }
    d.body.innerHTML = LD.miniHtml(3, "", "", true); expect(d.querySelector(".ld-mini")!.getAttribute("aria-hidden")).toBe("true"); expect(d.querySelector(".ld-mini")!.getAttribute("role")).toBeNull();
  });
  test("the cube has six faces, opposite faces add up to 7, the 6 is on top at rest, and every turn brings its own number to the front", () => {
    const { d, LD } = load();
    d.body.innerHTML = LD.dieHtml("die");
    expect([...d.querySelectorAll("#die .ld-face")].map((f: any) => Number(f.getAttribute("data-n")))).toEqual([1, 2, 3, 4, 5, 6]);
    for (let n = 1; n <= 6; n++) {
      const [x, y] = LD.TURN[n];
      expect(LD.frontFaceOf(x, y, 0)).toBe(n);
      expect(LD.frontFaceOf(x + 720, y + 1080, 360)).toBe(n); // full turns on top change nothing
    }
    for (const [a, b] of [[3, 4], [2, 5]]) { const ta = LD.TURN[a], tb = LD.TURN[b]; expect(LD.frontFaceOf(ta[0], ta[1] + 180, 0)).toBe(b); expect(LD.frontFaceOf(tb[0], tb[1] + 180, 0)).toBe(a); } // half way round about the up-down line
    expect(LD.frontFaceOf(LD.TURN[6][0] + 180, 0, 0)).toBe(1); expect(LD.frontFaceOf(LD.TURN[1][0] + 180, 0, 0)).toBe(6); // and about the left-right line for the 6 and the 1
    for (const [a, b] of [[1, 6], [2, 5], [3, 4]]) expect(a + b).toBe(7);
    expect(LD.frontFaceOf(...(LD.IDLE as [number, number, number]))).toBe(3); // at rest the 3 faces the player, the 2 shows at the side and the 6 on top
    const css = pub("luck-dice.css");
    for (const [n, t] of [[3, "rotateY(0deg)"], [2, "rotateY(90deg)"], [6, "rotateX(90deg)"], [1, "rotateX(-90deg)"], [5, "rotateY(-90deg)"], [4, "rotateY(180deg)"]]) expect(css).toContain(`.ld-cube .ld-f${n}{--ft:${t};`); // the 6 is the top face of the cube
    expect(css).toContain("perspective:640px"); expect(css).toContain("transform-style:preserve-3d"); expect(css).toContain("rotateX(-28deg) rotateY(-32deg)");
  });
});

describe("the words", () => {
  test("a match: +target points; a miss: 'Not this time, 0 points'; singular for 1", () => {
    for (let t = 1; t <= 6; t++) for (let x = 1; x <= 6; x++) {
      const s = L0.scoreLine(t, x);
      expect(s.hit).toBe(x === t); expect(s.points).toBe(x === t ? t : 0);
      expect(s.head).toBe(x === t ? `+${t} ${t === 1 ? "point" : "points"}` : "Not this time, 0 points");
      expect(s.sr).toContain(`You rolled ${x}`); expect(s.sr).toContain(x === t ? `You score ${t} ${t === 1 ? "point" : "points"}` : "You score 0 points");
    }
    expect(L0.targetWords(4)).toBe("Roll a 4 and you score 4 points. Any other number scores 0.");
    expect(L0.targetWords(1)).toBe("Roll a 1 and you score 1 point. Any other number scores 0.");
  });
  test("the screen reader hears it: one polite, atomic status region for the whole page", async () => {
    const { d, LD } = load();
    LD.announce("You rolled 4. That is the target."); await tick(90);
    const sr = d.getElementById("lt-sr")!; expect(sr.getAttribute("role")).toBe("status"); expect(sr.getAttribute("aria-live")).toBe("polite"); expect(sr.getAttribute("aria-atomic")).toBe("true");
    expect(sr.textContent).toBe("You rolled 4. That is the target.");
    LD.announce("Second."); await tick(90); expect(d.querySelectorAll("#lt-sr").length).toBe(1); expect(sr.textContent).toBe("Second.");
  });
});

describe("rolling and landing", () => {
  test("it rolls until told, then slows down and lands on the number it was given; the number is never changed", async () => {
    const { d, LD } = load(false);
    d.body.innerHTML = LD.dieHtml("die"); const el = d.getElementById("die")!;
    const ctl = LD.attach(el, "t1"); expect(el.getAttribute("data-state")).toBe("idle");
    ctl.roll(); expect(el.getAttribute("data-state")).toBe("rolling"); expect(ctl.state()).toBe("rolling");
    await tick(120); const a = (el.querySelector(".ld-cube") as any).style.transform; await tick(120); const b = (el.querySelector(".ld-cube") as any).style.transform;
    expect(a).not.toBe(b); // it is turning
    expect(el.getAttribute("data-value")).toBeNull(); expect(ctl.value()).toBe(0);
    let told = 0; ctl.land(4, 600); ctl.whenLanded((v: number) => { told = v; });
    expect(el.getAttribute("data-state")).toBe("landing");
    await tick(900);
    expect(el.getAttribute("data-state")).toBe("landed"); expect(el.getAttribute("data-value")).toBe("4"); expect(told).toBe(4); expect(ctl.landed()).toBe(true);
    const m = /rotateX\((-?[\d.]+)deg\) rotateY\((-?[\d.]+)deg\) rotateZ\((-?[\d.]+)deg\)/.exec((el.querySelector(".ld-cube") as any).style.transform)!;
    expect(LD.frontFaceOf(Number(m[1]), Number(m[2]), Number(m[3]))).toBe(4);
    ctl.land(2, 600); await tick(50); expect(el.getAttribute("data-value")).toBe("4"); // a landed dice stays landed
  });
  test("every number 1 to 6 lands on its own face, from a roll at any moment", async () => {
    for (let n = 1; n <= 6; n++) {
      const { d, LD } = load(false);
      d.body.innerHTML = LD.dieHtml("die"); const el = d.getElementById("die")!; const ctl = LD.attach(el, "k" + n);
      if (n % 2) { ctl.roll(); await tick(40 * n); }
      ctl.land(n, 600); await tick(900);
      const m = /rotateX\((-?[\d.]+)deg\) rotateY\((-?[\d.]+)deg\) rotateZ\((-?[\d.]+)deg\)/.exec((el.querySelector(".ld-cube") as any).style.transform)!;
      expect([n, el.getAttribute("data-value"), LD.frontFaceOf(Number(m[1]), Number(m[2]), Number(m[3]))]).toEqual([n, String(n), n]);
    }
  });
  test("a screen drawn again in the middle of a roll carries on, and one drawn after the landing shows the landed dice at once", async () => {
    const { d, LD } = load(false);
    d.body.innerHTML = LD.dieHtml("die"); const first = LD.attach(d.getElementById("die")!, "again"); first.roll(); first.land(5, 600);
    d.body.innerHTML = LD.dieHtml("die"); const el2 = d.getElementById("die")!; const second = LD.attach(el2, "again");
    expect(el2.getAttribute("data-state")).toBe("landing"); let told = 0; second.whenLanded((v: number) => { told = v; });
    await tick(900); expect(told).toBe(5); expect(el2.getAttribute("data-value")).toBe("5");
    d.body.innerHTML = LD.dieHtml("die"); const el3 = d.getElementById("die")!; const third = LD.attach(el3, "again");
    expect(el3.getAttribute("data-state")).toBe("landed"); expect(el3.getAttribute("data-value")).toBe("5"); expect(third.landed()).toBe(true);
    expect(LD.peek("again")).toEqual({ state: "landed", landed: true, value: 5 }); expect(LD.peek("never")).toBeNull();
  });
  test("with reduce-motion there is no tumbling: it stays still, then shows the number after a short fade", async () => {
    const { d, LD } = load(true);
    d.body.innerHTML = LD.dieHtml("die"); const el = d.getElementById("die")!; const ctl = LD.attach(el, "r1");
    const rest = (el.querySelector(".ld-cube") as any).style.transform;
    ctl.roll(); expect(el.getAttribute("data-state")).toBe("rolling"); await tick(150); expect((el.querySelector(".ld-cube") as any).style.transform).toBe(rest);
    ctl.land(6, 1800); expect(el.getAttribute("data-state")).toBe("landing"); await tick(320);
    expect(el.getAttribute("data-state")).toBe("landed"); expect(el.getAttribute("data-value")).toBe("6");
    expect(pub("luck-dice.css")).toMatch(/prefers-reduced-motion:reduce\)\{[^}]*animation:none/); expect(pub("luck-dice.css")).toContain("ld-fade");
    expect(pub("luck.css")).toMatch(/prefers-reduced-motion:reduce\)\{\s*\.lt-conf\{display:none\}/);
  });
  test("no random numbers and no inline styles in the code that draws the dice (the page's content rules allow neither a drawn number nor style attributes)", () => {
    for (const f of ["luck-dice.js", "luck.js", "demo.js", "big.js", "luck-run.js"]) expect([f, /Math\.random/.test(pub(f))]).toEqual([f, false]);
    for (const f of ["luck-dice.js", "luck.js", "demo.js", "big.js"]) expect([f, /style="/.test(pub(f))]).toEqual([f, false]);
    expect(pub("luck-dice.js")).not.toMatch(/\bfetch\(|XMLHttpRequest|\bsrc=|<img|<script/);
  });
});

// ---- colours: worked out from the CSS itself
const hexRgb = (h: string) => { const m = /^#([0-9a-f]{6})$/i.exec(h)!; return [0, 2, 4].map((i) => parseInt(m[1]!.slice(i, i + 2), 16)); };
const lum = (h: string) => { const [r, g, b] = hexRgb(h).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };
describe("colours", () => {
  const css = pub("luck-dice.css"), page = pub("luck.css");
  test("a realistic ivory dice: light cream faces and black dots (contrast at least 10:1), no coloured faces", () => {
    const faces = [...css.matchAll(/\.ld-f\d\{--ft:[^;]+;--f:(#[0-9A-Fa-f]{6})\}/g)].map((m) => m[1]!);
    expect(faces.length).toBe(6);
    for (const f of faces) { expect([f, lum(f) > 0.55]).toEqual([f, true]); expect([f, contrast(f, "#000000") >= 10]).toEqual([f, true]); expect([f, contrast(f, "#1A1A1A") >= 10]).toEqual([f, true]); } // cream, even on the shaded side
    expect(css).toMatch(/\.ld-pip\{[^}]*#1A1A1A[^}]*#000/); expect(css).toContain("radial-gradient(ellipse at center,rgba(0,0,0,.55)"); // a soft shadow on the table
    expect(css).not.toMatch(/\.ld-f\d\{--c:/);
  });
  test("the number shown in each value's colour reads on white and on the target panel (4.5:1)", () => {
    for (let n = 1; n <= 6; n++) {
      const c = new RegExp(`\\.lt-game \\.lt-c${n}\\{color:(#[0-9A-Fa-f]{6})\\}`).exec(page)![1]!;
      for (const bg of ["#FFFFFF", "#FFF4CC"]) expect([n, bg, contrast(c, bg) >= 4.5]).toEqual([n, bg, true]);
    }
  });
  test("every text and button colour pair of the play screen is at least WCAG AA (4.5:1), on both ends of every gradient", () => {
    const pairs: [string, string, string][] = [
      ["score label", "#CFE0FF", "#14284B"], ["score number", "#FFD54F", "#14284B"], ["press button", "#FFFFFF", "#C2410C"], ["press button off", "#1B2B45", "#DDE6F2"], ["next button", "#FFFFFF", "#14284B"],
      ["target text", "#4A3300", "#FFF4CC"], ["match line", "#3B2A00", "#FFD54F"], ["miss line", "#223859", "#DCE6F5"], ["chip match", "#0E4A31", "#E2F6E9"], ["chip miss", "#223859", "#E8EEF8"],
      ["felt, light end", "#FFFFFF", "#198058"], ["felt, middle", "#FFFFFF", "#167050"], ["felt, dark end", "#FFFFFF", "#0F4A38"],
      ["match felt, number", "#2D1F00", "#FFD54F"], ["match felt, number (dark end)", "#2D1F00", "#F5A623"], ["match felt, label", "#4A3300", "#F5A623"], ["match felt, label (light end)", "#4A3300", "#FFF0A8"],
      ["miss felt, light end", "#FFFFFF", "#4F72AE"], ["miss felt, middle", "#FFFFFF", "#41639C"], ["miss felt, dark end", "#FFFFFF", "#2F4A78"],
      ["countdown number", "#C2410C", "#FFFDF9"], ["place 1", "#3B2A00", "#FFD54F"], ["place 1 (light end)", "#3B2A00", "#FFE9A3"], ["place 2", "#1F2A37", "#E3E8EF"], ["place 3", "#4A2A10", "#F6D9BE"], ["pill", "#FFD54F", "#14284B"],
      ["hint and labels", "#46585D", "#EAF2FF"], ["waiting line", "#2B403E", "#F3F8F7"], ["progress label", "#0F1D1C", "#F3F8F7"],
    ];
    for (const [what, fg, bg] of pairs) expect([what, contrast(fg, bg) >= 4.5]).toEqual([what, true]);
    const has = (h: string) => page.toLowerCase().includes(h.toLowerCase()) || (h === "#FFFFFF" && /#fff[;}\s]/i.test(page));
    for (const [what, fg, bg] of pairs.filter((p) => !/waiting|progress|hint|countdown/.test(p[0]))) expect([what, has(fg), has(bg)]).toEqual([what, true, true]); // the pairs above are really the colours this CSS uses
  });
  test("animations are short (200 to 400 ms) and every one of them is off with reduce-motion", () => {
    for (const m of page.matchAll(/animation:(lt-(?:in|flip|tap|bump|bang|fadein)) ([.\d]+)s/g)) expect([m[1], Number(m[2]) <= 0.4]).toEqual([m[1], true]);
    expect(page).toMatch(/\.lt-game\.enter\{animation:lt-in \.28s/); expect(page).toMatch(/\.lt-press\.tap\{animation:lt-tap \.22s/);
    const reduced = [...page.matchAll(/@media \(prefers-reduced-motion:reduce\)\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join("\n");
    for (const k of [".lt-game.enter", ".lt-press.tap", ".lt-conf{display:none}", ".lt-chip.fresh", "::after{animation:none}"]) expect([k, reduced.includes(k)]).toEqual([k, true]);
    expect(css).toMatch(/prefers-reduced-motion:reduce\)\{[^}]*animation:none/);
  });
  test("the main button is at least 44 px high, text is at least 12 px, there is room for the notch (safe areas) and for a phone on its side", () => {
    expect(page).toMatch(/\.lt-press\{[^}]*min-height:68px/); expect(page).toContain("env(safe-area-inset-bottom)"); expect(page).toContain("env(safe-area-inset-left)"); expect(page).toContain("orientation:landscape");
    for (const m of page.matchAll(/font:\d+ (\d+)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12);
    for (const m of page.matchAll(/font-size:(\d+)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12);
    for (const m of css.matchAll(/font(?:-size)?:(?:\d+ )?(\d+)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(12);
  });
});

// ---- the try-it page, played in a simulated phone
describe("the demo page", () => {
  async function openDemo(reduce = true) {
    const w: any = new Window({ url: "https://corporate-luck-by-chance.pages.dev/demo.html", width: 360, height: 640 });
    w.crypto = globalThis.crypto; w.matchMedia = MEDIA(reduce);
    w.document.body.innerHTML = '<main id="app"></main>';
    new Function("globalThis", pub("luck-engine.js"))(w);
    for (const f of ["luck-dice.js", "demo.js"]) new Function("window", "document", "crypto", "setTimeout", pub(f))(w, w.document, globalThis.crypto, (fn: any, ms?: number) => setTimeout(fn, ms));
    await tick(60);
    return { w, d: w.document };
  }
  const frontOf = (w: any, d: any) => { const m = /rotateX\((-?[\d.]+)deg\) rotateY\((-?[\d.]+)deg\) rotateZ\((-?[\d.]+)deg\)/.exec(d.querySelector("#die .ld-cube").style.transform)!; return w.LuckDice.frontFaceOf(Number(m[1]), Number(m[2]), Number(m[3])); };
  test("the first screen: target in words and as a dice face, an idle dice, a big Press button, round 1 of 5, score 0", async () => {
    const { d } = await openDemo();
    const t = Number(d.querySelector(".lt-tn b")!.textContent); expect(t).toBeGreaterThanOrEqual(1); expect(t).toBeLessThanOrEqual(6);
    expect(d.querySelector(".lt-ts")!.textContent).toBe(`Roll a ${t} and you score ${t} ${t === 1 ? "point" : "points"}. Any other number scores 0.`);
    expect(d.querySelectorAll(".lt-tface .ld-pip").length).toBe(t);
    expect(d.querySelector(".lt-tk")!.textContent).toBe("Dice round 1 of 5"); expect(d.getElementById("lt-total")!.textContent).toBe("0");
    expect(d.getElementById("die")!.getAttribute("data-state")).toBe("idle");
    const b = d.getElementById("press") as any; expect(b.tagName).toBe("BUTTON"); expect(b.type).toBe("button"); expect(b.disabled).toBe(false); expect(b.textContent).toBe("Press the dice"); // a real button: Enter and Space work, screen readers name it
    expect(d.getElementById("lt-stage")!.getAttribute("tabindex")).toBe("-1"); expect(d.querySelector(".lt-game")!.getAttribute("aria-live")).toBe("off");
    expect(d.getElementById("die")!.getAttribute("role")).toBe("img"); expect(d.getElementById("die")!.getAttribute("aria-label")).toBeTruthy();
    expect(d.body.textContent).not.toMatch(/Points so far|Next dice round|You rolled \d/);
  });
  test("five dice rounds: each press rolls and lands; the pips equal the number; a match gives the target in points, a miss gives 0; the badge, the chips and the progress add up; then Play again", async () => {
    const { w, d } = await openDemo(); let total = 0; const seen: any[] = [];
    for (let round = 1; round <= 5; round++) {
      const t = Number(d.querySelector(".lt-tn b")!.textContent);
      (d.getElementById("press") as any).click(); await tick(80);
      expect(d.getElementById("die")!.getAttribute("data-state")).toBe("rolling"); expect((d.getElementById("press") as any).disabled).toBe(true);
      expect(d.getElementById("lt-total")!.textContent).toBe(String(total)); expect(d.getElementById("lt-num")!.textContent).toBe("?"); // the score waits for the dice
      await tick(1100);
      const die = d.getElementById("die")!; expect(die.getAttribute("data-state")).toBe("landed");
      const n = Number(die.getAttribute("data-value")); expect(n).toBeGreaterThanOrEqual(1); expect(n).toBeLessThanOrEqual(6);
      expect(frontOf(w, d)).toBe(n); expect(Number(d.getElementById("lt-num")!.textContent)).toBe(n); // the number beside it is the face
      const gain = n === t ? t : 0; total += gain; seen.push({ t, n, gain });
      expect(d.getElementById("lt-total")!.textContent).toBe(String(total));
      expect(d.getElementById("lt-verdict")!.textContent).toContain(gain ? `+${gain}` : "Not this time, 0 points");
      expect(d.querySelectorAll(".lt-chip").length).toBe(round); expect(d.querySelectorAll("#lt-segs li.hit, #lt-segs li.miss").length).toBe(round);
      const next = d.getElementById(round < 5 ? "next" : "again") as any; expect(next.textContent).toBe(round < 5 ? "Next dice round" : "Play again"); expect(next.disabled).toBe(false);
      if (round < 5) { next.click(); await tick(60); expect(d.querySelector(".lt-tk")!.textContent).toBe(`Dice round ${round + 1} of 5`); }
    }
    expect(d.getElementById("lt-verdict")!.textContent).toContain(`You scored ${total} in 5 dice rounds`);
    expect(seen.length).toBe(5);
    (d.getElementById("again") as any).click(); await tick(60);
    expect(d.getElementById("lt-total")!.textContent).toBe("0"); expect(d.querySelectorAll(".lt-chip").length).toBe(0); expect(d.querySelector(".lt-tk")!.textContent).toBe("Dice round 1 of 5");
  });
  test("with motion on, the dice tumbles for about two seconds, then the number, the points and the chip appear", async () => {
    const { d } = await openDemo(false);
    (d.getElementById("press") as any).click(); await tick(300);
    expect(d.getElementById("die")!.getAttribute("data-state")).toBe("rolling");
    await tick(900); expect(d.getElementById("die")!.getAttribute("data-state")).toBe("landing"); expect(d.getElementById("lt-num")!.textContent).toBe("?");
    await tick(1400); expect(d.getElementById("die")!.getAttribute("data-state")).toBe("landed"); expect(d.getElementById("lt-num")!.textContent).toMatch(/^[1-6]$/);
    expect(d.querySelectorAll(".lt-chip").length).toBe(1);
  });
  test("the old wording is gone from the demo and the player's page", () => {
    for (const f of ["demo.js", "luck.js"]) { const t = pub(f); expect([f, /Points so far/.test(t)]).toEqual([f, false]); expect([f, /Dice round \$\{[^}]*\}: target/.test(t)]).toEqual([f, false]); expect([f, /You rolled \$\{rolled\}/.test(t)]).toEqual([f, false]); }
  });
});
