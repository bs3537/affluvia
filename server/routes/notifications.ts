import express from 'express';
import { NotificationService } from '../services/notification-service';
import { requireAuth } from '../auth';

const router = express.Router();

// Get all notifications for current user
router.get('/notifications', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const unreadOnly = req.query.unreadOnly === 'true';
    
    const notifications = await NotificationService.getNotifications(userId, unreadOnly);
    
    res.json({
      success: true,
      notifications
    });
  } catch (error) {
    console.error('[Notifications] Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
});

// Mark notification as read
router.patch('/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const notificationId = parseInt(req.params.id);
    
    await NotificationService.markAsRead(userId, notificationId);
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('[Notifications] Error marking as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
});

// Mark all notifications as read
router.patch('/notifications/read-all', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    await NotificationService.markAllAsRead(userId);
    
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('[Notifications] Error marking all as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read'
    });
  }
});

// Clear all notifications
router.delete('/notifications', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    await NotificationService.clearNotifications(userId);
    
    res.json({
      success: true,
      message: 'All notifications cleared'
    });
  } catch (error) {
    console.error('[Notifications] Error clearing notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear notifications'
    });
  }
});

// SSE endpoint for real-time notifications
router.get('/notifications/stream', requireAuth, (req, res) => {
  const userId = req.user!.id;
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  // Subscribe to notifications
  const unsubscribe = NotificationService.subscribe(userId, (notification) => {
    res.write(`data: ${JSON.stringify({ type: 'notification', data: notification })}\n\n`);
  });

  // Send heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
  }, 30000);

  // Clean up on disconnect
  req.on('close', () => {
    unsubscribe();
    clearInterval(heartbeat);
  });
});

export default router;