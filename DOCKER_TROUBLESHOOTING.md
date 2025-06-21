# Docker Troubleshooting Guide

## Common Issues and Solutions

### 1. "Unexpected end of JSON input" Error

This error typically means the API endpoints are not responding or returning empty responses.

**Possible causes:**
- Backend server not starting properly
- Database initialization issues
- Port configuration problems
- Permission issues

**Solutions:**

#### Check if Docker is running:
```bash
docker ps
```

#### Check container logs:
```bash
docker compose logs budget-app
```

#### Test the health endpoint:
```bash
curl http://localhost:8585/api/health
```

#### Rebuild the container:
```bash
docker compose down
docker compose up --build
```

### 2. Database Issues

**Check database permissions:**
```bash
docker compose exec budget-app ls -la /app/backend/
```

**Check if database file exists:**
```bash
docker compose exec budget-app ls -la /app/backend/budget.db
```

**Reset database (WARNING: This will delete all data):**
```bash
docker compose down -v
docker compose up --build
```

### 3. Port Issues

**Check if port 8585 is available:**
```bash
netstat -tulpn | grep :8585
```

**Check container port mapping:**
```bash
docker compose ps
```

### 4. Frontend Not Loading

**Check if static files are being served:**
```bash
curl http://localhost:8585/
```

**Check if API endpoints are accessible:**
```bash
curl http://localhost:8585/api/health
```

### 5. Authentication Issues

**Test registration for existing user without password:**
```bash
curl -X POST http://localhost:8585/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"leverson83@gmail.com","password":"test123","name":"Luke"}'
```

**Test login:**
```bash
curl -X POST http://localhost:8585/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"leverson83@gmail.com","password":"test123"}'
```

## Debugging Steps

1. **Start fresh:**
   ```bash
   docker compose down -v
   docker system prune -f
   docker compose up --build
   ```

2. **Check logs in real-time:**
   ```bash
   docker compose logs -f budget-app
   ```

3. **Access container shell:**
   ```bash
   docker compose exec budget-app sh
   ```

4. **Test from inside container:**
   ```bash
   docker compose exec budget-app node -e "
   const http = require('http');
   const req = http.request({
     hostname: 'localhost',
     port: 8585,
     path: '/api/health',
     method: 'GET'
   }, (res) => {
     console.log('Status:', res.statusCode);
     res.on('data', (chunk) => console.log('Response:', chunk.toString()));
   });
   req.on('error', (e) => console.error('Error:', e.message));
   req.end();
   "
   ```

## Environment Variables

Make sure these are set in your `.env` file:
```
JWT_SECRET=your-secure-jwt-secret
NODE_ENV=production
```

## Common Commands

```bash
# Build and start
docker compose up --build

# Start in background
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down

# Restart
docker compose restart

# Clean everything
docker compose down -v
docker system prune -f
``` 