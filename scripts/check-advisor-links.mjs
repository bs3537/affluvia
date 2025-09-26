import { storage } from '../server/storage';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

const clientId = Number(process.env.CLIENT_ID || process.argv[2] || 13);
const advisorId = Number(process.env.ADVISOR_ID || 20);

console.log('Checking advisor link', { clientId, advisorId });

const links = await storage.getActiveAdvisorsForClient(clientId);
console.log('Active advisor links for client:', links);

const clients = await storage.getAdvisorClients(advisorId);
console.log('Advisor clients:', clients.map(c => c.id));

const rows = await db.execute(sql`SELECT * FROM advisor_clients WHERE client_id = ${clientId}`);
console.log('Raw advisor_clients rows:', rows.rows);

process.exit(0);
