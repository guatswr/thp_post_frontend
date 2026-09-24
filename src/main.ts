import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import Host from "./views/Host.vue";
import Screen from "./views/Screen.vue";
import "./style.css";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/host" },
    { path: "/host", component: Host },
    { path: "/screen", component: Screen },
  ],
});
createApp(App).use(createPinia()).use(router).mount("#app");
