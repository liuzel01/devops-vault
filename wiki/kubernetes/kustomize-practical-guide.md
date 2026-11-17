---
title: Kubernetes Kustomize 实践指南
created: 2023-07-15
updated: 2026-11-17
type: wiki
status: review
publish: false
tags: [kubernetes, kustomize, configuration, deployment]
owners: [liuzel01]
sources: ["legacy-hugo:2023-07-15-k8s-kustomize"]
generated:
  tool: opencode
  model: gpt-5.6-sol
  reviewed_by: null
---

# Kubernetes Kustomize 实践指南

Kustomize 通过 `base` 与 `overlays` 复用 Kubernetes 资源，不需要额外模板语言。它适合资源结构稳定、环境差异主要体现在镜像、命名空间、标签和少量字段覆盖的场景。

## 推荐目录

```text
kustomize/
├── base/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── kustomization.yaml
└── overlays/
    ├── staging/
    │   └── kustomization.yaml
    └── production/
        └── kustomization.yaml
```

`base/kustomization.yaml`：

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
```

`overlays/staging/kustomization.yaml`：

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: example-staging
resources:
  - ../../base
namePrefix: staging-
labels:
  - pairs:
      environment: staging
images:
  - name: example/app
    newTag: "1.2.3"
```

## 渲染与部署

先渲染并审查最终清单，再交给 Kubernetes：

```bash
kubectl kustomize overlays/staging
kubectl diff -k overlays/staging
kubectl apply -k overlays/staging
```

CI 中应保存或检查渲染结果，并在部署前执行 schema、策略和敏感信息检查。不要在 `secretGenerator` 中提交真实密钥；应使用外部密钥系统或由受控流水线注入。

## 常用能力

### 更新镜像

```bash
cd overlays/staging
kustomize edit set image example/app=example/app:1.2.4
```

提交生成后的 `kustomization.yaml`，使部署版本可由 Git 追溯。

### 生成 ConfigMap

```yaml
configMapGenerator:
  - name: app-config
    literals:
      - LOG_LEVEL=info
```

默认名称哈希会在配置变化时触发工作负载滚动更新。除非调用方无法引用带哈希名称的资源，否则不建议设置 `disableNameSuffixHash: true`。

### 覆盖少量字段

优先使用 `patches`，避免复制完整 Deployment：

```yaml
patches:
  - target:
      kind: Deployment
      name: example-app
    patch: |-
      - op: replace
        path: /spec/replicas
        value: 2
```

## 维护原则

- `base` 不包含环境专用域名、账号或密钥；
- overlay 只表达环境差异，避免复制整个资源；
- 部署前检查 `kubectl diff -k`；
- 远程 base 应固定 Git ref，避免上游变化导致不可重复构建；
- 旧版 `vars` 已不适合作为新配置的默认方案，优先使用 replacements 或结构化 patch；
- 删除 PVC、命名空间等有状态资源前必须单独确认。

## 参考

- [Kubernetes：使用 Kustomize 对对象进行声明式管理](https://kubernetes.io/zh-cn/docs/tasks/manage-kubernetes-objects/kustomization/)
- [Kustomize 官方文档](https://kubectl.docs.kubernetes.io/references/kustomize/)
