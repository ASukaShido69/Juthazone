// =====================================================
// AUTOMATED BACKUP SCHEDULER - Node.js
// =====================================================
// Purpose: Schedule daily backups automatically
// Usage: node backup-scheduler.js

const cron = require('node-cron');
const supabase = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

// =====================================================
// Configuration
// =====================================================
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const BACKUP_WEBHOOK = process.env.BACKUP_WEBHOOK_URL; // For notifications

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =====================================================
// Backup Schedule Configurations
// =====================================================
const BACKUP_SCHEDULES = {
  daily: '0 2 * * *',        // Every day at 2:00 AM UTC+7
  weekly: '0 3 * * 0',       // Every Sunday at 3:00 AM UTC+7
  monthly: '0 4 1 * *'       // Every 1st of month at 4:00 AM UTC+7
};

// =====================================================
// 1. Daily Backup Function
// =====================================================
async function createDailyBackup() {
  console.log(`[${new Date().toISOString()}] Starting daily backup...`);
  
  try {
    // Execute SQL backup function
    const { data, error } = await client.rpc('backup_all_tables');
    
    if (error) {
      console.error('❌ Backup failed:', error);
      await notifyAdmin('backup_failed', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    console.log('✅ Backup completed successfully');
    console.log('📊 Backup results:', data);
    
    // Log success
    await logBackupEvent('success', data);
    
    // Send notification
    await notifyAdmin('backup_success', {
      backupResults: data,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('❌ Backup error:', err);
    await notifyAdmin('backup_error', {
      error: err.message,
      stack: err.stack
    });
  }
}

// =====================================================
// 2. Backup Health Check
// =====================================================
async function checkBackupHealth() {
  console.log(`[${new Date().toISOString()}] Checking backup health...`);
  
  try {
    const { data, error } = await client
      .from('backup_metadata')
      .select('table_name, backup_time, total_rows, status')
      .eq('status', 'success')
      .gte('backup_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('backup_time', { ascending: false });
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      console.warn('⚠️ No recent backups found!');
      await notifyAdmin('backup_missing', {
        message: 'No backups in last 24 hours',
        timestamp: new Date().toISOString()
      });
      return false;
    }
    
    console.log(`✅ Latest backups: ${data.length} tables backed up`);
    data.forEach(backup => {
      const hoursOld = (Date.now() - new Date(backup.backup_time).getTime()) / (1000 * 60 * 60);
      console.log(`  📦 ${backup.table_name}: ${backup.total_rows} rows, ${hoursOld.toFixed(1)} hours old`);
    });
    
    return true;
    
  } catch (err) {
    console.error('❌ Health check failed:', err);
    await notifyAdmin('health_check_failed', { error: err.message });
    return false;
  }
}

// =====================================================
// 3. Cleanup Old Backups
// =====================================================
async function cleanupOldBackups(daysToKeep = 30) {
  console.log(`[${new Date().toISOString()}] Cleaning up backups older than ${daysToKeep} days...`);
  
  try {
    const { data, error } = await client.rpc('cleanup_old_backups', {
      p_days_to_keep: daysToKeep
    });
    
    if (error) throw error;
    
    console.log(`✅ Cleanup complete: ${data[0].deleted_count} old backup records deleted`);
    await notifyAdmin('cleanup_success', {
      deletedCount: data[0].deleted_count,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('❌ Cleanup failed:', err);
    await notifyAdmin('cleanup_failed', { error: err.message });
  }
}

// =====================================================
// 4. Export Backup to Local Storage
// =====================================================
async function exportBackupToFile(tableName) {
  console.log(`[${new Date().toISOString()}] Exporting backup for ${tableName}...`);
  
  try {
    const { data, error } = await client
      .from(`${tableName}_backup`)
      .select('*');
    
    if (error) throw error;
    
    const fs = require('fs');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backups/${tableName}_backup_${timestamp}.json`;
    
    // Create backups directory if not exists
    if (!fs.existsSync('backups')) {
      fs.mkdirSync('backups', { recursive: true });
    }
    
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`✅ Backup exported to ${filename} (${data.length} records)`);
    
    return filename;
    
  } catch (err) {
    console.error(`❌ Export failed for ${tableName}:`, err);
    throw err;
  }
}

// =====================================================
// 5. Get Backup Status
// =====================================================
async function getBackupStatus() {
  try {
    const { data, error } = await client
      .rpc('v_backup_status');  // Call view through RPC
    
    if (error) throw error;
    
    return data;
    
  } catch (err) {
    // Fallback: query backup_metadata directly
    const { data } = await client
      .from('backup_metadata')
      .select('*')
      .eq('status', 'success')
      .order('backup_time', { ascending: false })
      .limit(10);
    
    return data;
  }
}

// =====================================================
// 6. Restore from Backup
// =====================================================
async function restoreFromBackup(tableName) {
  console.log(`[${new Date().toISOString()}] Restoring ${tableName} from backup...`);
  
  try {
    const { data, error } = await client.rpc('restore_from_backup', {
      p_table_name: tableName
    });
    
    if (error) throw error;
    
    console.log(`✅ Restore successful: ${data[0].message}`);
    console.log(`   Restored ${data[0].restored_rows} rows`);
    
    await notifyAdmin('restore_success', {
      tableName,
      restoredRows: data[0].restored_rows,
      timestamp: new Date().toISOString()
    });
    
    return data[0];
    
  } catch (err) {
    console.error(`❌ Restore failed for ${tableName}:`, err);
    await notifyAdmin('restore_failed', {
      tableName,
      error: err.message,
      timestamp: new Date().toISOString()
    });
    throw err;
  }
}

// =====================================================
// 7. Send Notifications
// =====================================================
async function notifyAdmin(type, details) {
  if (!BACKUP_WEBHOOK) {
    console.log('⚠️ No webhook URL configured, skipping notification');
    return;
  }
  
  const messages = {
    backup_success: `✅ Backup completed successfully\n${JSON.stringify(details, null, 2)}`,
    backup_failed: `❌ Backup failed\n${JSON.stringify(details, null, 2)}`,
    backup_error: `❌ Backup error\n${JSON.stringify(details, null, 2)}`,
    backup_missing: `⚠️ ${details.message}`,
    health_check_failed: `❌ Health check failed\n${JSON.stringify(details, null, 2)}`,
    cleanup_success: `✅ Cleanup completed: ${details.deletedCount} records deleted`,
    cleanup_failed: `❌ Cleanup failed\n${JSON.stringify(details, null, 2)}`,
    restore_success: `✅ Restored ${details.tableName}: ${details.restoredRows} rows`,
    restore_failed: `❌ Restore failed for ${details.tableName}\n${details.error}`
  };
  
  try {
    await axios.post(BACKUP_WEBHOOK, {
      text: messages[type] || 'Backup system notification',
      timestamp: details.timestamp || new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to send notification:', err.message);
  }
}

// =====================================================
// 8. Log Backup Events
// =====================================================
async function logBackupEvent(status, details) {
  try {
    await client
      .from('activity_logs')
      .insert({
        username: 'system',
        action_type: 'BACKUP_EVENT',
        description: `Backup ${status}`,
        data_changed: details,
        user_agent: 'backup-scheduler'
      });
  } catch (err) {
    console.error('Failed to log backup event:', err);
  }
}

// =====================================================
// 9. Setup Cron Jobs
// =====================================================
function setupBackupSchedules() {
  console.log('📅 Setting up backup schedules...');
  
  // Daily backup at 2:00 AM
  cron.schedule(BACKUP_SCHEDULES.daily, async () => {
    console.log('\n🔄 SCHEDULED: Daily Backup Started');
    await createDailyBackup();
  });
  
  // Health check every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('\n💓 SCHEDULED: Health Check');
    await checkBackupHealth();
  });
  
  // Cleanup every week
  cron.schedule(BACKUP_SCHEDULES.weekly, async () => {
    console.log('\n🧹 SCHEDULED: Cleanup Old Backups');
    await cleanupOldBackups(30);
  });
  
  console.log('✅ Backup schedules configured');
  console.log('   📦 Daily backup: 2:00 AM UTC+7');
  console.log('   💓 Health check: Every 6 hours');
  console.log('   🧹 Cleanup: Every Sunday at 3:00 AM UTC+7');
}

// =====================================================
// 10. Manual Test Commands
// =====================================================
async function runManualBackup() {
  console.log('\n🚀 Manual Backup Started');
  await createDailyBackup();
  await checkBackupHealth();
}

async function runHealthCheck() {
  console.log('\n💓 Health Check');
  const status = await checkBackupHealth();
  console.log('\n📊 Backup Status:');
  console.log(await getBackupStatus());
}

async function runCleanup() {
  console.log('\n🧹 Cleanup');
  await cleanupOldBackups(30);
}

// =====================================================
// 11. CLI Interface
// =====================================================
const command = process.argv[2];

switch (command) {
  case 'start':
    console.log('🎯 Starting Backup Scheduler...\n');
    setupBackupSchedules();
    console.log('\n✅ Backup scheduler is running. Press Ctrl+C to stop.\n');
    
    // Run initial health check
    checkBackupHealth();
    break;
    
  case 'backup':
    runManualBackup();
    break;
    
  case 'status':
    runHealthCheck();
    break;
    
  case 'cleanup':
    runCleanup();
    break;
    
  case 'restore':
    if (!process.argv[3]) {
      console.log('Usage: node backup-scheduler.js restore <table_name>');
      console.log('Example: node backup-scheduler.js restore customers');
      process.exit(1);
    }
    restoreFromBackup(process.argv[3]);
    break;
    
  case 'export':
    if (!process.argv[3]) {
      console.log('Usage: node backup-scheduler.js export <table_name>');
      console.log('Example: node backup-scheduler.js export customers_history');
      process.exit(1);
    }
    exportBackupToFile(process.argv[3]);
    break;
    
  default:
    console.log(`
🛠️  Backup Scheduler CLI

Usage:
  node backup-scheduler.js <command>

Commands:
  start      Start backup scheduler (runs continuously)
  backup     Run manual backup now
  status     Check backup status
  cleanup    Cleanup old backups (>30 days)
  restore    Restore table from backup
             restore <table_name>
  export     Export backup to JSON file
             export <table_name>

Examples:
  node backup-scheduler.js start
  node backup-scheduler.js backup
  node backup-scheduler.js status
  node backup-scheduler.js restore customers
  node backup-scheduler.js export customers_history

Configuration:
  Create .env file with:
    VITE_SUPABASE_URL=your_url
    VITE_SUPABASE_ANON_KEY=your_key
    BACKUP_WEBHOOK_URL=slack_or_discord_webhook (optional)
    `);
}

// =====================================================
// Error Handling
// =====================================================
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
  notifyAdmin('backup_error', {
    error: String(reason),
    timestamp: new Date().toISOString()
  });
});

process.on('SIGINT', () => {
  console.log('\n\n👋 Backup scheduler stopped');
  process.exit(0);
});

module.exports = {
  createDailyBackup,
  checkBackupHealth,
  cleanupOldBackups,
  exportBackupToFile,
  restoreFromBackup,
  getBackupStatus,
  setupBackupSchedules
};
