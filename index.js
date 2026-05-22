const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());


// MongoDB Setup

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {



    version: ServerApiVersion.v1,
   strict: true,


       deprecationErrors: true,
  },
});

let db;
async function getDb() {
  if (!db) {

await client.connect();

    db = client.db("happypet");
  }
return db;

}

// JWT Setup

let JWKS;
function getJWKS() {


  if (!JWKS) {
    JWKS = createRemoteJWKSet(
 new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)


    );
  }
  return JWKS;
}





// Auth Middleware



const verifyToken = async (req, res, next) => {

  const authHeader = req.headers.authorization;
if (!authHeader) return res.status(401).json({ message: "Unauthorized" });
  const token = authHeader.split(" ")[1];
  
  
  try {
    const { payload } = await jwtVerify(token, getJWKS());
    req.user = payload;


 next();
  } catch (err) {


    return res.status(403).json({ message: "Forbidden" });
  }
};

const isOwner = (pet, userEmail) => pet.ownerEmail === userEmail;


// ROOT

app.get("/", (req, res) => {
  res.send("Server is running fine");

});


// FEATURED PETS

app.get("/featured", async (req, res) => {
  const db = await getDb();


  const result = await db.collection("pets").find().limit(6).toArray();
res.json(result);
});




// GET ALL PETS

app.get("/pets", async (req, res) => {
  const db = await getDb();

  
  const { page = 1, limit = 10, search = "", category } = req.query;
  const query = {};


  if (search) {
  query.$or = [
  { petName: { $regex: search, $options: "i" } },
      
  { breed: { $regex: search, $options: "i" } },
    ];
  }
  if (category) query.category = category;
  const skip = (page - 1) * limit;


 const pets = await db.collection("pets").find(query).skip(skip).limit(parseInt(limit)).toArray();
  const total = await db.collection("pets").countDocuments(query);




  res.json({ success: true, total, page: Number(page), totalPages: Math.ceil(total / limit), data: pets });
});


// GET SINGLE PET

app.get("/pets/:id", async (req, res) => {
const db = await getDb();



  const result = await db.collection("pets").findOne({ _id: new ObjectId(req.params.id) });


  res.json(result);
});

// ADD PET

app.post("/pets", verifyToken, async (req, res) => {
  try {
    const db = await getDb();



    const pet = req.body;
if (!pet.petName || !pet.category || !pet.ownerEmail) {

      return res.status(400).json({ message: "Missing required pet fields" });
    }
    const newPet = {
      ...pet,
      age: Number(pet.age),


      adoptionFee: Number(pet.adoptionFee),
  status: pet.status || "available",
      createdAt: new Date(),
    };
    const result = await db.collection("pets").insertOne(newPet);


  return res.status(201).json({ success: true, insertedId: result.insertedId });
  } catch (error) {


 return res.status(500).json({ message: "Server error while adding pet" });
  }
});


// UPDATE PET

app.patch("/pets/:id", verifyToken, async (req, res) => {
  const db = await getDb();

  const pet = await db.collection("pets").findOne({ _id: new ObjectId(req.params.id) });
if (!pet) return res.status(404).json({ message: "Pet not found" });
  
if (!isOwner(pet, req.user.email)) return res.status(403).json({ message: "Not authorized" });
const result = await db.collection("pets").updateOne(
    { _id: new ObjectId(req.params.id) },
  
  
  
  
    { $set: req.body }
  );
  res.json(result);
});


// DELETE PET



app.delete("/pets/:id", verifyToken, async (req, res) => {
  const db = await getDb();


  
  const pet = await db.collection("pets").findOne({ _id: new ObjectId(req.params.id) });
if (!pet) return res.status(404).json({ message: "Pet not found" });
  

if (!isOwner(pet, req.user.email)) return res.status(403).json({ message: "Not authorized" });
  

const result = await db.collection("pets").deleteOne({ _id: new ObjectId(req.params.id) });


  res.json(result);
});


// ADOPTION REQUEST

app.post("/adoption", verifyToken, async (req, res) => {


  const db = await getDb();
 
 
 const pet = await db.collection("pets").findOne({ _id: new ObjectId(req.body.petId) });
  
 if (!pet) return res.status(404).json({ message: "Pet not found" });


 if (pet.status === "adopted") return res.status(400).json({ message: "Pet already adopted" });
  
 
 if (pet.ownerEmail === req.user.email) return res.status(403).json({ message: "Owner cannot adopt own pet" });
const result = await db.collection("adoptions").insertOne(req.body);


  res.json(result);
});


// GET ADOPTIONS

app.get("/adoption", verifyToken, async (req, res) => {
  const db = await getDb();


const { petId, email } = req.query;
  const query = {};
if (petId) query.petId = petId;


  if (email) query.userEmail = email;
const result = await db.collection("adoptions").find(query).toArray();
  res.json(result);
});


// DELETE ADOPTION

app.delete("/adoption/:id", verifyToken, async (req, res) => {
  const db = await getDb();



const result = await db.collection("adoptions").deleteOne({ _id: new ObjectId(req.params.id) });
  
  
  res.json(result);
});


// APPROVE / REJECT ADOPTION



app.patch("/adoption/:id", verifyToken, async (req, res) => {


  const db = await getDb();
  const { status } = req.body;


  const request = await db.collection("adoptions").findOne({ _id: new ObjectId(req.params.id) });
  
  
  if (!request) return res.status(404).json({ message: "Request not found" });
  if (status === "approved") {
 const already = await db.collection("adoptions").findOne({ petId: request.petId, status: "approved" });
   
 
 
 if (already) return res.status(400).json({ message: "This pet is already adopted" });
    await db.collection("pets").updateOne(
  { _id: new ObjectId(request.petId) },
     
     
      { $set: { status: "adopted" } }
    );
  await db.collection("adoptions").updateMany(
                 { petId: request.petId, _id: { $ne: new ObjectId(req.params.id) } },
      
                 { $set: { status: "rejected" } }
    );
  }
  const result = await db.collection("adoptions").updateOne(
   
   
  { _id: new ObjectId(req.params.id) },
    { $set: { status } }
  );
  res.json(result);



});


// MY PETS



app.get("/my-pets/:email", verifyToken, async (req, res) => {
const db = await getDb();
  


const result = await db.collection("pets").find({ ownerEmail: req.params.email }).toArray();
  res.json(result);
});


// STATS

app.get("/my-pets-stats/:email", verifyToken, async (req, res) => {
const db = await getDb();



  const pets = await db.collection("pets").find({ ownerEmail: req.params.email }).toArray();
 
 
  const total = pets.length;
  const adopted = pets.filter((p) => p.status === "adopted").length;


  res.json({ total, adopted, available: total - adopted });
});


// 404

app.use((req, res) => {


res.status(404).json({ message: "Route not found" });
});



module.exports = app;