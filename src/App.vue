<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { ArrowUpRight, Radio, LockKeyhole } from "lucide-vue-next";
import { useLive } from "./store";
const live = useLive(),
  secret = ref(""),
  eventId = ref(""),
  busy = ref(false);
onMounted(live.restore);
onUnmounted(live.disconnect);
async function submit() {
  busy.value = true;
  try {
    await live.login(secret.value, eventId.value);
    secret.value = "";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div v-if="live.loading" class="loading-page">正在连接现场…</div>
  <div v-else-if="!live.session" class="login-page">
    <section class="login-story">
      <div class="brand">
        <span class="brand-icon">↗</span> THP POST
        <span class="brand-small">现场来信</span>
      </div>
      <div>
        <div class="eyebrow"><Radio :size="16" /> LIVE MOMENTS, SHARED.</div>
        <h1>每一句话，<br />都值得被看见<span>。</span></h1>
        <p>从 QQ 群聊到现场大屏。<br />把此刻的心情，交给整个现场。</p>
      </div>
      <div class="login-foot">
        观众在群内发送 <code>/投稿 你的内容</code><span>01 — 现场互动</span>
      </div>
    </section>
    <section class="login-form">
      <div class="form-wrap">
        <LockKeyhole class="login-lock" :size="25" />
        <div class="eyebrow">
          THP / {{ live.role === "host" ? "CONTROL ROOM" : "ON SCREEN" }}
        </div>
        <h2>{{ live.role === "host" ? "进入主持控制台" : "连接现场大屏" }}</h2>
        <p class="muted">
          {{
            live.role === "host"
              ? "收听现场的声音，掌握展示的节奏。"
              : "输入本场活动的展示码，即可开始投屏。"
          }}
        </p>
        <form @submit.prevent="submit">
          <label v-if="live.role === 'screen'"
            >活动 ID<input
              v-model="eventId"
              required
              autocomplete="off"
              placeholder="由现场管理员提供" /></label
          ><label
            >{{ live.role === "host" ? "主持密码" : "展示码"
            }}<input
              v-model="secret"
              type="password"
              required
              autocomplete="current-password"
              placeholder="请输入访问凭据"
          /></label>
          <p v-if="live.error" class="error" role="alert">{{ live.error }}</p>
          <button class="primary login-submit" :disabled="busy">
            {{ busy ? "连接中…" : "进入现场" }}<ArrowUpRight :size="19" />
          </button>
        </form>
        <a
          :href="live.role === 'host' ? '/screen' : '/host'"
          class="alternate"
          >{{
            live.role === "host" ? "我要连接投屏页面 ↗" : "返回主持控制台 ↗"
          }}</a
        >
      </div>
    </section>
  </div>
  <RouterView v-else />
</template>
