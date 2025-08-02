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
- `POST /api/upload/ocr` - 仅OCR识别
- `POST /api/upload/classify` - 仅AI分类

### 试卷生成
- `POST /api/test-paper/generate` - 生成试卷PDF
- `POST /api/test-paper/generate-answers` - 生成答案PDF 