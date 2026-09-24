<script setup lang="ts">
import { ref } from "vue";
import { Maximize } from "lucide-vue-next";
import { useLive } from "../store";
import Stage from "../components/Stage.vue";
const live = useLive(),
  entered = ref(false);
async function fullscreen() {
  try {
    await document.documentElement.requestFullscreen();
    entered.value = true;
  } catch {
    entered.value = false;
  }
}
</script>
<template>
  <main class="screen-page">
    <Stage v-if="live.snapshot" :snapshot="live.snapshot" /><button
      v-if="!entered"
      class="fullscreen"
      @click="fullscreen"
    >
      <Maximize :size="18" />进入全屏
    </button>
    <div v-if="live.connection !== 'live'" class="screen-offline">
      连接恢复中 · 暂留当前画面
    </div>
  </main>
</template>
