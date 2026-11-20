# 🏠 Growlyze Property AI Agent - Intelligent Property Management Platform

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-f55809.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/)
[![React Native](https://img.shields.io/badge/React%20Native-0.74-blue.svg)](https://reactnative.dev/)

Growlyze Property AI Agent by [Growlyze](https://growlyze.com) is a comprehensive property management platform that leverages artificial intelligence to revolutionize property operations. Built with modern technologies and AI-powered features, it provides an integrated solution for property managers, owners, tenants, and contractors.

## ✨ Key Features

### 🤖 AI-Powered Capabilities
- **Predictive Maintenance**: AI algorithms predict maintenance needs before issues occur
- **Market Intelligence**: Automated market analysis and rent optimization
- **Risk Assessment**: AI-driven tenant screening and property risk evaluation
- **Content Generation**: Automated property descriptions and marketing content
- **Sentiment Analysis**: Tenant communication analysis for proactive management

### 🏢 Property Management
- **Unified Rental Model**: Streamlined property and unit management
- **Smart Maintenance**: Automated work order routing and vendor management
- **Financial Management**: Comprehensive rent collection and payment processing
- **Tenant Portal**: Self-service portal for tenants with mobile app
- **Document Management**: Digital lease signing and document storage

### 🔧 Technical Excellence
- **Microservices Architecture**: Scalable and maintainable system design
- **Real-time Communication**: WebSocket-based live updates and notifications
- **Multi-database Support**: PostgreSQL for relational data, MongoDB for documents
- **RESTful APIs**: Comprehensive API coverage with OpenAPI documentation
- **Containerized Deployment**: Docker and Kubernetes ready

## 🚀 Project Components

- **Backend**: Node.js API server with TypeScript, Express, Prisma ORM, and MongoDB
- **Dashboard**: React web application for property managers and administrators
- **PropertyApp**: React Native mobile app for tenants and property owners
- **ContractorApp**: React Native mobile app for vendors and contractors

## 🏗️ Architecture

### System Overview
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Dashboard     │    │   PropertyApp   │    │  ContractorApp  │
│  (React Web)    │    │ (React Native)  │    │ (React Native)  │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │     API Gateway           │
                    │   (Express.js + TS)      │
                    └─────────────┬─────────────┘
                                  │
                ┌─────────────────┼─────────────────┐
                │                 │                 │
    ┌───────────▼───────────┐    │    ┌───────────▼───────────┐
    │    PostgreSQL         │    │    │      MongoDB          │
    │  (Relational Data)    │    │    │  (Documents/Logs)     │
    └───────────────────────┘    │    └───────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │      AI Services          │
                    │  (Python + Node.js)      │
                    └───────────────────────────┘
```

### Key Design Principles
- **Microservices Architecture**: Modular, scalable service design
- **API-First Development**: RESTful APIs with comprehensive documentation
- **Real-time Communication**: WebSocket integration for live updates
- **AI-Native Design**: Built-in AI capabilities across all workflows
- **Mobile-First**: Progressive web and native mobile applications

## 🚀 Quick Start

### Prerequisites
- Node.js 20.x or later
- PostgreSQL 13+
- MongoDB 4.4+
- Redis 7+ (for caching and sessions)
- Docker (optional, for containerized development)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/growlyze/Property-Ai-Agent.git
   cd Growlyze Property AI Agent
   ```

2. **Install dependencies:**
   ```bash
   npm run install:all
   ```

3. **Set up environment variables:**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your database URLs and API keys
   ```

4. **Initialize databases:**
   ```bash
   # Generate Prisma client and run migrations
   npm run prisma:generate
   npm run prisma:migrate
   
   # Seed with sample data (optional)
   npm run seed
   ```

5. **Start development servers:**
   ```bash
   # Start all services (recommended)
   npm run dev
   
   # Or start services individually:
   npm run dev:backend    # API server on :3001
   npm run dev:dashboard  # Web dashboard on :3000
   npm run dev:contractor # Contractor app (Expo)
   ```

6. **Access the applications:**
   - Dashboard: http://localhost:3000
   - API Documentation: http://localhost:3001/api-docs
   - Mobile apps: Use Expo Go app to scan QR code

### Docker Setup (Alternative)

```bash
# Start all services with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests for specific components
npm run test:backend     # Backend unit tests
npm run test:dashboard   # Frontend tests  
npm run test:contractor  # Mobile app tests

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

### Test Structure
- **Unit Tests**: Jest for backend services and utilities
- **Integration Tests**: API endpoint testing with supertest
- **Frontend Tests**: React Testing Library for components
- **E2E Tests**: Playwright for full user workflows
- **Load Tests**: K6 scripts for performance testing

## 📚 Documentation

- **[API Documentation](./backend/docs/)**: Complete API reference
- **[Architecture Guide](./PROJECT_DOCUMENTATION.md)**: System architecture overview
- **[Contributing Guide](./CONTRIBUTING.md)**: How to contribute to the project
- **[Deployment Guide](./dashboard/DEPLOYMENT.md)**: Production deployment instructions
- **[AI Integration](./backend/docs/ai-orchestration.md)**: AI services documentation

## 🔒 Security

- **Authentication**: JWT with refresh token rotation
- **Authorization**: Role-based access control (RBAC)
- **Data Protection**: Encryption at rest and in transit
- **API Security**: Rate limiting, input validation, CORS
- **Vulnerability Scanning**: Automated security checks in CI/CD

## 🌐 API Reference

The API is fully documented using OpenAPI 3.0 specification:

- **Live Documentation**: http://localhost:3001/api-docs
- **API Contract**: [api-contracts.yml](./backend/docs/api-contracts.yml)

### Core Endpoints

- `POST /api/auth/login` - User authentication
- `GET /api/rentals` - List rental properties
- `POST /api/maintenance` - Create maintenance request
- `GET /api/ai/insights` - Get AI-powered insights
- `POST /api/payments` - Process payments

## 🎨 Design

The dashboard and apps use the Growlyze design system: cream background
(`#f5f0e6`), deep ink text and borders (`#140827`), Growlyze orange
(`#f55809`) for primary actions, and hard offset shadows. The typeface is
Switzer, self-hosted in `dashboard/public/fonts`. Dashboard colours live in
`dashboard/src/design-system/` (tokens + `theme/themeConfig.ts`), and the
Material UI component styling is in `dashboard/src/contexts/ThemeContext.tsx`.

## 📄 License

Proprietary. Copyright (c) 2026 Growlyze, all rights reserved. See [LICENSE](LICENSE).
Third-party code notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## 🚀 Roadmap

### Current Focus (Q1 2025)
- [ ] Enhanced AI-powered property descriptions
- [ ] Advanced predictive maintenance algorithms
- [ ] Mobile app performance optimizations
- [ ] Multi-language support

### Upcoming Features
- [ ] IoT device integration for smart buildings
- [ ] Advanced analytics dashboard
- [ ] White-label solutions for property management companies
- [ ] Integration with additional payment providers

## 💬 Support

- **Issues**: [Report bugs and request features](https://github.com/growlyze/Property-Ai-Agent/issues)
- **Documentation**: [Guides and API docs](./docs/)
- **Website**: [growlyze.com](https://growlyze.com)

---

**Built by [Growlyze](https://growlyze.com).**
