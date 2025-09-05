# Database Optimization Strategy - ConcertMaster Platform

## Overview

**Objective**: Optimize PostgreSQL database performance for high-throughput workflow execution and form processing  
**Target**: <50ms query response time, 10,000+ concurrent operations  
**Approach**: Indexing, query optimization, connection management, and scaling strategy  

## Current Database Schema Analysis

### Performance-Critical Tables

```sql
-- Workflows table - High read frequency
CREATE TABLE workflows (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    definition JSONB,           -- PERFORMANCE BOTTLENECK
    created_by UUID,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    is_template BOOLEAN DEFAULT FALSE
);

-- Workflow runs - High write frequency
CREATE TABLE workflow_runs (
    id UUID PRIMARY KEY,
    workflow_id UUID REFERENCES workflows(id),
    status VARCHAR(50),         -- FREQUENT FILTERING
    trigger_data JSONB,         -- LARGE PAYLOADS
    started_at TIMESTAMP,       -- DATE RANGE QUERIES
    completed_at TIMESTAMP
);

-- Form responses - Highest volume table
CREATE TABLE form_responses (
    id UUID PRIMARY KEY,
    form_schema_id UUID REFERENCES form_schemas(id),
    workflow_run_id UUID,
    data JSONB,                 -- COMPLEX QUERIES
    metadata JSONB,
    submitted_at TIMESTAMP      -- TIME-SERIES DATA
);
```

## Comprehensive Indexing Strategy

### Phase 1: Critical Performance Indexes

```sql
-- Workflow definition queries
CREATE INDEX CONCURRENTLY idx_workflow_type 
ON workflows USING GIN((definition->>'type'));

CREATE INDEX CONCURRENTLY idx_workflow_status_filter
ON workflows USING GIN((definition->>'status')) 
WHERE definition->>'status' IS NOT NULL;

-- Workflow runs performance
CREATE INDEX CONCURRENTLY idx_workflow_runs_status_time
ON workflow_runs(status, started_at DESC) 
WHERE status IN ('running', 'failed', 'pending');

CREATE INDEX CONCURRENTLY idx_workflow_runs_workflow_status
ON workflow_runs(workflow_id, status) 
INCLUDE (started_at, completed_at);

-- Form responses optimization
CREATE INDEX CONCURRENTLY idx_form_responses_schema_time
ON form_responses(form_schema_id, submitted_at DESC);

CREATE INDEX CONCURRENTLY idx_form_responses_workflow
ON form_responses(workflow_run_id) 
WHERE workflow_run_id IS NOT NULL;

-- JSONB data queries (most expensive)
CREATE INDEX CONCURRENTLY idx_form_responses_data_gin
ON form_responses USING GIN(data);

-- Metadata searches
CREATE INDEX CONCURRENTLY idx_form_responses_metadata
ON form_responses USING GIN(metadata)
WHERE metadata IS NOT NULL;
```

### Phase 2: Advanced Performance Indexes

```sql
-- Node execution performance
CREATE INDEX CONCURRENTLY idx_node_executions_composite
ON node_executions(workflow_run_id, node_id, status)
INCLUDE (started_at, completed_at, error);

-- Multi-column optimization for dashboard queries
CREATE INDEX CONCURRENTLY idx_workflow_runs_dashboard
ON workflow_runs(created_by, status, started_at DESC)
WHERE started_at > NOW() - INTERVAL '30 days';

-- Form schema versioning
CREATE INDEX CONCURRENTLY idx_form_schemas_name_version
ON form_schemas(name, version DESC);

-- Audit trail optimization
CREATE INDEX CONCURRENTLY idx_audit_events_entity_time
ON audit_events(entity_type, entity_id, created_at DESC)
WHERE created_at > NOW() - INTERVAL '90 days';
```

### Phase 3: Partitioning Strategy

```sql
-- Partition form_responses by month for better performance
CREATE TABLE form_responses_partitioned (
    LIKE form_responses INCLUDING ALL
) PARTITION BY RANGE (submitted_at);

-- Create monthly partitions
CREATE TABLE form_responses_2025_01 PARTITION OF form_responses_partitioned
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE form_responses_2025_02 PARTITION OF form_responses_partitioned
FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- Auto-partition creation function
CREATE OR REPLACE FUNCTION create_monthly_partition(table_name TEXT, start_date DATE)
RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    end_date DATE;
BEGIN
    partition_name := table_name || '_' || to_char(start_date, 'YYYY_MM');
    end_date := start_date + INTERVAL '1 month';
    
    EXECUTE format('CREATE TABLE %I PARTITION OF %I 
                   FOR VALUES FROM (%L) TO (%L)',
                   partition_name, table_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;
```

