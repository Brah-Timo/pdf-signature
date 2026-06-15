# pdf-signature

> **Legal PDF e-signatures in one line of code.**  
> eIDAS & KSA-ETL compliant · PKCS#7 detached signatures · X.509 ephemeral certs · RFC 3161 timestamps (AdES-B-LT)

[![CI](https://github.com/Brah-Timo/pdf-signature/actions/workflows/ci.yml/badge.svg)](https://github.com/Brah-Timo/pdf-signature/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@pdf-signature/core)](https://www.npmjs.com/package/@pdf-signature/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-cc00ff.svg)](https://pnpm.io/)

---

## Overview

`pdf-signature` is a production-ready monorepo that provides:

| Package / App | Description |
|---------------|-------------|
| `packages/core` | Main SDK — `pdfSign()`, `pdfVerify()`, `pdfMultiSign()` |
| `packages/crypto` | PKCS#7 / X.509 / RFC 3161 cryptographic primitives |
| `packages/pdf` | PDF manipulation — byte-range placeholder, embed signature |
| `packages/api-server` | REST API server (Express + Prisma + Postgres) |
| `packages/signing-page` | Next.js hosted signing flow UI |
| `apps/dashboard` | Next.js 15 merchant dashboard (analytics, API keys, billing) |
| `apps/docs` | Docusaurus 3 documentation site |

---

## Quick Start

### Installation

```bash
# npm
npm install @pdf-signature/core

# pnpm
pnpm add @pdf-signature/core

# yarn
yarn add @pdf-signature/core
```

### Sign a PDF

```typescript
import { pdfSign } from '@pdf-signature/core';

const result = await pdfSign({
  pdfBuffer: fs.readFileSync('./contract.pdf'),
  signerInfo: {
    name:         'Alice Johnson',
    email:        'alice@example.com',
    organization: 'Acme Corp',
  },
  apiKey: process.env.PDF_SIGNATURE_API_KEY!,
});

fs.writeFileSync('./contract-signed.pdf', result.signedPdfBuffer);

console.log(result.signatureId);    // "sig_01HX..."
console.log(result.timestampToken); // RFC 3161 token
console.log(result.certificate);    // PEM-encoded ephemeral X.509 cert
```

### Verify a Signature

```typescript
import { pdfVerify } from '@pdf-signature/core';

const verification = await pdfVerify({
  pdfBuffer: fs.readFileSync('./contract-signed.pdf'),
  apiKey:    process.env.PDF_SIGNATURE_API_KEY!,
});

console.log(verification.isValid);         // true
console.log(verification.signerInfo.name); // 'Alice Johnson'
console.log(verification.timestamp);       // 2026-06-15T10:30:00.000Z
console.log(verification.complianceLevel); // 'AdES-B-LT'
```

### Multi-signer Workflow

```typescript
import { pdfMultiSign } from '@pdf-signature/core';

const result = await pdfMultiSign({
  pdfBuffer: fs.readFileSync('./agreement.pdf'),
  signers: [
    { name: 'Alice Johnson', email: 'alice@example.com', order: 1 },
    { name: 'Bob Smith',     email: 'bob@example.com',   order: 2 },
  ],
  webhookUrl: 'https://your-app.com/api/webhooks/pdf-signature',
  apiKey:     process.env.PDF_SIGNATURE_API_KEY!,
});

console.log(result.signingSessionId); // 'sess_01HX...'
console.log(result.signingUrls);      // per-signer hosted signing links
```

---

## Compliance

| Standard | Status | Notes |
|----------|--------|-------|
| **eIDAS** (EU) | ✅ Supported | AdES-B-LT level (Baseline Long-Term) |
| **KSA-ETL** (Saudi Arabia) | ✅ Supported | Electronic Transactions Law compliant |
| **ESIGN** (USA) | ✅ Supported | Federal e-signature law |
| **UETA** (USA) | ✅ Supported | Uniform Electronic Transactions Act |

### Cryptographic Stack

```
PKCS#7 detached signature (CAdES)
  ├── X.509 ephemeral certificate (RSA-2048 or ECDSA P-256)
  ├── SHA-256 document digest
  └── RFC 3161 timestamp token (from trusted TSA)
        └── Counter-signed by TSA's X.509 certificate
```

---

## Monorepo Structure

```
pdf-signature/
├── apps/
│   ├── dashboard/          # Next.js 15 merchant dashboard
│   │   ├── app/
│   │   │   ├── (auth)/login/
│   │   │   └── (dashboard)/
│   │   │       ├── page.tsx        # Overview + stats
│   │   │       ├── signatures/     # Signature history
│   │   │       ├── api-keys/       # API key management
│   │   │       └── billing/        # Stripe subscription
│   │   ├── components/ui/
│   │   └── lib/
│   │       ├── auth.ts             # NextAuth v5 config
│   │       └── api.ts              # Axios client with auto-auth
│   └── docs/               # Docusaurus 3.1 documentation site
│       └── docs/
│           ├── getting-started.md
│           ├── api-reference.md
│           ├── legal-compliance.md
│           └── examples/
│               ├── nextjs.md
│               ├── express.md
│               ├── webhooks.md
│               └── multi-sign.md
├── packages/
│   ├── core/               # @pdf-signature/core — main SDK
│   ├── crypto/             # @pdf-signature/crypto — PKCS#7 primitives
│   ├── pdf/                # @pdf-signature/pdf — PDF manipulation
│   ├── api-server/         # REST API (Express + Prisma)
│   └── signing-page/       # Next.js hosted signing UI
├── infra/
│   ├── docker/
│   │   ├── Dockerfile.api            # API server (3-stage, uid 1001)
│   │   ├── Dockerfile.signing-page   # Next.js signing page (3-stage)
│   │   └── docker-compose.yml        # Full local dev stack
│   ├── terraform/
│   │   └── main.tf                   # AWS ECS, RDS, ElastiCache, S3
│   └── k8s/
│       └── api-deployment.yaml       # K8s Deployment, Service, Ingress, HPA
├── .github/workflows/
│   ├── ci.yml              # PR / push: lint, tests, docker build, security
│   ├── publish.yml         # Tag v*.*.* : npm publish + Docker push + release
│   └── deploy.yml          # main push: build → K8s deploy → migrations → smoke
├── package.json            # Monorepo root (pnpm workspaces + turbo)
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.json
```

---

## Development Setup

### Prerequisites

- **Node.js** ≥ 18
- **pnpm** ≥ 8 (`npm install -g pnpm@8`)
- **Docker** & **Docker Compose** (for local stack)
- **PostgreSQL** 16 or use Docker

### 1. Clone & Install

```bash
git clone https://github.com/Brah-Timo/pdf-signature.git
cd pdf-signature
pnpm install
```

### 2. Environment Variables

```bash
# packages/api-server
cp packages/api-server/.env.example packages/api-server/.env

# apps/dashboard
cp apps/dashboard/.env.example apps/dashboard/.env.local
```

Minimum required variables:

```env
# api-server
DATABASE_URL=postgresql://user:pass@localhost:5432/pdfsig
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-min-32-chars
ENCRYPTION_KEY=your-aes-256-key-min-32-chars
TIMESTAMP_SERVER_URL=http://timestamp.digicert.com

# dashboard
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-nextauth-secret
NEXT_PUBLIC_API_URL=http://localhost:4000
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### 3. Start Local Stack (Docker)

```bash
# Start all services
docker compose -f infra/docker/docker-compose.yml up -d

# Or with optional tools (Adminer DB browser)
docker compose -f infra/docker/docker-compose.yml --profile tools up -d
```

Services started:

| Service | Port | Description |
|---------|------|-------------|
| API Server | 4000 | REST API |
| Signing Page | 3000 | Hosted signing UI |
| Dashboard | 3001 | Merchant dashboard (--profile dashboard) |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache |
| Adminer | 8080 | DB browser (--profile tools) |

### 4. Run Migrations

```bash
cd packages/api-server
pnpm prisma migrate dev
```

### 5. Start Development Servers

```bash
# All packages in parallel (via Turbo)
pnpm dev

# Individual package
pnpm --filter '@pdf-signature/core' dev
pnpm --filter 'apps/dashboard' dev
```

---

## Testing

```bash
# All tests
pnpm test

# Unit tests only
pnpm test --filter='./packages/core'

# With coverage
pnpm test -- --coverage

# Integration tests (requires PostgreSQL + Redis)
cd packages/api-server
DATABASE_URL=postgresql://... pnpm test:integration
```

---

## CI/CD

### GitHub Actions Workflows

| Workflow | Trigger | Jobs |
|----------|---------|------|
| `ci.yml` | PR / push to main/develop | Lint, unit tests, integration tests, docker build, security audit |
| `publish.yml` | Tag `v*.*.*` | Validate, npm publish (with provenance), Docker push to GHCR, GitHub Release |
| `deploy.yml` | Push to `main` / manual dispatch | Pre-validate, build+push images, K8s deploy, migrations, smoke tests, failure notifications |

### Required GitHub Secrets

| Secret | Used By | Description |
|--------|---------|-------------|
| `NPM_TOKEN` | publish | npm publish access token |
| `KUBECONFIG_B64` | deploy | Base64-encoded kubeconfig |
| `DATABASE_URL` | deploy | Production database URL |
| `REDIS_URL` | deploy | Production Redis URL |
| `JWT_SECRET` | deploy | JWT signing secret |
| `ENCRYPTION_KEY` | deploy | AES-256 encryption key |
| `AWS_ACCESS_KEY_ID` | deploy | AWS credentials for S3 |
| `AWS_SECRET_ACCESS_KEY` | deploy | AWS credentials for S3 |
| `AWS_S3_BUCKET` | deploy | S3 bucket for signed PDFs |
| `TIMESTAMP_SERVER_URL` | deploy | RFC 3161 TSA endpoint |
| `SLACK_WEBHOOK_URL` | deploy | Failure notifications (optional) |
| `CODECOV_TOKEN` | ci | Coverage reporting (optional) |

---

## Infrastructure

### Docker

Multi-stage builds with non-root user (`uid 1001`) for security:

```bash
# Build API image
docker build -f infra/docker/Dockerfile.api -t pdf-signature-api .

# Build signing page image
docker build -f infra/docker/Dockerfile.signing-page -t pdf-signature-signing-page .
```

### Terraform (AWS)

Provisions: VPC, ECS Fargate, RDS PostgreSQL 16, ElastiCache Redis 7, S3 with AES256 encryption.

```bash
cd infra/terraform
terraform init
terraform plan -var="environment=production"
terraform apply
```

### Kubernetes

```bash
# Deploy to cluster
kubectl apply -f infra/k8s/api-deployment.yaml

# Check HPA status
kubectl get hpa -n pdf-signature

# View pods
kubectl get pods -n pdf-signature
```

The K8s manifests include:
- `readOnlyRootFilesystem: true`
- `allowPrivilegeEscalation: false`
- `capabilities: drop: [ALL]`
- HPA: scale 2→10 replicas at CPU 70% / memory 80%

---

## API Reference

### `pdfSign(options)`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pdfBuffer` | `Buffer` | ✅ | Input PDF bytes |
| `signerInfo.name` | `string` | ✅ | Signer full name |
| `signerInfo.email` | `string` | ✅ | Signer email |
| `signerInfo.organization` | `string` | ❌ | Signer organization |
| `apiKey` | `string` | ✅ | Your API key |
| `webhookUrl` | `string` | ❌ | Receives completion events |
| `reason` | `string` | ❌ | Signature reason field |
| `location` | `string` | ❌ | Signing location |

Returns:

```typescript
{
  signatureId:       string;     // 'sig_01HX...'
  signedPdfBuffer:   Buffer;     // Modified PDF with embedded signature
  certificate:       string;     // PEM X.509 ephemeral certificate
  timestampToken:    string;     // Base64 RFC 3161 token
  signedAt:          Date;
  complianceLevel:   'AdES-B-LT';
}
```

### Webhook Events

| Event | Description |
|-------|-------------|
| `signature.completed` | All signers have signed |
| `signature.declined` | A signer declined |
| `signature.expired` | Session expired |
| `signer.viewed` | A signer opened the document |
| `signer.signed` | A signer completed their signature |

---

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feat/my-feature`
3. Commit with conventional commits: `git commit -m 'feat(core): add batch signing'`
4. Push: `git push origin feat/my-feature`
5. Open a Pull Request

### Commit Convention

```
feat(scope):     New feature
fix(scope):      Bug fix
docs(scope):     Documentation only
refactor(scope): Code change (no feature/fix)
test(scope):     Tests only
ci(scope):       CI/CD changes
chore(scope):    Build/tooling
```

---

## License

MIT © [Brah-Timo](https://github.com/Brah-Timo)

---

## Links

- 📖 **Documentation**: [docs.pdfsignature.io](https://docs.pdfsignature.io)
- 🐛 **Issues**: [github.com/Brah-Timo/pdf-signature/issues](https://github.com/Brah-Timo/pdf-signature/issues)
- 📦 **npm**: [@pdf-signature/core](https://www.npmjs.com/package/@pdf-signature/core)
- 🐳 **GHCR**: [ghcr.io/brah-timo/pdf-signature-api](https://ghcr.io/brah-timo/pdf-signature-api)
