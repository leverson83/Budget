# Docker Setup for Budget Tool v2

This document explains how to run the Budget Tool v2 application using Docker.

## Prerequisites

- Docker installed on your system
- Docker Compose installed

## Quick Start

1. **Build and start the application:**
   ```bash
   docker-compose up --build
   ```

2. **Access the application:**
   Open your browser and go to `http://localhost:3001`

3. **Stop the application:**
   ```bash
   docker-compose down
   ```

## Environment Variables

The application uses the following environment variables:

- `JWT_SECRET`: Secret key for JWT token signing (required for production)
- `NODE_ENV`: Set to `production` for production deployment

### Setting up JWT_SECRET

1. Generate a secure secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

2. Create a `.env` file in the root directory:
   ```bash
   echo "JWT_SECRET=your-generated-secret-here" > .env
   ```

3. Or set it as an environment variable:
   ```bash
   export JWT_SECRET=your-generated-secret-here
   docker-compose up
   ```

## Docker Commands

### Using the provided script:
```bash
# Make the script executable (Linux/Mac)
chmod +x docker-scripts.sh

# Build the image
./docker-scripts.sh build

# Start the application
./docker-scripts.sh up

# View logs
./docker-scripts.sh logs

# Stop the application
./docker-scripts.sh down

# Restart the application
./docker-scripts.sh restart

# Clean up resources
./docker-scripts.sh clean

# Access container shell
./docker-scripts.sh shell

# Backup database
./docker-scripts.sh db-backup

# Restore database
./docker-scripts.sh db-restore backup-file-name
```

### Using docker-compose directly:
```bash
# Build and start
docker-compose up --build

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Rebuild and restart
docker-compose up --build --force-recreate
```

## Data Persistence

The application data is persisted using Docker volumes:

- `budget_data`: Contains the SQLite database and application data
- Database file location in container: `/app/backend/budget.db`

### Backup and Restore

**Backup:**
```bash
docker-compose exec budget-app cp /app/backend/budget.db /app/backend/budget.db.backup.$(date +%Y%m%d_%H%M%S)
```

**Restore:**
```bash
docker-compose exec budget-app cp /app/backend/backup-file /app/backend/budget.db
```

## Development vs Production

### Development
- Frontend runs on Vite dev server (port 3000)
- Backend runs on Express server (port 3001)
- CORS enabled for localhost:3000

### Production (Docker)
- Frontend is built and served by Express server
- Single container serves both frontend and backend
- CORS disabled (same-origin requests)
- All traffic goes through port 3001

## Troubleshooting

### Container won't start
1. Check if port 3001 is available:
   ```bash
   netstat -tulpn | grep :3001
   ```

2. Check container logs:
   ```bash
   docker-compose logs
   ```

### Database issues
1. Check if the database file exists:
   ```bash
   docker-compose exec budget-app ls -la /app/backend/
   ```

2. Reset the database (WARNING: This will delete all data):
   ```bash
   docker-compose down -v
   docker-compose up --build
   ```

### Permission issues
If you encounter permission issues on Linux/Mac:
```bash
sudo chown -R $USER:$USER .
```

## Health Check

The application includes a health check endpoint at `/api/health` that returns:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456
}
```

## Security Considerations

1. **JWT Secret**: Always use a strong, unique JWT_SECRET in production
2. **Database**: The SQLite database is stored in a Docker volume for persistence
3. **User**: The application runs as a non-root user (nodejs) for security
4. **Ports**: Only port 3001 is exposed to the host

## Production Deployment

For production deployment:

1. Set `NODE_ENV=production`
2. Use a strong JWT_SECRET
3. Consider using a reverse proxy (nginx) for SSL termination
4. Set up proper logging and monitoring
5. Use Docker secrets for sensitive environment variables

Example production docker-compose.yml:
```yaml
version: '3.8'
services:
  budget-app:
    build: .
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
    ports:
      - "3001:3001"
    volumes:
      - budget_data:/app/backend/data
    restart: unless-stopped
    secrets:
      - jwt_secret

secrets:
  jwt_secret:
    external: true

volumes:
  budget_data:
    driver: local
``` 