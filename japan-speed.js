

// 日本节点下载测速（Surge 5）
// 节点来源：策略组「🚀 我的节点」，再按关键字筛出日本节点
const PARENT_GROUP = "🚀 我的节点";
const NODE_FILTER = /🇯🇵|日本|Japan|JP/i;
const TEST_URL = "https://spurl.api.030101.xyz/5mb";
const TIMEOUT = 25;
const CONCURRENCY = 3;

const details = $surge.selectGroupDetails();
const groups = details && details.groups ? details.groups : {};
const parentNodes = groups[PARENT_GROUP];

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
  let next = 0;
  let finished = 0;

  function testNode(name, callback) {
    const start = Date.now();

    $httpClient.get({
      url: TEST_URL,
      policy: name,
      timeout: TIMEOUT,
      "binary-mode": true
    }, function (error, response, data) {
      const elapsed = (Date.now() - start) / 1000;
      const bytes = data && data.byteLength ? data.byteLength : 0;

      if (!error && response &&
          response.status >= 200 &&
          response.status < 300 &&
          bytes > 0 && elapsed > 0) {
        callback({
          name: name,
          speed: bytes / elapsed / 1048576,
          seconds: elapsed,
          bytes: bytes
        });
      } else {
        callback({
          name: name,
          error: error || (response ? "HTTP " + response.status : "请求失败")
        });
      }
    });
  }

  function worker() {
    if (next >= nodes.length) return;

    const name = nodes[next++];

    testNode(name, function (result) {
      results.push(result);
      finished++;

      if (finished === nodes.length) {
        results.sort(function (a, b) {
          return (b.speed || 0) - (a.speed || 0);
        });

        const okCount = results.filter(function (r) {
          return !r.error;
        }).length;

        const lines = results.map(function (r, i) {
          if (r.error) {
            return (i + 1) + ". " + r.name + "：失败（" + r.error + "）";
          }

          return (i + 1) + ". " + r.name +
            " — " + r.speed.toFixed(2) + " MB/s" +
            "（" + r.seconds.toFixed(1) + " 秒）";
        });

        $done({
          title: "🇯🇵 日本节点下载测速",
          content:
            "测速文件：5MB　节点数：" + nodes.length +
            "（成功 " + okCount + "）　并发：" + CONCURRENCY + "\n\n" +
            lines.join("\n"),
          style: "info"
        });

        return;
      }

      worker();
    });
  }

  // 启动最多 CONCURRENCY 个并发下载任务
  for (let i = 0; i < Math.min(CONCURRENCY, nodes.length); i++) {
    worker();
  }
}
