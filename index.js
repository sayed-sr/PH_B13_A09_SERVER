// ======================
// Optional DNS Fix (commented)
// ======================
// const dns = require("node:dns");
// dns.setServers(["8.8.8.8", "8.8.4.4"]);

// ======================
// Core Imports
// ======================
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ======================
// MongoDB Setup
// ======================
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// ======================
// JWT Setup
// ======================
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
);

// ======================
// Auth Middleware
// ======================
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Forbidden" });
  }
};

// ======================
// Helper
// ======================
const isOwner = (pet, userEmail) => {
  return pet.ownerEmail === userEmail;
};

// ======================
// Main Function
// ======================
async function run() {
  try {
    await client.connect();

    const db = client.db("happypet");

    const petCollection = db.collection("pets");
    const adoptionCollection = db.collection("adoptions");

    // ======================
    // FEATURED PETS
    // ======================
    app.get("/featured", async (req, res) => {
      const result = await petCollection.find().limit(6).toArray();
      res.json(result);
    });

    // ======================
    // GET ALL PETS (SEARCH + FILTER + PAGINATION)
    // ======================
    app.get("/pets", async (req, res) => {
      const { page = 1, limit = 10, search = "", category } = req.query;

      const query = {};

      if (search) {
        query.$or = [
          { petName: { $regex: search, $options: "i" } },
          { breed: { $regex: search, $options: "i" } },
        ];
      }

      if (category) {
        query.category = category;
      }

      const skip = (page - 1) * limit;

      const pets = await petCollection
        .find(query)
        .skip(skip)
        .limit(parseInt(limit))
        .toArray();

      const total = await petCollection.countDocuments(query);

      res.json({
        success: true,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / limit),
        data: pets,
      });
    });

    // ======================
    // GET SINGLE PET
    // ======================
    app.get("/pets/:id", async (req, res) => {
      const result = await petCollection.findOne({
        _id: new ObjectId(req.params.id),
      });

      res.json(result);
    });

    // ======================
    // ADD PET (PRIVATE)
    // ======================
   app.post("/pets", verifyToken, async (req, res) => {
  try {
    const pet = req.body;

    // ✅ Validation (VERY IMPORTANT)
    if (!pet.petName || !pet.category || !pet.ownerEmail) {
      return res.status(400).json({
        message: "Missing required pet fields",
      });
    }

    // ✅ Normalize data
    const newPet = {
      ...pet,
      age: Number(pet.age),
      adoptionFee: Number(pet.adoptionFee),
      status: pet.status || "available",
      createdAt: new Date(),
    };

    const result = await petCollection.insertOne(newPet);

    return res.status(201).json({
      success: true,
      insertedId: result.insertedId,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error while adding pet",
    });
  }
});
    // ======================
    // UPDATE PET (OWNER ONLY)
    // ======================
    app.patch("/pets/:id", verifyToken, async (req, res) => {
      const petId = req.params.id;

      const pet = await petCollection.findOne({
        _id: new ObjectId(petId),
      });

      if (!pet) {
        return res.status(404).json({ message: "Pet not found" });
      }

      if (!isOwner(pet, req.user.email)) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const result = await petCollection.updateOne(
        { _id: new ObjectId(petId) },
        { $set: req.body }
      );

      res.json(result);
    });

    // ======================
    // DELETE PET (OWNER ONLY)
    // ======================
    app.delete("/pets/:id", verifyToken, async (req, res) => {
      const petId = req.params.id;

      const pet = await petCollection.findOne({
        _id: new ObjectId(petId),
      });

      if (!pet) {
        return res.status(404).json({ message: "Pet not found" });
      }

      if (!isOwner(pet, req.user.email)) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const result = await petCollection.deleteOne({
        _id: new ObjectId(petId),
      });

      res.json(result);
    });

    // ======================
    // ADOPTION REQUEST (SAFE)
    // ======================
    app.post("/adoption", verifyToken, async (req, res) => {
      const pet = await petCollection.findOne({
        _id: new ObjectId(req.body.petId),
      });

      if (!pet) {
        return res.status(404).json({ message: "Pet not found" });
      }

      if (pet.status === "adopted") {
        return res.status(400).json({
          message: "Pet already adopted",
        });
      }

      if (pet.ownerEmail === req.user.email) {
        return res.status(403).json({
          message: "Owner cannot adopt own pet",
        });
      }

      const result = await adoptionCollection.insertOne(req.body);
      res.json(result);
    });

    // ======================
    // GET ADOPTIONS
    // ======================
    app.get("/adoption", verifyToken, async (req, res) => {
      const { petId, email } = req.query;

      const query = {};

      if (petId) query.petId = petId;
      if (email) query.userEmail = email;

      const result = await adoptionCollection.find(query).toArray();
      res.json(result);
    });

    // ======================
    // DELETE ADOPTION
    // ======================
    app.delete("/adoption/:id", verifyToken, async (req, res) => {
      const result = await adoptionCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });

      res.json(result);
    });

    // ======================
    // APPROVE / REJECT ADOPTION
    // ======================
    app.patch("/adoption/:id", verifyToken, async (req, res) => {
      const { status } = req.body;

      const request = await adoptionCollection.findOne({
        _id: new ObjectId(req.params.id),
      });

      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      if (status === "approved") {
        const already = await adoptionCollection.findOne({
          petId: request.petId,
          status: "approved",
        });

        if (already) {
          return res.status(400).json({
            message: "This pet is already adopted",
          });
        }

        await petCollection.updateOne(
          { _id: new ObjectId(request.petId) },
          { $set: { status: "adopted" } }
        );

        await adoptionCollection.updateMany(
          {
            petId: request.petId,
            _id: { $ne: new ObjectId(req.params.id) },
          },
          { $set: { status: "rejected" } }
        );
      }

      const result = await adoptionCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { status } }
      );

      res.json(result);
    });

    // ======================
    // MY PETS
    // ======================
    app.get("/my-pets/:email", verifyToken, async (req, res) => {
      const result = await petCollection
        .find({ ownerEmail: req.params.email })
        .toArray();

      res.json(result);
    });

    // ======================
    // STATS
    // ======================
    app.get("/my-pets-stats/:email", verifyToken, async (req, res) => {
      const pets = await petCollection
        .find({ ownerEmail: req.params.email })
        .toArray();

      const total = pets.length;
      const adopted = pets.filter((p) => p.status === "adopted").length;

      res.json({
        total,
        adopted,
        available: total - adopted,
      });
    });

    // ======================
    // 404
    // ======================
    app.use((req, res) => {
      res.status(404).json({ message: "Route not found" });
    });

    console.log("MongoDB connected successfully");
  } finally {
    // keep alive
  }
}

run().catch(console.dir);

// ======================
// SERVER START
// ======================
app.get("/", (req, res) => {
  res.send("Server is running fine");
});

module.exports = app;