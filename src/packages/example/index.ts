/**
 * example · 复制模板（深模块示例）
 * 新建包时复制本目录改名：包根文件 = 入口（对外可见），lib/ = 实现（私有），
 * tests/ = 测试（私有）。用完或不需要时可删。
 */
import { formatGreeting } from "./lib/impl";

/** 示例接口：一行签名，行为都藏在 lib/ 里——这就是"深" */
export function greeting(name: string): string {
  return formatGreeting(name);
}
