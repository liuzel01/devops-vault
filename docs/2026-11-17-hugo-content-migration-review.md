# Hugo 历史内容迁移审查

> 审查来源：`~/github/blog/public/`  
> 审查日期：2026-11-17

## 已迁移

| Hugo 页面 | 目标页面 | 状态 |
| --- | --- | --- |
| `2023-07-15-k8s-kustomize/index.md` | `wiki/kubernetes/kustomize-practical-guide.md` | 已确认发布 |
| `2024-06-06-gcp-cloud-armor/index.md` | `wiki/gcp/cloud-armor-access-control.md` | 已确认发布 |

迁移页面已移除对旧博客图片和私有仓库示例的依赖，按当前工具行为重新整理，并于 2026-11-17 确认发布。

## 暂不迁移

- cert-manager：历史正文包含带认证参数的链接，且版本和操作步骤需要重新验证；
- AWS Lambda 告警：历史正文包含 Webhook 形态的值；
- Let’s Encrypt/acme.sh：历史正文包含疑似 DNS API 凭据及具体基础设施信息；
- GitLab 仓库同步：包含绕过商业授权的操作及 Token 形态内容；
- GitLab CI/CD：示例使用旧 Node.js、弱化受保护变量并直接以 root 部署，不适合作为当前实践；
- Nginx 多实例：依赖已结束生命周期的 CentOS 7 和旧版 Nginx；
- Prometheus/Thanos：与现有监控 Review 重叠，且原文依赖内网拓扑与旧截图；
- 自建 Registry：方案缺少认证、存储持久化和完整安全边界，不建议直接迁移。

## 安全建议

旧站构建产物中出现过 Token、Webhook 或 API 凭据形态的字符串。即使这些值已经失效，也建议确认相关凭据已撤销或轮换，并避免继续公开旧构建产物。
