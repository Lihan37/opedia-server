const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const path = require("path");

// Middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.static("public"));

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.g9xsrko.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server
    await client.connect();

    const usersCollection = client.db("blogsDB").collection("users");
    const blogsCollection = client.db("blogsDB").collection("blogs");

    // GET all users
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // POST a new user
    app.post("/users", async (req, res) => {
      try {
        const { name, email, password } = req.body;
        const newUser = { name, email, password };

        // Insert the new user
        await usersCollection.insertOne(newUser);

        res.status(201).json(newUser);
      } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ error: "Failed to create user" });
      }
    });

    // POST a new blog
    app.post("/blogs", async (req, res) => {
      try {
        const { title, content, authorEmail, thumbnail } = req.body;
        const newBlog = {
          title,
          content,
          authorEmail,
          thumbnail,
        };

        // Insert the new blog
        const result = await blogsCollection.insertOne(newBlog);
        newBlog._id = result.insertedId; // Assign the inserted ID to the new blog

        res.status(201).json(newBlog);
      } catch (error) {
        console.error("Error creating blog:", error);
        res.status(500).json({ error: "Failed to create blog" });
      }
    });

    app.get("/blogs", async (req, res) => {
      const result = await blogsCollection.find().toArray();
      res.send(result);
    });

    // Implement the DELETE endpoint
    app.delete("/blogs/:id", async (req, res) => {
      try {
        const id = req.params.id;
        await blogsCollection.deleteOne({ _id: new ObjectId(id) }); 
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting blog:", error);
        res.status(500).json({ error: "Failed to delete blog" });
      }
    });

    // Implement the PUT endpoint for editing blogs
    app.put("/blogs/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { title, content } = req.body;
        await blogsCollection.updateOne(
          { _id: id },
          { $set: { title, content } }
        );
        res.status(200).send();
      } catch (error) {
        console.error("Error editing blog:", error);
        res.status(500).json({ error: "Failed to edit blog" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensure that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(port, () => {
  console.log(`Opedia Blogs server is sitting on port ${port}`);
});
