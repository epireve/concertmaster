# ConcertMaster Setup Guide

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose** (v3.8+)
- **Node.js** (v18+) for frontend development
- **Python** (v3.11+) for backend development
- **PostgreSQL** (v15+) for database
- **Redis** (v7+) for caching and message broker

### Development Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd concertmaster
```

2. **Environment Configuration**
```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

3. **Start the development environment**
```bash
# Start all services
docker-compose -f config/docker-compose.yml -f config/docker-compose.dev.yml up -d

# View logs
docker-compose logs -f
```

4. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs
- Flower (Task Monitor): http://localhost:5555
- Mailhog (Email Testing): http://localhost:8025

### Production Setup

1. **Environment Configuration**
```bash
# Production environment file
cp .env.production .env

# Configure production values
# - Strong SECRET_KEY
# - Production database URL
# - SMTP settings
# - SSL certificates
```

2. **SSL Certificate Setup**
```bash
# Create SSL directory
mkdir -p config/ssl

# Add your SSL certificates
cp your-cert.crt config/ssl/
cp your-private.key config/ssl/
```

3. **Deploy with production profile**
```bash
docker-compose -f config/docker-compose.yml --profile production up -d
```

## 🔧 Manual Installation

### Backend Setup

1. **Create virtual environment**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. **Install dependencies**
```bash
pip install -r requirements.txt
pip install -r requirements-dev.txt  # For development
```

3. **Database setup**
```bash
# Start PostgreSQL
sudo service postgresql start

# Create database
createdb concertmaster

# Run migrations
alembic upgrade head
```

4. **Start the backend server**
```bash
# Development
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# Production
gunicorn src.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

5. **Start Celery workers**
```bash
# Worker
celery -A src.services.celery_worker worker --loglevel=info

# Beat scheduler
celery -A src.services.celery_worker beat --loglevel=info

# Flower monitor
celery -A src.services.celery_worker flower --port=5555
```

### Frontend Setup

1. **Install dependencies**
```bash
cd frontend
npm install
```

2. **Environment configuration**
```bash
# Create environment file
cp .env.example .env.local

# Configure API endpoints
echo "VITE_API_BASE_URL=http://localhost:8000/api/v1" >> .env.local
```

3. **Start development server**
```bash
npm run dev
```

4. **Build for production**
```bash
npm run build
npm run preview  # Preview production build
```

## 🐳 Docker Configuration

### Environment Variables

Create `.env` file in the project root:

```bash
# Database Configuration
POSTGRES_PASSWORD=your_secure_password
DATABASE_URL=postgresql+asyncpg://postgres:your_secure_password@postgres:5432/concertmaster

# Security
SECRET_KEY=your_very_secure_secret_key_at_least_32_characters_long
JWT_EXPIRATION_HOURS=24

# Redis
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2

# Email Configuration (Optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USERNAME=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Frontend Configuration
REACT_APP_API_BASE_URL=http://localhost:8000/api/v1
REACT_APP_WS_URL=ws://localhost:8000/ws

# Development Settings
DEBUG=true
LOG_LEVEL=INFO
GENERATE_SOURCEMAP=true

# Production Settings (for production deployment)
# DEBUG=false
# LOG_LEVEL=WARNING
# ALLOWED_ORIGINS=https://yourdomain.com
```

### Service Configuration

#### PostgreSQL
- **Port**: 5432
- **Database**: concertmaster
- **User**: postgres
- **Password**: Set via `POSTGRES_PASSWORD`
- **Persistent Storage**: `postgres_data` volume

#### Redis
- **Port**: 6379
- **Configuration**: 512MB memory limit with LRU eviction
- **Persistent Storage**: `redis_data` volume

#### Backend (FastAPI)
- **Port**: 8000
- **Workers**: 4 (production)
- **Health Check**: `/health` endpoint
- **Auto-reload**: Enabled in development

#### Frontend (React)
- **Port**: 3000 (development), 80 (production)
- **Build Tool**: Vite
- **Hot Reload**: Enabled in development

### Docker Profiles

#### Default Profile (Development)
```bash
docker-compose up
```
Includes: postgres, redis, backend, frontend, celery-worker, celery-beat, flower

#### Production Profile
```bash
docker-compose --profile production up
```
Adds: nginx reverse proxy with SSL

#### Monitoring Profile
```bash
docker-compose --profile monitoring up
```
Adds: prometheus, grafana

#### Logging Profile
```bash
docker-compose --profile logging up
```
Adds: elasticsearch, kibana

## 🔐 Security Setup

### JWT Configuration

1. **Generate secure secret key**
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

2. **Set environment variables**
```bash
SECRET_KEY=your_generated_secret_key
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
```

### Database Security

1. **Create application user**
```sql
CREATE USER concertmaster WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE concertmaster TO concertmaster;
```

2. **Configure connection limits**
```sql
ALTER USER concertmaster CONNECTION LIMIT 20;
```

### SSL Configuration

1. **Generate self-signed certificate (development)**
```bash
openssl req -x509 -newkey rsa:4096 -keyout config/ssl/key.pem -out config/ssl/cert.pem -days 365 -nodes
```

2. **Production SSL with Let's Encrypt**
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem config/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem config/ssl/key.pem
```

