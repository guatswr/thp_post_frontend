<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import {
  Radio,
  MonitorUp,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  EyeOff,
  Eye,
  Search,
  ArrowDown,
  LogOut,
  SlidersHorizontal,
  Inbox,
  RotateCcw,
} from "lucide-vue-next";
import { useLive } from "../store";
import type { Submission } from "../types";
import Avatar from "../components/Avatar.vue";
import Stage from "../components/Stage.vue";
const live = useLive(),
  items = ref<Submission[]>([]),
  next = ref<string | null>(null);
const search = ref(""),
  visibility = ref("all"),
  busy = ref(false),
  listBusy = ref(false);
const seenTotal = ref(0),
  loaded = ref(false),
  interval = ref(12),
  activeTab = ref("feed");
const following = ref(true);
const metrics = ref<{
  sse_connections: number;
  ingest_requests: number;
  ingest_failures: number;
  ingest_p95_ms: number | null;
  disk_free_bytes: number;
} | null>(null);
async function loadMetrics() {
  if (!live.session) return;
  try {
    metrics.value = await live.api(`/events/${live.session.event_id}/metrics`);
  } catch (e) {
    live.error = (e as Error).message;
  }
}
watch(activeTab, (value) => {
  if (value === "settings") void loadMetrics();
});
watch(
  () => live.snapshot?.counts.total,
  () => {
    if (
      loaded.value &&
      following.value &&
      !search.value &&
      visibility.value === "all"
    )
      void load(false, true);
  },
);
const fresh = computed(() =>
  Math.max(0, (live.snapshot?.counts.total || 0) - seenTotal.value),
);
const status = computed(() =>
  live.snapshot?.display.blanked
    ? "待机画面"
    : live.snapshot?.display.paused
      ? "已暂停"
      : live.snapshot?.display.mode === "manual"
        ? "手动展示"
        : "自动轮播",
);
async function load(more = false, automatic = false) {
  if (!live.session || listBusy.value) return;
  listBusy.value = true;
  const totalAtStart = live.snapshot?.counts.total || 0;
  try {
    const query = new URLSearchParams({
      q: search.value,
      visibility: visibility.value,
    });
    if (more && next.value) query.set("before", next.value);
    const data = await live.api<{
      items: Submission[];
      next_cursor: string | null;
    }>(`/events/${live.session.event_id}/submissions?${query}`);
    if (automatic && !following.value) return;
    items.value = more ? [...items.value, ...data.items] : data.items;
    following.value = !more;
    next.value = data.next_cursor;
    seenTotal.value = totalAtStart;
    loaded.value = true;
  } catch (e) {
    live.error = (e as Error).message;
  } finally {
    listBusy.value = false;
    if (
      following.value &&
      !search.value &&
      visibility.value === "all" &&
      (live.snapshot?.counts.total || 0) > totalAtStart
    )
      void load(false, true);
  }
}
async function control(action: string, value?: string | number) {
  if (busy.value) return;
  busy.value = true;
  try {
    await live.mutate("/control", { action, value });
  } finally {
    busy.value = false;
  }
}
async function hide(item: Submission) {
  if (busy.value) return;
  busy.value = true;
  try {
    if (
      await live.mutate(
        `/submissions/${item.id}`,
        { hidden: !item.hidden_at },
        "PATCH",
      )
    )
      item.hidden_at = item.hidden_at ? null : new Date().toISOString();
  } finally {
    busy.value = false;
  }
}
async function toggleAccepting() {
  if (!busy.value) {
    busy.value = true;
    try {
      await live.mutate(
        "/settings",
        { accepting: !live.snapshot?.event.accepting },
        "PATCH",
      );
    } finally {
      busy.value = false;
    }
  }
}
function keys(event: KeyboardEvent) {
  if (
    (event.target as HTMLElement).closest(
      "input,textarea,select,button,[contenteditable]",
    )
  )
    return;
  if (event.key === "ArrowRight") {
    event.preventDefault();
    void control("next");
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    void control("previous");
  }
}
function trackScroll(event: Event) {
  const target = event.target as HTMLElement;
  if (target.classList?.contains("feed-list"))
    following.value = target.scrollTop < 15;
}
onMounted(() => {
  void load();
  interval.value = live.snapshot?.display.interval_seconds || 12;
  window.addEventListener("keydown", keys);
  window.addEventListener("scroll", trackScroll, true);
});
onUnmounted(() => {
  window.removeEventListener("keydown", keys);
  window.removeEventListener("scroll", trackScroll, true);
});
const time = (s: string) =>
  new Date(s).toLocaleTimeString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
  });
</script>

