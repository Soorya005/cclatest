# ProLink Architecture Overview

ProLink is a modern social network for developers. This document describes the system components and their interactions.

## 1. Backend Services
- **User Service**: Handles authentication and profile management using FastAPI and SQLModel.
- **Post Service**: Manages the developer feed, tagging system, and comments.
- **Auth Layer**: Implements OAuth2 with Password Flow and JWT tokens.

## 2. Frontend
- Built with React (Next.js structure).
- Uses a "Component-Driven" architecture.
- Communicates with the backend via a RESTful API.

## 3. Security
- **JWT Authentication**: All write operations require a valid bearer token.
- **Shared Validation**: Passwords and usernames are validated using a unified logic layer in `shared/`.

## 4. Database Schema
The system uses SQLite for the demo. Models are defined using SQLModel (SQLAlchemy wrapper).
- `User` table: Stores credentials and profile info.
- `Post` table: Stores content, author mapping, and tags.
