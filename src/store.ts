import { defineStore } from "pinia";
import { ref } from "vue";
import type { Session, Snapshot } from "./types";

export const useLive = defineStore("live", () => {
  const role = location.pathname === "/screen" ? "screen" : "host";
  const session = ref<Session | null>(null),
    snapshot = ref<Snapshot | null>(null);
  const connection = ref<"connecting" | "live" | "offline">("connecting");
  const error = ref(""),
    loading = ref(true);
  let stream: EventSource | null = null,
    poll: ReturnType<typeof setInterval> | undefined;
  let refreshing: Promise<void> | null = null;
  let refreshAgain = false;

  async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`/api/v1${path}`, {
      ...options,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Role": role,
        ...(session.value ? { "X-CSRF-Token": session.value.csrf_token } : {}),
        ...options.headers,
      },
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        disconnect();
        session.value = null;
      }
      throw new Error(data.message || "服务暂时不可用");
    }
    return data as T;
  }
  function accept(data: Snapshot) {
    if (
      !snapshot.value ||
      data.display.revision >= snapshot.value.display.revision
    )
      snapshot.value = data;
  }
  function refresh(): Promise<void> {
    if (!session.value) return Promise.resolve();
    refreshAgain = true;
    if (refreshing) return refreshing;
    refreshing = (async () => {
      do {
        refreshAgain = false;
        if (!session.value) return;
        accept(
          await api<Snapshot>(`/events/${session.value.event_id}/snapshot`),
        );
      } while (refreshAgain);
    })().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }
  function disconnect() {
    stream?.close();
    stream = null;
    if (poll) clearInterval(poll);
    poll = undefined;
    connection.value = "offline";
  }
  function connect() {
    if (!session.value || !snapshot.value) return;
    stream?.close();
    stream = new EventSource(
      `/api/v1/events/${session.value.event_id}/stream?role=${role}&after=${snapshot.value.event_cursor}`,
    );
    stream.onopen = () => {
      connection.value = "live";
      void refresh().catch(() => {});
    };
    stream.onerror = () => {
      connection.value = "offline";
    };
    for (const event of [
      "submission.created",
      "submission.updated",
      "display.updated",
      "event.updated",
    ]) {
      stream.addEventListener(event, () => {
        void refresh().catch(() => {
          connection.value = "offline";
        });
      });
    }
    stream.addEventListener("resync_required", () => {
      stream?.close();
      void refresh()
        .then(connect)
        .catch(() => {
          connection.value = "offline";
        });
    });
    ensurePolling();
  }
  function ensurePolling() {
    if (!poll)
      poll = setInterval(() => {
        if (connection.value !== "live")
          void refresh()
            .then(() => {
              if (!stream || stream.readyState === EventSource.CLOSED)
                connect();
            })
            .catch(() => {});
      }, 5000);
  }
  async function start() {
    ensurePolling();
    await refresh();
    connect();
  }
  async function restore() {
    try {
      session.value = await api<Session>("/auth/me");
      await start();
    } catch {
      /* Login is shown for an expired or absent session. */
    } finally {
      loading.value = false;
    }
  }
  async function login(secret: string, eventId: string) {
    error.value = "";
    try {
      session.value = await api<Session>(`/auth/${role}-login`, {
        method: "POST",
        body: JSON.stringify(
          role === "host"
            ? { password: secret }
            : { event_id: eventId, code: secret },
        ),
      });
      await start();
    } catch (e) {
      error.value = (e as Error).message;
    }
  }
  async function logout() {
    await api("/auth/logout", { method: "POST" });
    disconnect();
    session.value = null;
    snapshot.value = null;
  }
  async function mutate(path: string, data: object, method = "POST") {
    if (!session.value || !snapshot.value) return;
    error.value = "";
    try {
      accept(
        await api<Snapshot>(`/events/${session.value.event_id}${path}`, {
          method,
          body: JSON.stringify({
            ...data,
            expected_revision: snapshot.value.display.revision,
          }),
        }),
      );
      return true;
    } catch (e) {
      error.value = (e as Error).message;
      await refresh().catch(() => {});
      return false;
    }
  }
  return {
    role,
    session,
    snapshot,
    connection,
    error,
    loading,
    api,
    refresh,
    restore,
    login,
    logout,
    mutate,
    disconnect,
  };
});
