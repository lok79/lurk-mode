// 测试只走入口（../index），不碰 lib/ ——规则见 src/packages/README.md
// 尚无测试运行器（Vitest 在质量门 TODO 里）；装好后把这段改成 test/expect 写法
import { greeting } from "../index";

const actual = greeting("Lurk");
const expected = "你好，Lurk！我是一个深模块：小接口，大实现。";
if (actual !== expected) {
  throw new Error(`greeting 断言失败：${actual}`);
}
console.log("example tests: ok");






