// 日本节点下载测速（Surge 5）
// 做法：依次把策略组「🚀 我的节点」切到每个日本节点，经该策略组下载测速文件，
// 全部测完后自动切回原来的节点。
const PARENT_GROUP = "🚀 我的节点";
const NODE_FILTER = /🇯🇵|日本|Japan|JP/i;
const TEST_URL = "https://spurl.api.030101.xyz/50mb";
const TIMEOUT = 10;                  // 单次下载超时（秒）
const MAX_SIZE = 100 * 1024 * 1024;  // 放宽 Surge 对响应体大小的上限
const GAP_MS = 2000;                 // 两个节点之间的间隔，避免被测速服务限流(429)
const RETRY_WAIT_MS = 6000;          // 遇到 429 后等待多久再重试
const MAX_RETRY = 2;                 // 429 最多重试次数

const wait = typeof setTimeout === "function"
  ? setTimeout
  : function (fn) { fn(); };

const details = $surge.selectGroupDetails();
const groups = details && details.groups ? details.groups : {};
const decisions = details && details.decisions ? details.decisions : {};
const parentNodes = groups[PARENT_GROUP];
const originalChoice = decisions[PARENT_GROUP];

const nodes = Array.isArray(parentNodes)
  ? parentNodes.filter(function (name) {
      return NODE_FILTER.test(name);
    })
  : [];

if (nodes.length === 0) {
  $done({
    title: "日本节点测速",
    content:
      "未找到可测速的日本节点。\n" +
      "查找的策略组：" + PARENT_GROUP + "\n\n" +
      "Surge 实际识别到的策略组：\n" +
      Object.keys(groups).join("\n"),
    style: "error"
  });
} else {
  const results = [];
  let index = 0;

  function finish() {
    // 恢复测速前的节点选择
    let restored = "";
    if (originalChoice) {
      const ok = $surge.setSelectGroupPolicy(PARENT_GROUP, originalChoice);
      restored = ok
        ? "\n\n已切回：" + originalChoice
        : "\n\n⚠️ 切回原节点失败，请手动选择：" + originalChoice;
    }

    // 排序：测出速度的在前（速度高优先），其次是触顶的（耗时短优先），失败的最后
    function rank(r) {
      return r.error ? 2 : (r.capped ? 1 : 0);
    }
    results.sort(function (a, b) {
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      if (a.capped) return a.seconds - b.seconds;
      return (b.speed || 0) - (a.speed || 0);
    });

    const okCount = results.filter(function (r) {
      return !r.error;
    }).length;

    const lines = results.map(function (r, i) {
      if (r.error) {
        return (i + 1) + ". " + r.name + "：失败（" + r.error + "）";
      }
      if (r.capped) {
        return (i + 1) + ". " + r.name +
          " — 达到大小上限，耗时 " + r.seconds.toFixed(1) + " 秒（越短越快）";
      }
      return (i + 1) + ". " + r.name +
        " — " + r.speed.toFixed(2) + " MB/s" +
        "（" + r.seconds.toFixed(1) + " 秒）";
    });

    $done({
      title: "🇯🇵 日本节点下载测速",
      content:
        "测速文件：50MB　节点数：" + nodes.length +
        "（成功 " + okCount + "）\n\n" +
        lines.join("\n") + restored,
      style: "info"
    });
  }

  // 必须逐个测：切换策略组是全局的，不能并发
  function next() {
    if (index >= nodes.length) {
      finish();
      return;
    }

    const name = nodes[index++];

    if (!$surge.setSelectGroupPolicy(PARENT_GROUP, name)) {
      results.push({ name: name, error: "切换节点失败" });
      next();
      return;
    }

    attempt(name, 0);
  }

  function attempt(name, tries) {
    const start = Date.now();

    $httpClient.get({
      url: TEST_URL,
      policy: PARENT_GROUP,
      timeout: TIMEOUT,
      "max-size": MAX_SIZE,
      "binary-mode": true
    }, function (error, response, data) {
      const elapsed = (Date.now() - start) / 1000;
      const bytes = data && data.byteLength ? data.byteLength : 0;

      // 被测速服务限流：等一会儿再试同一个节点
      if (response && response.status === 429 && tries < MAX_RETRY) {
        wait(function () { attempt(name, tries + 1); }, RETRY_WAIT_MS);
        return;
      }

      if (!error && response &&
          response.status >= 200 && response.status < 300 &&
          bytes > 0 && elapsed > 0) {
        results.push({
          name: name,
          speed: bytes / elapsed / 1048576,
          seconds: elapsed
        });
      } else if (error && /size limit/i.test(String(error))) {
        // 响应体超过 Surge 的大小上限：下载被截断，改用"到达上限的耗时"比较快慢
        results.push({ name: name, seconds: elapsed, capped: true });
      } else {
        results.push({
          name: name,
          error: error || (response ? "HTTP " + response.status : "请求失败")
        });
      }

      wait(next, GAP_MS);
    });
  }

  next();
}
