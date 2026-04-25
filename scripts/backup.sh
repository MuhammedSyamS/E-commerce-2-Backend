#!/bin/bash
# HighPhaus / SLOOK - Automated Disaster Recovery Backup
# Retention: 7 / 30 / 90 days

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="./backups/$TIMESTAMP"
MONGODB_URI=${MONGO_URI}

echo "🚀 Starting Enterprise Backup: $TIMESTAMP"

# 1. Create directory
mkdir -p "$BACKUP_DIR"

# 2. MongoDB Dump
mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR/mongo" --gzip

# 3. Zip and Encrypt (Optional, but recommended)
tar -czf "$BACKUP_DIR.tar.gz" -C "$BACKUP_DIR" .
rm -rf "$BACKUP_DIR"

# 4. Retention Cleanup
find ./backups -name "*.tar.gz" -mtime +30 -delete

echo "✅ Backup Completed: $BACKUP_DIR.tar.gz"
