import { test, expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";

test("投屏短暂断网保留画面并在重连后收敛", async ({ page, browser }) => {
  await login(page);
  await page.getByRole("button", { name: "暂停播放", exact: true }).click();
  const screenContext = await browser.newContext();
  const screen = await screenContext.newPage();
  try {
    await screen.goto("http://localhost:5173/screen");
    await screen.getByLabel("活动 ID").fill("demo");
    await screen.getByLabel("展示码").fill("demo-screen-only");
    await screen.getByRole("button", { name: "进入现场", exact: true }).click();
    await expect(screen.locator(".stage-content")).toBeVisible();
    const previous = await screen.locator(".stage-content").innerText();
    await screenContext.setOffline(true);
    await page.getByRole("button", { name: "下一条", exact: true }).click();
    await expect(screen.locator(".stage-content")).toHaveText(previous);
    const next = await page
      .locator(".preview-panel .stage-content")
      .innerText();
    expect(next).not.toEqual(previous);
    await screenContext.setOffline(false);
    await expect(screen.locator(".stage-content")).toHaveText(next, {
      timeout: 12000,
    });
  } finally {
    await screenContext.close();
    await page.getByRole("button", { name: "自动轮播", exact: true }).click();
  }
});

async function login(page: Page, role = "host") {
  await page.goto(`/${role}`);
  if (role === "screen") await page.getByLabel("活动 ID").fill("demo");
  await page
    .getByLabel(role === "host" ? "主持密码" : "展示码")
    .fill(`demo-${role}-only`);
  await page.getByRole("button", { name: "进入现场", exact: true }).click();
  await expect(
    page.locator(role === "host" ? ".host-shell" : ".screen-page"),
  ).toBeVisible();
}

test("主持与投屏实时同步、纯文本安全、隐藏和待机", async ({
  page,
  context,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.getByRole("button", { name: "暂停播放", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "继续播放", exact: true }),
  ).toBeVisible();
  const screen = await context.newPage();
  await login(screen, "screen");
  await expect(screen.locator(".stage-person")).toContainText("QQ ");
  const content = `浏览器验收 ${Date.now()} <script>window.hacked=true</script> 🎉`;
  const body = {
    event_id: "demo",
    source_instance_id: "e2e",
    bot_self_id: "100000001",
    group_id: "100000002",
    message_id: String(Date.now()),
    qq_id: String(100000000 + Math.floor(Math.random() * 100000000)),
    nickname: "演示观众 · 自动化测试",
    content,
    source_sent_at: new Date().toISOString(),
  };
  const key = createHash("sha256")
    .update(
      JSON.stringify([
        body.source_instance_id,
        body.bot_self_id,
        body.group_id,
        body.message_id,
      ]),
    )
    .digest("hex");
  const result = await request.post("/api/v1/ingest/submissions", {
    data: body,
    headers: {
      Authorization: "Bearer demo-ingest-only",
      "Idempotency-Key": key,
    },
  });
  expect(result.status()).toBe(201);
  const post = page.locator(".post").filter({ hasText: content });
  await expect(post).toBeVisible({ timeout: 6000 });
  await post.getByRole("button", { name: "立即展示" }).click();
  await expect(screen.locator(".stage-content")).toHaveText(content);
  expect(
    await screen.evaluate(
      () => (window as Window & { hacked?: boolean }).hacked,
    ),
  ).toBeUndefined();
  await page.getByRole("button", { name: "待机画面", exact: true }).click();
  await expect(screen.getByText("让此刻，稍作停留。")).toBeVisible();
  await page.getByRole("button", { name: "恢复画面", exact: true }).click();
  await expect(screen.locator(".stage-content")).toHaveText(content);
  await post.getByRole("button", { name: "隐藏", exact: true }).click();
  await expect(screen.locator(".stage-content")).not.toHaveText(content);
  await page.getByRole("button", { name: "自动轮播", exact: true }).click();
  await page.screenshot({
    path: "../artifacts/host-desktop.png",
    fullPage: true,
  });
  await screen.screenshot({ path: "../artifacts/screen-desktop.png" });
  expect(errors).toEqual([]);
});

test("投屏在三种分辨率显示长稿与完整 QQID", async ({ page, request }) => {
  await login(page);
  const content = (
    `演示验收 ${Date.now()} ` +
    "这是明确标记的演示长稿，用来检查大屏排版和阅读体验。".repeat(12)
  ).slice(0, 300);
  const body = {
    event_id: "demo",
    source_instance_id: "layout",
    bot_self_id: "100000001",
    group_id: "100000002",
    message_id: String(Date.now()),
    qq_id: "123456789012345678",
    nickname: "演示观众 · 长昵称".repeat(8),
    content,
    source_sent_at: new Date().toISOString(),
  };
  const key = createHash("sha256")
    .update(
      JSON.stringify([
        body.source_instance_id,
        body.bot_self_id,
        body.group_id,
        body.message_id,
      ]),
    )
    .digest("hex");
  expect(
    (
      await request.post("/api/v1/ingest/submissions", {
        data: body,
        headers: {
          Authorization: "Bearer demo-ingest-only",
          "Idempotency-Key": key,
        },
      })
    ).status(),
  ).toBe(201);
  const post = page.locator(".post").filter({ hasText: content });
  await expect(post).toBeVisible();
  await post.getByRole("button", { name: "立即展示" }).click();
  const screen = await page.context().newPage();
  await login(screen, "screen");
  for (const [width, height] of [
    [1280, 720],
    [1920, 1080],
    [3840, 2160],
  ]) {
    await screen.setViewportSize({ width, height });
    await expect(screen.locator(".stage-content")).toHaveText(content);
    await expect(
      screen.getByText("QQ 123456789012345678", { exact: true }),
    ).toBeVisible();
    const bounds = await screen.locator(".stage-person").boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height);
    expect(
      await screen.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await screen
        .locator(".stage-content")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    await screen.screenshot({ path: `../artifacts/screen-${height}p.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "../artifacts/host-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await post.getByRole("button", { name: "隐藏", exact: true }).click();
  await page.getByRole("button", { name: "自动轮播", exact: true }).click();
});
