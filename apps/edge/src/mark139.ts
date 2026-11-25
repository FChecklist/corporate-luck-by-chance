// The small mark "१३९" at the very top centre of every page (owner order, approved 2026-11-25). Exact text; apps/web/test/mark139.test.ts guards it.
// Use MARK139_STYLE once inside <head> and MARK139_DIV as the first thing inside <body>.
export const MARK139_STYLE = `<style>.mark139{position:absolute;top:0;left:0;right:0;margin:0;padding:1px 0 0;text-align:center;line-height:1;pointer-events:none;user-select:none;z-index:2147483647;font-family:"Noto Sans Devanagari","Mukta","Nirmala UI","Mangal","Kohinoor Devanagari","Devanagari Sangam MN",sans-serif;font-size:6px;font-weight:700;color:#0B2A6B}
.mark139 span{display:inline-block;border-bottom:.5px solid #7A1010;padding-bottom:.5px}</style>`;
export const MARK139_DIV = `<div class="mark139" lang="hi" aria-hidden="true"><span>१३९</span></div>`;