## Query Optimization Patterns

### Optimized Workflow Queries

```sql
-- BEFORE: Slow JSONB query (500ms+)
SELECT * FROM workflows 
WHERE definition->>'type' = 'scheduled' 
AND definition->>'status' = 'active';

-- AFTER: Optimized with proper indexing (<50ms)
SELECT w.id, w.name, w.definition, w.created_at
FROM workflows w 
WHERE (definition->>'type') = 'scheduled'
AND (definition->>'status') = 'active'
ORDER BY w.updated_at DESC
LIMIT 50;

-- Use index hints for complex queries
SET enable_seqscan = off; -- Force index usage for critical queries
```

### Form Response Analytics Queries

```sql
-- Optimized aggregation with materialized views
CREATE MATERIALIZED VIEW form_completion_stats AS
SELECT 
    fr.form_schema_id,
    fs.name as form_name,
    DATE_TRUNC('day', fr.submitted_at) as day,
    COUNT(*) as submissions,
    COUNT(CASE WHEN fr.data->>'status' = 'complete' THEN 1 END) as completed,
    AVG(CASE WHEN fr.data->>'completion_time' IS NOT NULL 
        THEN (fr.data->>'completion_time')::INTEGER END) as avg_completion_time
FROM form_responses fr
JOIN form_schemas fs ON fr.form_schema_id = fs.id
WHERE fr.submitted_at > NOW() - INTERVAL '30 days'
GROUP BY fr.form_schema_id, fs.name, DATE_TRUNC('day', fr.submitted_at);

-- Refresh strategy (every 15 minutes)
SELECT cron.schedule('refresh-form-stats', '*/15 * * * *', 
    'REFRESH MATERIALIZED VIEW CONCURRENTLY form_completion_stats;');
```

## Connection Management & Pooling

### PgBouncer Configuration

```ini
[databases]
concertmaster = host=postgres port=5432 dbname=concertmaster_prod

[pgbouncer]
listen_port = 5432
listen_addr = 0.0.0.0
auth_type = md5
auth_file = users.txt
admin_users = admin
stats_users = admin

# Connection limits
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
max_db_connections = 100
reserve_pool_size = 5

# Performance tuning
server_reset_query = DISCARD ALL
server_check_query = SELECT 1
server_check_delay = 30
server_lifetime = 3600
server_idle_timeout = 600

# Logging
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
```

### Application-Level Connection Management

```python
# SQLAlchemy engine configuration
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=20,                    # Base connection pool
    max_overflow=30,                 # Additional connections
    pool_pre_ping=True,              # Validate connections
    pool_recycle=3600,               # Recycle after 1 hour
    connect_args={
        "application_name": "concertmaster-api",
        "options": "-c default_transaction_isolation=read committed"
    }
)

# Read-only connection for analytics
analytics_engine = create_engine(
    READONLY_DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True
)
```

## Query Performance Monitoring

### Custom Performance Monitoring

```sql
-- Enable query logging for slow queries
ALTER SYSTEM SET log_min_duration_statement = 100;  -- Log queries >100ms
ALTER SYSTEM SET log_statement = 'mod';             -- Log modifications
ALTER SYSTEM SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';

-- Create performance monitoring view
CREATE VIEW slow_query_analysis AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
WHERE mean_time > 100  -- Queries averaging >100ms
ORDER BY mean_time DESC;

-- Monitor index usage
CREATE VIEW index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### Application Monitoring Integration

```python
# Performance monitoring with SQLAlchemy events
from sqlalchemy import event
from sqlalchemy.engine import Engine
import time
import logging

logger = logging.getLogger("sql_performance")

@event.listens_for(Engine, "before_cursor_execute")
def receive_before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    context._query_start_time = time.time()

@event.listens_for(Engine, "after_cursor_execute")
def receive_after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    total = time.time() - context._query_start_time
    
    # Log slow queries (>100ms)
    if total > 0.1:
        logger.warning(f"Slow query detected: {total:.3f}s - {statement[:100]}...")
    
    # Metrics for monitoring
    QUERY_DURATION.labels(
        query_type=statement.split()[0].upper(),
        status="success"
    ).observe(total)
