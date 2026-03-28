// Set layout class before CSS renders to avoid flash
(function() {
  var mobile  = /Android/i.test(navigator.userAgent);
  var safari  = window.location.href.startsWith('safari-web-extension://');
  document.documentElement.classList.add(mobile ? 'is-mobile' : 'is-desktop');
  if (safari) document.documentElement.classList.add('is-safari');
  document.addEventListener('DOMContentLoaded', function() {
    document.body.classList.add(mobile ? 'mobile' : 'desktop');
    if (safari) document.body.classList.add('safari');
  });
})();
