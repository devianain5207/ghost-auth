import "./app.css";
import { initI18n } from "$lib/i18n";
import { waitLocale } from "svelte-i18n";
import App from "./App.svelte";
import { mount } from "svelte";

window.addEventListener("unhandledrejection", (e) => {
  console.error("[ghost-auth] unhandled rejection:", e.reason);
});

window.addEventListener("error", (e) => {
  console.error("[ghost-auth] uncaught error:", e.message);
});

initI18n();

waitLocale().then(() => {
  mount(App, {
    target: document.getElementById("app")!,
  });
});
