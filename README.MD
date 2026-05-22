 Project Name=> HappyPet (Backend Server)

Purpose :

The HappyPet backend is a RESTful API built using Node.js, Express, and MongoDB to power a full-stack Pet Adoption Platform.


Live URL=>  https://server-tau-wheat-35.vercel.app

 Features: 
1. Full CRUD operations for pet listings (Create, Read, Update, Delete)
2. Secure JWT authentication using HTTP authorization headers
3. Adoption request management system (approve/reject workflow)
4. Protected API routes for secure operations
5. Connects with the database precisely and passes the information

Organized MongoDB collections for pets and adoption requests


NPM Packages Used=>


express – Backend framework for building REST APIs
mongodb – Database driver for MongoDB
cors  – Enables cross-origin resource sharing
dotenv  – Environment variable management
jose-cjs – JWT verification and authentication handling


Database Structure
Collections Used:
pets → Stores all pet listings
adoptions → Stores adoption requests and status tracking
