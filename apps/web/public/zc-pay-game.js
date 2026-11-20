/* The game's Pay-step descriptor for the console's shared flow (pack/zc-flow.js reads window.ZFLOW_GAME). Only what the Pay step needs; the values are the ones in config/console-pay.json
   (a test keeps the two the same). No price or amount here: every number comes from the console. A page loads this BEFORE pack/zc-flow.js; it adds to anything already set. */
window.ZFLOW_GAME = Object.assign(window.ZFLOW_GAME || {}, { payGame: "luckbychance", consoleOrigin: "https://console.corporatetambola.com" });
