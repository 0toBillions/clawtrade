#!/bin/bash

# ClawTrade Local Development Setup Script
# This script automates the setup process for local development

set -e

echo "🐾 ClawTrade Setup Script"
echo "========================="
echo ""

# Check Node.js version
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js 20+ required. Current version: $(node -v)"
    exit 1
fi
echo "✅ Node.js version: $(node -v)"
echo ""

# Check Docker
echo "🐳 Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker Desktop."
    exit 1
fi
echo "✅ Docker found: $(docker --version)"
echo ""

# Install dependencies
echo "📥 Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Create .env file if it doesn't exist
if [ ! -f "apps/api/.env" ]; then
    echo "📝 Creating .env file..."
    cat > apps/api/.env << EOF
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/clawtrade?schema=public

# Redis
REDIS_URL=redis://localhost:6379

# Blockchain (Base Sepolia Testnet for development)
BASE_RPC_URL=https://sepolia.base.org
BASE_CHAIN_ID=84532
PRIVATE_KEY_PLATFORM=0x...replace_with_your_private_key...

# Smart Contracts (deploy to testnet first)
GROUP_VAULT_FACTORY_ADDRESS=0x...

# API
JWT_SECRET=$(openssl rand -base64 32)
API_PORT=4000
WS_PORT=4001
NODE_ENV=development

# Clanker SDK
CLANKER_SDK_KEY=your_key_here

# Rate Limiting (development - more lenient)
RATE_LIMIT_READ=10000
RATE_LIMIT_WRITE=1000
EOF
    echo "✅ .env file created at apps/api/.env"
    echo "⚠️  Please update PRIVATE_KEY_PLATFORM and CLANKER_SDK_KEY"
    echo ""
else
    echo "ℹ️  .env file already exists"
    echo ""
fi

# Start Docker containers
echo "🐳 Starting Docker containers (PostgreSQL + Redis)..."
docker-compose up -d
echo "✅ Docker containers started"
echo ""

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker exec clawtrade-postgres pg_isready &> /dev/null; do
    sleep 1
done
echo "✅ PostgreSQL is ready"
echo ""

# Run database migrations
echo "🗄️  Running database migrations..."
cd apps/api
npx prisma migrate dev --name init
echo "✅ Database migrations complete"
echo ""

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npx prisma generate
echo "✅ Prisma Client generated"
cd ../..
echo ""

# Check if smart contracts need deployment
echo "📝 Smart Contract Deployment"
echo "----------------------------"
echo "Before starting the application, you need to:"
echo "1. Add your private key to apps/api/.env"
echo "2. Deploy GroupVaultFactory to Base Sepolia:"
echo "   cd packages/contracts"
echo "   npx hardhat run scripts/deploy.ts --network baseSepolia"
echo "3. Update GROUP_VAULT_FACTORY_ADDRESS in apps/api/.env"
echo ""

# Summary
echo "✅ Setup Complete!"
echo "=================="
echo ""
echo "Next steps:"
echo "1. Update apps/api/.env with your private key and API keys"
echo "2. Deploy smart contracts (see instructions above)"
echo "3. Start development servers:"
echo "   npm run dev"
echo ""
echo "Access:"
echo "- Frontend: http://localhost:3000"
echo "- API: http://localhost:4000"
echo "- Prisma Studio: npx prisma studio (in apps/api directory)"
echo ""
echo "Useful commands:"
echo "- npm run dev           Start all dev servers"
echo "- npm run db:studio     Open Prisma Studio"
echo "- npm run db:migrate    Run new migrations"
echo "- docker-compose logs   View Docker logs"
echo "- docker-compose down   Stop Docker containers"
echo ""
echo "Documentation:"
echo "- Agent Integration: docs/AGENT_GUIDE.md"
echo "- Deployment Guide: docs/DEPLOYMENT.md"
echo "- README: README.md"
echo ""
echo "Happy coding! 🚀"
