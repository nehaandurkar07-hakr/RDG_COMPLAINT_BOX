/* guard.js - runs first (in <head>).
   Protects against clickjacking: if another website tries to show this site inside a
   hidden frame, the page stays blank and the browser is sent to the real site. */
(function () {
  'use strict';
  var hide = document.getElementById('antiClickjack');
  if (window.top === window.self) {
    if (hide && hide.parentNode) hide.parentNode.removeChild(hide);
  } else {
    try { window.top.location = window.self.location.href; } catch (e) { /* the page stays hidden */ }
  }
})();
