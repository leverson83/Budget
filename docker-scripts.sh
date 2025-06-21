#!/bin/bash

# Docker scripts for budget-tool-v2

echo "Budget Tool v2 - Docker Management Script"
echo "========================================"

case "$1" in
  "build")
    echo "Building Docker image..."
    docker-compose build
    ;;
  "up")
    echo "Starting the application..."
    docker-compose up -d
    ;;
  "down")
    echo "Stopping the application..."
    docker-compose down
    ;;
  "restart")
    echo "Restarting the application..."
    docker-compose restart
    ;;
  "logs")
    echo "Showing logs..."
    docker-compose logs -f
    ;;
  "clean")
    echo "Cleaning up Docker resources..."
    docker-compose down -v
    docker system prune -f
    ;;
  "shell")
    echo "Opening shell in container..."
    docker-compose exec budget-app sh
    ;;
  "db-backup")
    echo "Backing up database..."
    docker-compose exec budget-app cp /app/backend/budget.db /app/backend/budget.db.backup.$(date +%Y%m%d_%H%M%S)
    ;;
  "db-restore")
    if [ -z "$2" ]; then
      echo "Usage: $0 db-restore <backup-file>"
      exit 1
    fi
    echo "Restoring database from $2..."
    docker-compose exec budget-app cp /app/backend/$2 /app/backend/budget.db
    ;;
  *)
    echo "Usage: $0 {build|up|down|restart|logs|clean|shell|db-backup|db-restore}"
    echo ""
    echo "Commands:"
    echo "  build      - Build the Docker image"
    echo "  up         - Start the application"
    echo "  down       - Stop the application"
    echo "  restart    - Restart the application"
    echo "  logs       - Show application logs"
    echo "  clean      - Clean up Docker resources"
    echo "  shell      - Open shell in container"
    echo "  db-backup  - Backup the database"
    echo "  db-restore - Restore database from backup"
    exit 1
    ;;
esac 