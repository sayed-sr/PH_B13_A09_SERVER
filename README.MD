 Project Name=> HappyPet (Backend Server)

Purpose :

The HappyPet backend is a RESTful API built using Node.js, Express, and MongoDB to power a full-stack Pet Adoption Platform.


Live URL=>  https://server-tau-wheat-35.vercel.app

 Features: 
Full CRUD operations for pet listings (Create, Read, Update, Delete)
Secure JWT authentication using HTTP authorization headers
Adoption request management system (approve/reject workflow)
Protected API routes for secure operations


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