<template>
  <div class="host-shell">
    <aside class="sidebar">
      <a class="brand" href="/host"
        ><span class="brand-icon">↗</span> THP POST</a
      >
      <div class="sidebar-label">现场工作台</div>
      <button
        :class="{ active: activeTab === 'feed' }"
        @click="activeTab = 'feed'"
      >
        <Inbox :size="19" />现场投稿
        <span>{{ live.snapshot?.counts.total || 0 }}</span></button
      ><button
        :class="{ active: activeTab === 'settings' }"
        @click="activeTab = 'settings'"
      >
        <SlidersHorizontal :size="19" />展示设置</button
      ><a href="/screen" target="_blank" rel="noopener"
        ><MonitorUp :size="19" />打开投屏页 ↗</a
      >
      <div class="sidebar-bottom">
        <div class="side-note">
          <Radio :size="21" />
          <p>每一句话，<br />都值得被看见。</p>
          <small>LIVE MOMENTS, SHARED.</small>
        </div>
        <button @click="live.logout"><LogOut :size="17" />退出控制台</button>
      </div>
    </aside>
    <main class="workspace">
      <header class="topbar">
        <span
          >控制台 <span class="crumb">/</span>
          {{ activeTab === "feed" ? "现场投稿" : "展示设置" }}</span
        ><span class="connection" :class="live.connection"
          ><i />{{
            live.connection === "live" ? "实时连接正常" : "连接恢复中"
          }}</span
        >
      </header>
      <div class="workspace-body">
        <div class="page-heading">
          <div>
            <div class="eyebrow">LIVE SUBMISSIONS</div>
            <h1>{{ live.snapshot?.event.name || "现场来信" }}</h1>
            <p>让群里的声音，成为现场的一部分。</p>
          </div>
          <button
            class="accept-toggle"
            :class="{ closed: !live.snapshot?.event.accepting }"
            :disabled="busy"
            @click="toggleAccepting"
          >
            <span class="switch"><i /></span
            >{{
              live.snapshot?.event.accepting ? "正在接收投稿" : "已关闭投稿"
            }}
          </button>
        </div>
        <div v-if="live.error" class="error banner" role="alert">
          {{ live.error }}<button @click="live.error = ''">关闭</button>
        </div>
        <div class="stats">
          <div>
            <span>全部投稿</span
            ><strong>{{
              String(live.snapshot?.counts.total || 0).padStart(2, "0")
            }}</strong
            ><small>来自观众的现场来信</small>
          </div>
          <div>
            <span>可展示</span
            ><strong
              >{{ String(live.snapshot?.counts.visible || 0).padStart(2, "0")
              }}<i class="stat-dot" /></strong
            ><small>投稿自动进入展示队列</small>
          </div>
          <div>
            <span>展示状态</span
            ><strong class="status-text">{{ status }}</strong
            ><small
              >{{ live.snapshot?.display.interval_seconds }} 秒起 / 条 ·
              {{ live.snapshot?.counts.hidden || 0 }} 条已隐藏</small
            >
          </div>
        </div>
        <div class="content-grid">
          <section class="feed-panel panel">
            <div class="panel-head">
              <h2>{{ activeTab === "feed" ? "投稿收件箱" : "展示设置" }}</h2>
              <span class="subtle">{{
                activeTab === "feed" ? "最新优先" : "对所有投屏设备生效"
              }}</span>
            </div>
            <template v-if="activeTab === 'feed'"
              ><form class="feed-tools" @submit.prevent="load()">
                <label class="search"
                  ><Search :size="17" /><input
                    v-model="search"
                    aria-label="搜索投稿"
                    placeholder="搜索内容、昵称或 QQ 号" /></label
                ><button class="quiet" type="submit">搜索</button
                ><select
                  v-model="visibility"
                  aria-label="稿件筛选"
                  @change="load()"
                >
                  <option value="all">全部稿件</option>
                  <option value="visible">可展示</option>
                  <option value="hidden">已隐藏</option>
                </select>
              </form>
              <button v-if="fresh > 0" class="new-posts" @click="load()">
                <ArrowDown :size="16" />{{ fresh }} 条新投稿 · 回到最新
              </button>
              <div class="feed-list">
                <article
                  v-for="item in items"
                  :key="item.id"
                  class="post"
                  :class="{
                    selected: live.snapshot?.current?.id === item.id,
                    hidden: item.hidden_at,
                  }"
                >
                  <Avatar :qq="item.qq_id" :name="item.nickname" />
                  <div class="post-body">
                    <div class="post-author">
                      <strong>{{ item.nickname || item.qq_id }}</strong
                      ><span
                        v-if="live.snapshot?.current?.id === item.id"
                        class="on-air"
                        >正在展示</span
                      ><time>{{ time(item.received_at) }}</time>
                    </div>
                    <div class="qq">
                      QQ {{ item.qq_id
                      }}<span
                        >#{{ String(item.event_seq).padStart(3, "0") }}</span
                      >
                    </div>
                    <p>{{ item.content }}</p>
                    <div class="post-actions">
                      <button
                        :disabled="busy || !!item.hidden_at"
                        @click="control('select', item.id)"
                      >
                        <MonitorUp :size="14" />{{
                          live.snapshot?.current?.id === item.id
                            ? "当前画面"
                            : "立即展示"
                        }}</button
                      ><button :disabled="busy" @click="hide(item)">
                        <Eye v-if="item.hidden_at" :size="14" /><EyeOff
                          v-else
                          :size="14"
                        />{{ item.hidden_at ? "恢复展示" : "隐藏" }}
                      </button>
                    </div>
                  </div>
                </article>
                <div v-if="loaded && !items.length" class="empty-feed">
                  <Inbox :size="34" />
                  <h3>
                    {{ search ? "没有找到匹配的投稿" : "等待第一封现场来信" }}
                  </h3>
                  <p>观众在活动群内发送 /投稿 内容</p>
                </div>
              </div>
              <button
                v-if="next"
                class="load-more"
                :disabled="listBusy"
                @click="load(true)"
              >
                {{ listBusy ? "加载中…" : "加载更早的投稿" }}</button
              ><button
                v-else
                class="load-more"
                :disabled="listBusy"
                @click="load()"
              >
                刷新列表
              </button>
            </template>
            <div v-else class="settings-body">
              <h3>运行状态</h3>
              <p v-if="metrics">
                当前连接 {{ metrics.sse_connections }} 个页面 · 可用空间
                {{ (metrics.disk_free_bytes / 1073741824).toFixed(1) }}
                GB<br />最近 5 分钟收到
                {{ metrics.ingest_requests }} 次上传请求，失败
                {{ metrics.ingest_failures }} 次<span
                  v-if="metrics.ingest_p95_ms !== null"
                >
                  · 入库响应 p95 {{ metrics.ingest_p95_ms }} ms</span
                >
              </p>
              <button @click="loadMetrics">刷新状态</button>
              <hr />
              <h3>轮播节奏</h3>
              <p>
                基础停留 5–60
                秒，也是每条的最短停留。长稿会按字数自动加长停留时间，保证现场能读完。
              </p>
              <form @submit.prevent="control('interval', Number(interval))">
                <label
                  >展示间隔（秒）<input
                    v-model="interval"
                    type="number"
                    min="5"
                    max="60"
                    required /></label
                ><button class="primary" :disabled="busy">保存间隔</button>
              </form>
              <hr />
              <h3>现场操作</h3>
              <p>
                ← / →
                切换上一条、下一条。点选稿件进入手动模式；点击“自动轮播”即可继续。
              </p>
              <p>
                暂停只停止换页。待机画面覆盖当前内容；两种状态下仍继续接收投稿。
              </p>
              <p>现场投稿无需审核，隐藏仅用于已投稿件的紧急撤下。</p>
            </div>
          </section>
          <aside class="preview-column">
            <section class="panel preview-panel">
              <div class="panel-head">
                <h2><span class="live-dot" />大屏实时预览</h2>
                <a
                  href="/screen"
                  target="_blank"
                  rel="noopener"
                  aria-label="打开投屏页"
                  ><MonitorUp :size="17"
                /></a>
              </div>
              <Stage v-if="live.snapshot" :snapshot="live.snapshot" />
              <div class="preview-caption">
                <span>{{ status }}</span
                ><span>{{
                  live.snapshot?.current
                    ? `#${String(live.snapshot.current.event_seq).padStart(3, "0")}`
                    : "等待投稿"
                }}</span>
              </div>
              <div class="control-row">
                <button
                  aria-label="上一条"
                  :disabled="busy"
                  @click="control('previous')"
                >
                  <ChevronLeft :size="21" /></button
                ><button
                  class="pause-control"
                  :disabled="busy"
                  @click="
                    control(live.snapshot?.display.paused ? 'resume' : 'pause')
                  "
                >
                  <Play v-if="live.snapshot?.display.paused" :size="17" /><Pause
                    v-else
                    :size="17"
                  />{{
                    live.snapshot?.display.paused ? "继续播放" : "暂停播放"
                  }}</button
                ><button
                  aria-label="下一条"
                  :disabled="busy"
                  @click="control('next')"
                >
                  <ChevronRight :size="21" />
                </button>
              </div>
              <div class="secondary-controls">
                <button
                  :disabled="busy"
                  :class="{ chosen: live.snapshot?.display.mode === 'auto' }"
                  @click="control('auto')"
                >
                  <RotateCcw :size="15" />自动轮播</button
                ><button
                  :disabled="busy"
                  :class="{ chosen: live.snapshot?.display.blanked }"
                  @click="
                    control(
                      live.snapshot?.display.blanked ? 'unblank' : 'blank',
                    )
                  "
                >
                  <EyeOff :size="15" />{{
                    live.snapshot?.display.blanked ? "恢复画面" : "待机画面"
                  }}
                </button>
              </div>
            </section>
            <section class="participate">
              <span class="eyebrow">HOW TO JOIN</span>
              <h3>把话说给现场听。</h3>
              <p>在活动 QQ 群发送</p>
              <code>/投稿 你想说的话</code>
              <div>
                纯文本 · 最多 300 字<br />昵称、QQ 号与头像将随投稿公开展示
              </div>
              <span class="participate-star">✳</span>
            </section>
            <p class="preview-note">
              预览与投屏同步 · 投稿自动上屏<br />主持端的搜索和翻页不会影响现场画面
            </p>
          </aside>
        </div>
        <footer class="host-footer">
          THP POST / 现场来信<span>每一份参与，都让现场更完整。</span>
        </footer>
      </div>
    </main>
  </div>
</template>
