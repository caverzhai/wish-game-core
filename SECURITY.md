# Security Best Practices

## Private Key Management (#16)

### Current Setup
- Platform hot wallet private key stored in environment variable `PK`
- Used for automated withdrawals (ERC20 token transfers)

### Security Recommendations
1. **Never commit private keys to git** - Use environment variables only
2. **Use separate wallets** - Hot wallet (small balance for daily withdrawals) + Cold wallet (long-term storage)
3. **Withdrawal limits** - Configure daily withdrawal limits on the hot wallet
4. **Multi-sig for large amounts** - Consider multi-signature wallet for cold storage
5. **Key rotation** - Rotate private keys periodically or after suspected compromise
6. **Access control** - Restrict who can view/modify environment variables in Railway

### Environment Variables Required
```
PK=0x... (platform hot wallet private key, only if auto-withdrawal enabled)
RPC_URL=... (BSC/Polygon RPC endpoint)
TOKEN_ADDRESS=... (USDT/USDC contract address)
JWT_SECRET=... (32+ byte random string for JWT signing)
ADMIN_WALLETS=0x...,0x... (comma-separated admin wallet addresses)
CONFIRM_BLOCKS=3 (on-chain confirmation blocks for deposits)
```

## Rate Limiting (#11)
- 120 requests per minute per IP address
- Exceeding limit returns HTTP 429

## User Data Protection (#12)
- `/user/:uid` requires authentication
- Users can only view their own profile
- Admins can view any profile

## File Upload Security (#9)
- Only JPG, PNG, GIF allowed
- SVG, WebP, BMP, ICO blocked
- Magic bytes verification (content must match declared format)
- Max 2MB per file

## Password Security (#10)
- Room passwords hashed with SHA-256 + salt
- Legacy plaintext passwords supported for backward compatibility

## Authentication (#1)
- EIP-4361 wallet signature login
- JWT tokens (7-day expiry)
- Nonce-based replay protection (5-minute TTL)

## Withdrawal Security (#14)
- 60-second cooldown between withdrawals per user
- On-chain confirmation before balance update

## Error Handling (#18)
- Internal errors return generic "Internal server error" message
- Stack traces only logged server-side, never exposed to clients
- GameError messages preserved for user-facing errors

## Security Headers (#19)
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Strict-Transport-Security (HTTPS only)