```

## Scaling Strategy

### Read Replica Setup

```yaml
# PostgreSQL streaming replication
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: postgres-cluster
spec:
  instances: 3
  
  postgresql:
    parameters:
      max_connections: "200"
      shared_buffers: "256MB"
      effective_cache_size: "1GB"
      work_mem: "4MB"
      maintenance_work_mem: "64MB"
      
  # Read-only replicas
  replica:
    instances: 2
    resources:
      requests:
        cpu: "500m"
        memory: "1Gi"
      limits:
        cpu: "1000m"
        memory: "2Gi"

  monitoring:
    enabled: true
```

### Database Load Balancing

```python
# Read/write split configuration
class DatabaseRouter:
    def __init__(self):
        self.write_engine = create_engine(PRIMARY_DATABASE_URL)
        self.read_engines = [
            create_engine(REPLICA_1_URL),
            create_engine(REPLICA_2_URL)
        ]
        self.read_engine_index = 0
    
    def get_read_engine(self):
        # Round-robin load balancing
        engine = self.read_engines[self.read_engine_index]
        self.read_engine_index = (self.read_engine_index + 1) % len(self.read_engines)
        return engine
    
    def get_write_engine(self):
        return self.write_engine

# Usage in services
class WorkflowService:
    def get_workflows(self, filters):
        # Use read replica for queries
        engine = db_router.get_read_engine()
        with engine.connect() as conn:
            return conn.execute(select_workflows_query, filters)
    
    def create_workflow(self, workflow_data):
        # Use primary for writes
        engine = db_router.get_write_engine()
        with engine.connect() as conn:
            return conn.execute(insert_workflow_query, workflow_data)
```

## Backup and Recovery Strategy

### Automated Backup Configuration

```bash
#!/bin/bash
# Automated backup script with point-in-time recovery

# Full backup (weekly)
pg_basebackup -h $DB_HOST -U $BACKUP_USER -D /backup/$(date +%Y-%m-%d) \
    --wal-method=stream --progress --verbose

# WAL archiving (continuous)
archive_command = 'cp %p /backup/wal_archive/%f'

# Recovery configuration
cat > recovery.conf << EOF
restore_command = 'cp /backup/wal_archive/%f %p'
recovery_target_time = '2025-09-05 10:30:00'
recovery_target_action = 'promote'
EOF
```

### Monitoring and Alerting

```sql
-- Database health monitoring queries
-- Connection monitoring
SELECT count(*) as active_connections 
FROM pg_stat_activity 
WHERE state = 'active';

-- Lock monitoring
SELECT 
    pg_stat_activity.pid,
    pg_stat_activity.query,
    pg_locks.mode,
    pg_locks.granted
FROM pg_stat_activity
JOIN pg_locks ON pg_stat_activity.pid = pg_locks.pid
WHERE NOT pg_locks.granted;

-- Table size monitoring
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Implementation Timeline

### Week 1: Critical Indexes
- ✅ Deploy Phase 1 indexes (JSONB optimization)
- ✅ Set up query monitoring
- ✅ Configure PgBouncer connection pooling

### Week 2: Advanced Optimization  
- 🔄 Implement materialized views for analytics
- 🔄 Set up read replica infrastructure
- 🔄 Deploy application-level query routing

### Week 3: Scaling Infrastructure
- ⏳ Configure Kubernetes PostgreSQL cluster
- ⏳ Implement automated backup system
- ⏳ Set up monitoring and alerting

### Week 4: Performance Testing
- ⏳ Load testing with optimized queries
- ⏳ Benchmark performance improvements
- ⏳ Fine-tune configuration parameters

## Expected Performance Improvements

| Metric | Current | Target | Improvement |
|---------|---------|---------|-------------|
| **JSONB Queries** | 500ms+ | <50ms | 90% reduction |
| **Workflow Lookups** | 200ms | <25ms | 87% reduction |
| **Form Analytics** | 2s+ | <100ms | 95% reduction |
| **Concurrent Connections** | 100 | 1000+ | 10x increase |
| **Query Cache Hit Rate** | 85% | 95%+ | +10% improvement |

## Success Metrics

- **Query Response Time**: 90% of queries <100ms
- **Database CPU Usage**: <70% under normal load
- **Connection Pool Efficiency**: >90% utilization
- **Index Hit Rate**: >95% for critical indexes
- **Backup Recovery Time**: <30 minutes for point-in-time recovery

---

**Database Optimization Strategy Complete**  
**Performance Target**: <50ms average query time  
**Scalability**: 10,000+ concurrent operations  
**Implementation**: Ready for deployment