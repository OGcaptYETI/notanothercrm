// Loads RingCentral WebPhone v2 (ESM) with deps bundled and exposes it as a browser global
// Using esm.sh with ?bundle resolves bare imports like "mixpanel-browser" for direct browser use
// Loads RingCentral WebPhone UMD build from CDN and exposes as global RingCentral.WebPhone
(function() {
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/ringcentral-web-phone@2.2.7/dist/umd/index.min.js';
  script.onload = function() {
    window.RingCentral = window.RingCentral || {};
    window.RingCentral.WebPhone = window.RingCentral.WebPhone || window.RingCentralWebPhone || window.WebPhone;
  };
  document.head.appendChild(script);
})();
