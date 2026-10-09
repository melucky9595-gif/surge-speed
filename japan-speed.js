
const GROUP = "🇯🇵 日本节点";
const TEST_URL = "https://spurl.api.030101.xyz/5mb";
const TIMEOUT = 25;
const CONCURRENCY = 3;

const details = $surge.selectGroupDetails();
const parentNodes = details && details.groups
  ? details.groups["🚀 我的节点"]
  : null;

const nodes = parentNodes
  ? parentNodes.filter(function (name) {
      return /日本|Japan|\bJP\b/i.test(name);
    })
  : null;

if (!nodes || nodes.length === 0) {
  $done({
    title: "日本节点测速",
    content:
      "未找到策略组：" + GROUP +
      "\n请检查组名是否完全一致，并确认它是手动选择策略组。"
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
      const bytes = data && data.byteLength
        ? data.byteLength
        : 0;

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
          error: error || (
            response
              ? "HTTP " + response.status
              : "请求失败"
          )
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

        const lines = results.map(function (r, i) {
          if (r.error) {
            return (i + 1) + ". " + r.name +
              "：失败（" + r.error + "）";
          }

          return (i + 1) + ". " + r.name +
            " — " + r.speed.toFixed(2) + " MB/s" +
            "（" + r.seconds.toFixed(1) + " 秒）";
        });

        $done({
          title: "🇯🇵 日本节点下载测速",
          content:
            "测速地址：5MB\n" +
            "节点数：" + nodes.length +
            "，并发：" + CONCURRENCY + "\n\n" +
            lines.join("\n"),
          style: "info"
        });

        return;
      }

      worker();
    });
  }

  // 启动最多三个并发下载任务
  for (let i = 0;
       i < Math.min(CONCURRENCY, nodes.length);
       i++) {
    worker();
  }
}
