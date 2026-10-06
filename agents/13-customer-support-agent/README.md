# CloudSync AI Customer Support Platform

An AI-powered customer support platform that provides knowledge-grounded responses using **Retrieval-Augmented Generation (RAG)** and **Google Gemini**, with automatic escalation of serious customer issues into support tickets.

---

## 1. Project Overview

CloudSync is a full-stack AI customer support application designed to help customers get quick and relevant answers to their questions.

The application uses **RAG with FAISS** to retrieve relevant information from a product knowledge base before generating an answer with Gemini.

For issues that require human assistance, the system can automatically create a support ticket. Administrators can then manage these tickets through a dedicated admin dashboard.

### Main Goals

- Provide AI-powered customer support
- Generate knowledge-grounded responses
- Maintain customer conversation history
- Detect issues requiring human assistance
- Create and manage support tickets
- Provide separate customer and administrator functionality

---

## 2. Key Features

- AI-powered customer support
- Retrieval-Augmented Generation (RAG)
- FAISS vector search
- Google Gemini integration
- LangGraph-based AI workflow
- Customer registration and login
- JWT authentication
- Role-Based Access Control (RBAC)
- Persistent conversation history
- Automatic issue escalation
- Support ticket creation
- Ticket priority management
- Ticket status management
- Admin dashboard
- Ticket search and filtering
- Responsive customer interface
- Markdown-formatted AI responses
- MongoDB Atlas data persistence

---

## 3. Technology Stack

### Frontend

- React
- Vite
- JavaScript
- CSS

### Backend

- Python
- FastAPI
- LangGraph
- REST APIs

### AI / RAG

- Google Gemini
- Retrieval-Augmented Generation (RAG)
- FAISS
- Knowledge-base retrieval

### Database

- MongoDB Atlas

### Authentication & Security

- JSON Web Tokens (JWT)
- Role-Based Access Control (RBAC)
- Password authentication
- Protected API endpoints

---

## 4. System Architecture

## System Architecture

