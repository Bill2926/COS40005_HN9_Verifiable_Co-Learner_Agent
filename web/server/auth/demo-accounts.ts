// seededEvidence marks the account whose evidence ledger the seed fills, so a
// rehearsal that clears what the demo students did leaves it alone.
export const demoAccounts = [
  {
    email: 'an@example.com',
    password: 'an-demo-password',
    displayName: 'An',
    seededEvidence: false,
  },
  {
    email: 'binh@example.com',
    password: 'binh-demo-password',
    displayName: 'Bình',
    seededEvidence: true,
  },
] as const

export const productOwnerAccount = {
  email: 'owner@example.com',
  password: 'owner-demo-password',
  displayName: 'Owner',
} as const
