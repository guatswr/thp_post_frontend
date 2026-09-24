<script setup lang="ts">
import { computed, ref, watch, nextTick, onUnmounted } from "vue";
import type { Snapshot } from "../types";
import Avatar from "./Avatar.vue";
const props = defineProps<{ snapshot: Snapshot }>();
const length = computed(
  () => Array.from(props.snapshot.current?.content || "").length,
);
const letter = ref<HTMLElement | null>(null);
let frame = 0;
watch(
  () => [props.snapshot.current?.id, props.snapshot.display.blanked],
  async () => {
    cancelAnimationFrame(frame);
    await nextTick();
    const el = letter.value;
    if (!el) return;
    el.scrollTop = 0;
    const started = performance.now(),
      // Pace the scroll from the dwell the server granted this card (service.dwell_seconds)
      // so long text is readable instead of being crammed into the base interval.
      duration = Math.max(
        3000,
        props.snapshot.display.next_switch_at * 1000 - Date.now() - 2000,
      );
    const animate = (now: number) => {
      if (!el.isConnected) return;
      const overflow = el.scrollHeight - el.clientHeight;
      if (overflow > 0)
        el.scrollTop =
          overflow *
          Math.min(1, Math.max(0, (now - started - 2000) / duration));
      if (now - started < duration + 2000)
        frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
  },
  { immediate: true },
);
onUnmounted(() => cancelAnimationFrame(frame));
</script>
<template>
  <div class="stage" :class="{ blanked: snapshot.display.blanked }">
    <div class="stage-top">
      <span>THP POST <i>现场来信</i></span
      ><span>{{ snapshot.event.name }}</span>
    </div>
    <div v-if="snapshot.display.blanked" class="stage-wait">
      <span class="stage-mark">✳</span>
      <h2>让此刻，稍作停留。</h2>
    </div>
    <article
      v-else-if="snapshot.current"
      class="stage-letter"
      :key="snapshot.current.id"
    >
      <span class="quote-mark">“</span>
      <p
        ref="letter"
        class="stage-content"
        :class="{ medium: length > 80, long: length > 160 }"
      >
        {{ snapshot.current.content }}
      </p>
      <div class="stage-person">
        <Avatar
          :qq="snapshot.current.qq_id"
          :name="snapshot.current.nickname"
        />
        <div>
          <strong>{{
            snapshot.current.nickname || snapshot.current.qq_id
          }}</strong
          ><span>QQ {{ snapshot.current.qq_id }}</span>
        </div>
        <span class="stage-number"
          >NO. {{ String(snapshot.current.event_seq).padStart(3, "0") }}</span
        >
      </div>
    </article>
    <div v-else class="stage-wait">
      <span class="stage-mark">✳</span>
      <h2>下一句，等你来说。</h2>
      <p>在活动 QQ 群发送 /投稿 你的内容</p>
    </div>
    <div class="stage-bottom">
      <span>来自现场的声音</span
      ><span>群内发送 <b>/投稿</b> 你的内容 <i>↗</i></span>
    </div>
  </div>
</template>
