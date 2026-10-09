

try {
  const details = $surge.selectGroupDetails();

  let output;
  if (details === undefined || details === null) {
    output = "selectGroupDetails() 返回空值。\n请检查 Surge 版本及脚本运行环境。";
  } else {
    output = JSON.stringify(details, null, 2);
    if (!output) output = String(details);
  }

  $done({
    title: "Surge 5 策略诊断",
    content: output,
    style: "info"
  });
} catch (e) {
  $done({
    title: "Surge 5 策略诊断：读取失败",
    content: String(e),
    style: "info"
  });
}
