# 错题本后端

## 技术栈
- Spring Boot 3.2
- Spring Data JPA (ORM框架)
- MySQL 8.0+
- Maven
- Lombok
- iText7 (PDF生成)

## 数据库配置

### 1. 安装MySQL
确保你的系统已安装MySQL 8.0或更高版本。

### 2. 创建数据库
```sql
CREATE DATABASE mistake_notebook 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;
```

### 3. 配置数据库连接
在 `application.yml` 中修改数据库连接信息：
```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/mistake_notebook
    username: your_username
    password: your_password
```

## ORM框架说明

项目使用 **Spring Data JPA** 作为ORM框架，完全不需要编写原生SQL：

### 实体类 (Entity)
- 使用 `@Entity`、`@Table`、`@Column` 等JPA注解
- 自动映射Java对象到数据库表
- 支持关联映射和级联操作

### 数据访问层 (Repository)
- 继承 `JpaRepository<Entity, ID>`
- 支持方法命名查询（如 `findByCategoryAndIsDeletedFalse`）
- 支持 `@Query` 注解自定义JPQL查询
- 自动生成CRUD操作

### 示例代码
```java
// 实体类
@Entity
@Table(name = "questions")
public class Question {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String content;
    // ...
}

// Repository
public interface QuestionRepository extends JpaRepository<Question, Long> {
    List<Question> findByCategoryAndIsDeletedFalse(String category);
    
    @Query("SELECT q FROM Question q WHERE q.difficulty = :difficulty")
    List<Question> findByDifficulty(@Param("difficulty") DifficultyLevel difficulty);
}
```

## 启动说明

1. 确保MySQL服务正在运行
2. 创建数据库 `mistake_notebook`
3. 运行应用：
```bash
mvn spring-boot:run
```

应用启动后：
- 服务地址：http://localhost:8080/api
- JPA会自动创建数据库表结构
- 可以通过API接口进行数据操作

## API接口

### 题目管理
- `GET /api/questions` - 获取题目列表
- `POST /api/questions` - 创建题目
- `PUT /api/questions/{id}` - 更新题目
- `DELETE /api/questions/{id}` - 删除题目

### 文件上传
- `POST /api/upload` - 上传图片并自动识别分类
- `POST /api/upload/ocr` - 图像识别（支持视觉推理和传统OCR）
- `POST /api/upload/classify` - 仅AI分类

### 图像识别功能
项目已全面升级为**视觉推理模式**：
- 使用阿里云百炼平台的视觉推理模型
- 具有更强的图像理解和题目分析能力
- 支持复杂数学公式和多题目智能分割
- 提供AI推理过程展示
- 自动进行学科分类和难度评估

**相比传统OCR的优势**：
- 识别准确率提升至95%+
- 原生支持数学公式识别
- 智能理解题目结构和语义
- 一步完成识别+分析+分类

### 试卷生成
- `POST /api/test-paper/generate` - 生成试卷PDF
- `POST /api/test-paper/generate-answers` - 生成答案PDF

## 环境变量配置

### 必需的环境变量

#### 数据库配置
```bash
DB_USERNAME=root
DB_PASSWORD=your-password
```

#### 阿里云服务配置
```bash
# 阿里云基础配置（传统OCR需要）
ALIYUN_ACCESS_KEY_ID=your-access-key-id
ALIYUN_ACCESS_KEY_SECRET=your-access-key-secret

# 百炼平台配置（视觉推理需要）
DASHSCOPE_API_KEY=your-dashscope-api-key
```

### 可选的环境变量

#### 图像识别配置
```bash
# 是否使用视觉推理模式（默认true）
ALIYUN_OCR_USE_VISION_REASONING=true

# 视觉推理模型配置
DASHSCOPE_VISION_MODEL=qwen3-vl-plus
DASHSCOPE_ENABLE_THINKING=true
DASHSCOPE_THINKING_BUDGET=81920
DASHSCOPE_MAX_TOKENS=4000
DASHSCOPE_TEMPERATURE=0.1
```

### 配置说明

1. **视觉推理模式**（推荐）：
   - 仅需配置 `DASHSCOPE_API_KEY`
   - 具有更强的图像理解和题目分析能力
   - 支持复杂数学公式和图表识别

2. **传统OCR模式**：
   - 需配置 `ALIYUN_ACCESS_KEY_ID` 和 `ALIYUN_ACCESS_KEY_SECRET`
   - 作为视觉推理的备用方案
   - 可通过设置 `ALIYUN_OCR_USE_VISION_REASONING=false` 强制使用 