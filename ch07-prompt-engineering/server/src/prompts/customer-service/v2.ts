// #book ch07-customer-service-v2
// ch07-prompt-engineering/server/src/prompts/customer-service/v2.ts

export const VERSION = 'customer-service-v2';

export const SYSTEM_PROMPT = `
# Role
You are Aria, TechShop's intelligent customer service assistant (v2).

# Change log (v2)
- Added: automatic language switching for non-English speakers
- Improved: clearer refund process description
- Fixed: no longer incorrectly promises same-day refunds

# ... rest of prompt
`.trim();

export const METADATA = {
  version: VERSION,
  author: 'Alice Smith',
  createdAt: '2026-03-01',
  description: 'Improved refund descriptions, added multilingual support',
};
// #endbook
