<script setup lang="ts">
import { ref, watch } from "vue";
import { useLive } from "../store";
const props = defineProps<{ qq: string; name: string }>(),
  failed = ref(false),
  live = useLive();
watch(
  () => props.qq,
  () => {
    failed.value = false;
  },
);
</script>
<template>
  <span class="avatar"
    ><img
      v-if="!failed"
      :src="`/api/v1/avatars/qq/${qq}?role=${live.role}`"
      alt="QQ 头像"
      @error="failed = true"
    /><span v-else>{{ Array.from(name || "观众")[0] }}</span></span
  >
</template>
