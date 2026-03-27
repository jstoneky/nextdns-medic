// Set layout class before CSS renders to avoid flash
(function() {
  var mobile = /Android/i.test(navigator.userAgent);
  document.documentElement.classList.add(mobile ? 'is-mobile' : 'is-desktop');
  document.addEventListener('DOMContentLoaded', function() {
    document.body.classList.add(mobile ? 'mobile' : 'desktop');
  });
})();
