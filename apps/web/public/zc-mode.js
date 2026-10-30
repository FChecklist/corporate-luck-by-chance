/* Which organizer screens open at /zc. For this release the previous console is the only one: the new five-step screens (pack/zc-flow.js) look for the sign-in key under a different name than this game stores it, so they stay hidden.
   An address that carries flow=new or flow=old is cleaned (the word is taken out) and opens the previous console, so zc.js and pack/zc-flow.js both see no flow word.
   Nothing is stored on the device. */
(function () {
  try {
    var q = new URLSearchParams(location.search);
    if (q.has("flow")) {
      q.delete("flow");
      var rest = q.toString();
      try { history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash); } catch (e) { /* the address stays; the page opens as before */ }
    }
    window.CT_ZCFLOW = "old";
  } catch (e) { /* the page then opens as before */ }
})();