```text
                         CUSTOMER / ADMIN
                                |
                                v
                    +-----------------------+
                    |    React Frontend     |
                    |        + Vite         |
                    +-----------+-----------+
                                |
                                | REST API + JWT
                                v
                    +-----------------------+
                    |    FastAPI Backend     |
                    +-----------+-----------+
                                |
              +-----------------+------------------+
              |                 |                  |
              v                 v                  v
         JWT Auth           Chat API          Admin API
                                |
                                v
                         +-------------+
                         |  LangGraph  |
                         | AI Workflow |
                         +------+------+
                                |
                                v
                         +-------------+
                         | RAG Pipeline|
                         +------+------+
                                |
                                v
                         +-------------+
                         |    FAISS    |
                         |  Retrieval  |
                         +------+------+
                                |
                                v
                       Relevant Knowledge
                                |
                                v
                         +-------------+
                         |   Gemini    |
                         |     LLM     |
                         +------+------+
                                |
                                v
                          AI Response
                                |
                                v
                    +-----------------------+
                    |    MongoDB Atlas      |
                    | users | chats | tickets|
                    +-----------+-----------+
                                |
                                v
                    +-----------------------+
                    |    Admin Dashboard    |
                    | Ticket Management     |
                    +-----------------------+
5. AI + RAG Workflow

The application uses Retrieval-Augmented Generation to provide responses based on relevant information from the configured knowledge base.

Customer Question
        |
        v
FastAPI Backend
        |
        v
LangGraph Workflow
        |
        v
FAISS Knowledge Search
        |
        v
Relevant Knowledge
        |
        v
Gemini
        |
        v
AI Response
        |
        v
Customer
How RAG Works
The customer submits a question.
The FastAPI backend receives the request.
The LangGraph workflow processes the request.
FAISS searches the knowledge base for relevant information.
Relevant information is provided as context to Gemini.
Gemini generates the final response.
The response is returned to the customer.
The conversation can be stored for future history.

This approach helps reduce unsupported responses by grounding the AI response in retrieved knowledge.

6. Authentication & Security

The application uses JWT authentication and Role-Based Access Control to separate customer and administrator functionality.

Customer

Customers can:

Register and log in
Use the AI support chat
View their own conversations
Create support requests
View their own support information

Customers cannot:

Access the admin dashboard
Manage other customers' tickets
Change ticket status through admin APIs
Administrator

Administrators can:

Log in securely
Use the AI support chat
Access the admin dashboard
View support tickets
Search and filter tickets
View ticket details
Update ticket status
Manage escalated customer issues
7. Ticket Escalation

When a customer reports an issue that requires human support, the application can escalate the issue by creating a support ticket.

Customer Issue
      |
      v
Escalation Detection
      |
      v
Ticket Created
      |
      v
MongoDB Atlas
      |
      v
Admin Dashboard
      |
      v
Open
  |
  v
In Progress
  |
  v
Resolved

Each ticket can contain information such as:

Ticket ID
Customer ID
Conversation ID
Issue description
AI response
Priority
Ticket status
Creation time
8. Admin Dashboard

The admin dashboard provides administrators with a centralized interface for managing customer support tickets.

Dashboard Features
Total ticket count
Open tickets
In-progress tickets
Resolved tickets
High-priority tickets
Ticket search
Ticket filtering
Ticket details
Ticket status management
Ticket Status Workflow
Open
  |
  v
In Progress
  |
  v
Resolved

This allows administrators to track the progress of escalated customer issues.

9. Project Structure
13-customer-support-agent/
|
├── api.py
├── agent.py
├── requirements.txt
├── README.md
|
├── frontend/
│   |
│   ├── src/
│   │   |
│   │   ├── components/
│   │   │   ├── AuthScreen.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── WelcomeScreen.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   └── MarkdownMessage.jsx
│   │   |
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   └── authApi.js
│   │   |
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   |
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
|
└── ...
10. Installation
Prerequisites

Make sure the following are installed:

Python
Node.js
npm
MongoDB Atlas account
Gemini API key
Backend Setup

Create a Python virtual environment:

python -m venv .venv

Activate the virtual environment on Windows:

.venv\Scripts\activate

Install the Python dependencies:

pip install -r requirements.txt
Frontend Setup

Open another terminal and navigate to the frontend directory:

cd frontend

Install the frontend dependencies:

npm install
11. Environment Variables

Create a .env file in the backend project directory.

Example:

GEMINI_API_KEY=your_gemini_api_key
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret

Create or update the frontend environment file:

frontend/.env

Example:

VITE_API_URL=http://127.0.0.1:8000

Replace the example values with your own configuration.

Security

Do not commit real credentials or secrets to GitHub.

Never upload:

.env
API keys
MongoDB passwords
JWT secrets
User passwords

Make sure .env is included in .gitignore.

12. How to Run
Start the Backend

From the project root:

uvicorn api:app --reload

The backend will run at:

http://127.0.0.1:8000

FastAPI API documentation is available at:

http://127.0.0.1:8000/docs
Start the Frontend

Open another terminal:

cd frontend

Start the development server:

npm run dev

The frontend will run at:

http://localhost:5173

Open the frontend URL in your browser.

13. Application Workflow

The complete application workflow is:

                         CUSTOMER
                            |
                            v
                     Register / Login
                            |
                            v
                    Ask Support Question
                            |
                            v
                     AI + RAG Processing
                            |
                            v
                        AI Response
                            |
                            v
                    Conversation Saved
                            |
                +-----------+-----------+
                |                       |
                v                       v
           Normal Issue           Serious Issue
                |                       |
                v                       v
          Continue Chat           Create Ticket
                                        |
                                        v
                                Admin Dashboard
                                        |
                                        v
                              Manage Ticket Status
                                        |
                                        v
                                    Resolved
14. Screenshots
Customer Chat

The customer interface provides:

AI customer support chat
Conversation history
New conversation option
Account information
Support suggestions
Formatted AI responses

Add the customer chat screenshot below.

[Add Customer Chat Screenshot Here]
Admin Dashboard

The admin interface provides:

Ticket statistics
Ticket search and filtering
Ticket details
Ticket status management

Add the admin dashboard screenshot below.

[Add Admin Dashboard Screenshot Here]
Mobile Interface

The application is designed to provide a responsive experience across desktop and mobile screen sizes.

Add the mobile screenshot below.

[Add Mobile Screenshot Here]
15. Testing

The application was tested across the major customer, AI, ticket, authentication, security, and responsive UI workflows.

Functional Testing Workflow
Customer Login
      |
      v
AI / RAG Response
      |
      v
Chat History
      |
      v
Ticket Escalation
      |
      v
Admin Login
      |
      v
View Ticket
      |
      v
Change Ticket Status
      |
      v
Security / RBAC Testing
      |
      v
Mobile Testing
Customer Testing

The customer should be able to:

Register
Log in
Chat with the AI
Receive knowledge-grounded responses
View conversation history
Create or trigger support requests

The customer should not be able to:

Access the admin dashboard
Manage other customers' tickets
Change ticket status through admin functionality
Admin Testing

The administrator should be able to:

Log in
Access the admin dashboard
View ticket statistics
View support tickets
Search and filter tickets
View ticket details
Change ticket status
Ticket Status Testing

Ticket status was tested using the following workflow:

Open
  |
  v
In Progress
  |
  v
Resolved
AI / RAG Testing

The AI support system can be tested with questions such as:

What is the price of the Pro plan?

How do I reset my password?

How can I manage my subscription?

What payment methods are supported?

How do I cancel my subscription?

I was charged incorrectly.

I want to speak to a human support agent.

I have a serious billing problem.

My account is not working.
Security Testing

The application was tested to verify that:

Customers cannot access admin functionality.
Admin functionality is protected by role-based authorization.
Customer conversation access is separated from administrator functionality.
Protected API endpoints require authentication.
Real credentials are not stored in the source code.
Responsive Testing

The frontend was tested on:

Desktop screens
Tablet-sized screens
Mobile-sized screens

The responsive interface was checked for:

Sidebar behavior
Mobile navigation
Chat layout
Input area
Admin dashboard layout
Horizontal scrolling issues
16. Future Improvements

Possible future improvements include:

Add more knowledge-base documents
Improve AI response evaluation
Add email notifications for escalated tickets
Add advanced support analytics
Add conversation search
Add more detailed ticket management
Improve production deployment
Add application monitoring and logging
Add automated unit and integration testing
Add streaming AI responses
Add better conversation title generation
Add agent performance metrics
17. Project Purpose

This project was developed as a full-stack AI application to demonstrate practical implementation of modern software development and AI engineering concepts.

Concepts Demonstrated
React frontend development
FastAPI backend development
REST API development
Gemini AI integration
Retrieval-Augmented Generation (RAG)
FAISS vector search
LangGraph workflows
MongoDB database integration
JWT authentication
Role-Based Access Control
Chat history management
AI-powered customer support
Automatic issue escalation
Support ticket management
Admin dashboard development
Responsive web development

The project demonstrates how an AI feature can be integrated into a complete full-stack application rather than being used only as a standalone chatbot.

18. License

This project is developed for educational and portfolio purposes.