## 📊 Monitoring Setup

### Prometheus Configuration

Create `config/monitoring/prometheus.yml`:
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'concertmaster-backend'
    static_configs:
      - targets: ['backend:8000']
    metrics_path: '/metrics'

  - job_name: 'concertmaster-celery'
    static_configs:
      - targets: ['flower:5555']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
```

### Grafana Dashboards

1. **Import ConcertMaster dashboard**
```bash
# Copy dashboard configuration
cp config/monitoring/grafana/dashboards/*.json /var/lib/grafana/dashboards/
```

2. **Configure data sources**
- Prometheus: http://prometheus:9090
- PostgreSQL: postgres://postgres:password@postgres:5432/concertmaster

## 🧪 Testing Setup

### Backend Testing

1. **Install test dependencies**
```bash
pip install -r requirements-dev.txt
```

2. **Setup test database**
```bash
createdb concertmaster_test
export DATABASE_URL=postgresql://postgres:password@localhost:5432/concertmaster_test
```

3. **Run tests**
```bash
# All tests
pytest

# With coverage
pytest --cov=src

# Specific test file
pytest tests/test_workflows.py

# Integration tests
pytest tests/integration/
```

### Frontend Testing

1. **Install test dependencies**
```bash
npm install
```

2. **Run tests**
```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

### API Testing

1. **Using curl**
```bash
# Health check
curl http://localhost:8000/health

# Get workflows (with auth)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/api/v1/workflows
```

2. **Using Postman**
- Import: `config/postman/ConcertMaster.postman_collection.json`
- Set environment variables for API base URL and auth token

## 🚀 Production Deployment

### Server Requirements

**Minimum Requirements:**
- 2 CPU cores
- 4GB RAM
- 20GB storage
- Ubuntu 20.04+ or similar Linux distribution

**Recommended:**
- 4+ CPU cores
- 8GB+ RAM
- 100GB+ SSD storage
- Load balancer for high availability

### Deployment Steps

1. **Server preparation**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

2. **Application deployment**
```bash
# Clone repository
git clone <repository-url> /opt/concertmaster
cd /opt/concertmaster

# Configure environment
cp .env.production .env
nano .env  # Edit production values

# Deploy
docker-compose -f config/docker-compose.yml --profile production up -d
```

3. **SSL and domain setup**
```bash
# Configure DNS to point to your server
# Setup SSL certificates
# Configure nginx with your domain
```

4. **Setup systemd service (optional)**
```bash
sudo cp config/systemd/concertmaster.service /etc/systemd/system/
sudo systemctl enable concertmaster
sudo systemctl start concertmaster
```

### Backup and Recovery

1. **Database backup**
```bash
# Create backup script
cat > backup-db.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec -T postgres pg_dump -U postgres concertmaster | gzip > backups/concertmaster_$DATE.sql.gz
EOF

chmod +x backup-db.sh
```

2. **Schedule backups**
```bash
# Add to crontab
0 2 * * * /opt/concertmaster/backup-db.sh
```

## 🔍 Troubleshooting

### Common Issues

#### Backend won't start
```bash
# Check logs
docker-compose logs backend

# Common solutions:
# 1. Database connection issues - check DATABASE_URL
# 2. Redis connection issues - check REDIS_URL
# 3. Missing SECRET_KEY - generate and set SECRET_KEY
```

#### Frontend build fails
```bash
# Check logs
docker-compose logs frontend

# Common solutions:
# 1. Node.js version compatibility
# 2. Missing environment variables
# 3. Network connectivity to backend
```

#### Database migrations fail
```bash
# Manual migration
docker-compose exec backend alembic upgrade head

# Check migration status
docker-compose exec backend alembic current
```

#### Celery workers not processing tasks
```bash
# Check worker logs
docker-compose logs celery-worker

# Restart workers
docker-compose restart celery-worker

# Check Redis connection
docker-compose exec redis redis-cli ping
```

### Performance Issues

1. **High memory usage**
   - Reduce worker concurrency
   - Increase swap space
   - Optimize database queries

2. **Slow API responses**
   - Check database indexes
   - Enable Redis caching
   - Profile slow endpoints

3. **Task queue backlog**
   - Increase worker instances
   - Optimize task code
   - Implement task prioritization

### Getting Help

1. **Check logs first**
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs backend

# Follow logs
docker-compose logs -f
```

2. **Health checks**
```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/status
```

3. **Database status**
```bash
docker-compose exec postgres psql -U postgres -c "\l"
docker-compose exec postgres psql -U postgres -d concertmaster -c "\dt"
```

4. **Redis status**
```bash
docker-compose exec redis redis-cli info
```