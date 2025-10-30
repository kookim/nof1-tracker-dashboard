#!/bin/bash
set -e

# 强制清理所有npm认证配置
npm config delete _auth || true
npm config delete //registry.npmjs.org/:_authToken || true
npm config delete //registry.npmjs.org/:always-auth || true
npm config delete always-auth || true

# 确保使用正确的registry且不启用认证
npm config set registry https://registry.npmjs.org/
npm config set always-auth false

# 清理npm缓存
npm cache clean --force || true

# 安装依赖
npm install

echo "Build completed successfully"

