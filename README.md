# ☁️ CloudDrive

A full-stack cloud file storage and sharing application inspired by the core functionality of Google Drive.

CloudDrive allows users to securely upload, organize, search, download, star, delete, restore, and share files and folders through a modern React interface backed by a FastAPI REST API.

---

## ✨ Features

### 🔐 Authentication

* User registration and login
* JWT-based authentication
* Protected API endpoints
* Automatic authentication headers through Axios

### 📁 File & Folder Management

* Upload files to cloud storage
* Create folders
* Create nested folder structures
* Open folders and navigate using breadcrumbs
* Rename files and folders
* Move files between folders
* Download files
* Soft-delete files and folders

### ⭐ Starred Items

* Star files and folders
* Unstar items
* Dedicated Starred section for quick access

### 🗑️ Trash

* Deleted files and folders are moved to Trash
* Restore deleted files
* Restore deleted folders
* Soft-delete architecture prevents immediate permanent deletion

### 🔗 Sharing

* Share files with other registered users
* Share folders with other users
* Viewer and Editor permissions
* Dedicated "Shared with me" section
* Permission checks enforced by the backend

### 🌐 Public Links

* Generate public shareable links
* Links contain unique tokens
* Configurable expiration time
* Public resources can be accessed without normal Drive navigation

### 🔎 Search

* Search files and folders by name
* Search results update dynamically in the interface

### 🎨 User Interface

* Modern Google Drive-inspired layout
* Grid and list views
* Breadcrumb navigation
* Responsive file cards
* Loading states
* Error handling
* Share modal
* File-type icons
* Clean sidebar navigation

---

## 🛠️ Tech Stack

### Frontend

* React
* Vite
* Tailwind CSS
* Axios
* Lucide React
* React Router

### Backend

* Python
* FastAPI
* SQLAlchemy
* Pydantic
* JWT authentication

### Database

* PostgreSQL
* Supabase

### Object Storage

* Supabase Storage

### Deployment

* Frontend: Vercel
* Backend: Render
* Database & Storage: Supabase

---

## 🏗️ Architecture

```text
                    ┌──────────────────────┐
                    │      React App       │
                    │   Vite + Tailwind    │
                    └──────────┬───────────┘
                               │
                               │ Axios / REST API
                               ▼
                    ┌──────────────────────┐
                    │    FastAPI Backend   │
                    │   JWT Authentication │
                    │  Permission Checks   │
                    └──────────┬───────────┘
                               │
                    ┌──────────┴───────────┐
                    │                      │
                    ▼                      ▼
           ┌─────────────────┐   ┌─────────────────┐
           │   PostgreSQL    │   │ Supabase Storage│
           │     Database    │   │   File Objects  │
           └─────────────────┘   └─────────────────┘
```

---

## 🔒 Security & Permissions

CloudDrive uses server-side authorization to protect user resources.

### Roles

| Role        | Permissions                        |
| ----------- | ---------------------------------- |
| Owner       | Full control                       |
| Editor      | Can modify permitted resources     |
| Viewer      | Read-only access                   |
| Public User | Access through a public share link |

JWT authentication is used to protect API requests.

File downloads use signed storage URLs rather than exposing storage credentials directly to the frontend.

The Supabase secret key is stored in environment variables and is not committed to the repository.

---

## 📂 Project Structure

```text
cloud-drive/
│
├── backend/
│   ├── main.py
│   ├── models.py
│   ├── database.py
│   ├── auth.py
│   ├── requirements.txt
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── Login.jsx
│   │   ├── PublicLink.jsx
│   │   ├── api.js
│   │   ├── main.jsx
│   │   └── index.css
│   │
│   ├── package.json
│   └── vite.config.js
│
├── .gitignore
└── README.md
```

> The exact backend file structure may vary depending on the current implementation.

---

## 🗄️ Database Models

CloudDrive currently uses the following core models:

### User

Stores registered user accounts and authentication information.

### Folder

Stores folder hierarchy using `parent_id`, allowing nested folders.

### File

Stores file metadata such as:

* File name
* Owner
* Parent folder
* Storage path
* File size
* Deleted state

### Share

Stores resource-sharing information:

* Resource type
* Resource ID
* Owner
* Recipient
* Permission role

### LinkShare

Stores public share links including:

* Resource type
* Resource ID
* Owner
* Unique token
* Expiration time

---

## 🔌 API Overview

### Authentication

```text
POST /auth/register
POST /auth/login
```

### Files

```text
GET    /files
POST   /files/upload
PATCH  /files/{id}/rename
PATCH  /files/{id}/move
DELETE /files/{id}
PATCH  /files/{id}/restore
GET    /files/{id}/download
```

### Folders

```text
GET    /folders
POST   /folders
PATCH  /folders/{id}/rename
DELETE /folders/{id}
PATCH  /folders/{id}/restore
```

### Sharing

```text
POST   /shares
GET    /shares/with-me
DELETE /shares/{id}
```

### Public Sharing

```text
POST /public-link
```

### Other

```text
GET /trash
GET /search
```

---

## ⚙️ Local Development

### Prerequisites

Make sure you have:

* Python 3.10+
* Node.js
* npm
* PostgreSQL / Supabase project

---

### 1. Clone the repository

```bash
git clone https://github.com/coldcaffine/cloud-drive.git

cd cloud-drive
```

---

### 2. Backend Setup

```bash
cd backend
```

Create a virtual environment:

```bash
python3 -m venv venv
```

Activate it:

### macOS / Linux

```bash
source venv/bin/activate
```

### Windows

```bash
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a `.env` file:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SECRET_KEY=your_supabase_secret_key
SECRET_KEY=your_jwt_secret
```

Start the FastAPI server:

```bash
uvicorn main:app --reload
```

The backend will run locally at:

```text
http://127.0.0.1:8000
```

---

### 3. Frontend Setup

Open another terminal:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend will be available at:

```text
http://localhost:5173
```

---

## 🌐 Deployment

CloudDrive is designed to be deployed as two separate applications.

### Frontend

The React/Vite frontend can be deployed using Vercel or another static hosting provider.

### Backend

The FastAPI backend can be deployed using Render, Railway, Fly.io, or similar services.

### Database & Storage

Supabase provides:

* PostgreSQL database
* Object storage
* Cloud infrastructure

---

## 📸 Screenshots

Screenshots of the application will be added here.

### My Drive

*Add screenshot here*

### Shared With Me

*Add screenshot here*

### Trash / Starred

*Add screenshot here*

### Share & Public Link

*Add screenshot here*

---

## 🚀 Future Improvements

Potential improvements for future versions include:

* Google OAuth
* HttpOnly cookie-based authentication
* Drag-and-drop uploads
* Upload progress indicators
* Image and PDF previews
* File sorting
* Pagination / lazy loading
* File version history
* Activity logs
* Tags and labels
* Storage quota tracking
* Permanent deletion
* Automated backend/frontend tests
* Rate limiting

---

## 🎯 Project Goals

This project was built to demonstrate practical full-stack development skills, including:

* REST API design
* Authentication and authorization
* Role-based access control
* Cloud object storage
* PostgreSQL database design
* File management
* React state management
* Frontend/backend integration
* Cloud deployment
* Secure resource access

---

## 👩‍💻 Author

**Aditi Dharme**

Built as a full-stack cloud storage project using React, FastAPI, PostgreSQL, and Supabase.

---

## 📄 License

This project is intended primarily as a learning and portfolio project.
