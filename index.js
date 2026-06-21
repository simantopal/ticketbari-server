const express = require('express');
const cors = require('cors');
const app = express()
require('dotenv').config()
const port = 5000

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.get('/', (req, res) => {
  res.send('Hello World!')
})


const uri = process.env.MONGO_DB_URI;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("ticket-bari");
    const ticketCollection = database.collection("tickets");
    const userCollection = database.collection("user");
    const bookingCollection = database.collection("bookings");


    // GET user
    app.get("/api/users/:id", async (req, res) => {
      try {
        const user = await userCollection.findOne({
          _id: new ObjectId(req.params.id),
        });
        res.send(user);
      } catch (e) {
        res.status(500).send({ message: e.message });
      }
    });

    // UPDATE user
    app.put("/api/users/:id", async (req, res) => {
      try {
        const { name, image } = req.body;

        const result = await userCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { name, image, updatedAt: new Date() } }
        );

        res.send(result);
      } catch (e) {
        res.status(500).send({ message: e.message });
      }
    });


    app.get('/api/tickets', async (req, res) => {
      const query = {};
      if (req.query.vendorEmail) {
        query.vendorEmail = req.query.vendorEmail;
      }
      if (req.query.status) {
        query.status = req.query.status;
      }
      const cursor = ticketCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    })


    app.get("/api/advertisements", async (req, res) => {
      const tickets = await ticketCollection
        .find({
          // status: "approved",
          // isAdvertised: true,
        })
        .limit(6)
        .toArray();

      res.send(tickets);
    });

    app.get("/api/latest-tickets", async (req, res) => {
      try {
        const tickets = await ticketCollection
          .find({
            // status: "approved" 
          })
          .sort({ createdAt: -1 })
          .limit(8)
          .toArray();

        res.send(tickets);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });


    // Get Single Ticket
    app.get("/api/tickets/:id", async (req, res) => {
      const id = req.params.id;

      const result = await ticketCollection.findOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    // Add Ticket
    app.post("/api/tickets", async (req, res) => {
      const ticket = req.body;

      const result = await ticketCollection.insertOne({
        ...ticket,
        status: "pending",
        createdAt: new Date(),
      });

      res.send(result);
    });

    app.put("/api/tickets/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await ticketCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              ...req.body,
              status: "pending",
              updatedAt: new Date(),
            },
          }
        );

        res.send(result);
      } catch (e) {
        res.status(500).send({ message: e.message });
      }
    });

    // Delete Ticket
    app.delete("/api/tickets/:id", async (req, res) => {
      const id = req.params.id;

      const result = await ticketCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });


    // booking related api
    app.post("/api/bookings", async (req, res) => {
      const bookingData = req.body;

      const result = await bookingCollection.insertOne({
        ...bookingData,
        createdAt: new Date(),
      });

      res.send({
        success: true,
        insertedId: result.insertedId,
      });
    });

    app.get("/api/bookings", async (req, res) => {
      const result = await bookingCollection.find().toArray();
      res.send(result);
    });

    app.patch("/api/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body; // "accepted" or "rejected"

      if (!["accepted", "rejected"].includes(status)) {
        return res.status(400).send({ success: false, message: "Invalid status" });
      }

      const result = await bookingCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );

      res.send({
        success: true,
        updated: result.modifiedCount,
      });
    });








    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);





app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})