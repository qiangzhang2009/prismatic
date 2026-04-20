FROM python:3.11-slim

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl build-essential \
    && rm -rf /var/lib/apt/lists/*

# 安装 Hermes Agent
RUN pip install --no-cache-dir hermes-agent[messaging]

# 工作目录
WORKDIR /app

# Hermes 数据目录（挂载卷）
ENV HERMES_HOME=/opt/data
ENV HERMES_DATA_DIR=/opt/data

# 预创建目录
RUN mkdir -p /opt/data/weixin/accounts \
             /opt/data/plugins \
             /opt/data/skills \
             /opt/data/memories \
             /opt/data/logs \
             /opt/data/sessions \
             /opt/data/cron \
             /opt/data/soul

# 默认命令：运行 gateway
CMD ["hermes", "gateway", "run"]
