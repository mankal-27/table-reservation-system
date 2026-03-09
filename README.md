# 🍽️ Distributed Table Reservation System

An enterprise-grade, event-driven microservices architecture built to handle restaurant reservations, billing, and user notifications. 



## 🚀 Architecture Overview

This project implements a polyglot microservices system demonstrating strict domain boundaries, independent scalable components, and resilient cross-service communication. It shifts away from monolithic design by utilizing the **Database-per-Service** pattern and **Event-Driven Choreography**.

### 🛠️ Tech Stack
* **Backend:** Node.js, Express.js
* **Databases:** PostgreSQL (Relational), Elasticsearch (Search/NoSQL)
* **ORM:** Prisma (v6)
* **Message Broker:** RabbitMQ (AMQP)
* **Infrastructure:** Docker & Docker Compose
* **Authentication:** Google OAuth2 (Passport.js)

---

## 🏗️ Microservices Ecosystem

The system is decoupled into five distinct, specialized services:

1. **Catalog Service (`:3001`)**
   * **Role:** High-speed search engine for restaurants and table availability.
   * **Data Store:** Elasticsearch.
   * **Key Feature:** Extremely fast read queries for spatial and availability data.

2. **User Service (`:3002`)**
   * **Role:** Manages user identities and sessions.
   * **Data Store:** PostgreSQL (`user_db`).
   * **Key Feature:** Integrates Google OAuth2 for secure, passwordless authentication.

3. **Booking Service (`:3003`)**
   * **Role:** Core transactional engine. Validates requests and reserves tables.
   * **Data Store:** PostgreSQL (`booking_db`).
   * **Key Feature:** Makes synchronous HTTP REST calls to the Catalog Service for data validation before writing to its isolated database. Publishes `ReservationCreated` events.

4. **Billing Service (`:3004`)**
   * **Role:** Asynchronous background worker for invoice generation.
   * **Data Store:** PostgreSQL (`billing_db`).
   * **Key Feature:** Consumes events from RabbitMQ to calculate totals without blocking the Booking thread. Publishes `BillPaid` events.

5. **Notification Service**
   * **Role:** Event-driven worker that sends email receipts.
   * **Data Store:** Stateless (None).
   * **Key Feature:** Listens to RabbitMQ for payment confirmations and uses Nodemailer (Ethereal) to dispatch emails.

---

## 🧠 System Design Highlights

* **Event-Driven Architecture (EDA):** Heavy computational tasks (billing calculation, email dispatching) are offloaded to background workers via RabbitMQ. This ensures the user facing APIs remain lightning fast and guarantees zero message loss if a downstream service temporarily fails.
* **Polyglot Persistence:** Data storage is optimized for the specific use case. Relational transactions use PostgreSQL, while high-speed restaurant discovery uses Elasticsearch.
* **Strict Data Isolation:** Services do not share databases. Cross-domain data fetching is handled strictly through RESTful APIs or AMQP messages, eliminating tightly coupled database constraints.

---

## 🏃‍♂️ Local Development Setup

The entire infrastructure and application suite is fully containerized. 

### Prerequisites
* Docker & Docker Compose installed on your machine.
* A `.env` file at the root of the project with your Google OAuth credentials:
  ```env
  GOOGLE_CLIENT_ID=your_client_id
  GOOGLE_CLIENT_SECRET=your_client_secret

### Bootstrapping the Environment
1. Clone the repository and navigate to the root directory.
2. Spin up the entire ecosystem with a single command:
    ```
    docker-compose up --build -d
    ```
3. Push the Prisma schemas to the isolated databases:
   ```
   docker exec -it user_service npx prisma db push
   
   docker exec -it booking_service npx prisma db push
   
   docker exec -it billing_service npx prisma db push
   ```

## 🧪 Testing the Flow (End-to-End)
1. Seed the Catalog (Elasticsearch):
   
   * POST http://localhost:3001/api/restaurants/seed
2. Book a Table:
   * POST http://localhost:3003/api/bookings
   * Provide the JSON payload with a valid Restaurant ID.
3. Pay the Bill:
   * Retrieve the generated Bill ID from billing_db.
   * POST http://localhost:3004/api/billing/{BILL_ID}/pay
4. Check Notifications:
   * View the Docker logs for the notification_service to click the generated Ethereal email receipt link.