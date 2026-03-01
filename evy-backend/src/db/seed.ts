import type Database from 'better-sqlite3';

export function seedDatabase(db: Database.Database): void {
  const kbCount = (db.prepare('SELECT COUNT(*) as cnt FROM knowledge_base').get() as { cnt: number }).cnt;

  if (kbCount === 0) {
    const insertKb = db.prepare(
      'INSERT INTO knowledge_base (id, title, content, category, created_at) VALUES (?, ?, ?, ?, ?)'
    );

    const kbEntries = [
      {
        id: crypto.randomUUID(),
        title: 'Refund Policy',
        content:
          'We offer a 30-day full refund, no questions asked. To request a refund, contact support@supportpilot.io with your order ID. Refunds are processed within 5-7 business days back to your original payment method.',
        category: 'billing',
      },
      {
        id: crypto.randomUUID(),
        title: 'Password Reset',
        content:
          'To reset your password, navigate to /forgot-password on our website. Enter your registered email address and we will send you a reset link valid for 24 hours. If you do not receive the email, check your spam folder or contact support.',
        category: 'account',
      },
      {
        id: crypto.randomUUID(),
        title: 'Billing Cycle',
        content:
          'Your account is billed monthly on the same date you originally signed up. For example, if you signed up on the 15th, you will be billed on the 15th of each month. You can view upcoming charges in Settings > Billing.',
        category: 'billing',
      },
      {
        id: crypto.randomUUID(),
        title: 'Cancellation Process',
        content:
          'You can cancel your subscription at any time from Settings > Account > Cancel Subscription. Cancellation takes effect at the end of your current billing period, so you retain access until then. No partial refunds are issued for unused days.',
        category: 'account',
      },
      {
        id: crypto.randomUUID(),
        title: 'Technical Support Hours',
        content:
          'Our technical support team is available Monday through Friday, 9am to 6pm EST. We guarantee a response within 24 hours on business days. For critical outages, use the emergency contact form for priority escalation.',
        category: 'support',
      },
    ];

    const insertMany = db.transaction(() => {
      for (const entry of kbEntries) {
        insertKb.run(entry.id, entry.title, entry.content, entry.category, Date.now());
      }
    });
    insertMany();
    console.log('[seed] Inserted 5 knowledge base entries');
  }

  const ticketCount = (db.prepare('SELECT COUNT(*) as cnt FROM tickets').get() as { cnt: number }).cnt;

  if (ticketCount === 0) {
    const insertTicket = db.prepare(
      'INSERT INTO tickets (id, subject, body, customer_email, source, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );

    const tickets = [
      {
        id: crypto.randomUUID(),
        subject: 'Charged twice this month — need immediate refund',
        body: "I've been charged twice for my subscription this month and I am absolutely furious. This is unacceptable. I need this resolved immediately or I'm cancelling and disputing the charge with my bank. My account is john.doe@example.com and both charges appeared on April 2nd.",
        customer_email: 'john.doe@example.com',
        source: 'email',
      },
      {
        id: crypto.randomUUID(),
        subject: 'App not loading on mobile — completely broken',
        body: "Your app has stopped working on my iPhone 15 Pro running iOS 17.4. Every time I open it, it shows a blank white screen and then crashes after about 3 seconds. I've tried uninstalling and reinstalling but the problem persists. This has been going on for 2 days and I rely on it for work.",
        customer_email: 'sarah.tech@example.com',
        source: 'chat',
      },
      {
        id: crypto.randomUUID(),
        subject: 'Feature request: dark mode support',
        body: "Hi team, I love the product but I find it quite hard to use late at night because there's no dark mode option. Would it be possible to add a dark mode toggle? I think many users would appreciate it. Would be happy to beta test if you build it!",
        customer_email: 'feature.fan@example.com',
        source: 'manual',
      },
    ];

    const now = Date.now();
    const insertMany = db.transaction(() => {
      for (const t of tickets) {
        insertTicket.run(t.id, t.subject, t.body, t.customer_email, t.source, 'open', now, now);
      }
    });
    insertMany();
    console.log('[seed] Inserted 3 sample tickets');
  }
}
