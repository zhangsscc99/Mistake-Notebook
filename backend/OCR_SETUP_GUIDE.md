# OCR服务配置指南

## 概述

本项目已移除所有模拟OCR数据，现在需要配置真实的阿里云OCR服务才能正常使用图像识别功能。

## 配置步骤

### 1. 开通阿里云OCR服务

1. 登录[阿里云控制台](https://www.aliyun.com/)
2. 搜索并进入"文字识别OCR"服务
3. 开通相应的OCR服务包（推荐：通用文字识别）

### 2. 创建AccessKey

1. 进入阿里云控制台 -> 访问控制RAM
2. 创建用户并生成AccessKey ID和AccessKey Secret
3. 为用户授权OCR相关权限

### 3. 启用阿里云SDK依赖

编辑 `backend/pom.xml` 文件，取消注释第104-120行：

```xml
<!-- 取消注释这些依赖 -->
<dependency>
    <groupId>com.aliyun</groupId>
    <artifactId>aliyun-java-sdk-core</artifactId>
    <version>4.6.4</version>
</dependency>
<dependency>
    <groupId>com.aliyun</groupId>
    <artifactId>ocr20191230</artifactId>
    <version>1.0.11</version>
</dependency>
<dependency>
    <groupId>com.alibaba</groupId>
    <artifactId>dashscope-sdk-java</artifactId>
    <version>2.8.1</version>
</dependency>
```

### 4. 配置访问凭证

在 `backend/src/main/resources/application.yml` 中配置：

```yaml
aliyun:
  access-key-id: 你的AccessKey ID
  access-key-secret: 你的AccessKey Secret
  region-id: cn-hangzhou
  
  ocr:
    endpoint: https://ocr-api.cn-hangzhou.aliyuncs.com
```

或者通过环境变量配置：

```bash
export ALIYUN_ACCESS_KEY_ID=你的AccessKey ID
export ALIYUN_ACCESS_KEY_SECRET=你的AccessKey Secret
```

### 5. 重新编译项目

```bash
cd backend
mvn clean install
```

### 6. 启用真实OCR代码

编辑 `backend/src/main/java/com/mistake/notebook/service/OCRService.java`，取消注释第520-562行的真实OCR调用代码。

## 功能特性

配置完成后，系统将具备以下能力：

- ✅ 真实图像文字识别（无模拟数据）
- ✅ 智能题目分割算法
- ✅ 多种题目格式识别
- ✅ 自适应边界计算
- ✅ 基于内容的智能分类

**重要提醒：系统不提供任何模拟数据，必须配置真实的阿里云OCR服务才能使用。**

## 故障排除

### 常见问题

1. **OCR识别失败**
   - 检查AccessKey配置是否正确
   - 确认OCR服务已开通
   - 查看日志中的详细错误信息

2. **依赖冲突**
   - 清理Maven缓存：`mvn clean`
   - 重新下载依赖：`mvn install`

3. **图片格式不支持**
   - 支持格式：JPG, PNG, GIF, BMP
   - 图片大小限制：10MB以内

### 联系支持

如遇到配置问题，请查看应用日志或联系开发团队。