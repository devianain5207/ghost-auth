// Anti-flash: set theme and RTL direction before paint
(function() {
  var t = localStorage.getItem("ghost-auth-theme");
  if (t === "light" || t === "dark") {
    document.documentElement.setAttribute("data-theme", t);
  } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
  }
  var l = localStorage.getItem("ghost-auth-ext-locale");
  if (l && /^(ar|he|fa|ur)/.test(l)) document.documentElement.dir = "rtl";
})();
