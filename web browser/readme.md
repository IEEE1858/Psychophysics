Psychophysics Web App
======================

This is a full-stack web application for evaluating the realism and quality of images based on user ratings.
It is used in a psychophysics study. The project includes:

- A frontend built with React 19.1.0
- A backend written in Node.js v18.20.8
- A PostgreSQL database hosted on AWS RDS PostgreSQL v17.4


------------------------------------------------------------
Frontend (React)
------------------------------------------------------------

Directory:
    web browser/client

React Version:
    19.1.0 (installed via react-scripts)

To install dependencies and start the frontend:

    ```
    cd "web browser/client"
    npm install
    npm start
    ```

This will run the React development server on:
    http://localhost:3000

------------------------------------------------------------
Backend (Node.js + Express)
------------------------------------------------------------

Directory:
    web browser/server

Node Version:
    v18.20.8

To start the backend server:

    ```
    cd "web browser/server"
    node server.js
    ```

Ensure the PostgreSQL database is accessible before starting.

------------------------------------------------------------
Static Files (Images)
------------------------------------------------------------

Directory:
    images/images-for-web-browser/


------------------------------------------------------------
PostgreSQL Database Info
------------------------------------------------------------

## Setting Up Database Connection Parameters

To configure your database connection, you need to set environment variables in your shell configuration file (`.bashrc` for Bash users). This ensures your backend server can securely access the database without hardcoding credentials.

### Steps to Configure

1. Open your `.bashrc` file in a text editor. For example:
nano ~/.bashrc

Add the following lines at the end of the file, replacing the placeholder values with your actual database credentials:

``
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=your_database_name
export DB_USER=your_database_user
export DB_PASSWORD=your_secure_password
``

Save the file and exit the editor. Please ask me to get the database information

2. Reload your .bashrc to apply the changes:

source ~/.bashrc

------------------------------------------------------------
System Requirements
------------------------------------------------------------

- Node.js v18.20.8 or later
- npm (Node Package Manager)
- PostgreSQL v17.4 or later

------------------------------------------------------------
Development Notes
------------------------------------------------------------

- Environment variables (e.g., database credentials) should be stored in a `.env` file and not committed to version control.
- The frontend is bootstrapped using Create React App.
- The backend uses Express.js to handle API routes and static file serving.
- All images used in the experiment should be placed in the appropriate `images/images-for-web-browser` folder.
