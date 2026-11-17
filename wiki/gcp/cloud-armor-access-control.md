---
title: Google Cloud Armor 访问控制实践
created: 2024-06-06
updated: 2026-11-17
type: wiki
status: review
publish: false
tags: [gcp, cloud-armor, waf, security, load-balancing]
owners: [liuzel01]
sources: ["legacy-hugo:2024-06-06-gcp-cloud-armor"]
generated:
  tool: opencode
  model: gpt-5.6-sol
  reviewed_by: null
---

# Google Cloud Armor 访问控制实践

Google Cloud Armor 为外部负载均衡器提供基于 IP、地理位置、请求属性和 WAF 规则的访问控制。安全策略附加到 backend service，而不是直接附加到虚拟机。

## 规则设计

每条规则都有唯一优先级，数字越小越先匹配。策略应明确包含默认规则，并避免在未验证时直接使用“拒绝全部”。

常见模式：

1. 放行健康检查和可信管理出口；
2. 按业务需要放行目标地区或请求；
3. 应用预配置 WAF 规则；
4. 使用默认拒绝或默认放行规则处理剩余流量。

地理条件示例：

```text
origin.region_code == 'CN' || origin.region_code == 'TW'
```

地区判断适合降低暴露面，但不能替代身份认证。VPN、代理、移动网络和 GeoIP 误差都可能导致判断偏差。

## 推荐上线流程

1. 盘点负载均衡器、backend service 和真实访问来源；
2. 创建策略和规则，先启用 preview；
3. 开启请求日志，观察预期允许和拒绝的请求；
4. 从测试 backend 开始绑定策略；
5. 使用允许与拒绝来源分别验证；
6. 退出 preview 后持续观察 403、误拦截和规则命中量；
7. 保留解绑策略或恢复旧规则的回滚步骤。

## 验证清单

- 策略是否绑定到正确的 backend service；
- 规则优先级是否会被更早的规则覆盖；
- 默认规则的动作是否符合预期；
- 健康检查、监控探针和运维入口是否仍可访问；
- 允许来源返回正常业务响应；
- 拒绝来源返回预期状态码；
- 日志包含匹配规则、动作和请求来源；
- 变更记录中不包含客户 IP 清单或其他不宜公开的数据。

## 风险控制

- 管理入口应结合身份认证、IAP 或 VPN，不只依赖 IP 白名单；
- 动态出口 IP 不适合作为长期唯一允许条件；
- WAF 规则应先观察误报，再逐步启用阻断；
- 多个 backend 共用策略前，应确认业务访问模型一致；
- 大范围规则变更应分批执行，并设置回滚窗口。

## 参考

- [Google Cloud Armor 文档](https://cloud.google.com/armor/docs)
- [配置安全策略规则](https://cloud.google.com/armor/docs/configure-security-policies)
