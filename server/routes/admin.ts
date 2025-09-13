import { Router } from 'express';
import { db } from '../db';
import { users } from '@shared/schema';
import { requireAdmin } from '../admin-middleware';
import { sendInvestmentUpdateEmail } from '../email-service';
import { ne } from 'drizzle-orm';

const router = Router();

// Send investment update email to all users
router.post('/send-investment-update', requireAdmin, async (req, res) => {
  try {
    const { subject, message, tabName } = req.body;

    // Validate input
    if (!subject || !message || !tabName) {
      return res.status(400).json({ 
        error: 'Missing required fields: subject, message, and tabName are required' 
      });
    }

    // Check message length (approximately 1000 words = 6000 characters)
    if (message.length > 6000) {
      return res.status(400).json({ 
        error: 'Message exceeds maximum length of 1000 words (approximately 6000 characters)' 
      });
    }

    // Get all registered user emails except the admin
    const adminEmail = req.user?.email || 'bhav@live.com';
    const allUsers = await db
      .select({ email: users.email })
      .from(users)
      .where(ne(users.email, adminEmail));

    if (allUsers.length === 0) {
      return res.status(404).json({ 
        error: 'No registered users found to send updates to' 
      });
    }

    const userEmails = allUsers.map(user => user.email).filter(Boolean) as string[];

    // Send the email
    const emailSent = await sendInvestmentUpdateEmail({
      to: userEmails,
      subject,
      message,
      tabName,
      senderName: 'Admin',
    });

    if (emailSent) {
      res.json({ 
        success: true, 
        message: `Investment update sent to ${userEmails.length} users`,
        recipientCount: userEmails.length 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to send email. Please check email configuration.' 
      });
    }
  } catch (error) {
    console.error('Error sending investment update:', error);
    res.status(500).json({ 
      error: 'Failed to send investment update' 
    });
  }
});

// Get all user emails (for preview in UI)
router.get('/user-emails', requireAdmin, async (req, res) => {
  try {
    const adminEmail = req.user?.email || 'bhav@live.com';
    const allUsers = await db
      .select({ email: users.email })
      .from(users)
      .where(ne(users.email, adminEmail));

    res.json({ 
      users: allUsers,
      count: allUsers.length 
    });
  } catch (error) {
    console.error('Error fetching user emails:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user emails' 
    });
  }
});

export default router;