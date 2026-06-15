# Markdown to UBB

一个把 Markdown 转换成论坛 UBB 代码的 Vue 工具。

默认面向 CC98 的 UBB 语法，同时保留通用默认配置。用户可以在设置中调整不同 Markdown 语法对应的 UBB 标签，并为不同论坛保存不同配置文件。

## 功能

- Markdown 输入实时转换为 UBB
- Markdown 预览和 UBB 预览
- 一键复制转换结果
- 可自定义标题字号和是否加粗
- 可自定义常见 UBB 标签
- 支持配置文件，方便不同论坛快速切换
- 设置保存到浏览器本地缓存，刷新后不丢失

## 支持的 Markdown 语法

- 标题
- 粗体、斜体、删除线
- 行内代码、代码块
- 链接、图片
- 引用
- 无序列表、有序列表
- 任务列表
- 表格
- 分割线
- 段内软换行

## 配置文件

设置面板底部可以管理配置文件：

- 新建
- 重命名
- 保存
- 删除
- 切换当前配置

首次加载会内置两个配置：

- `CC98`：默认选中
- `默认配置`：通用 UBB 配置

`CC98` 配置包含：

- 删除线使用 `[del]...[/del]`
- 列表标签默认禁用
- 表头单元格使用 `[th]...[/th]`
- 分割线使用 `[line]`

配置会保存到浏览器 `localStorage`：

```text
markdown-to-ubb:profiles:v1
```

## 本地开发

安装依赖：

```sh
pnpm install
```

启动开发服务器：

```sh
pnpm dev
```

构建：

```sh
pnpm build
```

检查代码：

```sh
pnpm lint
```

## 技术栈

- Vue 3
- TypeScript
- Vite
- markdown-it

