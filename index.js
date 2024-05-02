const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const sanitizeHtml = require("sanitize-html");

// Middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "https://opedia-blogs-eanur.netlify.app"],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.static("public"));

// Rate Limiting Middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.g9xsrko.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const usersCollection = client.db("blogsDB").collection("users");
    const blogsCollection = client.db("blogsDB").collection("blogs");
    const commentsCollection = client.db("blogsDB").collection("comments");

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // Users Endpoints
    app.get("/users", verifyToken, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post(
      "/users",
      [
        body("name").notEmpty().trim().escape(),
        body("email").isEmail().normalizeEmail(),
        body("password").notEmpty().trim().escape(),
        (req, res, next) => {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
          }
          next();
        },
      ],
      async (req, res) => {
        try {
          const { name, email, password } = req.body;
          const newUser = { name, email, password };
          await usersCollection.insertOne(newUser);
          res.status(201).json(newUser);
        } catch (error) {
          console.error("Error creating user:", error);
          res.status(500).json({ error: "Failed to create user" });
        }
      }
    );

    // Blogs Endpoints
    app.post("/blogs", async (req, res) => {
      try {
        const { title, content, authorEmail, thumbnail } = req.body;
        const newBlog = {
          title: sanitizeHtml(title),
          content: sanitizeHtml(content),
          authorEmail,
          thumbnail,
        };

        const result = await blogsCollection.insertOne(newBlog);
        newBlog._id = result.insertedId;
        res.status(201).json(newBlog);
      } catch (error) {
        console.error("Error creating blog:", error);
        res.status(500).json({ error: "Failed to create blog" });
      }
    });

    app.get("/blogs", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = 2;
      const skip = (page - 1) * limit;

      try {
        const totalBlogs = await blogsCollection.countDocuments();
        const totalPages = Math.ceil(totalBlogs / limit);
        const result = await blogsCollection
          .find()
          .skip(skip)
          .limit(limit)
          .toArray();
        res.send({ blogs: result, totalPages });
      } catch (error) {
        console.error("Error fetching blogs:", error);
        res.status(500).json({ error: "Failed to fetch blogs" });
      }
    });

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

    app.put("/blogs/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { title, content } = req.body;
        await blogsCollection.updateOne(
          { _id: id },
          {
            $set: {
              title: sanitizeHtml(title),
              content: sanitizeHtml(content),
            },
          }
        );
        res.status(200).send();
      } catch (error) {
        console.error("Error editing blog:", error);
        res.status(500).json({ error: "Failed to edit blog" });
      }
    });

    // Comments Endpoints

    app.get("/comments", async (req, res) => {
      const result = await commentsCollection.find().toArray();
      res.send(result);
    });

    app.post("/blogs/:id/comments", verifyToken, async (req, res) => {
      try {
        const { content } = req.body;
        const { id } = req.params;
        const { email } = req.decoded; // Extract email from decoded token
    
        // Create the comment with the extracted email
        const comment = {
          content: sanitizeHtml(content),
          blogId: id,
          authorEmail: email, // Use extracted email as authorEmail
          createdAt: new Date(),
        };
    
        // Insert the comment into the database
        const result = await commentsCollection.insertOne(comment);
        comment._id = result.insertedId;
        res.status(201).json(comment);
      } catch (error) {
        console.error("Error creating comment:", error);
        res.status(500).json({ error: "Failed to create comment" });
      }
    });

    app.get("/blogs/:id/comments", async (req, res) => {
      try {
        const { id } = req.params;
        const comments = await commentsCollection
          .find({ blogId: id })
          .toArray();
        res.json(comments);
      } catch (error) {
        console.error("Error fetching comments:", error);
        res.status(500).json({ error: "Failed to fetch comments" });
      }
    });

    app.put("/comments/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        const { content } = req.body;
        await commentsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { content: sanitizeHtml(content) } }
        );
        res.status(200).send();
      } catch (error) {
        console.error("Error editing comment:", error);
        res.status(500).json({ error: "Failed to edit comment" });
      }
    });

    app.delete("/comments/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        await commentsCollection.deleteOne({ _id: new ObjectId(id) });
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting comment:", error);
        res.status(500).json({ error: "Failed to delete comment" });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
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
